-- Phase 5 (B5.3, B5.13, B5.15; masterplan §5.6, §6.4, §31 admin, §2.9, §13.10): administration APIs as audited database functions.
-- Requires 0030. Safe to run twice. Every function is admin-only (is_admin() includes the MFA check) unless stated, and audited.
--
--   feature_flags              flag key, enabled, data_status (live | sample | demo | planned)
--   categories                 admin_upsert_category (never deleted, only deactivated); service_code for Open311 (B5.15)
--   sla                        set_sla_policy per office and category
--   directory                  admin_update_constituency, admin_upsert_agency (a source and check date are required)
--   platform invitations       moderator and admin accounts join by invitation, like office staff
--   integration_settings       which providers are enabled (keys themselves are never stored here or returned)
--   security_events            auth failures, rate-limit hits and permission denials for the admin alerts feed
--   knowledge sources          add, refresh, retire
--   demo data                  load and reset, refused when app_settings.environment = 'production'

-- Feature flags and capability labels (B5.13) ------------------------------------------------------------------------------------
create table if not exists feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  enabled boolean not null default false,
  data_status text not null default 'planned' check (data_status in ('live','sample','demo','planned')),
  description text check (description is null or char_length(description) <= 300),
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table feature_flags enable row level security;
drop policy if exists feature_flags_select on feature_flags;
create policy feature_flags_select on feature_flags for select to authenticated using (true);
revoke all on feature_flags from anon, authenticated;
grant select on feature_flags to authenticated;

insert into feature_flags (key, enabled, data_status, description) values
  ('idea_comments', true, 'live', 'Comments on public ideas (moderated, rate limited)'),
  ('polls', true, 'live', 'Office polls with one vote per verified account'),
  ('video_reports', true, 'live', 'Short video evidence on reports (size and type limits)'),
  ('agency_liaison', true, 'live', 'Agency liaison accounts and referral tasks'),
  ('mp_approval', true, 'live', 'MP approval of publications where an area requires it'),
  ('translation', true, 'live', 'On-demand Bangla and English translation, labelled as machine translation'),
  ('insight_agent', true, 'live', 'Hotspot and trend briefs, reviewed by the office before sharing'),
  ('banglish_search', true, 'live', 'Search that finds Bangla text from Latin-letter spelling'),
  ('official_registration', false, 'planned', 'Showing a case as officially registered by an agency (needs a confirmed integration)'),
  ('sms_verification', false, 'planned', 'SMS codes for critical verification (needs consent and a budget)'),
  ('open311_api', false, 'planned', 'Open311 GeoReport v2 interface (Release 2)')
on conflict (key) do nothing;

-- Safe for anonymous clients: key, enabled and the label only.
create or replace function public_feature_flags() returns table (key text, enabled boolean, data_status text)
language sql stable security definer set search_path = public as $$ select f.key, f.enabled, f.data_status from feature_flags f order by f.key $$;
revoke all on function public_feature_flags() from public;
grant execute on function public_feature_flags() to anon, authenticated, service_role;

create or replace function set_feature_flag(p_key text, p_enabled boolean, p_status text default null, p_description text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o feature_flags%rowtype; n feature_flags%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('live','sample','demo','planned') then raise exception 'status' using errcode = 'JK002', detail = 'data_status'; end if;
  select * into o from feature_flags where key = p_key;
  if not found then raise exception 'flag not found' using errcode = 'JK404'; end if;
  update feature_flags set enabled = coalesce(p_enabled, enabled), data_status = coalesce(p_status, data_status), description = coalesce(left(p_description, 300), description),
    updated_by = auth.uid(), updated_at = now() where key = p_key returning * into n;
  perform audit_write('feature_flag.set', 'feature_flag', p_key, jsonb_build_object('enabled', o.enabled, 'data_status', o.data_status), jsonb_build_object('enabled', n.enabled, 'data_status', n.data_status));
  return jsonb_build_object('key', n.key, 'enabled', n.enabled, 'data_status', n.data_status);
end $$;

create or replace function create_feature_flag(p_key text, p_enabled boolean, p_status text, p_description text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if exists (select 1 from feature_flags where key = p_key) then raise exception 'flag exists' using errcode = 'JK003', detail = 'exists'; end if;
  insert into feature_flags (key, enabled, data_status, description, updated_by) values (p_key, coalesce(p_enabled, false), coalesce(p_status, 'planned'), left(p_description, 300), auth.uid());
  perform audit_write('feature_flag.create', 'feature_flag', p_key, null, jsonb_build_object('enabled', coalesce(p_enabled, false)));
  return jsonb_build_object('key', p_key);
exception when check_violation then raise exception 'invalid flag' using errcode = 'JK002', detail = 'key';
end $$;

-- Categories (B5.3, B5.15) ---------------------------------------------------------------------------------------------------------
-- service_code is the stable public code Open311 clients will use; it never changes once set.
alter table issue_categories add column if not exists service_code text;
update issue_categories set service_code = 'JK-' || upper(replace(slug, '_', '-')) where service_code is null;
alter table issue_categories alter column service_code set not null;
create unique index if not exists issue_categories_service_code_uq on issue_categories (service_code);
create or replace function issue_categories_code_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.service_code is distinct from old.service_code then raise exception 'a category service code never changes' using errcode = '42501'; end if;
  if tg_op = 'INSERT' and new.service_code is null then new.service_code := 'JK-' || upper(replace(new.slug, '_', '-')); end if;
  return new;
end $$;
drop trigger if exists issue_categories_code_guard_trg on issue_categories;
create trigger issue_categories_code_guard_trg before insert or update on issue_categories for each row execute function issue_categories_code_guard();

create or replace function admin_upsert_category(p_slug text, p_name_bn text, p_name_en text, p_parent text default null, p_priority text default 'normal', p_active boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare par uuid; v issue_categories%rowtype; created boolean := false;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_slug !~ '^[a-z][a-z0-9_]{1,39}$' then raise exception 'slug' using errcode = 'JK002', detail = 'slug'; end if;
  if char_length(btrim(coalesce(p_name_bn, ''))) not between 1 and 80 then raise exception 'name_bn' using errcode = 'JK002', detail = 'name_bn'; end if;
  if char_length(btrim(coalesce(p_name_en, ''))) not between 1 and 80 then raise exception 'name_en' using errcode = 'JK002', detail = 'name_en'; end if;
  if p_priority not in ('low','normal','high','urgent') then raise exception 'priority' using errcode = 'JK002', detail = 'default_priority'; end if;
  if p_parent is not null then
    select id into par from issue_categories where slug = p_parent and parent_id is null;
    if par is null or p_parent = p_slug then raise exception 'parent' using errcode = 'JK002', detail = 'parent'; end if;
  end if;
  select * into v from issue_categories where slug = p_slug;
  if found then
    update issue_categories set name_bn = btrim(p_name_bn), name_en = btrim(p_name_en), parent_id = par, default_priority = p_priority, is_active = coalesce(p_active, true) where id = v.id;
  else
    created := true;
    insert into issue_categories (slug, name_bn, name_en, parent_id, default_priority, is_active) values (p_slug, btrim(p_name_bn), btrim(p_name_en), par, p_priority, coalesce(p_active, true));
  end if;
  perform audit_write('category.' || case when created then 'create' else 'update' end, 'issue_category', p_slug, case when created then null else to_jsonb(v) end,
    jsonb_build_object('name_en', btrim(p_name_en), 'active', coalesce(p_active, true), 'priority', p_priority));
  return jsonb_build_object('slug', p_slug, 'created', created);
end $$;

-- SLA targets per office and category ------------------------------------------------------------------------------------------------
create or replace function set_sla_policy(p_constituency text, p_category text, p_ack_hours integer, p_update_hours integer, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid; cat uuid; v sla_policies%rowtype;
begin
  if p_constituency is not null then
    select id into cid from constituencies where key = p_constituency and is_active;
    if cid is null or not (is_admin() or office_can(cid, 'view', null)) then raise exception 'area not found' using errcode = 'JK404'; end if;
    if not (is_admin() or office_can(cid, 'decide', null)) then raise exception 'not allowed' using errcode = '42501'; end if;
  elsif not is_admin() then
    raise exception 'administrators only' using errcode = '42501';
  end if;
  if p_category is not null then
    select id into cat from issue_categories where slug = p_category;
    if cat is null then raise exception 'category' using errcode = 'JK002', detail = 'category'; end if;
  end if;
  if p_ack_hours not between 1 and 720 or p_update_hours not between 1 and 2160 then raise exception 'hours' using errcode = 'JK002', detail = 'ack_target_hours'; end if;
  select * into v from sla_policies where is_active and constituency_id is not distinct from cid and category_id is not distinct from cat;
  if found then
    update sla_policies set ack_target_hours = p_ack_hours, update_target_hours = p_update_hours, note = coalesce(left(p_note, 300), note), updated_at = now() where id = v.id;
  else
    insert into sla_policies (constituency_id, category_id, ack_target_hours, update_target_hours, note) values (cid, cat, p_ack_hours, p_update_hours, left(p_note, 300)) returning * into v;
  end if;
  perform audit_write('sla_policy.set', 'sla_policy', v.id::text, null, jsonb_build_object('ack', p_ack_hours, 'update', p_update_hours), jsonb_build_object('constituency', p_constituency, 'category', p_category));
  return jsonb_build_object('id', v.id, 'ack_target_hours', p_ack_hours, 'update_target_hours', p_update_hours);
end $$;

-- Directory records -----------------------------------------------------------------------------------------------------------------
create or replace function admin_update_constituency(p_key text, p_name_bn text default null, p_name_en text default null, p_district text default null, p_upazila text default null, p_active boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o constituencies%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into o from constituencies where key = p_key;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  update constituencies set name_bn = coalesce(nullif(btrim(p_name_bn), ''), name_bn), name_en = coalesce(nullif(btrim(p_name_en), ''), name_en),
    district = coalesce(nullif(btrim(p_district), ''), district), upazila_or_city = coalesce(nullif(btrim(p_upazila), ''), upazila_or_city), is_active = coalesce(p_active, is_active) where id = o.id;
  perform audit_write('constituency.update', 'constituency', p_key, jsonb_build_object('is_active', o.is_active, 'name_en', o.name_en), jsonb_build_object('is_active', coalesce(p_active, o.is_active), 'name_en', coalesce(p_name_en, o.name_en)));
  return jsonb_build_object('key', p_key);
end $$;

create or replace function admin_upsert_agency(p_key text, p_name_bn text, p_name_en text, p_categories text[], p_source text, p_url text, p_checked date, p_level text default null, p_channel text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare created boolean := false;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_key !~ '^[a-z0-9-]{2,60}$' then raise exception 'key' using errcode = 'JK002', detail = 'key'; end if;
  if coalesce(p_source, '') = '' or p_checked is null or (p_url is not null and p_url !~ '^https?://') then raise exception 'an agency record needs a source and the date it was checked' using errcode = 'JK002', detail = 'source'; end if;
  if p_level is not null and p_level not in ('national','division','district','upazila','city','union') then raise exception 'level' using errcode = 'JK002', detail = 'jurisdiction_level'; end if;
  created := not exists (select 1 from agencies where key = p_key);
  insert into agencies (key, name_bn, name_en, categories, source, url, checked_at, jurisdiction_level, contact_channel)
  values (p_key, btrim(p_name_bn), btrim(p_name_en), coalesce(p_categories, '{}'), p_source, p_url, p_checked, p_level, left(p_channel, 300))
  on conflict (key) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, categories = excluded.categories, source = excluded.source, url = excluded.url,
    checked_at = excluded.checked_at, jurisdiction_level = excluded.jurisdiction_level, contact_channel = excluded.contact_channel;
  perform audit_write('agency.' || case when created then 'create' else 'update' end, 'agency', p_key, null, jsonb_build_object('name_en', p_name_en, 'source', p_source));
  return jsonb_build_object('key', p_key, 'created', created);
end $$;

-- Platform invitations (moderators and admins) ---------------------------------------------------------------------------------------
create table if not exists platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  role text not null check (role in ('moderator','admin')),
  invited_by uuid references profiles on delete set null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  expires_at timestamptz not null default now() + interval '3 days',
  accepted_by uuid references profiles on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table platform_invitations enable row level security;
drop policy if exists platform_invitations_select on platform_invitations;
create policy platform_invitations_select on platform_invitations for select using (is_admin());
revoke all on platform_invitations from anon, authenticated;
grant select (id, email, role, status, expires_at, created_at, accepted_at) on platform_invitations to authenticated;

create or replace function platform_invite_accepted(p_user uuid, p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_invitations where accepted_by = p_user and status = 'accepted' and role = p_role and accepted_at > now() - interval '1 minute') $$;
revoke all on function platform_invite_accepted(uuid, text) from public, anon, authenticated;

create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.account_status is distinct from old.account_status)
     and auth.uid() is not null and not is_admin()
     and not (old.role = 'citizen' and new.role = 'staff' and new.account_status = old.account_status and new.id = auth.uid() and invitation_just_accepted(new.id))
     and not (old.role = 'citizen' and new.role in ('moderator','admin') and new.account_status = old.account_status and new.id = auth.uid() and platform_invite_accepted(new.id, new.role)) then
    raise exception 'role and account status can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function create_platform_invitation(p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tok text := encode(extensions.gen_random_bytes(24), 'hex'); v platform_invitations%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_role not in ('moderator','admin') then raise exception 'role' using errcode = 'JK002', detail = 'role'; end if;
  if exists (select 1 from platform_invitations where lower(email) = lower(p_email) and status = 'pending' and expires_at > now()) then
    raise exception 'an invitation is already pending' using errcode = 'JK003', detail = 'already_invited';
  end if;
  insert into platform_invitations (email, role, invited_by, token_hash) values (btrim(p_email), p_role, auth.uid(), encode(extensions.digest(tok, 'sha256'), 'hex')) returning * into v;
  perform audit_write('platform_invitation.create', 'platform_invitation', v.id::text, null, jsonb_build_object('role', p_role), jsonb_build_object('email_domain', split_part(lower(p_email), '@', 2)));
  return jsonb_build_object('id', v.id, 'token', tok, 'expires_at', v.expires_at);
exception when check_violation then raise exception 'invalid invitation' using errcode = 'JK002', detail = 'email';
end $$;

create or replace function revoke_platform_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  update platform_invitations set status = 'revoked' where id = p_id and status = 'pending';
  if not found then raise exception 'invitation not found' using errcode = 'JK404'; end if;
  perform audit_write('platform_invitation.revoke', 'platform_invitation', p_id::text, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'revoked'));
end $$;

create or replace function accept_platform_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v platform_invitations%rowtype; uid uuid := auth.uid(); mail text; r text;
begin
  if uid is null or app_role() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into v from platform_invitations where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v.status <> 'pending' or v.expires_at <= now() then raise exception 'invitation not valid' using errcode = 'JK404'; end if;
  select email into mail from auth.users where id = uid and email_confirmed_at is not null;
  if mail is null or lower(mail) <> lower(v.email) then raise exception 'this invitation was sent to a different email address' using errcode = '42501'; end if;
  select role into r from profiles where id = uid;
  if r <> 'citizen' then raise exception 'only a citizen account can accept this invitation' using errcode = '42501'; end if;
  update platform_invitations set status = 'accepted', accepted_by = uid, accepted_at = now() where id = v.id;
  update profiles set role = v.role where id = uid;
  perform audit_write('platform_invitation.accept', 'platform_invitation', v.id::text, null, jsonb_build_object('role', v.role));
  return jsonb_build_object('role', v.role);
end $$;

-- Accounts list for administrators (no email: it stays in the auth system) -----------------------------------------------------------
create or replace function admin_list_accounts(p_role text default null, p_status text default null, p_limit integer default 50) returns table (id uuid, display_name text, role text, account_status text, created_at timestamptz, office_roles text[])
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  perform record_admin_access('profiles', null, jsonb_build_object('list', true, 'role', p_role, 'status', p_status));
  return query select p.id, p.display_name, p.role, p.account_status, p.created_at,
      coalesce((select array_agg(distinct m.office_role) from office_members m where m.user_id = p.id and m.status = 'active'), '{}')
    from profiles p where (p_role is null or p.role = p_role) and (p_status is null or p.account_status = p_status)
    order by p.created_at desc limit least(greatest(p_limit, 1), 100);
end $$;

-- Integration settings (which providers are switched on; secrets live only in the server environment) --------------------------------
create table if not exists integration_settings (
  provider text primary key check (provider ~ '^[a-z][a-z0-9_]{1,30}$'),
  kind text not null check (kind in ('ai','email','sms','push','maps','stt','embeddings','malware_scan','error_monitoring','analytics')),
  enabled boolean not null default false,
  note text check (note is null or char_length(note) <= 300),
  updated_by uuid references profiles on delete set null,
  updated_at timestamptz not null default now()
);
alter table integration_settings enable row level security;
drop policy if exists integration_settings_select on integration_settings;
create policy integration_settings_select on integration_settings for select using (is_admin());
revoke all on integration_settings from anon, authenticated;
grant select on integration_settings to authenticated;
insert into integration_settings (provider, kind, enabled) values
  ('anthropic','ai',true), ('resend','email',false), ('web_push','push',false), ('maplibre','maps',true), ('stt','stt',false), ('embeddings','embeddings',false),
  ('sentry','error_monitoring',false), ('clamav','malware_scan',false), ('sms','sms',false), ('plausible','analytics',false)
on conflict (provider) do nothing;

create or replace function set_integration_setting(p_provider text, p_enabled boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o integration_settings%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into o from integration_settings where provider = p_provider;
  if not found then raise exception 'provider not found' using errcode = 'JK404'; end if;
  update integration_settings set enabled = coalesce(p_enabled, enabled), note = coalesce(left(p_note, 300), note), updated_by = auth.uid(), updated_at = now() where provider = p_provider;
  perform audit_write('integration.set', 'integration', p_provider, jsonb_build_object('enabled', o.enabled), jsonb_build_object('enabled', coalesce(p_enabled, o.enabled)));
  return jsonb_build_object('provider', p_provider, 'enabled', coalesce(p_enabled, o.enabled));
end $$;

-- Security alerts feed -----------------------------------------------------------------------------------------------------------------
-- No personal data: the IP is stored only as a one-way hash, no bodies, no tokens. Kept 90 days (purge_security_events).
create table if not exists security_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('auth_failure','rate_limit','permission_denied','csrf_blocked','upload_rejected')),
  route text check (route is null or char_length(route) <= 120),
  ip_hash text check (ip_hash is null or char_length(ip_hash) <= 64),
  actor_id uuid,
  detail text check (detail is null or char_length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists security_events_idx on security_events (created_at desc, kind);
alter table security_events enable row level security;
drop policy if exists security_events_select on security_events;
create policy security_events_select on security_events for select using (is_admin());
revoke all on security_events from anon, authenticated;
grant select on security_events to authenticated;

-- Callable by anyone (a blocked visitor is anonymous), so it is capped: more than 300 rows a minute are dropped, which keeps a flood from filling the table.
create or replace function record_security_event(p_kind text, p_route text, p_ip_hash text, p_detail text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('auth_failure','rate_limit','permission_denied','csrf_blocked','upload_rejected') then return; end if;
  if (select count(*) from security_events where created_at > now() - interval '1 minute') >= 300 then return; end if;
  insert into security_events (kind, route, ip_hash, actor_id, detail) values (p_kind, left(p_route, 120), left(p_ip_hash, 64), auth.uid(), left(p_detail, 200));
end $$;
revoke all on function record_security_event(text, text, text, text) from public;
grant execute on function record_security_event(text, text, text, text) to anon, authenticated, service_role;

create or replace function purge_security_events() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from security_events where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function purge_security_events() from public, anon, authenticated;
grant execute on function purge_security_events() to service_role;

-- Knowledge source management --------------------------------------------------------------------------------------------------------
create or replace function admin_manage_knowledge_source(p_action text, p_id uuid default null, p_name text default null, p_url text default null, p_license text default null, p_method text default 'manual') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v knowledge_sources%rowtype;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_action = 'add' then
    if char_length(btrim(coalesce(p_name, ''))) < 3 or coalesce(p_url, '') !~ '^https?://' or char_length(btrim(coalesce(p_license, ''))) < 2 then
      raise exception 'a source needs a name, a link and its licence or terms' using errcode = 'JK002', detail = 'name';
    end if;
    insert into knowledge_sources (name, url, license_or_terms, collection_method, fetched_at, is_demo) values (btrim(p_name), p_url, btrim(p_license), coalesce(p_method, 'manual'), now(), false) returning * into v;
  else
    select * into v from knowledge_sources where id = p_id;
    if not found then raise exception 'source not found' using errcode = 'JK404'; end if;
    if p_action = 'refresh' then update knowledge_sources set fetched_at = now(), status = 'active' where id = v.id returning * into v;
    elsif p_action = 'retire' then update knowledge_sources set status = 'retired' where id = v.id returning * into v;
    else raise exception 'action' using errcode = 'JK002', detail = 'action'; end if;
  end if;
  perform audit_write('knowledge_source.' || p_action, 'knowledge_source', v.id::text, null, jsonb_build_object('status', v.status, 'name', v.name));
  return jsonb_build_object('id', v.id, 'status', v.status, 'fetched_at', v.fetched_at);
exception when check_violation then raise exception 'invalid source' using errcode = 'JK002', detail = 'method';
end $$;

-- Demo data (never in production) -------------------------------------------------------------------------------------------------------
insert into app_settings (key, value, description) values ('environment', '"development"', 'development | staging | production. Demo data tools refuse to run in production')
on conflict (key) do nothing;

create or replace function not_production() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from app_settings where key = 'environment'), 'production') <> 'production' $$;

create or replace function load_demo_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; me uuid := auth.uid(); n integer := 0;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if not not_production() then raise exception 'demo data is not allowed in production' using errcode = 'JK003', detail = 'production'; end if;
  select * into c from constituencies where is_demo and is_active order by key limit 1;
  if not found then raise exception 'no demo constituency exists' using errcode = 'JK404'; end if;
  if not exists (select 1 from announcements where constituency_id = c.id and is_demo) then
    insert into announcements (constituency_id, author_id, title, body, status, published_at, is_demo)
    values (c.id, me, 'নমুনা ঘোষণা (ডেমো)', 'এটি একটি নমুনা ঘোষণা। বাস্তব তথ্য নয়।', 'published', now(), true); n := n + 1;
  end if;
  if not exists (select 1 from projects where constituency_id = c.id and is_demo) then
    insert into projects (constituency_id, title, description, status, created_by, is_demo) values (c.id, 'নমুনা প্রকল্প (ডেমো)', 'নমুনা তথ্য, বাস্তব নয়।', 'planned', me, true); n := n + 1;
  end if;
  if not exists (select 1 from ideas where constituency_id = c.id and is_demo) then
    insert into ideas (author_id, constituency_id, title, body, status, is_demo) values (me, c.id, 'নমুনা আইডিয়া (ডেমো)', 'এটি একটি নমুনা আইডিয়া। বাস্তব নয়।', 'published', true); n := n + 1;
  end if;
  perform audit_write('demo.load', 'demo_data', c.key, null, jsonb_build_object('created', n));
  return jsonb_build_object('constituency', c.key, 'created', n);
end $$;

create or replace function reset_demo_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare a integer; p integer; i integer; q integer;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if not not_production() then raise exception 'demo data is not allowed in production' using errcode = 'JK003', detail = 'production'; end if;
  delete from announcements where is_demo; get diagnostics a = row_count;
  delete from projects where is_demo; get diagnostics p = row_count;
  delete from ideas where is_demo; get diagnostics i = row_count;
  delete from questions where is_demo; get diagnostics q = row_count;
  -- Sample issues are kept: their content and events are immutable by design (scripts/seed-demo.mjs resets them with the service role).
  perform audit_write('demo.reset', 'demo_data', null, null, jsonb_build_object('announcements', a, 'projects', p, 'ideas', i, 'questions', q));
  return jsonb_build_object('announcements', a, 'projects', p, 'ideas', i, 'questions', q);
end $$;

revoke all on function set_feature_flag(text, boolean, text, text), create_feature_flag(text, boolean, text, text), admin_upsert_category(text, text, text, text, text, boolean),
  set_sla_policy(text, text, integer, integer, text), admin_update_constituency(text, text, text, text, text, boolean), admin_upsert_agency(text, text, text, text[], text, text, date, text, text),
  create_platform_invitation(text, text), revoke_platform_invitation(uuid), accept_platform_invitation(text), admin_list_accounts(text, text, integer),
  set_integration_setting(text, boolean, text), admin_manage_knowledge_source(text, uuid, text, text, text, text), load_demo_data(), reset_demo_data(), not_production() from public, anon;
grant execute on function set_feature_flag(text, boolean, text, text), create_feature_flag(text, boolean, text, text), admin_upsert_category(text, text, text, text, text, boolean),
  set_sla_policy(text, text, integer, integer, text), admin_update_constituency(text, text, text, text, text, boolean), admin_upsert_agency(text, text, text, text[], text, text, date, text, text),
  create_platform_invitation(text, text), revoke_platform_invitation(uuid), accept_platform_invitation(text), admin_list_accounts(text, text, integer),
  set_integration_setting(text, boolean, text), admin_manage_knowledge_source(text, uuid, text, text, text, text), load_demo_data(), reset_demo_data(), not_production() to authenticated;
