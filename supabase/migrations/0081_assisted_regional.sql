-- Phase 8 (B8.3, B8.5; masterplan §4.4): assisted reporting through community volunteers and kiosks, and regional administration.
-- Requires 0004-0080. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 8 status):
--   * A volunteer is a verified citizen account that an office manager approved for ONE area. It is not a platform role and carries no office
--     permission: a volunteer sees only the reports they entered. They must accept the conduct rules (version recorded) when they apply.
--   * A report on behalf of someone else needs a consent record in the same transaction as the case: how consent was given (read aloud and agreed,
--     signed paper, kiosk screen), which text version, and the three things the person agreed to. The person's identity is NOT stored. The case is
--     owned by the volunteer account (so updates reach the volunteer, who tells the person), is labelled `assisted` for the office, and follows every
--     normal rule (privacy, moderation, state machine). A daily cap per volunteer limits misuse.
--   * Regional administrators are staff accounts an administrator scopes to one administrative unit (and everything below it). They get aggregate
--     counts per area inside that scope. They get NO case, reporter or note access: no policy on issues or any private table is widened.

-- Volunteers and kiosks ------------------------------------------------------------------------------------------------------------------------------------
create table if not exists volunteers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  constituency_id uuid not null references constituencies,
  status text not null default 'pending' check (status in ('pending','active','rejected','suspended','withdrawn')),
  conduct_version text not null check (char_length(conduct_version) between 1 and 20),
  conduct_accepted_at timestamptz not null default now(),
  decided_by uuid references profiles on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, constituency_id)
);
create index if not exists volunteers_scope_idx on volunteers (constituency_id, status);

create table if not exists kiosks (
  id uuid primary key default gen_random_uuid(),
  constituency_id uuid not null references constituencies,
  label text not null check (char_length(label) between 3 and 80),
  place_text text check (place_text is null or char_length(place_text) <= 200),
  status text not null default 'active' check (status in ('active','retired')),
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kiosks_scope_idx on kiosks (constituency_id, status);

alter table issues drop constraint if exists issues_source_channel_check;
alter table issues add constraint issues_source_channel_check check (source_channel in ('app','whatsapp','sms','assisted'));

create table if not exists assisted_reports (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null unique references issues on delete cascade,
  volunteer_id uuid references profiles on delete set null,
  constituency_id uuid not null references constituencies,
  kiosk_id uuid references kiosks on delete set null,
  consent_method text not null check (consent_method in ('read_aloud_agreed','signed_paper','kiosk_screen')),
  consent_version text not null check (char_length(consent_version) between 1 and 20),
  consent_at timestamptz not null default now(),
  agreed_to_file boolean not null check (agreed_to_file),
  agreed_to_publish boolean not null check (agreed_to_publish),
  understands_no_account boolean not null check (understands_no_account),
  language text not null default 'bn' check (language in ('bn','en')),
  created_at timestamptz not null default now()
);
create index if not exists assisted_reports_volunteer_idx on assisted_reports (volunteer_id, created_at desc);

alter table volunteers enable row level security;
alter table kiosks enable row level security;
alter table assisted_reports enable row level security;
drop policy if exists volunteers_select on volunteers;
create policy volunteers_select on volunteers for select using (user_id = auth.uid() or office_can(constituency_id, 'assign', null) or is_admin());
drop policy if exists kiosks_select on kiosks;
create policy kiosks_select on kiosks for select using (office_can(constituency_id, 'view', null) or is_admin());
drop policy if exists assisted_reports_select on assisted_reports;
create policy assisted_reports_select on assisted_reports for select using (volunteer_id = auth.uid() or office_can(constituency_id, 'view', null) or is_admin());
revoke all on volunteers, kiosks, assisted_reports from anon, authenticated;
grant select on volunteers, kiosks, assisted_reports to authenticated;

create or replace view public_kiosks with (security_invoker = false) as
  select k.id, c.key as constituency_key, k.label, k.place_text from kiosks k join constituencies c on c.id = k.constituency_id where k.status = 'active';
grant select on public_kiosks to anon, authenticated;

create or replace function is_active_volunteer(p_constituency uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from volunteers v join profiles p on p.id = v.user_id where v.user_id = auth.uid() and v.constituency_id = p_constituency and v.status = 'active' and p.account_status = 'active') $$;
revoke all on function is_active_volunteer(uuid) from public, anon;
grant execute on function is_active_volunteer(uuid) to authenticated;

create or replace function apply_volunteer(p_constituency text, p_conduct_version text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c constituencies%rowtype; v volunteers%rowtype;
begin
  if uid is null or not verified_account() then raise exception 'a verified account is needed' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if char_length(btrim(coalesce(p_conduct_version, ''))) < 1 then raise exception 'conduct rules must be accepted' using errcode = 'JK002', detail = 'conduct_version'; end if;
  select * into v from volunteers where user_id = uid and constituency_id = c.id;
  if found and v.status in ('pending','active','suspended') then raise exception 'you already have a volunteer record for this area' using errcode = 'JK003', detail = 'already_applied'; end if;
  insert into volunteers (user_id, constituency_id, conduct_version) values (uid, c.id, btrim(p_conduct_version))
  on conflict (user_id, constituency_id) do update set status = 'pending', conduct_version = excluded.conduct_version, conduct_accepted_at = now(), decided_by = null, decided_at = null, decision_note = null
  returning * into v;
  perform audit_write('volunteer.apply', 'volunteer', v.id::text, null, jsonb_build_object('status', 'pending'), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('id', v.id, 'status', v.status);
end $$;

create or replace function decide_volunteer(p_id uuid, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v volunteers%rowtype; ns text;
begin
  select * into v from volunteers where id = p_id;
  if not found or not (office_can(v.constituency_id, 'view', null) or is_admin()) then raise exception 'volunteer not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'assign', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  ns := case p_decision when 'approve' then 'active' when 'reject' then 'rejected' when 'suspend' then 'suspended' when 'reinstate' then 'active' end;
  if ns is null then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if not ((v.status = 'pending' and p_decision in ('approve','reject')) or (v.status = 'active' and p_decision = 'suspend') or (v.status = 'suspended' and p_decision = 'reinstate')) then
    raise exception 'invalid status change' using errcode = 'JK001'; end if;
  if p_decision in ('reject','suspend') and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is needed' using errcode = 'JK002', detail = 'note'; end if;
  update volunteers set status = ns, decided_by = auth.uid(), decided_at = now(), decision_note = nullif(btrim(coalesce(p_note, '')), '') where id = v.id;
  perform audit_write('volunteer.' || p_decision, 'volunteer', v.id::text, jsonb_build_object('status', v.status), jsonb_build_object('status', ns));
  return jsonb_build_object('id', v.id, 'status', ns);
end $$;

create or replace function withdraw_volunteer(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v volunteers%rowtype;
begin
  select * into v from volunteers where id = p_id and user_id = auth.uid();
  if not found then raise exception 'volunteer record not found' using errcode = 'JK404'; end if;
  update volunteers set status = 'withdrawn', decided_at = now() where id = v.id and status <> 'withdrawn';
  perform audit_write('volunteer.withdraw', 'volunteer', v.id::text, jsonb_build_object('status', v.status), jsonb_build_object('status', 'withdrawn'));
  return jsonb_build_object('id', v.id, 'status', 'withdrawn');
end $$;

create or replace function create_kiosk(p_constituency text, p_label text, p_place text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; k kiosks%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'assign', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into kiosks (constituency_id, label, place_text, created_by) values (c.id, btrim(p_label), nullif(btrim(coalesce(p_place, '')), ''), auth.uid()) returning * into k;
  perform audit_write('kiosk.create', 'kiosk', k.id::text, null, jsonb_build_object('label', k.label), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('id', k.id, 'status', k.status);
exception when check_violation then raise exception 'invalid kiosk' using errcode = 'JK002', detail = 'label';
end $$;

create or replace function retire_kiosk(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k kiosks%rowtype;
begin
  select * into k from kiosks where id = p_id;
  if not found or not office_can(k.constituency_id, 'view', null) then raise exception 'kiosk not found' using errcode = 'JK404'; end if;
  if not office_can(k.constituency_id, 'assign', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  update kiosks set status = 'retired' where id = k.id;
  perform audit_write('kiosk.retire', 'kiosk', k.id::text, null, null);
  return jsonb_build_object('id', k.id, 'status', 'retired');
end $$;

-- The assisted report. Everything happens here so a case cannot exist without its consent record. p_consent:
-- {"method","version","agreed_to_file":true,"agreed_to_publish":true,"understands_no_account":true,"language"}
create or replace function submit_assisted_report(p_constituency text, p_kiosk uuid, p_consent jsonb, p_title text, p_category text, p_description text, p_area text,
  p_lat double precision default null, p_lng double precision default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c constituencies%rowtype; i issues%rowtype; cap integer := app_setting_int('assisted_reports_per_day', 30); made integer;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_constituency and is_active;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not is_active_volunteer(c.id) then raise exception 'only an approved volunteer of this area can file for someone else' using errcode = '42501'; end if;
  if p_kiosk is not null and not exists (select 1 from kiosks where id = p_kiosk and constituency_id = c.id and status = 'active') then raise exception 'kiosk not found in this area' using errcode = 'JK002', detail = 'kiosk_id'; end if;
  if coalesce(p_consent ->> 'method', '') not in ('read_aloud_agreed','signed_paper','kiosk_screen')
     or coalesce((p_consent ->> 'agreed_to_file')::boolean, false) is not true or coalesce((p_consent ->> 'agreed_to_publish')::boolean, false) is not true
     or coalesce((p_consent ->> 'understands_no_account')::boolean, false) is not true or char_length(coalesce(p_consent ->> 'version', '')) < 1 then
    raise exception 'the person must agree to every point of the consent' using errcode = 'JK003', detail = 'consent';
  end if;
  select count(*)::int into made from assisted_reports where volunteer_id = uid and created_at > now() - interval '24 hours';
  if made >= cap then raise exception 'daily limit for assisted reports reached' using errcode = 'JK003', detail = 'daily_limit'; end if;
  insert into issues (reporter_id, title, category, description, area, constituency_key, ai_summary, ai_confidence, ai_similar, source_channel, lat, lng, location_source)
  values (uid, p_title, p_category, p_description, coalesce(p_area, ''), c.key, left(p_description, 160), 0.7, '{}', 'assisted', p_lat, p_lng, case when p_lat is not null then 'manual_area' end)
  returning * into i;
  insert into assisted_reports (issue_id, volunteer_id, constituency_id, kiosk_id, consent_method, consent_version, agreed_to_file, agreed_to_publish, understands_no_account, language)
  values (i.id, uid, c.id, p_kiosk, p_consent ->> 'method', p_consent ->> 'version', true, true, true, coalesce(p_consent ->> 'language', 'bn'));
  perform audit_write('assisted_report.create', 'issue', i.id::text, null, jsonb_build_object('method', p_consent ->> 'method', 'kiosk', p_kiosk is not null), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', i.ref, 'status', i.status::text, 'label', 'assisted');
exception when check_violation or not_null_violation or invalid_text_representation then raise exception 'invalid report' using errcode = 'JK002', detail = 'report';
end $$;

-- A volunteer's own list (no one else's) with the case state and how consent was given. Never the text of other people's reports.
create or replace function my_assisted_reports() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ref', i.ref, 'status', i.status::text, 'category', i.category, 'created_at', a.created_at, 'consent_method', a.consent_method, 'kiosk_id', a.kiosk_id) order by a.created_at desc), '[]')
  from assisted_reports a join issues i on i.id = a.issue_id where a.volunteer_id = auth.uid() $$;

-- Office view: volunteers and assisted reports of the area.
create or replace function office_volunteers(p_constituency text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c constituencies%rowtype;
begin
  select * into c from constituencies where key = p_constituency;
  if not found or not (office_can(c.id, 'assign', null) or is_admin()) then raise exception 'area not found' using errcode = 'JK404'; end if;
  return jsonb_build_object('volunteers', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'status', v.status, 'conduct_version', v.conduct_version, 'applied_at', v.created_at, 'decided_at', v.decided_at,
      'reports_30d', (select count(*)::int from assisted_reports a where a.volunteer_id = v.user_id and a.created_at > now() - interval '30 days')) order by v.created_at desc), '[]') from volunteers v where v.constituency_id = c.id),
    'kiosks', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'label', k.label, 'place_text', k.place_text, 'status', k.status) order by k.created_at), '[]') from kiosks k where k.constituency_id = c.id));
end $$;
revoke all on function apply_volunteer(text, text), decide_volunteer(uuid, text, text), withdraw_volunteer(uuid), create_kiosk(text, text, text), retire_kiosk(uuid),
  submit_assisted_report(text, uuid, jsonb, text, text, text, text, double precision, double precision), my_assisted_reports(), office_volunteers(text) from public, anon;
grant execute on function apply_volunteer(text, text), decide_volunteer(uuid, text, text), withdraw_volunteer(uuid), create_kiosk(text, text, text), retire_kiosk(uuid),
  submit_assisted_report(text, uuid, jsonb, text, text, text, text, double precision, double precision), my_assisted_reports(), office_volunteers(text) to authenticated;

-- Regional administration ------------------------------------------------------------------------------------------------------------------------------------
create table if not exists regional_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  unit_id uuid not null references admin_units on delete restrict,
  status text not null default 'active' check (status in ('active','revoked')),
  granted_by uuid references profiles on delete set null,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index if not exists regional_admins_active_uq on regional_admins (user_id, unit_id) where status = 'active';
alter table regional_admins enable row level security;
drop policy if exists regional_admins_select on regional_admins;
create policy regional_admins_select on regional_admins for select using (user_id = auth.uid() or is_admin());
revoke all on regional_admins from anon, authenticated;
grant select on regional_admins to authenticated;

-- Only staff accounts may hold a regional scope (same rule as office membership).
create or replace function regional_admins_guard() returns trigger language plpgsql as $$
begin
  if new.status = 'active' and not exists (select 1 from profiles where id = new.user_id and role = 'staff') then
    raise exception 'regional administrators must have platform role staff' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists regional_admins_guard_trg on regional_admins;
create trigger regional_admins_guard_trg before insert or update on regional_admins for each row execute function regional_admins_guard();

-- Units under (and including) the caller's regional units, and the areas they cover. Internal.
create or replace function regional_unit_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  with recursive t as (
    select u.id from admin_units u join regional_admins r on r.unit_id = u.id
      join profiles p on p.id = r.user_id
     where r.user_id = auth.uid() and r.status = 'active' and p.account_status = 'active' and p.role = 'staff' and mfa_ok()
    union
    select u.id from admin_units u join t on u.parent_id = t.id)
  select id from t $$;
revoke all on function regional_unit_ids() from public, anon;
grant execute on function regional_unit_ids() to authenticated;

create or replace function grant_regional_admin(p_user uuid, p_unit_code text, p_level text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u admin_units%rowtype; r regional_admins%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into u from admin_units where code = p_unit_code and level = p_level and is_active and country_code = active_country();
  if not found then raise exception 'unit not found' using errcode = 'JK404'; end if;
  if not exists (select 1 from profiles where id = p_user and role = 'staff' and account_status = 'active') then raise exception 'the person must be an active staff account' using errcode = 'JK002', detail = 'user'; end if;
  select * into r from regional_admins where user_id = p_user and unit_id = u.id and status = 'active';
  if found then return jsonb_build_object('id', r.id, 'status', r.status); end if;
  insert into regional_admins (user_id, unit_id, granted_by, note) values (p_user, u.id, auth.uid(), nullif(btrim(coalesce(p_note, '')), '')) returning * into r;
  perform audit_write('regional_admin.grant', 'profile', p_user::text, null, jsonb_build_object('unit', u.code, 'level', u.level));
  return jsonb_build_object('id', r.id, 'status', r.status);
end $$;

create or replace function revoke_regional_admin(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r regional_admins%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into r from regional_admins where id = p_id;
  if not found then raise exception 'not found' using errcode = 'JK404'; end if;
  update regional_admins set status = 'revoked', revoked_at = coalesce(revoked_at, now()) where id = r.id;
  perform audit_write('regional_admin.revoke', 'profile', r.user_id::text, jsonb_build_object('status', r.status), jsonb_build_object('status', 'revoked'));
  return jsonb_build_object('id', r.id, 'status', 'revoked');
end $$;

create or replace function list_regional_admins() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'unit_code', u.code, 'level', u.level, 'unit_name_en', u.name_en, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc), '[]')
    from regional_admins r join admin_units u on u.id = r.unit_id);
end $$;

-- Aggregate counts per area inside the caller's scope: no reporter, no text, no case rows. Open = not resolved, closed, rejected or duplicate.
create or replace function regional_overview(p_unit_code text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare areas jsonb;
begin
  if not exists (select 1 from regional_unit_ids()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'constituency', c.key, 'name_en', c.name_en, 'name_bn', c.name_bn, 'is_sample', c.is_demo,
      'open_issues', (select count(*)::int from issues i where i.constituency_id = c.id and i.status not in ('resolved','closed','rejected','duplicate')),
      'new_30d', (select count(*)::int from issues i where i.constituency_id = c.id and i.created_at > now() - interval '30 days'),
      'resolved_30d', (select count(*)::int from issues i where i.constituency_id = c.id and i.resolved_at > now() - interval '30 days'),
      'overdue_first_response', (select count(*)::int from issue_sla s join issues i on i.id = s.issue_id where i.constituency_id = c.id and s.acknowledged_at is null and s.ack_due_at < now() and i.status not in ('resolved','closed','rejected','duplicate')),
      'active_staff', (select count(*)::int from office_members m where m.constituency_id = c.id and m.status = 'active'),
      'has_mp', exists (select 1 from office_members m where m.constituency_id = c.id and m.status = 'active' and m.office_role = 'mp')) order by c.key), '[]') into areas
  from constituencies c
  where c.is_active and c.id in (select cu.constituency_id from constituency_units cu where cu.unit_id in (select regional_unit_ids()))
    and (p_unit_code is null or c.id in (
      with recursive d as (select id from admin_units where code = p_unit_code and id in (select regional_unit_ids()) union select u.id from admin_units u join d on u.parent_id = d.id)
      select cu.constituency_id from constituency_units cu where cu.unit_id in (select id from d)));
  return jsonb_build_object('areas', areas, 'definition', 'Counts per area inside your region. No names, texts or locations of individual reports.');
end $$;

create or replace function my_regional_units() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', u.code, 'level', u.level, 'name_en', u.name_en, 'name_bn', u.name_bn) order by u.level, u.code), '[]')
  from admin_units u join regional_admins r on r.unit_id = u.id where r.user_id = auth.uid() and r.status = 'active' $$;
revoke all on function grant_regional_admin(uuid, text, text, text), revoke_regional_admin(uuid), list_regional_admins(), regional_overview(text), my_regional_units() from public, anon;
grant execute on function grant_regional_admin(uuid, text, text, text), revoke_regional_admin(uuid), list_regional_admins(), regional_overview(text), my_regional_units() to authenticated;

insert into feature_flags (key, enabled, data_status, description) values
  ('assisted_reporting', false, 'planned', 'Volunteer and kiosk reporting on behalf of someone (needs trained volunteers and the conduct and consent texts reviewed)'),
  ('regional_admin', true, 'live', 'Regional administrators: aggregate counts across the areas of one administrative unit')
on conflict (key) do nothing;
