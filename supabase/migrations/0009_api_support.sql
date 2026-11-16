-- Phase 1 step 5 (masterplan §13): database support for the v1 API.
--   * issue_feedback: the reporter rates a resolved issue (§13.3 POST /issues/{id}/feedback)
--   * idempotency_keys + idempotency_begin/finish/release: safe retries of POSTs (Idempotency-Key header, §13.10)
--   * rate_limits + consume_rate_limit: per-signed-in-user limits shared across server instances
--   * add_issue_note(): progress notes without a status change (office "update")
-- Requires 0005-0008.

-- Feedback -----------------------------------------------------------------------------------------------------
create or replace function issue_status_in(i uuid, s issue_status[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from issues where id = i and status = any (s)) $$;

create table if not exists issue_feedback (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  retention_until timestamptz,
  unique (issue_id, user_id)
);
create index if not exists issue_feedback_issue_idx on issue_feedback (issue_id);
alter table issue_feedback enable row level security;
-- The reporter rates once, after the issue is resolved or closed; the office reads feedback for issues in scope.
drop policy if exists issue_feedback_select on issue_feedback;
create policy issue_feedback_select on issue_feedback for select using (user_id = auth.uid() or can_view_issue(issue_id));
drop policy if exists issue_feedback_insert on issue_feedback;
create policy issue_feedback_insert on issue_feedback for insert
  with check (user_id = auth.uid() and is_issue_owner(issue_id) and issue_status_in(issue_id, array['resolved','closed']::issue_status[]) and app_role() is not null);
revoke update on issue_feedback from authenticated;
revoke all on issue_feedback from anon;

-- Idempotency -------------------------------------------------------------------------------------------------------
create table if not exists idempotency_keys (
  user_id uuid not null references profiles on delete cascade,
  endpoint text not null,
  key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (user_id, endpoint, key)
);
create index if not exists idempotency_keys_expiry_idx on idempotency_keys (expires_at);
alter table idempotency_keys enable row level security;
revoke all on idempotency_keys from anon, authenticated;

-- Returns {state: new|replay|conflict|in_progress, status?, body?}. Identity is the session user, never a parameter.
create or replace function idempotency_begin(p_key text, p_endpoint text, p_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r idempotency_keys%rowtype; n integer;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_key !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'invalid idempotency key' using errcode = 'JK002', detail = 'Idempotency-Key'; end if;
  delete from idempotency_keys where user_id = uid and expires_at < now();
  insert into idempotency_keys (user_id, endpoint, key, request_hash) values (uid, p_endpoint, p_key, p_hash)
    on conflict do nothing;
  get diagnostics n = row_count;
  if n = 1 then return jsonb_build_object('state', 'new'); end if;
  select * into r from idempotency_keys where user_id = uid and endpoint = p_endpoint and key = p_key;
  if r.request_hash <> p_hash then return jsonb_build_object('state', 'conflict'); end if;
  if r.response_status is null then
    -- An earlier attempt that never finished (crashed worker): after 60 s the key may be claimed again.
    if r.created_at < now() - interval '60 seconds' then
      update idempotency_keys set created_at = now() where user_id = uid and endpoint = p_endpoint and key = p_key;
      return jsonb_build_object('state', 'new');
    end if;
    return jsonb_build_object('state', 'in_progress');
  end if;
  return jsonb_build_object('state', 'replay', 'status', r.response_status, 'body', r.response_body);
end $$;

create or replace function idempotency_finish(p_key text, p_endpoint text, p_status integer, p_body jsonb) returns void
language sql security definer set search_path = public as $$
  update idempotency_keys set response_status = p_status, response_body = p_body
   where user_id = auth.uid() and endpoint = p_endpoint and key = p_key $$;

create or replace function idempotency_release(p_key text, p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from idempotency_keys where user_id = auth.uid() and endpoint = p_endpoint and key = p_key and response_status is null $$;

revoke all on function idempotency_begin(text, text, text), idempotency_finish(text, text, integer, jsonb), idempotency_release(text, text) from public, anon;
grant execute on function idempotency_begin(text, text, text), idempotency_finish(text, text, integer, jsonb), idempotency_release(text, text) to authenticated;

-- Shared rate limits (signed-in users only; the key is the session user, so it cannot be spoofed) ----------------------
create table if not exists rate_limits (
  scope text not null,
  user_id uuid not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (scope, user_id, window_start)
);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create or replace function consume_rate_limit(p_scope text, p_limit integer, p_window_seconds integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ws timestamptz; n integer;
begin
  if uid is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_scope !~ '^[a-z0-9_.:-]{1,48}$' or p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 3600 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;
  ws := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits (scope, user_id, window_start, hits) values (p_scope, uid, ws, 1)
    on conflict (scope, user_id, window_start) do update set hits = rate_limits.hits + 1
    returning hits into n;
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '2 hours'; end if;
  return jsonb_build_object('allowed', n <= p_limit, 'retry_after', greatest(1, ceil(extract(epoch from ws + make_interval(secs => p_window_seconds) - now()))::int));
end $$;
revoke all on function consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function consume_rate_limit(text, integer, integer) to authenticated;

-- Progress notes (office "update" without a status change) ---------------------------------------------------------------
create or replace function add_issue_note(p_issue uuid, p_note text, p_public boolean default false, p_request_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v issues%rowtype; v_uid uuid := auth.uid(); v_system boolean := is_system_caller(); v_note text := nullif(btrim(p_note), ''); v_id uuid;
begin
  select * into v from issues where id = p_issue;
  if not found or not (v_system or office_can(v.constituency_id, 'view', v.assigned_to)) then
    raise exception 'issue not found' using errcode = 'JK404';
  end if;
  if not (v_system or office_can(v.constituency_id, 'update', v.assigned_to)) then
    raise exception 'not allowed to update this issue' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) > 1000 then
    raise exception 'note must be 1-1000 characters' using errcode = 'JK002', detail = 'note';
  end if;
  insert into issue_events (issue_id, actor_id, event_type, from_status, to_status, public_message, internal_note, metadata, is_public)
  values (v.id, v_uid, 'note', v.status, v.status, case when p_public then v_note end, case when not p_public then v_note end,
          jsonb_strip_nulls(jsonb_build_object('request_id', p_request_id)), coalesce(p_public, false))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ref', v.ref, 'status', v.status);
end $$;
revoke all on function add_issue_note(uuid, text, boolean, text) from public, anon;
grant execute on function add_issue_note(uuid, text, boolean, text) to authenticated, service_role;
