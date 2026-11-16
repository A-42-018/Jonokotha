-- Phase 5 (B5.1, B5.2, B5.4; masterplan §5.2, §5.5, §1, §28, §31 #18): MP approval and delegation, agency liaison, and the
-- difference between "received", "forwarded" and "officially registered". Requires 0004-0023. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 5 status):
--   * An area may require MP approval (constituencies.mp_approval_required). When it does AND an active MP exists, an office manager's
--     announcement, public reply or project change waits in approval_requests until the MP (or an admin) decides. The MP's own
--     actions and admin actions go straight through. Nothing about audit history or deleting reports changes: an MP holds no write
--     access to either (tests/rls/phase5.test.ts proves it).
--   * A liaison never reads issue_events (internal notes live there). They get a purpose-built function with a safe column list.
--   * "officially_registered" is impossible without a confirmed agency_integrations row AND a proof string.

-- Permissions -------------------------------------------------------------------------------------------------------------
-- Kept identical in src/lib/auth.ts (tests/db/roles.test.ts compares them).
insert into office_permissions (office_role, action, assigned_only) values
  ('mp', 'approve', false), ('mp', 'delegate', false), ('office_manager', 'delegate', false)
on conflict (office_role, action) do nothing;

alter table constituencies add column if not exists mp_approval_required boolean not null default false;

-- Does the caller's publishing action need an MP's approval in this area? -------------------------------------------------------
create or replace function approval_needed(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select mp_approval_required from constituencies where id = c), false)
     and not is_admin() and not office_can(c, 'approve', null)
     and exists (select 1 from office_members m join profiles p on p.id = m.user_id
                  where m.constituency_id = c and m.office_role = 'mp' and m.status = 'active' and p.account_status = 'active') $$;
revoke all on function approval_needed(uuid) from public, anon;
grant execute on function approval_needed(uuid) to authenticated;

create or replace function set_mp_approval_required(p_constituency text, p_required boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not (is_admin() or office_can(c.id, 'approve', null)) then raise exception 'area not found' using errcode = 'JK404'; end if;
  update constituencies set mp_approval_required = coalesce(p_required, false) where id = c.id;
  perform audit_write('constituency.mp_approval', 'constituency', c.key, jsonb_build_object('required', c.mp_approval_required), jsonb_build_object('required', coalesce(p_required, false)));
  return jsonb_build_object('constituency', c.key, 'mp_approval_required', coalesce(p_required, false));
end $$;

-- Approval requests -----------------------------------------------------------------------------------------------------------
create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies on delete cascade,
  target_type text not null check (target_type in ('announcement','public_reply','project_change')),
  target_ref text not null check (char_length(target_ref) between 3 and 80),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references profiles on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references profiles on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500)
);
create index if not exists approval_requests_scope_idx on approval_requests (constituency_id, status, requested_at desc);
alter table approval_requests enable row level security;
drop policy if exists approval_requests_select on approval_requests;
create policy approval_requests_select on approval_requests for select
  using (requested_by = auth.uid() or office_can(constituency_id, 'approve', null) or is_admin());
revoke all on approval_requests from anon, authenticated;
grant select on approval_requests to authenticated;

alter table announcements drop constraint if exists announcements_status_check;
alter table announcements add constraint announcements_status_check check (status in ('draft','pending_approval','published','withdrawn','hidden'));

-- Announcements: save and publish now respect the approval rule ------------------------------------------------------------------
create or replace function save_announcement(p_constituency text, p_title text, p_body text, p_publish boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v announcements%rowtype; st text; wait boolean;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(p_title)) not between 5 and 150 then raise exception 'title length' using errcode = 'JK002', detail = 'title'; end if;
  if char_length(btrim(p_body)) not between 10 and 3000 then raise exception 'body length' using errcode = 'JK002', detail = 'body'; end if;
  wait := p_publish and approval_needed(c.id);
  st := case when wait then 'pending_approval' when p_publish then 'published' else 'draft' end;
  insert into announcements (constituency_id, author_id, title, body, status, published_at, is_demo)
  values (c.id, auth.uid(), btrim(p_title), btrim(p_body), st, case when st = 'published' then now() end, c.is_demo) returning * into v;
  if wait then
    insert into approval_requests (constituency_id, target_type, target_ref, requested_by) values (c.id, 'announcement', v.ref, auth.uid());
  end if;
  perform audit_write('announcement.' || case when wait then 'request_approval' when p_publish then 'publish' else 'draft' end, 'announcement', v.ref, null, jsonb_build_object('status', v.status), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status, 'approval_required', wait);
end $$;

create or replace function set_announcement_status(p_ref text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v announcements%rowtype; wait boolean := false;
begin
  select * into v from announcements where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'announcement not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('published','withdrawn') or v.status in ('hidden') or (p_status = 'published' and v.status = 'withdrawn') then
    raise exception 'invalid status change' using errcode = 'JK001';
  end if;
  if p_status = 'published' and v.status = 'pending_approval' and approval_needed(v.constituency_id) then
    raise exception 'this announcement is waiting for the MP' using errcode = 'JK003', detail = 'approval_pending';
  end if;
  if p_status = 'published' and v.status = 'draft' and approval_needed(v.constituency_id) then
    wait := true;
    update announcements set status = 'pending_approval', updated_at = now() where id = v.id;
    insert into approval_requests (constituency_id, target_type, target_ref, requested_by) values (v.constituency_id, 'announcement', v.ref, auth.uid());
    perform audit_write('announcement.request_approval', 'announcement', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', 'pending_approval'));
    return jsonb_build_object('ref', v.ref, 'status', 'pending_approval', 'approval_required', true);
  end if;
  if p_status = 'withdrawn' and v.status = 'pending_approval' then
    update approval_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = 'withdrawn by the author'
     where target_type = 'announcement' and target_ref = v.ref and status = 'pending';
  end if;
  update announcements set status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = v.id;
  perform audit_write('announcement.' || p_status, 'announcement', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ref', v.ref, 'status', p_status, 'approval_required', wait);
end $$;

-- Project transparency fields (B5.5): where the budget figure came from and when it was checked, procurement details only where public
-- by law, and an explanation whenever the end date moves later.
alter table projects add column if not exists budget_source text check (budget_source is null or char_length(budget_source) <= 300);
alter table projects add column if not exists budget_verified_at date;
alter table projects add column if not exists procurement_ref text check (procurement_ref is null or char_length(procurement_ref) <= 120);
alter table projects add column if not exists contractor_name text check (contractor_name is null or char_length(contractor_name) <= 200);
alter table projects add column if not exists delay_explanation text check (delay_explanation is null or char_length(delay_explanation) <= 500);
create or replace function projects_delay_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.expected_end_date is not null and old.expected_end_date is not null and new.expected_end_date > old.expected_end_date
     and (new.delay_explanation is null or char_length(btrim(new.delay_explanation)) < 10 or new.delay_explanation is not distinct from old.delay_explanation) then
    raise exception 'moving the end date later needs a new explanation' using errcode = 'JK002', detail = 'delay_explanation';
  end if;
  return new;
end $$;
drop trigger if exists projects_delay_guard_trg on projects;
create trigger projects_delay_guard_trg before update on projects for each row execute function projects_delay_guard();

-- Project changes: the same rule -------------------------------------------------------------------------------------------------
drop function if exists update_project(text, text, date);
create or replace function update_project(p_ref text, p_status text, p_end date, p_delay text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v projects%rowtype;
begin
  v := project_for_edit(p_ref);
  if p_status is not null and p_status not in ('planned','in_progress','completed','paused','cancelled') then raise exception 'status' using errcode = 'JK002', detail = 'status'; end if;
  if p_end is not null and p_end > v.expected_end_date and char_length(btrim(coalesce(p_delay, ''))) < 10 then
    raise exception 'moving the end date later needs an explanation' using errcode = 'JK002', detail = 'delay_explanation';
  end if;
  if approval_needed(v.constituency_id) then
    if p_end is not null and v.start_date is not null and p_end < v.start_date then raise exception 'end before start' using errcode = 'JK002', detail = 'expected_end_date'; end if;
    insert into approval_requests (constituency_id, target_type, target_ref, payload, requested_by)
    values (v.constituency_id, 'project_change', v.ref, jsonb_strip_nulls(jsonb_build_object('status', p_status, 'expected_end_date', p_end, 'delay_explanation', nullif(btrim(coalesce(p_delay, '')), ''))), auth.uid());
    perform audit_write('project.request_approval', 'project', v.ref, null, jsonb_build_object('status', p_status));
    return jsonb_build_object('ref', v.ref, 'status', v.status, 'approval_required', true);
  end if;
  update projects set status = coalesce(p_status, status), expected_end_date = coalesce(p_end, expected_end_date),
    delay_explanation = coalesce(nullif(left(btrim(coalesce(p_delay, '')), 500), ''), delay_explanation), updated_at = now() where id = v.id;
  perform audit_write('project.update', 'project', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', coalesce(p_status, v.status)));
  return jsonb_build_object('ref', v.ref, 'status', coalesce(p_status, v.status), 'approval_required', false);
exception when check_violation then raise exception 'invalid project fields' using errcode = 'JK002', detail = 'expected_end_date';
end $$;

-- Public replies: a note the citizen sees. In approval areas, add_issue_note refuses public notes from non-approvers and
-- post_public_reply files the request instead. -------------------------------------------------------------------------------------
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
  if p_public and not v_system and approval_needed(v.constituency_id) then
    raise exception 'public replies in this area need the MP''s approval; use the public-reply endpoint' using errcode = 'JK003', detail = 'approval_required';
  end if;
  insert into issue_events (issue_id, actor_id, event_type, from_status, to_status, public_message, internal_note, metadata, is_public)
  values (v.id, v_uid, 'note', v.status, v.status, case when p_public then v_note end, case when not p_public then v_note end,
          jsonb_strip_nulls(jsonb_build_object('request_id', p_request_id)), coalesce(p_public, false))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'ref', v.ref, 'status', v.status);
end $$;
revoke all on function add_issue_note(uuid, text, boolean, text) from public, anon;
grant execute on function add_issue_note(uuid, text, boolean, text) to authenticated, service_role;

create or replace function post_public_reply(p_ref text, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v issues%rowtype; n text := nullif(btrim(p_note), '');
begin
  select * into v from issues where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', v.assigned_to) then raise exception 'issue not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'update', v.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
  if n is null or char_length(n) > 1000 then raise exception 'note' using errcode = 'JK002', detail = 'note'; end if;
  if approval_needed(v.constituency_id) then
    insert into approval_requests (constituency_id, target_type, target_ref, payload, requested_by)
    values (v.constituency_id, 'public_reply', v.ref, jsonb_build_object('note', n), auth.uid());
    perform audit_write('reply.request_approval', 'issue', v.ref, null, jsonb_build_object('length', char_length(n)));
    return jsonb_build_object('ref', v.ref, 'approval_required', true);
  end if;
  perform add_issue_note(v.id, n, true);
  return jsonb_build_object('ref', v.ref, 'approval_required', false);
end $$;

-- Decide -----------------------------------------------------------------------------------------------------------------------
create or replace function decide_approval(p_id uuid, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r approval_requests%rowtype; i issues%rowtype; a announcements%rowtype; pr projects%rowtype; ok boolean := (p_decision = 'approve');
begin
  select * into r from approval_requests where id = p_id for update;
  if not found or not (office_can(r.constituency_id, 'approve', null) or is_admin() or r.requested_by = auth.uid()) then raise exception 'request not found' using errcode = 'JK404'; end if;
  if not (office_can(r.constituency_id, 'approve', null) or is_admin()) then raise exception 'only the MP or an administrator can decide' using errcode = '42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if r.status <> 'pending' then raise exception 'already decided' using errcode = 'JK003', detail = 'decided'; end if;
  if not ok and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is required to reject' using errcode = 'JK002', detail = 'note'; end if;
  if ok then
    if r.target_type = 'announcement' then
      update announcements set status = 'published', published_at = coalesce(published_at, now()), updated_at = now() where ref = r.target_ref and status = 'pending_approval';
    elsif r.target_type = 'public_reply' then
      select * into i from issues where ref = r.target_ref;
      insert into issue_events (issue_id, actor_id, event_type, from_status, to_status, public_message, metadata, is_public)
      values (i.id, r.requested_by, 'note', i.status, i.status, r.payload ->> 'note', jsonb_build_object('approved_by', auth.uid()), true);
    elsif r.target_type = 'project_change' then
      select * into pr from projects where ref = r.target_ref;
      update projects set status = coalesce(r.payload ->> 'status', status), expected_end_date = coalesce((r.payload ->> 'expected_end_date')::date, expected_end_date),
        delay_explanation = coalesce(r.payload ->> 'delay_explanation', delay_explanation), updated_at = now() where id = pr.id;
    end if;
  elsif r.target_type = 'announcement' then
    update announcements set status = 'draft', updated_at = now() where ref = r.target_ref and status = 'pending_approval';
  end if;
  update approval_requests set status = case when ok then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = r.id;
  perform audit_write('approval.' || p_decision, r.target_type, r.target_ref, jsonb_build_object('status', 'pending'), jsonb_build_object('status', case when ok then 'approved' else 'rejected' end), jsonb_build_object('request', r.id));
  perform notify_user(r.requested_by, 'approval_decision', case when ok then 'আপনার অনুরোধ অনুমোদিত হয়েছে' else 'আপনার অনুরোধ অনুমোদিত হয়নি' end, 'নম্বর ' || r.target_ref,
    jsonb_build_object('ref', r.target_ref, 'en', jsonb_build_object('title', case when ok then 'Your request was approved' else 'Your request was not approved' end, 'body', 'Reference ' || r.target_ref)), 'appr:' || r.id, r.target_ref);
  return jsonb_build_object('id', r.id, 'status', case when ok then 'approved' else 'rejected' end);
end $$;

-- Delegation of tasks to office staff ------------------------------------------------------------------------------------------
create table if not exists office_tasks (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies on delete cascade,
  issue_id uuid references issues on delete set null,
  title text not null check (char_length(title) between 3 and 150),
  detail text check (detail is null or char_length(detail) <= 1000),
  created_by uuid references profiles on delete set null,
  assigned_to uuid not null references profiles on delete cascade,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists office_tasks_assignee_idx on office_tasks (assigned_to, status);
create index if not exists office_tasks_scope_idx on office_tasks (constituency_id, status, created_at desc);
alter table office_tasks enable row level security;
drop policy if exists office_tasks_select on office_tasks;
create policy office_tasks_select on office_tasks for select
  using (assigned_to = auth.uid() or office_can(constituency_id, 'delegate', null) or is_admin());
revoke all on office_tasks from anon, authenticated;
grant select on office_tasks to authenticated;

create or replace function delegate_task(p_constituency text, p_assignee uuid, p_title text, p_detail text default null, p_due date default null, p_issue_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; iid uuid; t office_tasks%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'delegate', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from office_members m join profiles p on p.id = m.user_id where m.user_id = p_assignee and m.constituency_id = c.id and m.status = 'active'
                   and m.office_role in ('case_officer','office_manager') and p.account_status = 'active') then
    raise exception 'the assignee must be active office staff in this area' using errcode = 'JK002', detail = 'assignee';
  end if;
  if p_issue_ref is not null then
    select id into iid from issues where ref = p_issue_ref and constituency_id = c.id;
    if iid is null then raise exception 'issue not found in this area' using errcode = 'JK002', detail = 'issue_ref'; end if;
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 150 then raise exception 'title' using errcode = 'JK002', detail = 'title'; end if;
  insert into office_tasks (constituency_id, issue_id, title, detail, created_by, assigned_to, due_date)
  values (c.id, iid, btrim(p_title), nullif(btrim(coalesce(p_detail, '')), ''), auth.uid(), p_assignee, p_due) returning * into t;
  perform audit_write('task.delegate', 'office_task', t.id::text, null, jsonb_build_object('assignee', p_assignee), jsonb_build_object('constituency', p_constituency));
  perform notify_user(p_assignee, 'task_assigned', 'আপনাকে একটি কাজ দেওয়া হয়েছে', btrim(p_title), jsonb_build_object('task', t.id, 'en', jsonb_build_object('title', 'A task was assigned to you', 'body', btrim(p_title))), 'task:' || t.id, null);
  return jsonb_build_object('id', t.id, 'status', t.status);
exception when check_violation then raise exception 'invalid task' using errcode = 'JK002', detail = 'fields';
end $$;

create or replace function set_task_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t office_tasks%rowtype;
begin
  select * into t from office_tasks where id = p_id;
  if not found or not (t.assigned_to = auth.uid() or office_can(t.constituency_id, 'delegate', null) or is_admin()) then raise exception 'task not found' using errcode = 'JK404'; end if;
  if p_status not in ('open','done','cancelled') then raise exception 'status' using errcode = 'JK002', detail = 'status'; end if;
  if p_status = 'cancelled' and not (office_can(t.constituency_id, 'delegate', null) or is_admin()) then raise exception 'only the person who delegates can cancel' using errcode = '42501'; end if;
  update office_tasks set status = p_status, completed_at = case when p_status = 'done' then now() end where id = t.id;
  perform audit_write('task.' || p_status, 'office_task', t.id::text, jsonb_build_object('status', t.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('id', t.id, 'status', p_status);
end $$;

revoke all on function set_mp_approval_required(text, boolean), save_announcement(text, text, text, boolean), set_announcement_status(text, text), update_project(text, text, date, text),
  post_public_reply(text, text), decide_approval(uuid, text, text), delegate_task(text, uuid, text, text, date, text), set_task_status(uuid, text) from public, anon;
grant execute on function set_mp_approval_required(text, boolean), save_announcement(text, text, text, boolean), set_announcement_status(text, text), update_project(text, text, date, text),
  post_public_reply(text, text), decide_approval(uuid, text, text), delegate_task(text, uuid, text, text, date, text), set_task_status(uuid, text) to authenticated;

-- Agency integrations, referral registration state (B5.4) ----------------------------------------------------------------------
-- A confirmed integration is a fact an administrator recorded ("this agency's system accepts our referrals through X"). Empty by
-- default: until a row is confirmed, no referral can be called officially registered.
create table if not exists agency_integrations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies on delete cascade,
  kind text not null check (kind in ('api','email_gateway','portal')),
  status text not null default 'planned' check (status in ('planned','confirmed','retired')),
  note text check (note is null or char_length(note) <= 500),
  confirmed_by uuid references profiles on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'confirmed' or (confirmed_by is not null and confirmed_at is not null))
);
alter table agency_integrations enable row level security;
drop policy if exists agency_integrations_select on agency_integrations;
create policy agency_integrations_select on agency_integrations for select using (is_admin());
revoke all on agency_integrations from anon, authenticated;
grant select on agency_integrations to authenticated;

create or replace function set_agency_integration(p_agency uuid, p_kind text, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v agency_integrations%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if not exists (select 1 from agencies where id = p_agency) then raise exception 'agency not found' using errcode = 'JK404'; end if;
  if p_status not in ('planned','confirmed','retired') or p_kind not in ('api','email_gateway','portal') then raise exception 'status or kind' using errcode = 'JK002', detail = 'status'; end if;
  select * into v from agency_integrations where agency_id = p_agency and kind = p_kind and status <> 'retired' order by created_at desc limit 1;
  if found then
    update agency_integrations set status = p_status, note = coalesce(p_note, note),
      confirmed_by = case when p_status = 'confirmed' then auth.uid() else confirmed_by end, confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end where id = v.id returning * into v;
  else
    insert into agency_integrations (agency_id, kind, status, note, confirmed_by, confirmed_at)
    values (p_agency, p_kind, p_status, p_note, case when p_status = 'confirmed' then auth.uid() end, case when p_status = 'confirmed' then now() end) returning * into v;
  end if;
  perform audit_write('agency_integration.' || p_status, 'agency', p_agency::text, null, jsonb_build_object('kind', p_kind, 'status', p_status));
  return jsonb_build_object('id', v.id, 'status', v.status);
end $$;
revoke all on function set_agency_integration(uuid, text, text, text) from public, anon;
grant execute on function set_agency_integration(uuid, text, text, text) to authenticated;

alter table issue_agency_referrals add column if not exists registration_status text not null default 'forwarded' check (registration_status in ('received','forwarded','officially_registered'));
alter table issue_agency_referrals add column if not exists registration_reference text check (registration_reference is null or char_length(registration_reference) <= 120);
alter table issue_agency_referrals add column if not exists registration_proof text check (registration_proof is null or char_length(registration_proof) between 5 and 500);
alter table issue_agency_referrals add column if not exists integration_id uuid references agency_integrations on delete set null;
alter table issue_agency_referrals add column if not exists registered_at timestamptz;
alter table issue_agency_referrals add column if not exists registered_by uuid references profiles on delete set null;
alter table issue_agency_referrals add column if not exists task_status text not null default 'open' check (task_status in ('open','acknowledged','closed'));
alter table issue_agency_referrals add column if not exists closed_at timestamptz;
alter table issue_agency_referrals add column if not exists closure_evidence text check (closure_evidence is null or char_length(closure_evidence) <= 500);
alter table issue_agency_referrals drop constraint if exists referral_registered_needs_proof;
alter table issue_agency_referrals add constraint referral_registered_needs_proof
  check (registration_status <> 'officially_registered' or (registration_proof is not null and integration_id is not null and registered_at is not null));
create index if not exists issue_agency_referrals_agency_idx on issue_agency_referrals (agency_id) where agency_id is not null;

-- Office manager records that the agency's system registered the case (needs a confirmed integration and proof).
create or replace function register_referral(p_referral uuid, p_reference text, p_proof text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r issue_agency_referrals%rowtype; i issues%rowtype; integ uuid;
begin
  select * into r from issue_agency_referrals where id = p_referral;
  select * into i from issues where id = r.issue_id;
  if not found or not office_can(i.constituency_id, 'view', i.assigned_to) then raise exception 'referral not found' using errcode = 'JK404'; end if;
  if not office_can(i.constituency_id, 'forward', i.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
  select id into integ from agency_integrations where agency_id = r.agency_id and status = 'confirmed' order by confirmed_at desc limit 1;
  if r.agency_id is null or integ is null then raise exception 'no confirmed integration exists for this agency' using errcode = 'JK003', detail = 'no_integration'; end if;
  if char_length(btrim(coalesce(p_proof, ''))) < 5 then raise exception 'proof is required' using errcode = 'JK002', detail = 'proof'; end if;
  update issue_agency_referrals set registration_status = 'officially_registered', registration_reference = nullif(btrim(coalesce(p_reference, '')), ''), registration_proof = btrim(p_proof),
    integration_id = integ, registered_at = now(), registered_by = auth.uid() where id = r.id;
  perform audit_write('referral.register', 'issue', i.id::text, jsonb_build_object('registration_status', r.registration_status), jsonb_build_object('registration_status', 'officially_registered'), jsonb_build_object('referral', r.id));
  return jsonb_build_object('referral', r.id, 'registration_status', 'officially_registered');
end $$;

-- Public view of referrals that the office chose to publish. Says plainly which stage it is; never implies registration.
create or replace view public_case_referrals with (security_invoker = false) as
  select i.ref as case_ref, r.agency_name, r.registration_status, r.forwarded_at, r.acknowledged_at, r.task_status, (r.integration_id is not null) as integration_confirmed
  from issue_agency_referrals r join issues i on i.id = r.issue_id
  where r.visibility = 'public' and i.public_visibility;
grant select on public_case_referrals to anon, authenticated;

-- Agency liaison ----------------------------------------------------------------------------------------------------------------
alter table office_members add column if not exists agency_id uuid references agencies on delete set null;
alter table office_invitations add column if not exists agency_id uuid references agencies on delete set null;

drop function if exists create_office_invitation(text, text, text, uuid);
create or replace function create_office_invitation(p_email text, p_constituency text, p_role text, p_representative uuid default null, p_agency uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; tok text := encode(extensions.gen_random_bytes(24), 'hex'); v office_invitations%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if is_admin() then null;
  elsif office_can(c.id, 'assign', null) and p_role in ('case_officer', 'agency_liaison') then null;
  else
    if office_can(c.id, 'view', null) then raise exception 'not allowed' using errcode = '42501'; end if;
    raise exception 'area not found' using errcode = 'JK404';
  end if;
  if p_role = 'mp' and not exists (select 1 from representatives r join representative_constituencies rc on rc.representative_id = r.id
      where r.id = p_representative and r.verification_status = 'verified' and rc.constituency_id = c.id) then
    raise exception 'an MP invitation needs a verified representative of this area' using errcode = 'JK002', detail = 'representative';
  end if;
  if p_role = 'agency_liaison' and not exists (select 1 from agencies where id = p_agency) then
    raise exception 'a liaison invitation needs an agency' using errcode = 'JK002', detail = 'agency_id';
  end if;
  if exists (select 1 from office_invitations where lower(email) = lower(p_email) and constituency_id = c.id and status = 'pending' and expires_at > now()) then
    raise exception 'an invitation is already pending' using errcode = 'JK003', detail = 'already_invited';
  end if;
  insert into office_invitations (email, constituency_id, office_role, representative_id, agency_id, invited_by, token_hash)
  values (btrim(p_email), c.id, p_role, case when p_role = 'mp' then p_representative end, case when p_role = 'agency_liaison' then p_agency end, auth.uid(), encode(extensions.digest(tok, 'sha256'), 'hex')) returning * into v;
  perform audit_write('invitation.create', 'office_invitation', v.id::text, null, jsonb_build_object('role', p_role, 'constituency', p_constituency), jsonb_build_object('email_domain', split_part(lower(p_email), '@', 2)));
  return jsonb_build_object('id', v.id, 'token', tok, 'expires_at', v.expires_at);
exception when check_violation then raise exception 'invalid invitation' using errcode = 'JK002', detail = 'email';
end $$;

create or replace function accept_office_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v office_invitations%rowtype; uid uuid := auth.uid(); mail text; r text;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into v from office_invitations where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v.status <> 'pending' or v.expires_at <= now() then raise exception 'invitation not valid' using errcode = 'JK404'; end if;
  select email into mail from auth.users where id = uid and email_confirmed_at is not null;
  if mail is null or lower(mail) <> lower(v.email) then raise exception 'this invitation was sent to a different email address' using errcode = '42501'; end if;
  select role into r from profiles where id = uid;
  if r not in ('citizen', 'staff') then raise exception 'this account cannot join an office' using errcode = '42501'; end if;
  update office_invitations set status = 'accepted', accepted_by = uid, accepted_at = now() where id = v.id;
  if r = 'citizen' then update profiles set role = 'staff' where id = uid; end if;
  insert into office_members (user_id, representative_id, constituency_id, office_role, status, invited_by, agency_id)
  values (uid, v.representative_id, v.constituency_id, v.office_role, 'active', v.invited_by, v.agency_id)
  on conflict (user_id, constituency_id) do update set office_role = excluded.office_role, representative_id = excluded.representative_id, agency_id = excluded.agency_id, status = 'active';
  perform audit_write('invitation.accept', 'office_invitation', v.id::text, null, jsonb_build_object('role', v.office_role), jsonb_build_object('constituency_id', v.constituency_id));
  return jsonb_build_object('office_role', v.office_role, 'constituency_id', v.constituency_id);
end $$;
revoke all on function create_office_invitation(text, text, text, uuid, uuid), accept_office_invitation(text) from public, anon;
grant execute on function create_office_invitation(text, text, text, uuid, uuid), accept_office_invitation(text) to authenticated;

-- The caller's active liaison membership for a referral (their agency, this issue's area), or null. Internal.
create or replace function liaison_for_referral(p_referral uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id from issue_agency_referrals r join issues i on i.id = r.issue_id
   where r.id = p_referral and r.agency_id is not null and exists (
     select 1 from office_members m join profiles p on p.id = m.user_id
      where m.user_id = auth.uid() and m.status = 'active' and m.office_role = 'agency_liaison' and m.agency_id = r.agency_id
        and m.constituency_id = i.constituency_id and p.account_status = 'active' and p.role = 'staff' and mfa_ok()) $$;
revoke all on function liaison_for_referral(uuid) from public, anon, authenticated;

-- What a liaison may see: the referred case's public-safe fields and the referral's own state. No reporter, no internal notes.
create or replace function liaison_cases() returns table (referral_id uuid, ref text, title text, category text, description text, area text, constituency_key text,
  forwarded_at timestamptz, acknowledged_at timestamptz, task_status text, registration_status text, external_reference text, contact_channel text, closure_evidence text)
language sql stable security definer set search_path = public as $$
  select r.id, i.ref, i.title, i.category, i.description, i.area, c.key, r.forwarded_at, r.acknowledged_at, r.task_status, r.registration_status, r.external_reference, r.agency_contact_or_channel, r.closure_evidence
    from issue_agency_referrals r join issues i on i.id = r.issue_id join constituencies c on c.id = i.constituency_id
   where liaison_for_referral(r.id) is not null
   order by r.forwarded_at desc limit 100 $$;

create or replace function liaison_acknowledge(p_referral uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r issue_agency_referrals%rowtype;
begin
  if liaison_for_referral(p_referral) is null then raise exception 'referral not found' using errcode = 'JK404'; end if;
  select * into r from issue_agency_referrals where id = p_referral for update;
  if r.task_status <> 'open' then return jsonb_build_object('referral', r.id, 'task_status', r.task_status); end if;
  update issue_agency_referrals set task_status = 'acknowledged', acknowledged_at = now(),
    registration_status = case when registration_status = 'forwarded' then 'received' else registration_status end where id = r.id;
  perform audit_write('referral.acknowledge', 'issue', r.issue_id::text, jsonb_build_object('task_status', 'open'), jsonb_build_object('task_status', 'acknowledged'), jsonb_build_object('referral', r.id));
  return jsonb_build_object('referral', r.id, 'task_status', 'acknowledged', 'registration_status', case when r.registration_status = 'forwarded' then 'received' else r.registration_status end);
end $$;

create or replace function liaison_add_update(p_referral uuid, p_note text, p_public boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r issue_agency_referrals%rowtype; i issues%rowtype; n text := nullif(btrim(p_note), '');
begin
  if liaison_for_referral(p_referral) is null then raise exception 'referral not found' using errcode = 'JK404'; end if;
  if n is null or char_length(n) > 1000 then raise exception 'note' using errcode = 'JK002', detail = 'note'; end if;
  select * into r from issue_agency_referrals where id = p_referral;
  if r.task_status = 'closed' then raise exception 'this task is closed' using errcode = 'JK003', detail = 'closed'; end if;
  select * into i from issues where id = r.issue_id;
  -- Public liaison updates only where the referral itself is public, so an office decision to keep it internal is respected.
  insert into issue_events (issue_id, actor_id, event_type, from_status, to_status, public_message, internal_note, metadata, is_public)
  values (i.id, auth.uid(), 'note', i.status, i.status, case when p_public and r.visibility = 'public' then n end, case when not (p_public and r.visibility = 'public') then n end,
          jsonb_build_object('source', 'agency_liaison', 'agency', r.agency_name), (p_public and r.visibility = 'public'));
  perform audit_write('referral.update', 'issue', i.id::text, null, jsonb_build_object('public', p_public and r.visibility = 'public'), jsonb_build_object('referral', r.id));
  return jsonb_build_object('referral', r.id, 'public', p_public and r.visibility = 'public');
end $$;

create or replace function liaison_record_reference(p_referral uuid, p_external_reference text default null, p_channel text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r issue_agency_referrals%rowtype;
begin
  if liaison_for_referral(p_referral) is null then raise exception 'referral not found' using errcode = 'JK404'; end if;
  if nullif(btrim(coalesce(p_external_reference, '')), '') is null and nullif(btrim(coalesce(p_channel, '')), '') is null then raise exception 'a reference or a channel is required' using errcode = 'JK002', detail = 'external_reference'; end if;
  select * into r from issue_agency_referrals where id = p_referral;
  update issue_agency_referrals set external_reference = coalesce(nullif(left(btrim(coalesce(p_external_reference, '')), 100), ''), external_reference),
    agency_contact_or_channel = coalesce(nullif(left(btrim(coalesce(p_channel, '')), 300), ''), agency_contact_or_channel) where id = r.id;
  perform audit_write('referral.reference', 'issue', r.issue_id::text, jsonb_build_object('external_reference', r.external_reference), jsonb_build_object('external_reference', coalesce(p_external_reference, r.external_reference)), jsonb_build_object('referral', r.id));
  return jsonb_build_object('referral', r.id);
end $$;

create or replace function liaison_close_task(p_referral uuid, p_evidence text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r issue_agency_referrals%rowtype;
begin
  if liaison_for_referral(p_referral) is null then raise exception 'referral not found' using errcode = 'JK404'; end if;
  if char_length(btrim(coalesce(p_evidence, ''))) < 5 then raise exception 'evidence is required to close' using errcode = 'JK002', detail = 'evidence'; end if;
  select * into r from issue_agency_referrals where id = p_referral for update;
  if r.task_status = 'closed' then raise exception 'already closed' using errcode = 'JK003', detail = 'closed'; end if;
  update issue_agency_referrals set task_status = 'closed', closed_at = now(), closure_evidence = left(btrim(p_evidence), 500),
    acknowledged_at = coalesce(acknowledged_at, now()), notes = coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), notes) where id = r.id;
  perform audit_write('referral.close', 'issue', r.issue_id::text, jsonb_build_object('task_status', r.task_status), jsonb_build_object('task_status', 'closed'), jsonb_build_object('referral', r.id));
  return jsonb_build_object('referral', r.id, 'task_status', 'closed');
end $$;

revoke all on function register_referral(uuid, text, text), liaison_cases(), liaison_acknowledge(uuid), liaison_add_update(uuid, text, boolean),
  liaison_record_reference(uuid, text, text), liaison_close_task(uuid, text, text) from public, anon;
grant execute on function register_referral(uuid, text, text), liaison_cases(), liaison_acknowledge(uuid), liaison_add_update(uuid, text, boolean),
  liaison_record_reference(uuid, text, text), liaison_close_task(uuid, text, text) to authenticated;
