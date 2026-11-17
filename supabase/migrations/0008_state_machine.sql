-- Phase 1 step 4 (masterplan §9): controlled issue state machine, enforced in the database.
-- Every status change goes through transition_issue(); direct UPDATEs of status (and of the workflow columns)
-- are refused by a trigger for everyone, including the service role. The transition table below is mirrored in
-- src/lib/transitions.ts; tests/db/transitions.test.ts fails if the two ever differ.
-- Requires 0005-0007. Safe for the deployed app: the compatibility view `cases` is rewired to call transition_issue().
--
-- Error codes raised (SQLSTATE): JK001 invalid transition, JK002 missing/invalid field (DETAIL = field name),
-- JK003 rule not satisfied (review period, reopen window), JK404 issue not found or not visible, 42501 forbidden.

-- Workflow columns ---------------------------------------------------------------------------------------
alter table issues add column if not exists resolution_note text;
alter table issues add column if not exists status_reason text;
alter table issues add column if not exists appeal_route text;

-- Configurable policy (§9: do not hard-code). Values are defaults for the pilot; offices/admin change them. ----
insert into app_settings (key, value, description) values
  ('citizen_review_period_days', '7', 'Days a resolved issue stays open for citizen review before it can close without a reason'),
  ('reopen_window_days', '30', 'Days after resolution/closure in which the reporter can reopen an issue'),
  ('resolution_evidence_required', 'false', 'Require attached evidence (issue_media) before an issue can be resolved')
on conflict (key) do nothing;

create or replace function app_setting_int(k text, d integer) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::integer from app_settings where key = k), d) $$;

-- Office action for rejecting / marking duplicate / out of jurisdiction / office-initiated reopen.
insert into office_permissions (office_role, action, assigned_only) values ('office_manager', 'decide', false)
on conflict (office_role, action) do nothing;

-- The transition table -------------------------------------------------------------------------------------
create table if not exists issue_transitions (
  from_status issue_status not null,
  to_status issue_status not null,
  actor_kind text not null check (actor_kind in ('office','owner','system')),
  office_action text,
  required text[] not null default '{}',
  primary key (from_status, to_status, actor_kind),
  check ((actor_kind = 'office') = (office_action is not null))
);
alter table issue_transitions enable row level security;
drop policy if exists "read transitions" on issue_transitions;
create policy "read transitions" on issue_transitions for select using (true);
grant select on issue_transitions to anon, authenticated;
-- Reference data: read-only for every API role. Also keep future tables from inheriting delete/truncate for signed-in users.
revoke insert, update, delete, truncate, references, trigger on issue_transitions from anon, authenticated;
alter default privileges in schema public revoke delete, truncate, references, trigger on tables from authenticated;

-- required tokens: message, reason, resolution_note, appeal_route, assignee, master_issue, destination
-- (agency_id or agency_name), forwarding_details (contact_channel or external_reference), responsible_party
-- (an assignee, an existing referral, or an assignee/destination supplied now).
delete from issue_transitions;
insert into issue_transitions (from_status, to_status, actor_kind, office_action, required)
select f, 'under_review'::issue_status, 'office', 'update', '{}'::text[] from unnest(array['submitted','needs_information','reopened']::issue_status[]) f
union all select 'needs_information', 'under_review', 'owner', null, array['message']
union all select f, 'acknowledged', 'office', 'acknowledge', '{}' from unnest(array['submitted','under_review','needs_information','reopened']::issue_status[]) f
union all select f, 'assigned', 'office', 'assign', array['assignee'] from unnest(array['submitted','under_review','acknowledged','needs_information','referred_to_authority','reopened']::issue_status[]) f
union all select f, 'needs_information', 'office', 'request_information', array['message'] from unnest(array['submitted','under_review','acknowledged','assigned','referred_to_authority','in_progress','reopened']::issue_status[]) f
union all select f, 'referred_to_authority', 'office', 'forward', array['destination','forwarding_details'] from unnest(array['submitted','under_review','acknowledged','assigned','in_progress','needs_information','out_of_jurisdiction','reopened']::issue_status[]) f
union all select f, 'in_progress', 'office', 'update', array['responsible_party'] from unnest(array['under_review','acknowledged','assigned','referred_to_authority','reopened']::issue_status[]) f
union all select f, 'resolved', 'office', 'resolve', array['resolution_note'] from unnest(array['under_review','acknowledged','assigned','referred_to_authority','in_progress','reopened']::issue_status[]) f
union all select 'resolved', 'closed', 'office', 'close', '{}'
union all select 'resolved', 'closed', 'system', null, '{}'
union all select 'needs_information', 'closed', 'office', 'close', array['reason']
union all select 'needs_information', 'closed', 'system', null, array['reason']
union all select f, 'rejected', 'office', 'decide', array['reason','appeal_route'] from unnest(array['submitted','under_review','acknowledged','assigned','needs_information','reopened']::issue_status[]) f
union all select f, 'duplicate', 'office', 'decide', array['master_issue'] from unnest(array['submitted','under_review','acknowledged','assigned','needs_information','reopened']::issue_status[]) f
union all select f, 'out_of_jurisdiction', 'office', 'decide', array['reason'] from unnest(array['submitted','under_review','acknowledged','assigned','needs_information','reopened']::issue_status[]) f
union all select f, 'reopened', 'office', 'decide', array['reason'] from unnest(array['resolved','closed','rejected','duplicate','out_of_jurisdiction']::issue_status[]) f
union all select f, 'reopened', 'owner', null, array['reason'] from unnest(array['resolved','closed','rejected']::issue_status[]) f;

-- Helpers ---------------------------------------------------------------------------------------------------------
create or replace function jf(f jsonb, k text) returns text language sql immutable as $$ select nullif(btrim(f ->> k), '') $$;

-- Is the caller the trusted server (service role, or a direct database connection)? Anon/authenticated JWTs are not.
create or replace function is_system_caller() returns boolean language sql stable as $$
  select auth.role() = 'service_role' or (auth.role() is null and auth.uid() is null) $$;

-- May this user be assigned issues of constituency c?
create or replace function is_assignable(u uuid, c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from office_members m join profiles p on p.id = m.user_id
                  where m.user_id = u and m.constituency_id = c and m.status = 'active'
                    and m.office_role in ('case_officer','office_manager','agency_liaison')
                    and p.role = 'staff' and p.account_status = 'active') $$;

-- Guard: status and workflow columns change only inside transition_issue() / assign_issue() ------------------
create or replace function issues_workflow_guard() returns trigger language plpgsql as $$
declare in_tx boolean := coalesce(current_setting('app.in_transition', true), '') = 'on';
begin
  if new.status is distinct from old.status and not in_tx then
    raise exception 'status changes must go through transition_issue()' using errcode = '42501';
  end if;
  if not in_tx and auth.uid() is not null and
     (new.assigned_to, new.master_issue_id, new.resolution_note, new.status_reason, new.appeal_route, new.resolved_at, new.closed_at)
     is distinct from
     (old.assigned_to, old.master_issue_id, old.resolution_note, old.status_reason, old.appeal_route, old.resolved_at, old.closed_at) then
    raise exception 'workflow fields change only through the issue actions' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists issues_workflow_guard_trg on issues;
create trigger issues_workflow_guard_trg before update on issues for each row execute function issues_workflow_guard();

-- The transition_issue event is richer than the generic status-change trigger; avoid double events.
create or replace function log_issue_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into issue_events (issue_id, event_type, to_status, actor_id) values (new.id, 'submitted', new.status, auth.uid());
  elsif new.status is distinct from old.status and coalesce(current_setting('app.in_transition', true), '') <> 'on' then
    insert into issue_events (issue_id, event_type, from_status, to_status, actor_id) values (new.id, 'status_change', old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

-- transition_issue ----------------------------------------------------------------------------------------------------
create or replace function transition_issue(p_issue uuid, p_to issue_status, p_fields jsonb default '{}'::jsonb, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v issues%rowtype;
  v_uid uuid := auth.uid();
  v_system boolean := is_system_caller();
  t issue_transitions%rowtype;
  v_known boolean := false; v_ok boolean := false;
  v_req text;
  v_assignee uuid; v_master issues%rowtype; v_agency agencies%rowtype; v_agency_id uuid;
  v_prev issue_status; v_prev_closed timestamptz; v_prev_master uuid;
  v_public text; v_days integer; v_elapsed boolean;
begin
  p_fields := coalesce(p_fields, '{}'::jsonb);
  select * into v from issues where id = p_issue for update;
  if not found or not (v_system or v.reporter_id = v_uid or office_can(v.constituency_id, 'view', v.assigned_to)) then
    raise exception 'issue not found' using errcode = 'JK404';
  end if;

  for t in select * from issue_transitions where from_status = v.status and to_status = p_to loop
    v_known := true;
    if v_system
       or (t.actor_kind = 'office' and office_can(v.constituency_id, t.office_action, v.assigned_to))
       or (t.actor_kind = 'owner' and v_uid is not null and v.reporter_id = v_uid) then
      v_ok := true; exit;
    end if;
  end loop;
  if not v_known then
    raise exception 'invalid transition % -> %', v.status, p_to using errcode = 'JK001', detail = v.status || '>' || p_to;
  end if;
  if not v_ok then
    raise exception 'not allowed to move this issue from % to %', v.status, p_to using errcode = '42501';
  end if;

  -- Required fields
  foreach v_req in array t.required loop
    if (v_req = 'destination' and jf(p_fields, 'agency_id') is null and jf(p_fields, 'agency_name') is null)
       or (v_req = 'forwarding_details' and jf(p_fields, 'contact_channel') is null and jf(p_fields, 'external_reference') is null)
       or (v_req = 'responsible_party' and v.assigned_to is null and jf(p_fields, 'assignee') is null
           and jf(p_fields, 'agency_id') is null and jf(p_fields, 'agency_name') is null
           and not exists (select 1 from issue_agency_referrals where issue_id = v.id))
       or (v_req in ('message','reason','resolution_note','appeal_route','assignee','master_issue') and jf(p_fields, v_req) is null) then
      raise exception 'missing required field: %', v_req using errcode = 'JK002', detail = v_req;
    end if;
  end loop;

  -- Field validation
  if jf(p_fields, 'assignee') is not null and p_to in ('assigned','in_progress') then
    v_assignee := try_uuid(jf(p_fields, 'assignee'));
    if v_assignee is null or not is_assignable(v_assignee, v.constituency_id) then
      raise exception 'assignee is not an active member of this office' using errcode = 'JK002', detail = 'assignee';
    end if;
  end if;
  if p_to = 'duplicate' then
    select * into v_master from issues where id = try_uuid(jf(p_fields, 'master_issue'));
    if not found or v_master.id = v.id or v_master.constituency_id is distinct from v.constituency_id or v_master.status = 'duplicate'
       or exists (select 1 from issues where master_issue_id = v.id) then
      raise exception 'master issue must be another non-duplicate issue of the same office, and this issue must not already be a master' using errcode = 'JK002', detail = 'master_issue';
    end if;
  end if;
  if jf(p_fields, 'agency_id') is not null then
    select * into v_agency from agencies where id = try_uuid(jf(p_fields, 'agency_id'));
    if not found then raise exception 'unknown agency' using errcode = 'JK002', detail = 'agency_id'; end if;
    v_agency_id := v_agency.id;
  end if;
  if p_to = 'resolved' and app_setting_bool('resolution_evidence_required')
     and not exists (select 1 from issue_media where issue_id = v.id) and jf(p_fields, 'evidence_url') is null then
    raise exception 'evidence is required before resolving' using errcode = 'JK002', detail = 'evidence';
  end if;
  if v.status = 'resolved' and p_to = 'closed' then
    v_days := app_setting_int('citizen_review_period_days', 7);
    v_elapsed := v.resolved_at is not null and now() >= v.resolved_at + make_interval(days => v_days);
    if not v_elapsed and v_system then
      raise exception 'the citizen review period is still running' using errcode = 'JK003', detail = 'review_period_active';
    elsif not v_elapsed and jf(p_fields, 'reason') is null then
      raise exception 'closing during the citizen review period requires a reason' using errcode = 'JK002', detail = 'reason';
    end if;
  end if;
  if p_to = 'reopened' and v.status in ('resolved','closed') and v_uid is not null and v.reporter_id = v_uid and not v_system then
    v_days := app_setting_int('reopen_window_days', 30);
    if coalesce(v.closed_at, v.resolved_at) is not null and now() > coalesce(v.closed_at, v.resolved_at) + make_interval(days => v_days) then
      raise exception 'the reopen window has passed; use an appeal or contact the office' using errcode = 'JK003', detail = 'reopen_window_expired';
    end if;
  end if;

  -- Apply
  perform set_config('app.in_transition', 'on', true);
  v_prev := v.status; v_prev_closed := v.closed_at; v_prev_master := v.master_issue_id;
  update issues set
    status = p_to,
    assigned_to = case when p_to in ('assigned','in_progress') and v_assignee is not null then v_assignee else assigned_to end,
    master_issue_id = case when p_to = 'duplicate' then v_master.id when p_to = 'reopened' then null else master_issue_id end,
    resolution_note = case when p_to = 'resolved' then jf(p_fields, 'resolution_note') else resolution_note end,
    appeal_route = case when p_to = 'rejected' then jf(p_fields, 'appeal_route') else appeal_route end,
    status_reason = coalesce(jf(p_fields, 'reason'), case when p_to = 'reopened' then null else status_reason end),
    resolved_at = case when p_to = 'resolved' then now() when p_to = 'reopened' then null else resolved_at end,
    closed_at = case when p_to = 'closed' then now() when p_to = 'reopened' then null else closed_at end
  where id = v.id returning * into v;

  if p_to in ('assigned','in_progress') and v_assignee is not null then
    update issue_assignments set unassigned_at = now() where issue_id = v.id and unassigned_at is null;
    insert into issue_assignments (issue_id, assigned_to, assigned_by, reason) values (v.id, v_assignee, v_uid, jf(p_fields, 'reason'));
  end if;
  if p_to = 'referred_to_authority' or (p_to = 'in_progress' and (v_agency_id is not null or jf(p_fields, 'agency_name') is not null)) then
    insert into issue_agency_referrals (issue_id, agency_id, agency_name, agency_contact_or_channel, external_reference, forwarded_by, notes)
    values (v.id, v_agency_id, coalesce(jf(p_fields, 'agency_name'), v_agency.name_bn), jf(p_fields, 'contact_channel'), jf(p_fields, 'external_reference'), v_uid, jf(p_fields, 'internal_note'));
  end if;

  -- Citizen-facing text is explicit: a message, or the reason/notes the rules require to be shared with the citizen.
  v_public := coalesce(jf(p_fields, 'message'),
    case p_to when 'rejected' then jf(p_fields, 'reason') when 'out_of_jurisdiction' then jf(p_fields, 'reason')
              when 'resolved' then jf(p_fields, 'resolution_note') else null end);
  insert into issue_events (issue_id, actor_id, event_type, from_status, to_status, public_message, internal_note, metadata, is_public)
  values (v.id, v_uid, 'status_change', v_prev, p_to, v_public, jf(p_fields, 'internal_note'),
    jsonb_strip_nulls(jsonb_build_object('reason', jf(p_fields, 'reason'), 'request_id', p_request_id, 'assignee', v_assignee,
      'master_issue', v_master.id, 'previous_master', v_prev_master, 'previous_closed_at', v_prev_closed, 'agency_id', v_agency_id,
      'system', v_system and v_uid is null)), true);
  perform set_config('app.in_transition', '', true);
  return jsonb_build_object('id', v.id, 'ref', v.ref, 'status', v.status);
end $$;
revoke all on function transition_issue(uuid, issue_status, jsonb, text) from public, anon;
grant execute on function transition_issue(uuid, issue_status, jsonb, text) to authenticated, service_role;

-- assign_issue: change the assignee without changing status ------------------------------------------------------
create or replace function assign_issue(p_issue uuid, p_assignee uuid, p_reason text default null, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v issues%rowtype; v_uid uuid := auth.uid(); v_system boolean := is_system_caller();
begin
  select * into v from issues where id = p_issue for update;
  if not found or not (v_system or office_can(v.constituency_id, 'view', v.assigned_to)) then
    raise exception 'issue not found' using errcode = 'JK404';
  end if;
  if not (v_system or office_can(v.constituency_id, 'assign', v.assigned_to)) then
    raise exception 'not allowed to assign this issue' using errcode = '42501';
  end if;
  if v.status in ('closed','rejected','duplicate','out_of_jurisdiction') then
    raise exception 'cannot assign an issue in status %', v.status using errcode = 'JK001', detail = v.status::text;
  end if;
  if p_assignee is null or not is_assignable(p_assignee, v.constituency_id) then
    raise exception 'assignee is not an active member of this office' using errcode = 'JK002', detail = 'assignee';
  end if;
  perform set_config('app.in_transition', 'on', true);
  update issues set assigned_to = p_assignee where id = v.id;
  update issue_assignments set unassigned_at = now() where issue_id = v.id and unassigned_at is null;
  insert into issue_assignments (issue_id, assigned_to, assigned_by, reason) values (v.id, p_assignee, v_uid, nullif(btrim(p_reason), ''));
  insert into issue_events (issue_id, actor_id, event_type, from_status, to_status, metadata, is_public)
  values (v.id, v_uid, 'assigned', v.status, v.status, jsonb_strip_nulls(jsonb_build_object('assignee', p_assignee, 'previous', v.assigned_to, 'request_id', p_request_id)), false);
  perform set_config('app.in_transition', '', true);
  return jsonb_build_object('id', v.id, 'ref', v.ref, 'status', v.status, 'assigned_to', p_assignee);
end $$;
revoke all on function assign_issue(uuid, uuid, text, text) from public, anon;
grant execute on function assign_issue(uuid, uuid, text, text) to authenticated, service_role;

-- Legacy compatibility view: the deployed app's status writes now go through transition_issue(). -------------------
-- A refusal because of permissions reports 0 rows (as RLS did); a rule violation raises the error.
create or replace function cases_compat_write() returns trigger language plpgsql as $$
declare n integer; v_to issue_status; v_fields jsonb := '{}'; v_agency agencies%rowtype;
begin
  if tg_op = 'INSERT' then
    insert into issues (reporter_id, title, category, description, area, constituency_key, ai_summary, ai_agency, ai_confidence, ai_similar, is_demo)
    values (new.reporter_id, new.title, new.category, new.description, new.area, new.constituency_key, new.ai_summary, new.ai_agency, new.ai_confidence, coalesce(new.ai_similar, '{}'), coalesce(new.is_demo, false))
    returning id, ref, created_at into new.id, new.ref, new.created_at;
    new.status = 'received';
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      v_to := legacy_to_issue_status(new.status);
      if v_to = 'referred_to_authority' then
        -- The old UI's "refer" means: send to the agency the routing suggested and the staff member approved.
        select a.* into v_agency from issues i join agencies a on a.id = i.agency_id where i.id = old.id;
        if found then
          v_fields := jsonb_build_object('agency_id', v_agency.id, 'agency_name', v_agency.name_bn, 'contact_channel', coalesce(v_agency.url, v_agency.source));
        end if;
      end if;
      begin
        perform transition_issue(old.id, v_to, v_fields);
      exception when insufficient_privilege or sqlstate 'JK404' then
        return null;
      end;
    end if;
    return new;
  else
    delete from issues where id = old.id;
    get diagnostics n = row_count;
    if n = 0 then return null; end if;
    return old;
  end if;
end $$;
