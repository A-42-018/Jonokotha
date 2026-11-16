-- Phase 5 (B5.7; masterplan §7.13, §8.1, §12.2, §16): administrative hierarchy and uncertain-boundary lookup.
--   * admin_units: division > district > upazila or city > union or ward, imported from a SOURCED file only (no invented data).
--   * constituency_units: which units a constituency covers (many to many).
--   * constituency_candidates(): ALL areas that could contain a point; `certain` is true only for an exact verified-boundary match.
--   * location_change_requests: a coordinate change that would move the report into another area (or that cannot be placed) is held for review.
-- PostGIS is NOT enabled: point-in-polygon runs in SQL over the stored GeoJSON (0015) with a bounding-box prefilter, which is exact for the
-- pilot's few dozen areas. Enable PostGIS and replace geometry_contains() when boundaries pass a few hundred polygons (see docs/architecture.md).
-- Requires 0030-0032. Safe to run twice.

create table if not exists admin_units (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'BD',
  level text not null check (level in ('division','district','upazila','city','union','ward')),
  code text not null check (code ~ '^[A-Za-z0-9._-]{1,40}$'),
  name_bn text not null check (char_length(name_bn) between 1 and 120),
  name_en text not null check (char_length(name_en) between 1 and 120),
  parent_id uuid references admin_units on delete restrict,
  source_id uuid references knowledge_sources on delete set null,
  verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_code, level, code)
);
create index if not exists admin_units_parent_idx on admin_units (parent_id);
create table if not exists constituency_units (
  constituency_id uuid not null references constituencies on delete cascade,
  unit_id uuid not null references admin_units on delete cascade,
  primary key (constituency_id, unit_id)
);
alter table admin_units enable row level security;
alter table constituency_units enable row level security;
drop policy if exists admin_units_public on admin_units;
create policy admin_units_public on admin_units for select using (true);
drop policy if exists constituency_units_public on constituency_units;
create policy constituency_units_public on constituency_units for select using (true);
revoke all on admin_units, constituency_units from anon, authenticated;
grant select on admin_units, constituency_units to anon, authenticated;

-- Parents must be one level up: division > district > (upazila | city) > (union | ward).
create or replace function admin_units_guard() returns trigger language plpgsql as $$
declare pl text;
begin
  if new.parent_id is null then
    if new.level <> 'division' then raise exception 'only a division has no parent' using errcode = 'JK002', detail = 'parent_code'; end if;
  else
    select level into pl from admin_units where id = new.parent_id;
    if not ((new.level = 'district' and pl = 'division') or (new.level in ('upazila','city') and pl = 'district') or (new.level in ('union','ward') and pl in ('upazila','city'))) then
      raise exception 'a % cannot sit under a %', new.level, pl using errcode = 'JK002', detail = 'parent_code';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists admin_units_guard_trg on admin_units;
create trigger admin_units_guard_trg before insert or update of level, parent_id on admin_units for each row execute function admin_units_guard();

-- Import from a verified file. p_items: [{level, code, name_bn, name_en, parent_code?}] in parent-first order; one transaction; max 500.
create or replace function import_admin_units(p_source jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sid uuid; it jsonb; n integer := 0; par uuid; cc text := coalesce(p_source ->> 'country', 'BD');
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 500 then raise exception 'items' using errcode = 'JK002', detail = 'items'; end if;
  if coalesce(p_source ->> 'name', '') = '' or coalesce(p_source ->> 'url', '') !~ '^https?://' or coalesce(p_source ->> 'license', '') = '' or coalesce(p_source ->> 'fetched_at', '') = '' then
    raise exception 'the import needs the source name, link, licence and fetch date' using errcode = 'JK002', detail = 'source';
  end if;
  insert into knowledge_sources (name, url, license_or_terms, collection_method, fetched_at, is_demo) values (p_source ->> 'name', p_source ->> 'url', p_source ->> 'license', 'file', (p_source ->> 'fetched_at')::timestamptz, false) returning id into sid;
  for it in select * from jsonb_array_elements(p_items) loop
    par := null;
    if it ->> 'parent_code' is not null then
      select id into par from admin_units where country_code = cc and code = it ->> 'parent_code' and level <> (it ->> 'level');
      if par is null then raise exception 'unknown parent %', it ->> 'parent_code' using errcode = 'JK002', detail = 'parent_code'; end if;
    end if;
    insert into admin_units (country_code, level, code, name_bn, name_en, parent_id, source_id, verified_at)
    values (cc, it ->> 'level', it ->> 'code', it ->> 'name_bn', it ->> 'name_en', par, sid, now())
    on conflict (country_code, level, code) do update set name_bn = excluded.name_bn, name_en = excluded.name_en, parent_id = excluded.parent_id, source_id = sid, verified_at = now();
    n := n + 1;
  end loop;
  perform audit_write('admin_units.import', 'knowledge_source', sid::text, null, jsonb_build_object('count', n), jsonb_build_object('source', p_source ->> 'name'));
  return jsonb_build_object('source_id', sid, 'imported', n);
exception when check_violation or invalid_text_representation or datetime_field_overflow then raise exception 'invalid import data' using errcode = 'JK002', detail = 'items';
end $$;

create or replace function link_constituency_units(p_key text, p_unit_codes text[], p_country text default 'BD') returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; n integer;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into c from constituencies where key = p_key;
  if not found then raise exception 'area not found' using errcode = 'JK404'; end if;
  insert into constituency_units (constituency_id, unit_id) select c.id, u.id from admin_units u where u.country_code = p_country and u.code = any (p_unit_codes) on conflict do nothing;
  get diagnostics n = row_count;
  perform audit_write('constituency.link_units', 'constituency', p_key, null, jsonb_build_object('linked', n));
  return jsonb_build_object('key', p_key, 'linked', n);
end $$;

-- Path from a unit to its division (names, top-down).
create or replace function admin_unit_path(p_unit uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with recursive up as (select u.*, 0 as d from admin_units u where u.id = p_unit union all select p.*, up.d + 1 from admin_units p join up on up.parent_id = p.id)
  select coalesce(jsonb_agg(jsonb_build_object('level', level, 'code', code, 'name_bn', name_bn, 'name_en', name_en) order by d desc), '[]') from up $$;
grant execute on function admin_unit_path(uuid) to anon, authenticated;

-- Every active area that could contain the point. Exact (certain) only with a verified boundary; otherwise the box counts as "possible".
create or replace function constituency_candidates(p_lat double precision, p_lng double precision)
returns table (key text, name_bn text, name_en text, district text, is_demo boolean, method text, certain boolean)
language sql stable security definer set search_path = public as $$
  select c.key, c.name_bn, c.name_en, c.district, c.is_demo,
         case when c.boundary is not null then 'boundary' else 'bounding_box' end,
         (c.boundary is not null and c.boundary_verified_at is not null)
  from constituencies c
  where c.is_active and valid_bd_point(p_lat, p_lng) and c.min_lat is not null
    and p_lat between c.min_lat and c.max_lat and p_lng between c.min_lng and c.max_lng
    and (c.boundary is null or geometry_contains(p_lat, p_lng, c.boundary))
  order by (c.boundary is null), (c.max_lat - c.min_lat) * (c.max_lng - c.min_lng)
  limit 10 $$;
revoke all on function constituency_candidates(double precision, double precision) from public;
grant execute on function constituency_candidates(double precision, double precision) to anon, authenticated;

-- Location change review -----------------------------------------------------------------------------------------------------------------
create table if not exists location_change_requests (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues on delete cascade,
  requested_by uuid references profiles on delete set null,
  new_lat double precision not null,
  new_lng double precision not null check (valid_bd_point(new_lat, new_lng)),
  candidate_keys text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references profiles on delete set null,
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists location_change_issue_idx on location_change_requests (issue_id, status);
alter table location_change_requests enable row level security;
drop policy if exists location_change_select on location_change_requests;
create policy location_change_select on location_change_requests for select
  using (requested_by = auth.uid() or can_view_issue(issue_id) or is_admin());
revoke all on location_change_requests from anon, authenticated;
grant select on location_change_requests to authenticated;

-- A decided move is the only way constituency or coordinates change under a user session; flagged inside the transaction by our own functions.
create or replace function issues_guard() returns trigger language plpgsql as $$
declare moving boolean := coalesce(current_setting('app.location_change', true), '') = 'on';
begin
  if auth.uid() is null then return new; end if;
  if (new.id, new.ref, new.reporter_id, new.title, new.description, new.area, new.category, new.category_id, new.created_at, new.submitted_at, new.is_demo)
     is distinct from (old.id, old.ref, old.reporter_id, old.title, old.description, old.area, old.category, old.category_id, old.created_at, old.submitted_at, old.is_demo)
     or (not moving and (new.constituency_id, new.constituency_key, new.lat, new.lng) is distinct from (old.constituency_id, old.constituency_key, old.lat, old.lng)) then
    raise exception 'issue content is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function request_location_change(p_ref text, p_lat double precision, p_lng double precision) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i issues%rowtype; uid uuid := auth.uid(); keys text[]; certain_one boolean; cur text; r location_change_requests%rowtype;
begin
  select * into i from issues where ref = p_ref;
  if not found or not (i.reporter_id = uid or office_can(i.constituency_id, 'update', i.assigned_to)) then raise exception 'issue not found' using errcode = 'JK404'; end if;
  if not valid_bd_point(p_lat, p_lng) then raise exception 'location' using errcode = 'JK002', detail = 'lat'; end if;
  if exists (select 1 from location_change_requests where issue_id = i.id and status = 'pending') then raise exception 'a location change is already waiting for review' using errcode = 'JK003', detail = 'pending'; end if;
  select array_agg(key order by certain desc, key), coalesce(bool_and(certain) and count(*) = 1, false) into keys, certain_one from constituency_candidates(p_lat, p_lng);
  cur := i.constituency_key;
  if certain_one and keys[1] = cur or (keys is not null and cardinality(keys) = 1 and keys[1] = cur) then
    perform set_config('app.location_change', 'on', true);
    update issues set lat = p_lat, lng = p_lng where id = i.id;
    perform set_config('app.location_change', 'off', true);
    perform audit_write('issue.location_change', 'issue', i.id::text, jsonb_build_object('lat', i.lat, 'lng', i.lng), jsonb_build_object('lat', p_lat, 'lng', p_lng));
    return jsonb_build_object('ref', i.ref, 'applied', true);
  end if;
  insert into location_change_requests (issue_id, requested_by, new_lat, new_lng, candidate_keys) values (i.id, uid, p_lat, p_lng, coalesce(keys, '{}')) returning * into r;
  perform audit_write('issue.location_change_request', 'issue', i.id::text, null, jsonb_build_object('candidates', coalesce(keys, '{}')), jsonb_build_object('request', r.id));
  return jsonb_build_object('ref', i.ref, 'applied', false, 'review_id', r.id, 'candidates', coalesce(keys, '{}'));
end $$;

create or replace function decide_location_change(p_id uuid, p_decision text, p_target text default null, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r location_change_requests%rowtype; i issues%rowtype; tgt constituencies%rowtype;
begin
  select * into r from location_change_requests where id = p_id for update;
  if not found then raise exception 'request not found' using errcode = 'JK404'; end if;
  select * into i from issues where id = r.issue_id;
  if not (is_admin() or office_can(i.constituency_id, 'assign', null)) then
    if office_can(i.constituency_id, 'view', i.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
    raise exception 'request not found' using errcode = 'JK404';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if r.status <> 'pending' then raise exception 'already decided' using errcode = 'JK003', detail = 'decided'; end if;
  if p_decision = 'approve' then
    select * into tgt from constituencies where key = coalesce(p_target, i.constituency_key) and is_active;
    if not found or not (tgt.key = any (r.candidate_keys) or tgt.key = i.constituency_key) then raise exception 'choose one of the possible areas' using errcode = 'JK002', detail = 'target'; end if;
    perform set_config('app.location_change', 'on', true);
    update issues set lat = r.new_lat, lng = r.new_lng, constituency_id = tgt.id, constituency_key = tgt.key, assigned_to = case when tgt.id <> i.constituency_id then null else assigned_to end where id = i.id;
    perform set_config('app.location_change', 'off', true);
  end if;
  update location_change_requests set status = case when p_decision = 'approve' then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now(), decision_note = left(p_note, 300) where id = r.id;
  perform audit_write('issue.location_change_' || p_decision, 'issue', i.id::text, jsonb_build_object('constituency', i.constituency_key), jsonb_build_object('constituency', case when p_decision = 'approve' then coalesce(p_target, i.constituency_key) else i.constituency_key end), jsonb_build_object('request', r.id));
  return jsonb_build_object('id', r.id, 'status', case when p_decision = 'approve' then 'approved' else 'rejected' end);
end $$;

revoke all on function import_admin_units(jsonb, jsonb), link_constituency_units(text, text[], text), request_location_change(text, double precision, double precision), decide_location_change(uuid, text, text, text) from public, anon;
grant execute on function import_admin_units(jsonb, jsonb), link_constituency_units(text, text[], text), request_location_change(text, double precision, double precision), decide_location_change(uuid, text, text, text) to authenticated;
