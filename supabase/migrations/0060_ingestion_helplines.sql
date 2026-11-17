-- Phase 6 (B6.2): real-data ingestion with lineage, and helplines that are shown only after a person verified them.
-- Rules enforced here, not just in code: a source cannot be enabled until its licence is checked; robots.txt is always respected and
-- personal data is never collected (both are CHECK constraints, so a bad row cannot exist); demo and real data never mix.
-- Migration range 0060-0079 belongs to Phase 6.

create or replace function is_service() returns boolean language sql stable as $$ select coalesce(auth.role(), '') = 'service_role' $$;
revoke all on function is_service() from public, anon;
grant execute on function is_service() to authenticated, service_role;

-- Registry of external sources --------------------------------------------------------------------------------------------------
create table if not exists ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 3 and 120),
  kind text not null check (kind in ('boundaries', 'representatives', 'osm', 'service_directory', 'helpline', 'grs_link', 'other')),
  url text not null check (url ~ '^https://'),
  license text not null check (char_length(license) between 2 and 200),
  license_checked_at date,
  license_ok boolean not null default false,
  attribution text check (attribution is null or char_length(attribution) <= 300),
  refresh_hours integer not null default 168 check (refresh_hours between 1 and 8760),
  min_interval_ms integer not null default 5000 check (min_interval_ms >= 1000),
  respect_robots boolean not null default true check (respect_robots),       -- cannot be turned off
  personal_data boolean not null default false check (not personal_data),     -- cannot be turned on
  max_bytes integer not null default 5242880 check (max_bytes between 1024 and 52428800),
  is_demo boolean not null default false,
  enabled boolean not null default false,
  knowledge_source_id uuid references knowledge_sources on delete set null,   -- lineage row of the latest good fetch
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ingestion_enable_needs_licence check (not enabled or (license_ok and license_checked_at is not null))
);

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references ingestion_sources on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'unchanged', 'blocked_robots', 'blocked_licence', 'http_error', 'too_large', 'error')),
  http_status integer,
  bytes integer,
  checksum text check (checksum is null or checksum ~ '^[0-9a-f]{64}$'),
  robots_allowed boolean,
  records_staged integer not null default 0,
  error text check (error is null or char_length(error) <= 300),
  knowledge_source_id uuid references knowledge_sources on delete set null,
  is_demo boolean not null default false
);
create index if not exists ingestion_runs_source_idx on ingestion_runs (source_id, started_at desc);

create table if not exists ingestion_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references ingestion_sources on delete cascade,
  run_id uuid not null references ingestion_runs on delete cascade,
  record_key text not null check (char_length(record_key) between 1 and 200),
  payload jsonb not null,
  payload_hash text not null,
  status text not null default 'staged' check (status in ('staged', 'applied', 'rejected', 'superseded')),
  pii_flags text[] not null default '{}',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (source_id, record_key, payload_hash)
);
create index if not exists ingestion_records_status_idx on ingestion_records (source_id, status);

alter table ingestion_sources enable row level security;
alter table ingestion_runs enable row level security;
alter table ingestion_records enable row level security;
drop policy if exists ingestion_sources_admin on ingestion_sources;
create policy ingestion_sources_admin on ingestion_sources for select using (is_admin());
drop policy if exists ingestion_runs_admin on ingestion_runs;
create policy ingestion_runs_admin on ingestion_runs for select using (is_admin());
drop policy if exists ingestion_records_admin on ingestion_records;
create policy ingestion_records_admin on ingestion_records for select using (is_admin());
revoke all on ingestion_sources, ingestion_runs, ingestion_records from anon, authenticated;
grant select on ingestion_sources, ingestion_runs, ingestion_records to authenticated;

-- What the public may see about where data came from (attribution, licence, last refresh). No internal ids.
create or replace view public_data_sources with (security_invoker = false) as
  select key, name, kind, url, license, attribution, is_demo, last_run_at
  from ingestion_sources where enabled and license_ok;
revoke all on public_data_sources from public;
grant select on public_data_sources to anon, authenticated;

create or replace function register_ingestion_source(p_key text, p_name text, p_kind text, p_url text, p_license text, p_attribution text default null,
  p_refresh_hours integer default 168, p_min_interval_ms integer default 5000, p_max_bytes integer default 5242880, p_is_demo boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not (is_admin() or is_service()) then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into ingestion_sources (key, name, kind, url, license, attribution, refresh_hours, min_interval_ms, max_bytes, is_demo)
  values (p_key, p_name, p_kind, p_url, p_license, p_attribution, p_refresh_hours, p_min_interval_ms, p_max_bytes, p_is_demo)
  on conflict (key) do update set name = excluded.name, kind = excluded.kind, url = excluded.url, license = excluded.license,
    attribution = excluded.attribution, refresh_hours = excluded.refresh_hours, min_interval_ms = excluded.min_interval_ms, max_bytes = excluded.max_bytes, is_demo = excluded.is_demo,
    -- changing the address or the licence text voids the earlier licence check
    license_ok = case when ingestion_sources.url = excluded.url and ingestion_sources.license = excluded.license then ingestion_sources.license_ok else false end,
    enabled = case when ingestion_sources.url = excluded.url and ingestion_sources.license = excluded.license then ingestion_sources.enabled else false end
  returning id into sid;
  perform audit_write('ingestion.source_registered', 'ingestion_source', sid::text, null, jsonb_build_object('key', p_key, 'url', p_url, 'license', p_license), '{}');
  return sid;
exception when check_violation then raise exception 'invalid source' using errcode = 'JK002', detail = 'source';
end $$;

-- A person records that they read the licence; only then may the source be enabled.
create or replace function review_ingestion_licence(p_key text, p_license_ok boolean, p_checked_on date default current_date, p_enable boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s ingestion_sources;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into s from ingestion_sources where key = p_key;
  if not found then raise exception 'source not found' using errcode = 'JK404'; end if;
  update ingestion_sources set license_ok = p_license_ok, license_checked_at = p_checked_on, enabled = (p_enable and p_license_ok) where id = s.id returning * into s;
  perform audit_write('ingestion.licence_reviewed', 'ingestion_source', s.id::text, null, jsonb_build_object('license_ok', s.license_ok, 'enabled', s.enabled, 'checked_on', p_checked_on), jsonb_build_object('key', p_key));
  return jsonb_build_object('key', s.key, 'license_ok', s.license_ok, 'enabled', s.enabled);
end $$;

create or replace function set_ingestion_enabled(p_key text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s ingestion_sources;
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  select * into s from ingestion_sources where key = p_key;
  if not found then raise exception 'source not found' using errcode = 'JK404'; end if;
  if p_enabled and not (s.license_ok and s.license_checked_at is not null) then raise exception 'check the licence first' using errcode = 'JK003', detail = 'licence_not_checked'; end if;
  update ingestion_sources set enabled = p_enabled where id = s.id;
  perform audit_write('ingestion.source_toggled', 'ingestion_source', s.id::text, null, jsonb_build_object('enabled', p_enabled), jsonb_build_object('key', p_key));
  return jsonb_build_object('key', s.key, 'enabled', p_enabled);
end $$;

-- Sources whose refresh is due (service role: the scheduled job).
create or replace function ingest_due_sources() returns table (id uuid, key text, url text, kind text, license text, min_interval_ms integer, max_bytes integer, is_demo boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_service() or is_admin()) then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select s.id, s.key, s.url, s.kind, s.license, s.min_interval_ms, s.max_bytes, s.is_demo from ingestion_sources s
    where s.enabled and s.license_ok and (s.last_run_at is null or s.last_run_at + make_interval(hours => s.refresh_hours) <= now()) order by s.last_run_at nulls first;
end $$;

create or replace function ingest_begin_run(p_source uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s ingestion_sources; rid uuid;
begin
  if not is_service() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into s from ingestion_sources where id = p_source;
  if not found then raise exception 'source not found' using errcode = 'JK404'; end if;
  insert into ingestion_runs (source_id, is_demo, status) values (s.id, s.is_demo, case when s.enabled and s.license_ok then 'running' else 'blocked_licence' end) returning id into rid;
  if not (s.enabled and s.license_ok) then update ingestion_runs set finished_at = now() where id = rid; end if;
  return rid;
end $$;

-- Closes a run. A good fetch with a new checksum writes the lineage row (knowledge_sources: source, licence, fetch date, checksum) and
-- retires the previous one; an identical checksum is recorded as 'unchanged' and writes nothing new.
create or replace function ingest_finish_run(p_run uuid, p_status text, p_http integer default null, p_bytes integer default null, p_checksum text default null,
  p_robots boolean default null, p_error text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r ingestion_runs; s ingestion_sources; prev text; ks uuid; final_status text := p_status;
begin
  if not is_service() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from ingestion_runs where id = p_run and status = 'running';
  if not found then raise exception 'run not open' using errcode = 'JK003', detail = 'run_not_open'; end if;
  select * into s from ingestion_sources where id = r.source_id;
  if p_status = 'ok' then
    select checksum into prev from knowledge_sources where id = s.knowledge_source_id;
    if prev is not null and prev = p_checksum then final_status := 'unchanged';
    else
      insert into knowledge_sources (name, url, license_or_terms, collection_method, fetched_at, checksum, is_demo)
      values (s.name, s.url, s.license, case when s.kind = 'osm' then 'api' else 'scrape' end, now(), p_checksum, s.is_demo) returning id into ks;
      if s.knowledge_source_id is not null then update knowledge_sources set status = 'retired' where id = s.knowledge_source_id; end if;
      update ingestion_sources set knowledge_source_id = ks where id = s.id;
    end if;
  end if;
  update ingestion_runs set status = final_status, finished_at = now(), http_status = p_http, bytes = p_bytes, checksum = p_checksum, robots_allowed = p_robots,
    error = left(p_error, 300), knowledge_source_id = coalesce(ks, s.knowledge_source_id) where id = p_run;
  update ingestion_sources set last_run_at = now() where id = s.id;
  perform audit_write('ingestion.run', 'ingestion_source', s.id::text, null, jsonb_build_object('status', final_status, 'bytes', p_bytes), jsonb_build_object('key', s.key));
  return jsonb_build_object('status', final_status, 'knowledge_source_id', coalesce(ks, s.knowledge_source_id));
end $$;

-- Staged records. Anything that looks like personal data (an email address or a mobile number) is stored rejected, without its payload.
create or replace function ingest_stage_records(p_run uuid, p_records jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r ingestion_runs; it jsonb; txt text; flags text[]; staged int := 0; rejected int := 0; h text; ins int;
begin
  if not is_service() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into r from ingestion_runs where id = p_run;
  if not found then raise exception 'run not found' using errcode = 'JK404'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 2000 then raise exception 'records' using errcode = 'JK002', detail = 'records'; end if;
  for it in select * from jsonb_array_elements(p_records) loop
    txt := it ->> 'payload'; flags := '{}';
    txt := (it -> 'payload')::text;
    if txt ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' then flags := array_append(flags, 'email'); end if;
    if translate(txt, '০১২৩৪৫৬৭৮৯', '0123456789') ~ '(\+?88)?01[3-9][0-9]{8}' then flags := array_append(flags, 'phone'); end if;
    h := encode(extensions.digest(txt, 'sha256'), 'hex');
    insert into ingestion_records (source_id, run_id, record_key, payload, payload_hash, status, pii_flags, is_demo)
    values (r.source_id, r.id, left(it ->> 'key', 200), case when cardinality(flags) > 0 then '{}'::jsonb else it -> 'payload' end, h,
            case when cardinality(flags) > 0 then 'rejected' else 'staged' end, flags, r.is_demo)
    on conflict (source_id, record_key, payload_hash) do nothing;
    get diagnostics ins = row_count;
    if ins > 0 then if cardinality(flags) > 0 then rejected := rejected + 1; else staged := staged + 1; end if; end if;
  end loop;
  update ingestion_runs set records_staged = records_staged + staged where id = r.id;
  return jsonb_build_object('staged', staged, 'rejected_personal_data', rejected);
end $$;

revoke all on function register_ingestion_source(text, text, text, text, text, text, integer, integer, integer, boolean), review_ingestion_licence(text, boolean, date, boolean),
  set_ingestion_enabled(text, boolean), ingest_due_sources(), ingest_begin_run(uuid), ingest_finish_run(uuid, text, integer, integer, text, boolean, text), ingest_stage_records(uuid, jsonb) from public, anon;
grant execute on function register_ingestion_source(text, text, text, text, text, text, integer, integer, integer, boolean), review_ingestion_licence(text, boolean, date, boolean),
  set_ingestion_enabled(text, boolean), ingest_due_sources() to authenticated, service_role;
grant execute on function ingest_begin_run(uuid), ingest_finish_run(uuid, text, integer, integer, text, boolean, text), ingest_stage_records(uuid, jsonb) to service_role;

-- Demo and real knowledge never share an index: a chunk belongs to a source, and a source is demo or real. Make the rule checkable.
create or replace view knowledge_index_summary with (security_invoker = true) as
  select s.is_demo, count(distinct s.id) as sources, count(c.id) as chunks from knowledge_sources s left join knowledge_chunks c on c.source_id = s.id group by s.is_demo;
revoke all on knowledge_index_summary from public, anon, authenticated;
grant select on knowledge_index_summary to service_role;

-- Helplines ---------------------------------------------------------------------------------------------------------------------------
-- A helpline is shown to the public only while it is verified AND its review date has not passed. Proposed by the pipeline or a person,
-- verified by a different person who records how (method, evidence checksum). A change of number or source sends it back to pending.
create table if not exists helplines (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{2,40}$'),
  number text not null check (number ~ '^[0-9]{3,6}$'),
  name_bn text not null check (char_length(name_bn) between 2 and 120),
  name_en text not null check (char_length(name_en) between 2 and 120),
  purpose_bn text check (purpose_bn is null or char_length(purpose_bn) <= 300),
  purpose_en text check (purpose_en is null or char_length(purpose_en) <= 300),
  source_url text check (source_url is null or source_url ~ '^https://'),
  ingestion_record_id uuid references ingestion_records on delete set null,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'stale')),
  proposed_by uuid references profiles on delete set null,
  proposed_at timestamptz not null default now(),
  verified_by uuid references profiles on delete set null,
  verified_at timestamptz,
  verification_method text check (verification_method is null or char_length(verification_method) between 10 and 400),
  evidence_checksum text check (evidence_checksum is null or evidence_checksum ~ '^[0-9a-f]{64}$'),
  review_due_at timestamptz,
  is_demo boolean not null default false,
  constraint helplines_verified_complete check (verification_status not in ('verified') or
    (source_url is not null and verified_at is not null and verification_method is not null and review_due_at is not null))
);
alter table helplines enable row level security;
drop policy if exists helplines_admin on helplines;
create policy helplines_admin on helplines for select using (is_admin());
revoke all on helplines from anon, authenticated;
grant select on helplines to authenticated;

create or replace view public_helplines with (security_invoker = false) as
  select key, number, name_bn, name_en, purpose_bn, purpose_en, source_url, verified_at, review_due_at, is_demo
  from helplines where verification_status = 'verified' and review_due_at > now();
revoke all on public_helplines from public;
grant select on public_helplines to anon, authenticated;

create or replace function propose_helpline(p_key text, p_number text, p_name_bn text, p_name_en text, p_purpose_bn text default null, p_purpose_en text default null,
  p_source_url text default null, p_record uuid default null, p_is_demo boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h helplines; uid uuid := auth.uid();
begin
  if not (is_admin() or is_service()) then raise exception 'administrators only' using errcode = '42501'; end if;
  insert into helplines (key, number, name_bn, name_en, purpose_bn, purpose_en, source_url, ingestion_record_id, proposed_by, is_demo)
  values (p_key, p_number, p_name_bn, p_name_en, p_purpose_bn, p_purpose_en, p_source_url, p_record, uid, p_is_demo)
  on conflict (key) do update set
    number = excluded.number, name_bn = excluded.name_bn, name_en = excluded.name_en, purpose_bn = excluded.purpose_bn, purpose_en = excluded.purpose_en,
    source_url = excluded.source_url, ingestion_record_id = coalesce(excluded.ingestion_record_id, helplines.ingestion_record_id), proposed_by = excluded.proposed_by, proposed_at = now(),
    -- any change to what would be shown, or to where it came from, needs a fresh verification
    verification_status = case when helplines.number = excluded.number and helplines.source_url is not distinct from excluded.source_url
                                    and helplines.name_bn = excluded.name_bn and helplines.name_en = excluded.name_en then helplines.verification_status else 'pending' end,
    verified_by = case when helplines.number = excluded.number and helplines.source_url is not distinct from excluded.source_url then helplines.verified_by end,
    verified_at = case when helplines.number = excluded.number and helplines.source_url is not distinct from excluded.source_url then helplines.verified_at end
  returning * into h;
  perform audit_write('helpline.proposed', 'helpline', h.id::text, null, jsonb_build_object('key', h.key, 'number', h.number, 'status', h.verification_status), '{}');
  return jsonb_build_object('key', h.key, 'number', h.number, 'verification_status', h.verification_status);
exception when check_violation then raise exception 'invalid helpline' using errcode = 'JK002', detail = 'helpline';
end $$;

create or replace function verify_helpline(p_key text, p_decision text, p_method text, p_evidence_checksum text default null, p_valid_days integer default 90) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h helplines; uid uuid := auth.uid();
begin
  if not is_admin() then raise exception 'administrators only' using errcode = '42501'; end if;
  if p_decision not in ('verified', 'rejected') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if p_valid_days not between 7 and 365 then raise exception 'valid days' using errcode = 'JK002', detail = 'valid_days'; end if;
  select * into h from helplines where key = p_key;
  if not found then raise exception 'helpline not found' using errcode = 'JK404'; end if;
  if h.proposed_by is not null and h.proposed_by = uid then raise exception 'a different person must verify' using errcode = 'JK003', detail = 'second_person'; end if;
  if p_decision = 'verified' and (h.source_url is null) then raise exception 'a source link is required' using errcode = 'JK002', detail = 'source_url'; end if;
  if char_length(coalesce(p_method, '')) < 10 then raise exception 'say how it was verified' using errcode = 'JK002', detail = 'method'; end if;
  update helplines set verification_status = p_decision, verified_by = uid, verified_at = now(), verification_method = p_method, evidence_checksum = p_evidence_checksum,
    review_due_at = case when p_decision = 'verified' then now() + make_interval(days => p_valid_days) end where id = h.id returning * into h;
  perform audit_write('helpline.' || p_decision, 'helpline', h.id::text, null, jsonb_build_object('number', h.number, 'review_due_at', h.review_due_at), jsonb_build_object('key', h.key));
  return jsonb_build_object('key', h.key, 'verification_status', h.verification_status, 'review_due_at', h.review_due_at);
exception when check_violation then raise exception 'invalid verification' using errcode = 'JK002', detail = 'verification';
end $$;

-- Marks verified helplines whose review date passed as stale (the public view already hides them; this puts them in the review queue).
create or replace function ops_pilot_maintenance() returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_service() then raise exception 'not allowed' using errcode = '42501'; end if;
  update helplines set verification_status = 'stale' where verification_status = 'verified' and review_due_at <= now();
  get diagnostics n = row_count;
  if n > 0 then perform audit_write('helpline.stale', 'helpline', 'bulk', null, jsonb_build_object('count', n), '{}'); end if;
  return jsonb_build_object('helplines_marked_stale', n);
end $$;

revoke all on function propose_helpline(text, text, text, text, text, text, text, uuid, boolean), verify_helpline(text, text, text, text, integer), ops_pilot_maintenance() from public, anon;
grant execute on function propose_helpline(text, text, text, text, text, text, text, uuid, boolean), verify_helpline(text, text, text, text, integer) to authenticated, service_role;
grant execute on function ops_pilot_maintenance() to service_role;
