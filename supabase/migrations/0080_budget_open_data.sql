-- Phase 8 (B8.1, B8.4; masterplan §4.4): public budget and expenditure transparency from verified source documents, and the open-data catalogue.
-- Requires 0004-0074. Safe to run twice.
--
-- Decisions (recorded in docs/backend.md, Phase 8 status):
--   * Money figures are published ONLY as stated in a source document that a second person has checked against the original. An office (or admin)
--     records the document (title, publisher, link, fiscal year, optional SHA-256 of the archived copy); a DIFFERENT person with the moderator or
--     administrator role verifies it. Nobody can verify their own record (check constraint, not only the function).
--   * An entry (allocated, released or spent) must name its source, the page or section, and carries the document's fiscal year. If the source is
--     withdrawn, every entry from it disappears from the public views at once. Nothing is computed, estimated or totalled by the platform.
--   * Open data: only aggregates that already respect the 5-person rule (a cell under 5 is dropped and only counted as hidden), plus data that is
--     already public (projects, verified budget entries). The licence is a setting that counsel must confirm; the catalogue says whether it was reviewed.

-- Budget source documents -----------------------------------------------------------------------------------------------------------------------------
create sequence if not exists budget_source_ref_seq start 1000;
create table if not exists budget_sources (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('BS-' || to_char(now(), 'YYYY') || '-' || nextval('budget_source_ref_seq')),
  constituency_id uuid not null references constituencies,
  title text not null check (char_length(title) between 5 and 200),
  publisher text not null check (char_length(publisher) between 3 and 150),
  doc_kind text not null check (doc_kind in ('annual_budget','adp','tender_notice','work_order','expenditure_report','audit_report','other')),
  source_url text not null check (source_url ~ '^https://'),
  published_on date,
  fiscal_year text not null check (fiscal_year ~ '^20[0-9]{2}-[0-9]{2}$'),
  doc_sha256 text check (doc_sha256 is null or doc_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending','verified','rejected','withdrawn')),
  created_by uuid references profiles on delete set null,
  verified_by uuid references profiles on delete set null,
  verified_at timestamptz,
  verification_note text check (verification_note is null or char_length(verification_note) <= 500),
  withdraw_reason text check (withdraw_reason is null or char_length(withdraw_reason) <= 500),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null)),
  check (verified_by is null or created_by is null or verified_by <> created_by)
);
create index if not exists budget_sources_scope_idx on budget_sources (constituency_id, status, fiscal_year);

create table if not exists budget_entries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references budget_sources on delete restrict,
  constituency_id uuid not null references constituencies,
  project_id uuid references projects on delete set null,
  fiscal_year text not null,
  kind text not null check (kind in ('allocated','released','spent')),
  label text not null check (char_length(label) between 3 and 150),
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  source_page text not null check (char_length(source_page) between 1 and 60),
  created_by uuid references profiles on delete set null,
  retracted_at timestamptz,
  retract_reason text check (retract_reason is null or char_length(retract_reason) between 5 and 300),
  created_at timestamptz not null default now(),
  check (retracted_at is null or retract_reason is not null)
);
create index if not exists budget_entries_scope_idx on budget_entries (constituency_id, fiscal_year, kind);
create index if not exists budget_entries_source_idx on budget_entries (source_id);

alter table budget_sources enable row level security;
alter table budget_entries enable row level security;
drop policy if exists budget_sources_select on budget_sources;
create policy budget_sources_select on budget_sources for select using (office_can(constituency_id, 'view', null) or is_admin() or is_moderator());
drop policy if exists budget_entries_select on budget_entries;
create policy budget_entries_select on budget_entries for select using (office_can(constituency_id, 'view', null) or is_admin() or is_moderator());
revoke all on budget_sources, budget_entries from anon, authenticated;
grant select on budget_sources, budget_entries to authenticated;

create or replace view public_budget_sources with (security_invoker = false) as
  select s.ref, c.key as constituency_key, s.title, s.publisher, s.doc_kind, s.source_url, s.published_on, s.fiscal_year, s.doc_sha256, s.verified_at, s.is_demo
  from budget_sources s join constituencies c on c.id = s.constituency_id where s.status = 'verified';
create or replace view public_budget_entries with (security_invoker = false) as
  select e.id, s.ref as source_ref, c.key as constituency_key, p.ref as project_ref, e.fiscal_year, e.kind, e.label, e.amount, e.currency, e.source_page,
         s.title as source_title, s.publisher as source_publisher, s.source_url, s.verified_at, s.is_demo
  from budget_entries e join budget_sources s on s.id = e.source_id join constituencies c on c.id = e.constituency_id left join projects p on p.id = e.project_id
  where s.status = 'verified' and e.retracted_at is null;
grant select on public_budget_sources, public_budget_entries to anon, authenticated;

create or replace function create_budget_source(p_constituency text, p_title text, p_publisher text, p_kind text, p_url text, p_published date, p_fiscal text, p_sha256 text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c constituencies%rowtype; v budget_sources%rowtype;
begin
  select * into c from constituencies where key = p_constituency and is_active;
  if not found or not office_can(c.id, 'view', null) then raise exception 'area not found' using errcode = 'JK404'; end if;
  if not office_can(c.id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into budget_sources (constituency_id, title, publisher, doc_kind, source_url, published_on, fiscal_year, doc_sha256, created_by, is_demo)
  values (c.id, btrim(p_title), btrim(p_publisher), p_kind, btrim(p_url), p_published, btrim(p_fiscal), lower(nullif(btrim(coalesce(p_sha256, '')), '')), auth.uid(), c.is_demo) returning * into v;
  perform audit_write('budget_source.create', 'budget_source', v.ref, null, jsonb_build_object('kind', p_kind, 'fiscal_year', p_fiscal), jsonb_build_object('constituency', p_constituency));
  return jsonb_build_object('ref', v.ref, 'status', v.status);
exception when check_violation or not_null_violation then raise exception 'invalid source document' using errcode = 'JK002', detail = 'source';
end $$;

-- A second person checks the document against the original. Moderators and administrators only; never the person who recorded it.
create or replace function verify_budget_source(p_ref text, p_decision text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v budget_sources%rowtype;
begin
  if not (is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into v from budget_sources where ref = p_ref;
  if not found then raise exception 'source not found' using errcode = 'JK404'; end if;
  if p_decision not in ('verify','reject') then raise exception 'decision' using errcode = 'JK002', detail = 'decision'; end if;
  if v.status <> 'pending' then raise exception 'only a pending source can be decided' using errcode = 'JK001'; end if;
  if v.created_by = auth.uid() then raise exception 'a different person must verify this source' using errcode = 'JK003', detail = 'self_verification'; end if;
  if p_decision = 'reject' and char_length(btrim(coalesce(p_note, ''))) < 5 then raise exception 'a reason is needed' using errcode = 'JK002', detail = 'note'; end if;
  update budget_sources set status = case when p_decision = 'verify' then 'verified' else 'rejected' end, verified_by = auth.uid(), verified_at = now(), verification_note = nullif(btrim(coalesce(p_note, '')), '') where id = v.id;
  perform audit_write('budget_source.' || p_decision, 'budget_source', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('decision', p_decision));
  return jsonb_build_object('ref', v.ref, 'status', case when p_decision = 'verify' then 'verified' else 'rejected' end);
end $$;

create or replace function withdraw_budget_source(p_ref text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v budget_sources%rowtype;
begin
  select * into v from budget_sources where ref = p_ref;
  if not found or not (office_can(v.constituency_id, 'view', null) or is_admin() or is_moderator()) then raise exception 'source not found' using errcode = 'JK404'; end if;
  if not (office_can(v.constituency_id, 'publish', null) or is_admin() or is_moderator()) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v.status = 'withdrawn' then return jsonb_build_object('ref', v.ref, 'status', 'withdrawn'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is needed' using errcode = 'JK002', detail = 'reason'; end if;
  update budget_sources set status = 'withdrawn', withdraw_reason = btrim(p_reason) where id = v.id;
  perform audit_write('budget_source.withdraw', 'budget_source', v.ref, jsonb_build_object('status', v.status), jsonb_build_object('status', 'withdrawn'));
  return jsonb_build_object('ref', v.ref, 'status', 'withdrawn');
end $$;

-- An entry can be added to a pending or verified source by the area's office; it is public only while the source is verified.
create or replace function create_budget_entry(p_source text, p_kind text, p_label text, p_amount numeric, p_page text, p_project text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s budget_sources%rowtype; pid uuid; v budget_entries%rowtype;
begin
  select * into s from budget_sources where ref = p_source;
  if not found or not office_can(s.constituency_id, 'view', null) then raise exception 'source not found' using errcode = 'JK404'; end if;
  if not office_can(s.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if s.status not in ('pending','verified') then raise exception 'this source can no longer take entries' using errcode = 'JK003', detail = 'source_closed'; end if;
  if p_project is not null then
    select id into pid from projects where ref = p_project and constituency_id = s.constituency_id;
    if pid is null then raise exception 'project not found in this area' using errcode = 'JK002', detail = 'project_ref'; end if;
  end if;
  insert into budget_entries (source_id, constituency_id, project_id, fiscal_year, kind, label, amount, currency, source_page, created_by)
  values (s.id, s.constituency_id, pid, s.fiscal_year, p_kind, btrim(p_label), p_amount, coalesce((select currency from country_adapters where code = active_country()), 'BDT'), btrim(p_page), auth.uid()) returning * into v;
  perform audit_write('budget_entry.create', 'budget_entry', v.id::text, null, jsonb_build_object('kind', p_kind, 'source', s.ref), jsonb_build_object('amount', p_amount));
  return jsonb_build_object('id', v.id, 'source_ref', s.ref, 'public', s.status = 'verified');
exception when check_violation or not_null_violation then raise exception 'invalid entry' using errcode = 'JK002', detail = 'entry';
end $$;

create or replace function retract_budget_entry(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v budget_entries%rowtype;
begin
  select * into v from budget_entries where id = p_id;
  if not found or not office_can(v.constituency_id, 'view', null) then raise exception 'entry not found' using errcode = 'JK404'; end if;
  if not office_can(v.constituency_id, 'publish', null) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'a reason is needed' using errcode = 'JK002', detail = 'reason'; end if;
  update budget_entries set retracted_at = coalesce(retracted_at, now()), retract_reason = coalesce(retract_reason, btrim(p_reason)) where id = v.id;
  perform audit_write('budget_entry.retract', 'budget_entry', v.id::text, null, jsonb_build_object('retracted', true));
  return jsonb_build_object('id', v.id, 'retracted', true);
end $$;

-- Office view (own area) and the moderator or admin verification queue.
create or replace function budget_office_sources(p_constituency text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ref', s.ref, 'constituency', c.key, 'title', s.title, 'publisher', s.publisher, 'doc_kind', s.doc_kind, 'source_url', s.source_url, 'fiscal_year', s.fiscal_year,
      'status', s.status, 'verification_note', s.verification_note, 'created_at', s.created_at,
      'entries', (select count(*)::int from budget_entries e where e.source_id = s.id and e.retracted_at is null)) order by s.created_at desc), '[]')
  from budget_sources s join constituencies c on c.id = s.constituency_id
  where (p_constituency is null or c.key = p_constituency) and (office_can(s.constituency_id, 'view', null) or is_admin() or is_moderator()) $$;
revoke all on function create_budget_source(text, text, text, text, text, date, text, text), verify_budget_source(text, text, text), withdraw_budget_source(text, text),
  create_budget_entry(text, text, text, numeric, text, text), retract_budget_entry(uuid, text), budget_office_sources(text) from public, anon;
grant execute on function create_budget_source(text, text, text, text, text, date, text, text), verify_budget_source(text, text, text), withdraw_budget_source(text, text),
  create_budget_entry(text, text, text, numeric, text, text), retract_budget_entry(uuid, text), budget_office_sources(text) to authenticated;

-- Open-data catalogue (B8.4) -------------------------------------------------------------------------------------------------------------------------------
insert into app_settings (key, value, description) values
  ('open_data_licence', '{"code":"CC-BY-4.0","name":"Creative Commons Attribution 4.0 International","url":"https://creativecommons.org/licenses/by/4.0/","reviewed":false}',
   'Licence for the open-data portal. "reviewed" stays false until counsel confirms it (docs/aibc/release2/open-items.md).')
on conflict (key) do nothing;

create or replace function open_data_licence() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from app_settings where key = 'open_data_licence'), '{}') $$;
revoke all on function open_data_licence() from public;
grant execute on function open_data_licence() to anon, authenticated, service_role;

create table if not exists open_datasets (
  slug text primary key check (slug ~ '^[a-z][a-z0-9-]{2,40}$'),
  title_en text not null, title_bn text not null,
  description_en text not null check (char_length(description_en) <= 500),
  columns jsonb not null,
  update_frequency text not null check (update_frequency in ('live','daily','monthly')),
  privacy_note text not null check (char_length(privacy_note) <= 400),
  is_active boolean not null default true
);
alter table open_datasets enable row level security;
revoke all on open_datasets from anon, authenticated;
create or replace view public_open_datasets with (security_invoker = false) as
  select slug, title_en, title_bn, description_en, columns, update_frequency, privacy_note from open_datasets where is_active;
grant select on public_open_datasets to anon, authenticated;

insert into open_datasets (slug, title_en, title_bn, description_en, columns, update_frequency, privacy_note) values
  ('issues-monthly', 'Reported issues per month', 'মাসভিত্তিক রিপোর্ট', 'Public reports by area, category and month: how many were reported and how many resolved.',
    '[{"name":"month","type":"date"},{"name":"constituency","type":"text"},{"name":"category","type":"text"},{"name":"reported","type":"integer"},{"name":"resolved","type":"integer"},{"name":"is_sample","type":"boolean"}]', 'live',
    'Only public reports are counted. A cell with fewer than 5 reports is left out and only counted as hidden. No titles, texts, people or exact places.'),
  ('resolution-monthly', 'Time to resolve per month', 'সমাধানের সময় (মাসভিত্তিক)', 'Median days from report to resolution for reports resolved in the month.',
    '[{"name":"month","type":"date"},{"name":"constituency","type":"text"},{"name":"category","type":"text"},{"name":"resolved","type":"integer"},{"name":"median_days","type":"number"},{"name":"is_sample","type":"boolean"}]', 'live',
    'Cells with fewer than 5 resolved reports are left out and only counted as hidden.'),
  ('projects', 'Public projects', 'সরকারি প্রকল্প', 'Projects published by offices, as stated by their source.',
    '[{"name":"ref","type":"text"},{"name":"constituency_key","type":"text"},{"name":"title","type":"text"},{"name":"status","type":"text"},{"name":"budget_text","type":"text"},{"name":"start_date","type":"date"},{"name":"expected_end_date","type":"date"},{"name":"source_url","type":"text"},{"name":"source_checked_at","type":"date"}]', 'live',
    'Already public on the platform; no personal data.'),
  ('budget-entries', 'Budget and expenditure entries', 'বাজেট ও ব্যয়ের তথ্য', 'Amounts as stated in verified source documents, each with its source and page.',
    '[{"name":"source_ref","type":"text"},{"name":"constituency_key","type":"text"},{"name":"fiscal_year","type":"text"},{"name":"kind","type":"text"},{"name":"label","type":"text"},{"name":"amount","type":"number"},{"name":"currency","type":"text"},{"name":"source_page","type":"text"},{"name":"source_url","type":"text"}]', 'live',
    'Only entries whose source document was verified by a second person. Amounts are quoted, never computed.')
on conflict (slug) do nothing;

-- Aggregates: a cell under 5 is dropped (counted in hidden_cells only). Constituency totals are not published, which limits subtraction attacks.
create or replace function open_data_issues_monthly(p_constituency text default null, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f date := date_trunc('month', coalesce(p_from, (current_date - interval '12 months')::date))::date; t date := date_trunc('month', coalesce(p_to, current_date))::date; res jsonb; hidden integer;
begin
  if t < f or t - f > 800 then raise exception 'range' using errcode = 'JK002', detail = 'to'; end if;
  with cells as (
    select date_trunc('month', i.created_at)::date as month, c.key as constituency, i.category::text as category, c.is_demo as is_sample,
           count(*)::int as reported, count(*) filter (where i.status in ('resolved','closed'))::int as resolved
    from issues i join constituencies c on c.id = i.constituency_id
    where i.public_visibility and i.created_at >= f and i.created_at < (t + interval '1 month') and (p_constituency is null or c.key = p_constituency)
    group by 1, 2, 3, 4)
  select coalesce(jsonb_agg(to_jsonb(x) order by x.month, x.constituency, x.category) filter (where x.reported >= 5), '[]'), count(*) filter (where x.reported < 5)::int into res, hidden from cells x;
  return jsonb_build_object('rows', res, 'hidden_cells', hidden);
end $$;

create or replace function open_data_resolution_monthly(p_constituency text default null, p_from date default null, p_to date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f date := date_trunc('month', coalesce(p_from, (current_date - interval '12 months')::date))::date; t date := date_trunc('month', coalesce(p_to, current_date))::date; res jsonb; hidden integer;
begin
  if t < f or t - f > 800 then raise exception 'range' using errcode = 'JK002', detail = 'to'; end if;
  with cells as (
    select date_trunc('month', i.resolved_at)::date as month, c.key as constituency, i.category::text as category, c.is_demo as is_sample, count(*)::int as resolved,
           round((percentile_cont(0.5) within group (order by extract(epoch from (i.resolved_at - i.created_at)) / 86400))::numeric, 1) as median_days
    from issues i join constituencies c on c.id = i.constituency_id
    where i.public_visibility and i.resolved_at is not null and i.resolved_at >= f and i.resolved_at < (t + interval '1 month') and (p_constituency is null or c.key = p_constituency)
    group by 1, 2, 3, 4)
  select coalesce(jsonb_agg(to_jsonb(x) order by x.month, x.constituency, x.category) filter (where x.resolved >= 5), '[]'), count(*) filter (where x.resolved < 5)::int into res, hidden from cells x;
  return jsonb_build_object('rows', res, 'hidden_cells', hidden);
end $$;
revoke all on function open_data_issues_monthly(text, date, date), open_data_resolution_monthly(text, date, date) from public;
grant execute on function open_data_issues_monthly(text, date, date), open_data_resolution_monthly(text, date, date) to anon, authenticated, service_role;

insert into feature_flags (key, enabled, data_status, description) values
  ('budget_transparency', true, 'live', 'Budget and expenditure entries from verified source documents'),
  ('open_data', false, 'planned', 'Open-data portal (switch on after counsel confirms the licence)')
on conflict (key) do nothing;
