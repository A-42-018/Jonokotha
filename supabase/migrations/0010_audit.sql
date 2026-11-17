-- Phase 1 step 6 (masterplan §18): immutable audit trail.
--   * audit_logs and issue_events are append-only: UPDATE and TRUNCATE are refused for everyone, DELETE is refused
--     too (issue_events rows may only disappear together with their issue). Corrections are new rows.
--   * Triggers write audit_logs for every privileged change, so no code path (API, server job, SQL editor,
--     service role) can skip it: issue lifecycle, office memberships, platform roles, settings, permission matrix.
--   * record_admin_access(): admins reading private records leave a trace (masterplan §5.6).
-- The request id reaches the database in the x-jk-request-id header that the API forwards to PostgREST.
-- Requires 0005-0009.

-- Columns ----------------------------------------------------------------------------------------------------
alter table audit_logs add column if not exists actor_role text;
alter table audit_logs add column if not exists actor_kind text not null default 'user' check (actor_kind in ('user','system'));
alter table audit_logs add column if not exists metadata jsonb not null default '{}';
alter table audit_logs add column if not exists retention_until timestamptz;
-- Wall-clock time per row (not transaction start), so several entries written in one transaction keep their order.
alter table audit_logs alter column created_at set default clock_timestamp();
create index if not exists audit_logs_request_idx on audit_logs (request_id) where request_id is not null;
create index if not exists audit_logs_action_idx on audit_logs (action, created_at desc);

-- Request id: the API forwards its x-request-id as x-jk-request-id; server scripts can set app.request_id. -----------
create or replace function current_request_id() returns text language sql stable as $$
  select r from (select coalesce(nullif(current_setting('app.request_id', true), ''),
                                 nullif((nullif(current_setting('request.headers', true), '')::jsonb) ->> 'x-jk-request-id', '')) as r) s
  where r ~ '^[A-Za-z0-9._-]{8,64}$' $$;

-- The only writer of audit_logs. Not callable by API roles: triggers and SECURITY DEFINER functions use it. ---------
create or replace function audit_write(p_action text, p_type text, p_id text, p_before jsonb, p_after jsonb, p_meta jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  insert into audit_logs (actor_id, actor_role, actor_kind, action, resource_type, resource_id, before_data, after_data, request_id, metadata)
  values (uid, case when uid is null then null else (select role from profiles where id = uid) end,
          case when uid is null then 'system' else 'user' end,
          p_action, p_type, p_id, p_before, p_after, current_request_id(), coalesce(p_meta, '{}'));
end $$;
revoke all on function audit_write(text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- Immutability ---------------------------------------------------------------------------------------------------
create or replace function audit_block() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only; add a new row instead', tg_table_name using errcode = '23000';
end $$;

drop trigger if exists audit_logs_no_update on audit_logs;
create trigger audit_logs_no_update before update on audit_logs for each row execute function audit_block();
drop trigger if exists audit_logs_no_delete on audit_logs;
create trigger audit_logs_no_delete before delete on audit_logs for each row execute function audit_block();
drop trigger if exists audit_logs_no_truncate on audit_logs;
create trigger audit_logs_no_truncate before truncate on audit_logs for each statement execute function audit_block();
revoke update, delete, truncate on audit_logs from service_role;
-- API roles can only read (admins, through RLS); nothing writes to the log except the audit functions above.
revoke insert, update, delete, truncate on audit_logs from anon, authenticated;

drop trigger if exists issue_events_no_update on issue_events;
create trigger issue_events_no_update before update on issue_events for each row execute function audit_block();
drop trigger if exists issue_events_no_truncate on issue_events;
create trigger issue_events_no_truncate before truncate on issue_events for each statement execute function audit_block();

-- An event may be deleted only as part of deleting its issue (the parent row is already gone when the cascade runs).
create or replace function issue_events_guard_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from issues where id = old.issue_id) then
    raise exception 'issue_events is append-only; add a new row instead' using errcode = '23000';
  end if;
  return old;
end $$;
drop trigger if exists issue_events_no_delete on issue_events;
create trigger issue_events_no_delete before delete on issue_events for each row execute function issue_events_guard_delete();

-- Issue lifecycle ------------------------------------------------------------------------------------------------------
-- Free-text content is never copied into the audit log; only the names of changed content columns are recorded.
create or replace function audit_issues() returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb; n jsonb; k text; b jsonb := '{}'; a jsonb := '{}'; content text[] := '{}'; act text;
  skip constant text[] := array['updated_at','title','description','area','ai_summary','ai_similar','ai_confidence'];
begin
  if tg_op = 'INSERT' then
    perform audit_write('issue.create', 'issue', new.id::text, null,
      jsonb_build_object('ref', new.ref, 'status', new.status, 'constituency_id', new.constituency_id, 'category', new.category, 'reporter_id', new.reporter_id));
    return new;
  elsif tg_op = 'DELETE' then
    perform audit_write('issue.delete', 'issue', old.id::text,
      jsonb_build_object('ref', old.ref, 'status', old.status, 'constituency_id', old.constituency_id, 'reporter_id', old.reporter_id), null);
    return old;
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  for k in select key from jsonb_each(n) where o -> key is distinct from n -> key loop
    if k = any (skip) then
      if k not in ('updated_at') then content := content || k; end if;
    else
      b := b || jsonb_build_object(k, o -> k); a := a || jsonb_build_object(k, n -> k);
    end if;
  end loop;
  if b = '{}' and cardinality(content) = 0 then return new; end if;
  act := case when new.status is distinct from old.status then 'issue.status_change'
              when new.assigned_to is distinct from old.assigned_to then 'issue.assign' else 'issue.update' end;
  perform audit_write(act, 'issue', new.id::text, b, a || jsonb_build_object('ref', new.ref),
    case when cardinality(content) > 0 then jsonb_build_object('content_columns_changed', to_jsonb(content)) else '{}' end);
  return new;
end $$;
drop trigger if exists audit_issues_trg on issues;
create trigger audit_issues_trg after insert or update or delete on issues for each row execute function audit_issues();

create or replace function audit_issue_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Status changes and assignments are audited from the issues row; notes only exist as events.
  if new.event_type = 'note' then
    perform audit_write('issue.note', 'issue', new.issue_id::text, null, jsonb_build_object('event_id', new.id, 'is_public', new.is_public, 'status', new.to_status));
  end if;
  return new;
end $$;
drop trigger if exists audit_issue_events_trg on issue_events;
create trigger audit_issue_events_trg after insert on issue_events for each row execute function audit_issue_event();

create or replace function audit_referral() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform audit_write('issue.referral', 'issue', new.issue_id::text, null,
    jsonb_build_object('referral_id', new.id, 'agency_id', new.agency_id, 'agency_name', new.agency_name, 'external_reference', new.external_reference, 'visibility', new.visibility));
  return new;
end $$;
drop trigger if exists audit_referrals_trg on issue_agency_referrals;
create trigger audit_referrals_trg after insert on issue_agency_referrals for each row execute function audit_referral();

-- Roles, memberships, configuration -----------------------------------------------------------------------------------------
-- TG_ARGV: resource type, id column(s) joined with |, audited columns.
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare
  t_type text := tg_argv[0]; cols text[] := string_to_array(tg_argv[2], ',');
  o jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  b jsonb; a jsonb; rid text;
begin
  select coalesce(jsonb_object_agg(key, value), '{}') into b from jsonb_each(coalesce(o, '{}')) where key = any (cols);
  select coalesce(jsonb_object_agg(key, value), '{}') into a from jsonb_each(coalesce(n, '{}')) where key = any (cols);
  if tg_op = 'UPDATE' and a = b then return new; end if;
  select string_agg(coalesce((coalesce(n, o)) ->> k, ''), ':') into rid from unnest(string_to_array(tg_argv[1], '|')) k;
  perform audit_write(t_type || '.' || lower(tg_op), t_type, rid, case when o is null then null else b end, case when n is null then null else a end);
  return coalesce(new, old);
end $$;

drop trigger if exists audit_office_members_trg on office_members;
create trigger audit_office_members_trg after insert or update or delete on office_members
  for each row execute function audit_row('office_member', 'id', 'user_id,constituency_id,office_role,status,representative_id,invited_by');
drop trigger if exists audit_profile_role_trg on profiles;
create trigger audit_profile_role_trg after update of role, account_status on profiles
  for each row execute function audit_row('profile', 'id', 'role,account_status');
drop trigger if exists audit_app_settings_trg on app_settings;
create trigger audit_app_settings_trg after insert or update or delete on app_settings
  for each row execute function audit_row('setting', 'key', 'key,value');
drop trigger if exists audit_office_permissions_trg on office_permissions;
create trigger audit_office_permissions_trg after insert or update or delete on office_permissions
  for each row execute function audit_row('permission', 'office_role|action', 'office_role,action,assigned_only');
drop trigger if exists audit_issue_transitions_trg on issue_transitions;
create trigger audit_issue_transitions_trg after insert or update or delete on issue_transitions
  for each row execute function audit_row('transition_rule', 'from_status|to_status|actor_kind', 'from_status,to_status,actor_kind,office_action,required');

-- Administrators reading private records (§5.6) ------------------------------------------------------------------------------
create or replace function record_admin_access(p_resource_type text, p_resource_id text default null, p_meta jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_resource_type !~ '^[a-z_]{1,40}$' then raise exception 'invalid resource type' using errcode = '22023'; end if;
  perform audit_write('admin.access', p_resource_type, left(p_resource_id, 80), null, null, coalesce(p_meta, '{}'));
end $$;
revoke all on function record_admin_access(text, text, jsonb) from public, anon;
grant execute on function record_admin_access(text, text, jsonb) to authenticated;
