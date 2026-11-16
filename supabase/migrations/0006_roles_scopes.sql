-- Phase 1 step 2 (masterplan §5, §14): roles and scopes. Additive; the deployed app keeps working.
--
-- Role model
--   profiles.role (platform role):  citizen | staff | moderator | admin
--   office_members.office_role (per constituency, only for platform role 'staff'):
--       case_officer | office_manager | mp | agency_liaison
--   Effective roles in the product: citizen, case officer, office manager, MP, agency liaison, moderator, admin.
--   The legacy single 'staff' role stays valid; existing staff are backfilled below as office managers of the demo area.
--
-- is_staff() is left unchanged on purpose: current RLS policies still call it. Step 3 (0007) replaces those policies
-- with scoped checks built from the functions defined here.

-- Platform roles ---------------------------------------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('citizen','staff','moderator','admin'));

-- Runtime configuration (admin/service only; no policies = no client access) ----------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
-- MFA is enforced for MP, moderator and admin accounts when this is true (Supabase TOTP, session assurance level aal2).
-- It is false until the sign-in UI can enrol and challenge TOTP; turn it on in the Phase 3 security review at the latest.
insert into app_settings (key, value, description) values
  ('enforce_mfa', 'false', 'Require aal2 (TOTP) sessions for MP, moderator and admin accounts')
on conflict (key) do nothing;

create or replace function app_setting_bool(k text, d boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from app_settings where key = k), d) $$;

-- Identity helpers (SECURITY DEFINER so RLS on profiles / office_members cannot recurse) -------
create or replace function app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and account_status = 'active' $$;

create or replace function has_mfa() returns boolean
language sql stable as $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;

create or replace function mfa_required() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() in ('moderator','admin'), false)
      or exists (select 1 from office_members m where m.user_id = auth.uid() and m.status = 'active' and m.office_role = 'mp') $$;

-- True when MFA is not required for this user, not enforced yet, or the session is aal2.
create or replace function mfa_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select not app_setting_bool('enforce_mfa') or not mfa_required() or has_mfa() $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'admin', false) and mfa_ok() $$;

create or replace function is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(app_role() = 'moderator', false) and mfa_ok() $$;

-- Constituencies the caller works in (active membership, active staff account, MFA satisfied). Admin: all.
create or replace function office_scope() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.id from constituencies c where is_admin()
  union
  select m.constituency_id from office_members m join profiles p on p.id = m.user_id
   where m.user_id = auth.uid() and m.status = 'active' and p.account_status = 'active' and p.role = 'staff' and mfa_ok() $$;

create or replace function in_office_scope(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select c is not null and c in (select office_scope()) $$;

-- Permission matrix (single source in data; tests keep src/lib/auth.ts identical to it) -------------
create table if not exists office_permissions (
  office_role text not null check (office_role in ('case_officer','office_manager','mp','agency_liaison')),
  action text not null,
  assigned_only boolean not null default false,
  primary key (office_role, action)
);
alter table office_permissions enable row level security;
drop policy if exists "read permission matrix" on office_permissions;
create policy "read permission matrix" on office_permissions for select using (true);

insert into office_permissions (office_role, action, assigned_only) values
  ('office_manager','view',false), ('office_manager','acknowledge',false), ('office_manager','assign',false),
  ('office_manager','request_information',false), ('office_manager','forward',false), ('office_manager','update',false),
  ('office_manager','resolve',false), ('office_manager','close',false), ('office_manager','view_analytics',false),
  ('mp','view',false), ('mp','view_analytics',false),
  ('case_officer','view',true), ('case_officer','request_information',true), ('case_officer','update',true),
  ('agency_liaison','view',true), ('agency_liaison','update',true)
on conflict (office_role, action) do nothing;

-- Can the caller perform `act` on an issue of constituency `c`, assigned to `assignee`? Admin may do anything in scope.
create or replace function office_can(c uuid, act text, assignee uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from office_members m
      join profiles pr on pr.id = m.user_id
      join office_permissions p on p.office_role = m.office_role and p.action = act
     where m.user_id = auth.uid() and m.status = 'active' and m.constituency_id = c
       and pr.account_status = 'active' and pr.role = 'staff' and mfa_ok()
       and (not p.assigned_only or assignee = auth.uid())) $$;

-- Guards ------------------------------------------------------------------------------------------
-- Platform role and account status change only from the SQL editor / service role (no JWT user) or by an admin.
create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.account_status is distinct from old.account_status)
     and auth.uid() is not null and not is_admin() then
    raise exception 'role and account status can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_trg on profiles;
create trigger profiles_guard_trg before update on profiles for each row execute function profiles_guard();

-- Only staff accounts can hold an active office membership.
create or replace function office_members_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'active' and not exists (select 1 from profiles where id = new.user_id and role = 'staff') then
    raise exception 'active office members must have platform role staff' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists office_members_guard_trg on office_members;
create trigger office_members_guard_trg before insert or update on office_members for each row execute function office_members_guard();

-- Users may read their own memberships (needed to show the office UI); nobody writes through the API.
drop policy if exists "own memberships" on office_members;
create policy "own memberships" on office_members for select using (user_id = auth.uid());

-- Backfill: staff existing before this migration keep working as office managers of the demo area(s) only.
insert into office_members (user_id, constituency_id, office_role)
  select p.id, c.id, 'office_manager' from profiles p cross join constituencies c
   where p.role = 'staff' and c.is_demo
on conflict (user_id, constituency_id) do nothing;
