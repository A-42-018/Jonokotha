-- Phase 1 step 1a (masterplan §12): additive schema. Does not touch cases / case_events (see 0005).
-- Safe to re-run. Every new table has RLS enabled and NO policies = deny by default;
-- real policies arrive in 0006. Server code using the service role or SECURITY DEFINER functions is unaffected.
-- Nothing here is invented data: new columns on reference tables are nullable until a source is cited.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- Shared helpers ------------------------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Existing tables: extra columns ---------------------------------------------
alter table profiles add column if not exists account_status text not null default 'active' check (account_status in ('active','suspended','deleted'));
alter table profiles add column if not exists avatar_path text;
alter table profiles add column if not exists updated_at timestamptz not null default now();

alter table constituencies add column if not exists country_code text not null default 'BD';
alter table constituencies add column if not exists division text;
alter table constituencies add column if not exists district text;
alter table constituencies add column if not exists upazila_or_city text;
alter table constituencies add column if not exists ward_or_union text;
alter table constituencies add column if not exists boundary_verified_at timestamptz;

-- Provenance for anything derived from an external source (§12.2: source + fetch date on every such row).
create table if not exists knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text,
  license_or_terms text,
  collection_method text not null default 'manual' check (collection_method in ('api','scrape','manual','file')),
  fetched_at timestamptz,
  checksum text,
  is_demo boolean not null default false,
  status text not null default 'active' check (status in ('active','stale','retired')),
  created_at timestamptz not null default now()
);

alter table agencies add column if not exists country_code text not null default 'BD';
alter table agencies add column if not exists jurisdiction_level text check (jurisdiction_level in ('national','division','district','upazila','city','union'));
alter table agencies add column if not exists area_ref text;
alter table agencies add column if not exists contact_channel text;
alter table agencies add column if not exists source_id uuid references knowledge_sources on delete set null;
alter table agencies add column if not exists verified_at timestamptz;

-- Categories ------------------------------------------------------------------
create table if not exists issue_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_bn text not null,
  name_en text not null,
  parent_id uuid references issue_categories on delete restrict,
  default_priority text not null default 'normal' check (default_priority in ('low','normal','high','urgent')),
  is_active boolean not null default true
);
insert into issue_categories (slug, name_bn, name_en) values
  ('roads','রাস্তা','Roads'), ('drainage','ড্রেন','Drainage'), ('water','পানি','Water'),
  ('electricity','বিদ্যুৎ','Electricity'), ('waste','ময়লা','Waste'), ('flooding','জলাবদ্ধতা','Flooding'),
  ('health','স্বাস্থ্য','Health'), ('education','শিক্ষা','Education'), ('safety','নিরাপত্তা','Safety'),
  ('environment','পরিবেশ','Environment'), ('facilities','সুবিধা','Facilities'), ('other','অন্যান্য','Other')
on conflict (slug) do nothing;

-- Representatives and offices -------------------------------------------------
create table if not exists representatives (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete set null,
  full_name text not null,
  office_title text,
  party_name text,
  official_contact text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','revoked')),
  term_start date,
  term_end date,
  source_url text,
  verified_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists representative_constituencies (
  representative_id uuid not null references representatives on delete cascade,
  constituency_id uuid not null references constituencies on delete cascade,
  valid_from date not null default current_date,
  valid_to date,
  primary key (representative_id, constituency_id, valid_from)
);
create index if not exists rep_const_constituency_idx on representative_constituencies (constituency_id);

-- office_role values beyond profiles.role: the per-office role (§5). Platform roles are set in 0006.
create table if not exists office_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  representative_id uuid references representatives on delete set null,
  constituency_id uuid not null references constituencies on delete cascade,
  office_role text not null default 'case_officer' check (office_role in ('case_officer','office_manager','mp','agency_liaison')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, constituency_id)
);
create index if not exists office_members_user_idx on office_members (user_id) where status = 'active';
create index if not exists office_members_constituency_idx on office_members (constituency_id);

-- Issue satellites (FKs to issues are added in 0005, after the rename) ----------
-- issue_media, issue_assignments, issue_agency_referrals, issue_embeddings are created in 0005.

-- Notifications, consent, preferences -------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  retention_until timestamptz
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create unique index if not exists notifications_dedupe_uq on notifications (user_id, dedupe_key) where dedupe_key is not null;

create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  consent_type text not null,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index if not exists consents_user_idx on consents (user_id, consent_type);

create table if not exists user_preferences (
  user_id uuid primary key references profiles on delete cascade,
  followed_areas text[] not null default '{}',
  followed_categories text[] not null default '{}',
  simple_language_mode boolean not null default false,
  voice_first boolean not null default false,
  personalization_enabled boolean not null default true,
  quiet_hours jsonb,
  updated_at timestamptz not null default now()
);

-- Audit (immutability enforced in a later migration) -----------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_resource_idx on audit_logs (resource_type, resource_id, created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_id, created_at desc);

-- Knowledge layer and graph --------------------------------------------------------
-- The embedding dimension is fixed in the Duplicate Agent migration once the model is chosen
-- (the tables are empty until then). Demo and real sources never share an index (is_demo on the source).
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references knowledge_sources on delete cascade,
  locale text not null default 'bn',
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_chunks_source_idx on knowledge_chunks (source_id);

create table if not exists graph_edges (
  id uuid primary key default gen_random_uuid(),
  from_type text not null,
  from_id text not null,
  relation text not null,
  to_type text not null,
  to_id text not null,
  weight numeric,
  source text not null default 'system' check (source in ('system','office','ai_suggestion_accepted')),
  created_at timestamptz not null default now(),
  unique (from_type, from_id, relation, to_type, to_id)
);
create index if not exists graph_edges_from_idx on graph_edges (from_type, from_id, relation);
create index if not exists graph_edges_to_idx on graph_edges (to_type, to_id, relation);

-- AI logging and suggestions -----------------------------------------------------------
create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  agent text not null check (agent in ('intake','duplicate','routing','copilot','translation','insight','idea')),
  model text,
  prompt_version text,
  input_hash text,
  redaction_applied boolean not null default true,
  output jsonb,
  latency_ms integer,
  token_usage jsonb,
  cost_usd numeric,
  status text not null check (status in ('ok','timeout','refused','invalid_output','error','fallback')),
  decision text not null default 'pending' check (decision in ('pending','accepted','edited','dismissed','not_applicable')),
  actor_id uuid references profiles on delete set null,
  request_id text,
  created_at timestamptz not null default now(),
  retention_until timestamptz
);
create index if not exists ai_runs_agent_idx on ai_runs (agent, created_at desc);

create table if not exists ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid references ai_runs on delete set null,
  target_type text not null,
  target_id text not null,
  suggestion_type text not null,
  payload jsonb not null,
  citations jsonb not null default '[]',
  confidence numeric,
  decision text not null default 'pending' check (decision in ('pending','accepted','edited','dismissed')),
  decided_by uuid references profiles on delete set null,
  decided_at timestamptz,
  final_value jsonb,
  created_at timestamptz not null default now(),
  retention_until timestamptz
);
create index if not exists ai_suggestions_target_idx on ai_suggestions (target_type, target_id);

-- Deny by default ----------------------------------------------------------------------
alter table knowledge_sources enable row level security;
alter table issue_categories enable row level security;
alter table representatives enable row level security;
alter table representative_constituencies enable row level security;
alter table office_members enable row level security;
alter table notifications enable row level security;
alter table consents enable row level security;
alter table user_preferences enable row level security;
alter table audit_logs enable row level security;
alter table knowledge_chunks enable row level security;
alter table graph_edges enable row level security;
alter table ai_runs enable row level security;
alter table ai_suggestions enable row level security;

-- Categories are public reference data, like agencies and constituencies.
drop policy if exists "public read categories" on issue_categories;
create policy "public read categories" on issue_categories for select using (true);

drop trigger if exists representatives_updated on representatives;
create trigger representatives_updated before update on representatives for each row execute function set_updated_at();
drop trigger if exists profiles_updated on profiles;
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
