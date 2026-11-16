-- Phase 0 (0.4, 0.5, 0.10): close the public-read leak, move agencies/constituency into tables, flag demo data.
-- Repeatable: safe to run more than once.

-- 0.4 Public reads go through views with safe columns only (no reporter_id, no actor_id).
drop policy if exists "public read cases" on cases;
drop policy if exists "owner or staff read cases" on cases;
create policy "owner or staff read cases" on cases for select using (reporter_id = auth.uid() or is_staff());

drop policy if exists "public read events" on case_events;
drop policy if exists "staff read events" on case_events;
create policy "staff read events" on case_events for select using (is_staff());

alter table cases add column if not exists is_demo boolean not null default false;

-- Views run with the owner's rights (they bypass RLS on purpose); the column list is the privacy boundary.
create or replace view public_cases with (security_invoker = false) as
  select ref, title, category, description, area, status, created_at,
         ai_summary, ai_agency, ai_confidence, ai_similar, constituency_key, is_demo
  from cases;

create or replace view public_case_events with (security_invoker = false) as
  select c.ref as case_ref, e.status, e.note, e.created_at
  from case_events e join cases c on c.id = e.case_id;

revoke all on public_cases, public_case_events from anon, authenticated;
grant select on public_cases, public_case_events to anon, authenticated;

-- 0.5 Agencies and the sample constituency live in tables, with source URL and checked date.
alter table constituencies add column if not exists key text;
alter table agencies add column if not exists key text;
alter table agencies add column if not exists url text;
alter table agencies add column if not exists checked_at date;
create unique index if not exists constituencies_key_uq on constituencies (key);
create unique index if not exists agencies_key_uq on agencies (key);
