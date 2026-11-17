-- Phase 1 step 7 (masterplan §9.1): SLA configuration as data, never as hard-coded promises.
--   * sla_policies: acknowledgement and update targets per constituency and/or category. Most specific policy wins:
--     (constituency + category) > constituency > category > global default. Targets are "office response targets".
--   * issue_sla: one row per issue with its current due times, set when the issue is submitted.
--   * issue_sla_pauses: timers pause with a recorded reason while waiting for the citizen (needs_information) or an
--     agency (referred_to_authority). When a pause ends, the due times move by the paused time. Pauses are visible.
--   * issue_sla_state(): on_track / due_soon / overdue / paused / met, for the office. Citizens and the public only
--     ever see the configured target (hours) and the pause reason, never a guarantee.
-- Requires 0004-0010. Safe to run twice.

create table if not exists sla_policies (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid references constituencies on delete cascade,
  category_id uuid references issue_categories on delete cascade,
  ack_target_hours integer not null check (ack_target_hours between 1 and 24 * 30),
  update_target_hours integer not null check (update_target_hours between 1 and 24 * 90),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sla_policies_scope_uq
  on sla_policies ((coalesce(constituency_id, '00000000-0000-0000-0000-000000000000')),
                   (coalesce(category_id, '00000000-0000-0000-0000-000000000000'))) where is_active;

-- Pilot default, editable by admin. These are targets, not promises (§9.1).
insert into sla_policies (ack_target_hours, update_target_hours, note)
select 72, 168, 'Pilot default response target; offices and admin may change it'
where not exists (select 1 from sla_policies where constituency_id is null and category_id is null and is_active);

create table if not exists issue_sla (
  issue_id uuid primary key references issues on delete cascade,
  policy_id uuid references sla_policies on delete set null,
  ack_target_hours integer not null,
  update_target_hours integer not null,
  ack_due_at timestamptz not null,
  acknowledged_at timestamptz,
  update_due_at timestamptz not null,
  last_update_at timestamptz not null default now()
);

create table if not exists issue_sla_pauses (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues on delete cascade,
  kind text not null check (kind in ('waiting_citizen','waiting_agency')),
  reason text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create unique index if not exists issue_sla_one_open_pause on issue_sla_pauses (issue_id) where ended_at is null;
create index if not exists issue_sla_pauses_issue_idx on issue_sla_pauses (issue_id, started_at);

alter table sla_policies enable row level security;
alter table issue_sla enable row level security;
alter table issue_sla_pauses enable row level security;

-- Policy lookup --------------------------------------------------------------------------------------------
create or replace function sla_policy_for(c uuid, cat uuid) returns sla_policies
language sql stable security definer set search_path = public as $$
  select p.* from sla_policies p
  where p.is_active
    and (p.constituency_id is null or p.constituency_id = c)
    and (p.category_id is null or p.category_id = cat)
  order by (p.constituency_id is not null)::int * 2 + (p.category_id is not null)::int desc, p.created_at desc
  limit 1 $$;

-- Timers follow the status ---------------------------------------------------------------------------------
create or replace function issue_sla_track() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p sla_policies;
  s issue_sla;
  open_pause issue_sla_pauses;
  shift interval;
  pause_kind text;
begin
  if tg_op = 'INSERT' then
    p := sla_policy_for(new.constituency_id, new.category_id);
    if p.id is null then return new; end if;
    insert into issue_sla (issue_id, policy_id, ack_target_hours, update_target_hours, ack_due_at, update_due_at, last_update_at)
    values (new.id, p.id, p.ack_target_hours, p.update_target_hours,
            new.submitted_at + make_interval(hours => p.ack_target_hours),
            new.submitted_at + make_interval(hours => p.update_target_hours), new.submitted_at)
    on conflict (issue_id) do nothing;
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;
  select * into s from issue_sla where issue_id = new.id;
  if s.issue_id is null then return new; end if;

  -- End an open pause: the due times move by the time spent waiting.
  select * into open_pause from issue_sla_pauses where issue_id = new.id and ended_at is null;
  if open_pause.id is not null then
    shift := clock_timestamp() - open_pause.started_at;
    update issue_sla_pauses set ended_at = clock_timestamp() where id = open_pause.id;
    update issue_sla set ack_due_at = ack_due_at + shift, update_due_at = update_due_at + shift where issue_id = new.id;
  end if;

  -- First acknowledgement (or any move past "submitted"/"under_review" that implies the office has seen it).
  if s.acknowledged_at is null and new.status not in ('submitted','under_review') then
    update issue_sla set acknowledged_at = clock_timestamp() where issue_id = new.id;
  end if;

  -- Every status change counts as an update and restarts the update clock.
  update issue_sla set last_update_at = clock_timestamp(),
         update_due_at = clock_timestamp() + make_interval(hours => update_target_hours)
   where issue_id = new.id;

  -- Start a pause with a visible reason.
  pause_kind := case new.status when 'needs_information' then 'waiting_citizen' when 'referred_to_authority' then 'waiting_agency' end;
  if pause_kind is not null then
    insert into issue_sla_pauses (issue_id, kind, reason)
    values (new.id, pause_kind, case pause_kind
      when 'waiting_citizen' then 'Waiting for more information from the reporter'
      else 'Waiting for the responsible agency' end);
  end if;
  return new;
end $$;

drop trigger if exists issue_sla_trg on issues;
create trigger issue_sla_trg after insert or update on issues for each row execute function issue_sla_track();

-- Backfill timers for issues that already exist (targets run from submission, not from today).
insert into issue_sla (issue_id, policy_id, ack_target_hours, update_target_hours, ack_due_at, update_due_at, last_update_at)
select i.id, p.id, p.ack_target_hours, p.update_target_hours,
       i.submitted_at + make_interval(hours => p.ack_target_hours),
       i.submitted_at + make_interval(hours => p.update_target_hours), i.submitted_at
from issues i
cross join lateral sla_policy_for(i.constituency_id, i.category_id) p
where p.id is not null and not exists (select 1 from issue_sla s where s.issue_id = i.id);

-- State for the office ---------------------------------------------------------------------------------------
-- met      : acknowledged on or before its target, and the issue is resolved/closed or otherwise settled
-- paused   : an open pause exists (reason returned)
-- overdue  : a due time has passed
-- due_soon : a due time is within 20% of its target window
create or replace function issue_sla_state(p_issue uuid) returns table (
  state text, next_due_at timestamptz, due_kind text, pause_kind text, pause_reason text,
  ack_target_hours integer, update_target_hours integer
) language plpgsql stable security definer set search_path = public as $$
declare
  s issue_sla; i issues; pz issue_sla_pauses; due timestamptz; kind text; win interval;
begin
  select * into i from issues where id = p_issue;
  if i.id is null or not (can_view_issue(p_issue) or is_admin()) then return; end if;
  select * into s from issue_sla where issue_id = p_issue;
  if s.issue_id is null then return; end if;
  select * into pz from issue_sla_pauses where issue_id = p_issue and ended_at is null;

  if i.status in ('resolved','closed','rejected','duplicate','out_of_jurisdiction') then
    return query select 'met'::text, null::timestamptz, null::text, null::text, null::text, s.ack_target_hours, s.update_target_hours;
    return;
  end if;
  if pz.id is not null then
    return query select 'paused'::text, null::timestamptz, null::text, pz.kind, pz.reason, s.ack_target_hours, s.update_target_hours;
    return;
  end if;
  if s.acknowledged_at is null then
    due := s.ack_due_at; kind := 'acknowledgement'; win := make_interval(hours => s.ack_target_hours);
  else
    due := s.update_due_at; kind := 'update'; win := make_interval(hours => s.update_target_hours);
  end if;
  return query select
    case when now() > due then 'overdue' when now() > due - win * 0.2 then 'due_soon' else 'on_track' end,
    due, kind, null::text, null::text, s.ack_target_hours, s.update_target_hours;
end $$;

-- Access -----------------------------------------------------------------------------------------------------
-- Office staff see timers for issues in scope; the reporter sees their own issue's targets and pauses;
-- only admin (or an office manager for their constituency) edits policies. All changes are audited by the
-- audit trigger below.
-- Policies are never deleted (history stays in the audit log): set is_active = false instead.
drop policy if exists sla_policies_select on sla_policies;
create policy sla_policies_select on sla_policies for select to authenticated using (true);
drop policy if exists sla_policies_insert on sla_policies;
create policy sla_policies_insert on sla_policies for insert to authenticated
  with check (is_admin() or (constituency_id is not null and office_can(constituency_id, 'decide', null)));
drop policy if exists sla_policies_update on sla_policies;
create policy sla_policies_update on sla_policies for update to authenticated
  using (is_admin() or (constituency_id is not null and office_can(constituency_id, 'decide', null)))
  with check (is_admin() or (constituency_id is not null and office_can(constituency_id, 'decide', null)));
drop policy if exists sla_policies_write on sla_policies;

drop policy if exists issue_sla_select on issue_sla;
create policy issue_sla_select on issue_sla for select using (
  exists (select 1 from issues i where i.id = issue_id and (i.reporter_id = auth.uid() or can_view_issue(i.id))));
drop policy if exists issue_sla_pauses_select on issue_sla_pauses;
create policy issue_sla_pauses_select on issue_sla_pauses for select using (
  exists (select 1 from issues i where i.id = issue_id and (i.reporter_id = auth.uid() or can_view_issue(i.id))));

-- Timers and pauses are written only by the trigger above (security definer), never by clients.
revoke insert, update, delete on issue_sla, issue_sla_pauses from anon, authenticated;
revoke all on sla_policies from anon, authenticated;
grant select, insert, update on sla_policies to authenticated;
grant select on issue_sla, issue_sla_pauses to authenticated;
revoke execute on function issue_sla_state(uuid) from anon;
grant execute on function issue_sla_state(uuid) to authenticated, service_role;

-- Policy changes are audited (who changed which target, before and after).
create or replace function audit_sla_policies() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform audit_write('sla_policy.' || lower(tg_op), 'sla_policy', coalesce(new.id, old.id)::text,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end, case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;
drop trigger if exists audit_sla_policies_trg on sla_policies;
create trigger audit_sla_policies_trg after insert or update or delete on sla_policies for each row execute function audit_sla_policies();
