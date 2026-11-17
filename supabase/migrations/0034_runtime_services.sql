-- Phase 5 (B5.8; masterplan §10.1, §11, §20): runtime services.
--   * background_jobs: one queue for notifications, media processing, AI tasks and ingestion, with retry (exponential backoff) and a dead-letter state.
--   * Realtime: ONLY a user's own notifications and the office inbox counts are published. Row-level security applies to Realtime too.
--   * product_events: privacy-conscious analytics: a daily counter per event name and language. No user id, no IP, no cookie, no URL.
-- Requires 0030-0033. Safe to run twice.

-- Jobs ----------------------------------------------------------------------------------------------------------------------------------
create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('notify_deliver','media_scan','ai_task','ingest','poll_maintenance','purge')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  dedupe_key text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists background_jobs_due_idx on background_jobs (run_at) where status in ('queued','failed');
create unique index if not exists background_jobs_dedupe_uq on background_jobs (dedupe_key) where dedupe_key is not null and status in ('queued','running','failed');
alter table background_jobs enable row level security;
drop policy if exists background_jobs_select on background_jobs;
create policy background_jobs_select on background_jobs for select using (is_admin());
revoke all on background_jobs from anon, authenticated;
grant select on background_jobs to authenticated;

create or replace function enqueue_job(p_kind text, p_payload jsonb default '{}', p_run_at timestamptz default now(), p_dedupe text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  insert into background_jobs (kind, payload, run_at, dedupe_key) values (p_kind, coalesce(p_payload, '{}'), coalesce(p_run_at, now()), p_dedupe) on conflict do nothing returning background_jobs.id into id;
  return id;
end $$;

-- Takes up to p_limit due jobs. A job still "running" after 10 minutes is treated as abandoned and taken again.
create or replace function claim_jobs(p_limit integer, p_worker text) returns setof background_jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select j.id from background_jobs j
     where (j.status in ('queued','failed') and j.run_at <= now()) or (j.status = 'running' and j.locked_at < now() - interval '10 minutes')
     order by j.run_at limit least(greatest(p_limit, 1), 50) for update skip locked)
  update background_jobs j set status = 'running', attempts = j.attempts + 1, locked_at = now(), locked_by = left(p_worker, 60)
    from due where j.id = due.id returning j.*;
end $$;

-- Success -> done. Failure -> retry with backoff (30 s * 2^attempts, at most 1 h), or dead after max_attempts (the dead-letter state).
create or replace function finish_job(p_id uuid, p_ok boolean, p_error text default null) returns text
language plpgsql security definer set search_path = public as $$
declare j background_jobs%rowtype; st text;
begin
  select * into j from background_jobs where id = p_id for update;
  if not found then return null; end if;
  if p_ok then st := 'done';
  elsif j.attempts >= j.max_attempts then st := 'dead';
  else st := 'failed'; end if;
  update background_jobs set status = st, last_error = case when p_ok then null else left(p_error, 500) end, locked_at = null, locked_by = null,
    finished_at = case when st in ('done','dead') then now() end, run_at = case when st = 'failed' then now() + least(interval '1 hour', interval '30 seconds' * power(2, j.attempts)) else run_at end where id = p_id;
  return st;
end $$;

create or replace function requeue_job(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  update background_jobs set status = 'queued', attempts = 0, run_at = now(), last_error = null, finished_at = null where id = p_id and status in ('dead','failed');
  if not found then raise exception 'job not found' using errcode = 'JK404'; end if;
  perform audit_write('job.requeue', 'background_job', p_id::text, jsonb_build_object('status', 'dead'), jsonb_build_object('status', 'queued'));
  return jsonb_build_object('id', p_id, 'status', 'queued');
end $$;

-- The periodic work, enqueued at most once per hour and per day.
create or replace function ensure_periodic_jobs() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if enqueue_job('poll_maintenance', '{}', now(), 'poll:' || to_char(now(), 'YYYYMMDDHH24')) is not null then n := n + 1; end if;
  if enqueue_job('purge', '{}', now(), 'purge:' || to_char(now(), 'YYYYMMDD')) is not null then n := n + 1; end if;
  if enqueue_job('notify_deliver', '{}', now(), 'deliver:' || to_char(now(), 'YYYYMMDDHH24MI')) is not null then n := n + 1; end if;
  return n;
end $$;
revoke all on function enqueue_job(text, jsonb, timestamptz, text), claim_jobs(integer, text), finish_job(uuid, boolean, text), ensure_periodic_jobs() from public, anon, authenticated;
grant execute on function enqueue_job(text, jsonb, timestamptz, text), claim_jobs(integer, text), finish_job(uuid, boolean, text), ensure_periodic_jobs() to service_role;
revoke all on function requeue_job(uuid) from public, anon;
grant execute on function requeue_job(uuid) to authenticated;

-- Office inbox counts (Realtime) -------------------------------------------------------------------------------------------------------------
create table if not exists office_inbox_counts (
  constituency_id uuid primary key references constituencies on delete cascade,
  open_count integer not null default 0,
  unassigned_count integer not null default 0,
  awaiting_ack_count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table office_inbox_counts enable row level security;
drop policy if exists office_inbox_counts_select on office_inbox_counts;
-- 'acknowledge' is the managers' action: case officers see only their own assigned issues, so they get no area-wide count.
create policy office_inbox_counts_select on office_inbox_counts for select using (office_can(constituency_id, 'acknowledge', null) or office_can(constituency_id, 'view_analytics', null) or is_admin());
revoke all on office_inbox_counts from anon, authenticated;
grant select on office_inbox_counts to authenticated;

create or replace function refresh_inbox_count(c uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if c is null then return; end if;
  insert into office_inbox_counts (constituency_id, open_count, unassigned_count, awaiting_ack_count, updated_at)
  select c, count(*) filter (where status not in ('resolved','closed','rejected','duplicate','out_of_jurisdiction')),
            count(*) filter (where status not in ('resolved','closed','rejected','duplicate','out_of_jurisdiction') and assigned_to is null),
            count(*) filter (where status in ('submitted','under_review','reopened')), now()
    from issues where constituency_id = c
  on conflict (constituency_id) do update set open_count = excluded.open_count, unassigned_count = excluded.unassigned_count, awaiting_ack_count = excluded.awaiting_ack_count, updated_at = now();
end $$;
revoke all on function refresh_inbox_count(uuid) from public, anon, authenticated;

create or replace function trg_inbox_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then perform refresh_inbox_count(new.constituency_id);
  elsif new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to or new.constituency_id is distinct from old.constituency_id then
    perform refresh_inbox_count(new.constituency_id);
    if old.constituency_id is distinct from new.constituency_id then perform refresh_inbox_count(old.constituency_id); end if;
  end if;
  return new;
end $$;
drop trigger if exists inbox_count_trg on issues;
create trigger inbox_count_trg after insert or update of status, assigned_to, constituency_id on issues for each row execute function trg_inbox_count();
select refresh_inbox_count(id) from constituencies;

-- Realtime publication: nothing else is published. -------------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table office_inbox_counts; exception when duplicate_object then null; end;
  end if;
end $$;

-- Product analytics ---------------------------------------------------------------------------------------------------------------------------
create table if not exists product_events (
  day date not null default current_date,
  name text not null check (name in ('report_started','report_submitted','idea_posted','poll_voted','question_asked','search_used','offline_report_queued','install_prompt_shown','voice_used','language_switched')),
  lang text not null default 'bn' check (lang in ('bn','en')),
  count bigint not null default 0,
  primary key (day, name, lang)
);
alter table product_events enable row level security;
drop policy if exists product_events_select on product_events;
create policy product_events_select on product_events for select using (is_admin());
revoke all on product_events from anon, authenticated;
grant select on product_events to authenticated;

-- Anyone may count an event. Nothing identifying is stored or accepted: no user, no address, no device, no page URL.
create or replace function track_product_event(p_name text, p_lang text default 'bn') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_name not in ('report_started','report_submitted','idea_posted','poll_voted','question_asked','search_used','offline_report_queued','install_prompt_shown','voice_used','language_switched') then return; end if;
  insert into product_events (day, name, lang, count) values (current_date, p_name, case when p_lang = 'en' then 'en' else 'bn' end, 1)
  on conflict (day, name, lang) do update set count = product_events.count + 1;
end $$;
revoke all on function track_product_event(text, text) from public;
grant execute on function track_product_event(text, text) to anon, authenticated, service_role;
