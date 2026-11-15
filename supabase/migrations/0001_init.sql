-- Sprint 0 schema (subset of masterplan §12). Run in your own Supabase project.
create extension if not exists pgcrypto;
create type case_status as enum ('received','acknowledged','referred','resolved');

create table constituencies (
  id uuid primary key default gen_random_uuid(),
  name_bn text not null, name_en text not null,
  boundary_source text, is_demo boolean not null default true, is_active boolean not null default true
);
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name_bn text not null, name_en text not null,
  categories text[] not null, source text not null
);
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, preferred_language text not null default 'bn',
  role text not null default 'citizen' check (role in ('citizen','staff','admin')),
  created_at timestamptz not null default now()
);
create table cases (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  constituency_id uuid references constituencies,
  reporter_id uuid references profiles,
  title text not null, category text not null, description text not null, area text,
  status case_status not null default 'received',
  ai_summary text, ai_agency_id uuid references agencies, ai_confidence numeric,
  created_at timestamptz not null default now()
);
create table case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases on delete cascade,
  status case_status not null, note text, actor_id uuid references profiles,
  created_at timestamptz not null default now()
);

alter table constituencies enable row level security;
alter table agencies enable row level security;
alter table profiles enable row level security;
alter table cases enable row level security;
alter table case_events enable row level security;

create policy "public read constituencies" on constituencies for select using (true);
create policy "public read agencies" on agencies for select using (true);
create policy "own profile" on profiles for select using (id = auth.uid());
create policy "public read cases" on cases for select using (true);
create policy "citizen creates own case" on cases for insert with check (reporter_id = auth.uid());
create policy "public read events" on case_events for select using (true);
-- Staff updates/approvals: added in Sprint 1 with role checks and audit events.
