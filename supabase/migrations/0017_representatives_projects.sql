-- Phase 2.8 (masterplan §7.9, §8): representatives (verified profile fields with source and date), announcements,
-- projects with milestones, and the responsiveness numbers (counts and times for ONE area; never a ranking).
-- Requires 0004-0016.

-- New office permission: publish announcements and manage projects (MP and office manager). Kept identical in src/lib/auth.ts.
insert into office_permissions (office_role, action, assigned_only) values ('office_manager', 'publish', false), ('mp', 'publish', false)
on conflict (office_role, action) do nothing;

-- Verified profile fields: every public fact about a representative carries where it came from and when it was checked.
create table if not exists representative_fields (
  id uuid primary key default gen_random_uuid(),
  representative_id uuid not null references representatives on delete cascade,
  field text not null check (field in ('bio','office_address','office_phone','office_email','website','education','committees','term_note')),
  value text not null check (char_length(value) between 1 and 2000),
  source_url text not null check (source_url ~ '^https?://'),
  source_checked_at date not null,
  created_at timestamptz not null default now(),
  unique (representative_id, field)
);
alter table representative_fields enable row level security;
drop policy if exists representative_fields_public on representative_fields;
create policy representative_fields_public on representative_fields for select
  using (exists (select 1 from representatives r where r.id = representative_id and r.verification_status = 'verified') or is_admin());
revoke all on representative_fields from anon, authenticated;
grant select on representative_fields to anon, authenticated;

-- Announcements -------------------------------------------------------------------------------------------------------
create sequence if not exists announcement_ref_seq start 1000;
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('AN-' || to_char(now(), 'YYYY') || '-' || nextval('announcement_ref_seq')),
  constituency_id uuid not null references constituencies,
  author_id uuid references profiles on delete set null,
  title text not null check (char_length(title) between 5 and 150),
  body text not null check (char_length(body) between 10 and 3000),
  status text not null default 'draft' check (status in ('draft','published','withdrawn','hidden')),
  published_at timestamptz,
  is_demo boolean not null default false,
  moderation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_constituency_idx on announcements (constituency_id, published_at desc);
alter table announcements enable row level security;
drop policy if exists announcements_select on announcements;
create policy announcements_select on announcements for select using (office_can(constituency_id, 'view', null) or is_admin());
revoke all on announcements from anon, authenticated;
grant select on announcements to authenticated;
create or replace view public_announcements with (security_invoker = false) as
  select a.ref, c.key as constituency_key, a.title, a.body, a.published_at, a.is_demo
  from announcements a join constituencies c on c.id = a.constituency_id where a.status = 'published';
grant select on public_announcements to anon, authenticated;

create or replace function save_announcement(p_constituency text, p_title text, p_body text, p_publish boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v announcements%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(p_title)) not between 5 and 150 then raise exception 'title length' using errcode = 'JK002', detail = 'title'; end if;
  if char_length(btrim(p_body)) not between 10 and 3000 then raise exception 'body length' using errcode = 'JK002', detail = 'body'; end if;
  insert into announcements (constituency_id, author_id, title, body, status, published_at, is_demo)
  values (c.id, auth.uid(), btrim(p_title), btrim(p_body), case when p_publish then 'published' else 'draft' end, case when p_publish then now() end, c.is_demo) returning * into v;
  perform audit_write('announcement.' || case when p_publish then 'publish' else 'draft' end, 'announcement', v.ref, null, jsonb_build_object('status', v.status), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
end $$;

create or replace function set_announcement_status(p_ref text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v announcements%rowtype;
begin
  select * into v from announcements where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'announcement not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_status not in ('published','withdrawn') or v.status in ('hidden') or (p_status = 'published' and v.status = 'withdrawn') then
    raise exception 'invalid status change' using errcode = 'JK001';
  end if;
  update announcements set status = p_status, published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now() where id = v.id;
  perform audit_write('announcement.' || p_status, 'announcement', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ref', v.ref, 'status', p_status);
end $$;

-- Projects and milestones ---------------------------------------------------------------------------------------------
create sequence if not exists project_ref_seq start 1000;
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PR-' || to_char(now(), 'YYYY') || '-' || nextval('project_ref_seq')),
  constituency_id uuid not null references constituencies,
  title text not null check (char_length(title) between 5 and 150),
  description text check (description is null or char_length(description) <= 3000),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','paused','cancelled')),
  budget_text text check (budget_text is null or char_length(budget_text) <= 200),   -- as stated by the source, not computed
  start_date date, expected_end_date date,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  source_checked_at date,
  created_by uuid references profiles on delete set null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_end_date is null or start_date is null or expected_end_date >= start_date)
);
create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  title text not null check (char_length(title) between 3 and 150),
  due_date date,
  status text not null default 'pending' check (status in ('pending','done','delayed')),
  note text check (note is null or char_length(note) <= 500),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists projects_constituency_idx on projects (constituency_id, created_at desc);
create index if not exists project_milestones_idx on project_milestones (project_id, due_date);
alter table projects enable row level security;
alter table project_milestones enable row level security;
drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists project_milestones_select on project_milestones;
create policy project_milestones_select on project_milestones for select
  using (exists (select 1 from projects p where p.id = project_id and (office_can(p.constituency_id, 'view', null) or is_admin())));
revoke all on projects, project_milestones from anon, authenticated;
grant select on projects, project_milestones to authenticated;
create or replace view public_projects with (security_invoker = false) as
  select p.ref, c.key as constituency_key, p.title, p.description, p.status, p.budget_text, p.start_date, p.expected_end_date, p.source_url, p.source_checked_at, p.is_demo, p.updated_at
  from projects p join constituencies c on c.id = p.constituency_id;
create or replace view public_project_milestones with (security_invoker = false) as
  select p.ref as project_ref, m.id, m.title, m.due_date, m.status, m.note, m.completed_at
  from project_milestones m join projects p on p.id = m.project_id;
grant select on public_projects, public_project_milestones to anon, authenticated;

create or replace function project_for_edit(p_ref text) returns projects
language plpgsql stable security definer set search_path = public as $$
declare v projects%rowtype;
begin
  select * into v from projects where ref = p_ref;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'project not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  return v;
end $$;
revoke all on function project_for_edit(text) from public, anon, authenticated;

create or replace function create_project(p_constituency text, p_title text, p_description text, p_status text, p_budget text, p_start date, p_end date, p_source text, p_checked date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v projects%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_source is not null and p_checked is null then raise exception 'a source needs the date it was checked' using errcode = 'JK002', detail = 'source_checked_at'; end if;
  insert into projects (constituency_id, title, description, status, budget_text, start_date, expected_end_date, source_url, source_checked_at, created_by, is_demo)
  values (c.id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_status, 'planned'), nullif(btrim(coalesce(p_budget, '')), ''), p_start, p_end, p_source, p_checked, auth.uid(), c.is_demo)
  returning * into v;
  perform audit_write('project.create', 'project', v.ref, null, jsonb_build_object('status', v.status), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation then raise exception 'invalid project fields' using errcode = 'JK002', detail = 'fields';
end $$;

create or replace function update_project(p_ref text, p_status text, p_end date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v projects%rowtype;
begin
  v := project_for_edit(p_ref);
  if p_status is not null and p_status not in ('planned','in_progress','completed','paused','cancelled') then raise exception 'status' using errcode = 'JK002', detail = 'status'; end if;
  update projects set status = coalesce(p_status, status), expected_end_date = coalesce(p_end, expected_end_date), updated_at = now() where id = v.id;
  perform audit_write('project.update', 'project', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', coalesce(p_status, v.status)));
  return jsonb_build_object('ref', v.ref, 'status', coalesce(p_status, v.status));
exception when check_violation then raise exception 'invalid project fields' using errcode = 'JK002', detail = 'expected_end_date';
end $$;

create or replace function add_milestone(p_ref text, p_title text, p_due date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v projects%rowtype; m project_milestones%rowtype;
begin
  v := project_for_edit(p_ref);
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 150 then raise exception 'title length' using errcode = 'JK002', detail = 'title'; end if;
  insert into project_milestones (project_id, title, due_date) values (v.id, btrim(p_title), p_due) returning * into m;
  update projects set updated_at = now() where id = v.id;
  perform audit_write('project.milestone_add', 'project', v.ref, null, jsonb_build_object('milestone', m.id));
  return jsonb_build_object('id', m.id, 'status', m.status);
end $$;

create or replace function update_milestone(p_ref text, p_milestone uuid, p_status text, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v projects%rowtype; m project_milestones%rowtype;
begin
  v := project_for_edit(p_ref);
  select * into m from project_milestones where id = p_milestone and project_id = v.id;
  if not found then raise exception 'milestone not found' using errcode = 'JK404'; end if;
  if p_status not in ('pending','done','delayed') then raise exception 'status' using errcode = 'JK002', detail = 'status'; end if;
  if p_status = 'delayed' and char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'a delay needs a note' using errcode = 'JK002', detail = 'note'; end if;
  update project_milestones set status = p_status, note = nullif(btrim(coalesce(p_note, '')), ''), completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end where id = m.id;
  update projects set updated_at = now() where id = v.id;
  perform audit_write('project.milestone_update', 'project', v.ref, jsonb_build_object('status', m.status), jsonb_build_object('status', p_status), jsonb_build_object('milestone', m.id));
  return jsonb_build_object('id', m.id, 'status', p_status);
exception when check_violation then raise exception 'note too long' using errcode = 'JK002', detail = 'note';
end $$;

revoke all on function save_announcement(text, text, text, boolean), set_announcement_status(text, text), create_project(text, text, text, text, text, date, date, text, date),
  update_project(text, text, date), add_milestone(text, text, date), update_milestone(text, uuid, text, text) from public, anon;
grant execute on function save_announcement(text, text, text, boolean), set_announcement_status(text, text), create_project(text, text, text, text, text, date, date, text, date),
  update_project(text, text, date), add_milestone(text, text, date), update_milestone(text, uuid, text, text) to authenticated;

-- Responsiveness -------------------------------------------------------------------------------------------------------
-- Counts and a median for ONE constituency over a stated date range. "Answered" means the office did something visible on the
-- issue (a status change or a note by someone other than the reporter). It is a description of activity, not a score, and the
-- API offers no cross-area comparison or ordering.
create or replace function constituency_responsiveness(p_key text, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype; d_from date := coalesce(p_from, current_date - 90); d_to date := coalesce(p_to, current_date);
        received integer; answered integer; med numeric;
begin
  select * into c from constituencies where key = p_key and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if d_to < d_from or d_to - d_from > 730 then raise exception 'date range' using errcode = 'JK002', detail = 'to'; end if;
  with r as (
    select i.id, i.created_at,
           (select min(e.created_at) from issue_events e
             where e.issue_id = i.id and e.event_type in ('status_change','note') and e.actor_id is not null and e.actor_id is distinct from i.reporter_id) as first_response
    from issues i where i.constituency_id = c.id and i.created_at >= d_from and i.created_at < d_to + 1)
  select count(*), count(first_response), (percentile_cont(0.5) within group (order by extract(epoch from (first_response - created_at)) / 3600))::numeric(10,1)
    into received, answered, med from r;
  return jsonb_build_object('constituency', c.key, 'is_sample', c.is_demo, 'from', d_from, 'to', d_to, 'received', received, 'answered', answered, 'pending', received - answered,
    'median_hours_to_first_response', med, 'method_url', '/mp/method',
    'note', 'Counts of activity in this area over the stated dates. Not a ranking and not a promise of response times.');
end $$;
revoke all on function constituency_responsiveness(text, date, date) from public;
grant execute on function constituency_responsiveness(text, date, date) to anon, authenticated;
