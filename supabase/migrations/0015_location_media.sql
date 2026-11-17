-- Phase 2.1-2.4 (masterplan §7, §13, §16): location and maps, media, and the AI agent kinds used in Phase 2.
--   * issues keep the EXACT coordinates private (reporter and in-scope office only); the public view shows a grid-snapped,
--     approximate point (cell centre; cell size = app_settings.public_location_precision_m, default 300 m).
--   * constituencies gain verified boundary geometry (GeoJSON from HDX or another sourced file) and a bounding box.
--   * issue_media gains the facts the API verifies (mime, bytes, scan status) and a review function for the office.
-- Requires 0004-0014.

create extension if not exists pg_trgm;

-- AI agent kinds ----------------------------------------------------------------------------------------------------
alter table ai_runs drop constraint if exists ai_runs_agent_check;
alter table ai_runs add constraint ai_runs_agent_check
  check (agent in ('intake','duplicate','routing','copilot','translation','insight','idea','transcription'));

-- Settings ------------------------------------------------------------------------------------------------------------
insert into app_settings (key, value, description) values
  ('public_location_precision_m', '300', 'Cell size in metres for the approximate public location of an issue'),
  ('max_media_per_issue', '5', 'Photos per issue')
on conflict (key) do nothing;

-- Boundaries ----------------------------------------------------------------------------------------------------------
alter table constituencies add column if not exists boundary jsonb;               -- GeoJSON Polygon or MultiPolygon, [lng, lat]
alter table constituencies add column if not exists boundary_source_id uuid references knowledge_sources on delete set null;
alter table constituencies add column if not exists min_lat double precision;
alter table constituencies add column if not exists max_lat double precision;
alter table constituencies add column if not exists min_lng double precision;
alter table constituencies add column if not exists max_lng double precision;
alter table constituencies drop constraint if exists constituencies_boundary_type;
alter table constituencies add constraint constituencies_boundary_type
  check (boundary is null or boundary ->> 'type' in ('Polygon','MultiPolygon'));

create or replace function ring_contains(p_lat double precision, p_lng double precision, ring jsonb) returns boolean
language plpgsql immutable as $$
declare n int := jsonb_array_length(ring); i int; j int; inside boolean := false;
        xi double precision; yi double precision; xj double precision; yj double precision;
begin
  if n < 4 then return false; end if;
  j := n - 1;
  for i in 0 .. n - 1 loop
    xi := (ring -> i ->> 0)::double precision; yi := (ring -> i ->> 1)::double precision;
    xj := (ring -> j ->> 0)::double precision; yj := (ring -> j ->> 1)::double precision;
    if ((yi > p_lat) <> (yj > p_lat)) and (p_lng < (xj - xi) * (p_lat - yi) / (yj - yi) + xi) then inside := not inside; end if;
    j := i;
  end loop;
  return inside;
end $$;

create or replace function polygon_contains(p_lat double precision, p_lng double precision, poly jsonb) returns boolean
language plpgsql immutable as $$
declare k int;
begin
  if not ring_contains(p_lat, p_lng, poly -> 0) then return false; end if;
  for k in 1 .. coalesce(jsonb_array_length(poly) - 1, 0) loop
    if ring_contains(p_lat, p_lng, poly -> k) then return false; end if;   -- inside a hole
  end loop;
  return true;
end $$;

create or replace function geometry_contains(p_lat double precision, p_lng double precision, g jsonb) returns boolean
language plpgsql immutable as $$
declare k int;
begin
  if g is null then return false; end if;
  if g ->> 'type' = 'Polygon' then return polygon_contains(p_lat, p_lng, g -> 'coordinates'); end if;
  if g ->> 'type' = 'MultiPolygon' then
    for k in 0 .. jsonb_array_length(g -> 'coordinates') - 1 loop
      if polygon_contains(p_lat, p_lng, g -> 'coordinates' -> k) then return true; end if;
    end loop;
  end if;
  return false;
end $$;

-- Bangladesh bounding box, used to reject impossible coordinates early.
create or replace function valid_bd_point(p_lat double precision, p_lng double precision) returns boolean
language sql immutable as $$ select p_lat between 20.5 and 26.8 and p_lng between 88.0 and 92.8 $$;

-- Which active constituency contains this point? Exact polygon when a verified boundary exists, otherwise bounding box.
-- Returns "method" so the UI can say how sure it is; no row means "choose your area by hand".
create or replace function lookup_constituency(p_lat double precision, p_lng double precision)
returns table (key text, name_bn text, name_en text, district text, is_demo boolean, method text)
language sql stable security definer set search_path = public as $$
  select c.key, c.name_bn, c.name_en, c.district, c.is_demo,
         case when c.boundary is not null then 'boundary' else 'bounding_box' end
  from constituencies c
  where c.is_active and valid_bd_point(p_lat, p_lng)
    and ((c.boundary is not null and p_lat between c.min_lat and c.max_lat and p_lng between c.min_lng and c.max_lng and geometry_contains(p_lat, p_lng, c.boundary))
      or (c.boundary is null and c.min_lat is not null and p_lat between c.min_lat and c.max_lat and p_lng between c.min_lng and c.max_lng))
  order by (c.boundary is null), (c.max_lat - c.min_lat) * (c.max_lng - c.min_lng)
  limit 3 $$;
revoke all on function lookup_constituency(double precision, double precision) from public;
grant execute on function lookup_constituency(double precision, double precision) to anon, authenticated;

-- Manual fallback: search areas by name (Bangla or English), district or upazila.
create or replace function search_constituencies(p_q text)
returns table (key text, name_bn text, name_en text, district text, upazila_or_city text, is_demo boolean)
language sql stable security definer set search_path = public as $$
  select c.key, c.name_bn, c.name_en, c.district, c.upazila_or_city, c.is_demo
  from constituencies c
  where c.is_active and char_length(btrim(p_q)) between 2 and 80
    and (c.name_bn ilike '%' || btrim(p_q) || '%' or c.name_en ilike '%' || btrim(p_q) || '%'
         or c.district ilike '%' || btrim(p_q) || '%' or c.upazila_or_city ilike '%' || btrim(p_q) || '%' or c.ward_or_union ilike '%' || btrim(p_q) || '%')
  order by c.is_demo, c.name_en limit 10 $$;
revoke all on function search_constituencies(text) from public;
grant execute on function search_constituencies(text) to anon, authenticated;

-- Issue location ------------------------------------------------------------------------------------------------------
alter table issues add column if not exists lat double precision;
alter table issues add column if not exists lng double precision;
alter table issues add column if not exists public_lat double precision;
alter table issues add column if not exists public_lng double precision;
alter table issues add column if not exists location_source text check (location_source is null or location_source in ('device','map','manual_area'));
alter table issues add column if not exists location_accuracy_m integer check (location_accuracy_m is null or location_accuracy_m between 0 and 100000);
alter table issues drop constraint if exists issues_location_pair;
alter table issues add constraint issues_location_pair check (
  (lat is null and lng is null and public_lat is null and public_lng is null)
  or (lat is not null and lng is not null and valid_bd_point(lat, lng) and public_lat is not null and public_lng is not null));
create index if not exists issues_public_geo_idx on issues (public_lat, public_lng) where public_lat is not null and public_visibility;

-- Approximate public point: the centre of the grid cell that holds the exact point. Deterministic, so repeated reads cannot
-- be averaged to recover the exact spot; cell size is configuration.
create or replace function issues_location_before() returns trigger
language plpgsql set search_path = public as $$
declare m double precision; g double precision; gl double precision;
begin
  if new.lat is null or new.lng is null then
    new.lat := null; new.lng := null; new.public_lat := null; new.public_lng := null; return new;
  end if;
  m := greatest(100, coalesce((select (value #>> '{}')::double precision from app_settings where key = 'public_location_precision_m'), 300));
  g := m / 111320.0;
  gl := g / greatest(0.2, cos(radians(new.lat)));
  new.public_lat := round((floor(new.lat / g) * g + g / 2)::numeric, 5);
  new.public_lng := round((floor(new.lng / gl) * gl + gl / 2)::numeric, 5);
  return new;
end $$;
drop trigger if exists issues_location_before_trg on issues;
create trigger issues_location_before_trg before insert or update of lat, lng on issues for each row execute function issues_location_before();

-- Exact coordinates are part of the immutable report (no silent moving of a report).
create or replace function issues_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.id, new.ref, new.reporter_id, new.title, new.description, new.area, new.category, new.category_id,
      new.constituency_id, new.constituency_key, new.created_at, new.submitted_at, new.is_demo, new.lat, new.lng)
     is distinct from
     (old.id, old.ref, old.reporter_id, old.title, old.description, old.area, old.category, old.category_id,
      old.constituency_id, old.constituency_key, old.created_at, old.submitted_at, old.is_demo, old.lat, old.lng) then
    raise exception 'issue content is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

-- Public view: appended columns only (approximate point, never the exact one).
create or replace view public_cases with (security_invoker = false) as
  select ref, title, category, description, area, issue_to_legacy_status(status) as status, created_at,
         ai_summary, ai_agency, ai_confidence, ai_similar, constituency_key, is_demo, status as status_detail,
         public_lat, public_lng
  from issues where public_visibility;

-- References of public issues within p_km of a point (Haversine on the APPROXIMATE public point). Capped.
create or replace function public_issue_refs_near(p_lat double precision, p_lng double precision, p_km double precision)
returns table (ref text)
language sql stable security definer set search_path = public as $$
  select i.ref from issues i
  where i.public_visibility and i.public_lat is not null and valid_bd_point(p_lat, p_lng) and p_km between 0.1 and 50
    and i.public_lat between p_lat - p_km / 111.0 and p_lat + p_km / 111.0
    and 2 * 6371 * asin(sqrt(power(sin(radians(i.public_lat - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(i.public_lat)) * power(sin(radians(i.public_lng - p_lng) / 2), 2))) <= p_km
  order by i.created_at desc limit 1000 $$;
revoke all on function public_issue_refs_near(double precision, double precision, double precision) from public;
grant execute on function public_issue_refs_near(double precision, double precision, double precision) to anon, authenticated;

-- Media ---------------------------------------------------------------------------------------------------------------
alter table issue_media add column if not exists mime_type text;
alter table issue_media add column if not exists bytes integer check (bytes is null or bytes between 1 and 20000000);
alter table issue_media add column if not exists width integer;
alter table issue_media add column if not exists height integer;
alter table issue_media add column if not exists content_hash text;
alter table issue_media add column if not exists scan_status text not null default 'not_scanned' check (scan_status in ('not_scanned','clean','infected','error'));

create or replace function issue_media_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim integer := coalesce((select (value #>> '{}')::integer from app_settings where key = 'max_media_per_issue'), 5);
begin
  if (select count(*) from issue_media where issue_id = new.issue_id) >= lim then
    raise exception 'too many photos on this issue' using errcode = 'JK003', detail = 'media_limit';
  end if;
  return new;
end $$;
drop trigger if exists issue_media_limit_trg on issue_media;
create trigger issue_media_limit_trg before insert on issue_media for each row execute function issue_media_limit();

-- The office decides whether a photo may be shown publicly (default is private). Needs the "update" permission.
create or replace function review_issue_media(p_media uuid, p_visibility text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m issue_media%rowtype; i issues%rowtype;
begin
  select * into m from issue_media where id = p_media;
  if not found then raise exception 'media not found' using errcode = 'JK404'; end if;
  select * into i from issues where id = m.issue_id;
  if not office_can(i.constituency_id, 'update', i.assigned_to) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_visibility not in ('private','office','public') or p_status not in ('approved','rejected') then
    raise exception 'invalid visibility or status' using errcode = 'JK002', detail = 'visibility';
  end if;
  if p_status = 'rejected' and p_visibility = 'public' then raise exception 'a rejected photo cannot be public' using errcode = 'JK002', detail = 'visibility'; end if;
  update issue_media set visibility = p_visibility, moderation_status = p_status where id = p_media;
  perform audit_write('issue_media.review', 'issue_media', p_media::text, jsonb_build_object('visibility', m.visibility, 'status', m.moderation_status),
                      jsonb_build_object('visibility', p_visibility, 'status', p_status), jsonb_build_object('issue', i.ref));
  return jsonb_build_object('id', p_media, 'visibility', p_visibility, 'moderation_status', p_status);
end $$;
revoke all on function review_issue_media(uuid, text, text) from public, anon;
grant execute on function review_issue_media(uuid, text, text) to authenticated;
revoke update on issue_media from authenticated;

-- Private storage bucket (objects are written and signed by the server with the service role only).
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('issue-media', 'issue-media', false, 8388608, array['image/jpeg','image/webp'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;
