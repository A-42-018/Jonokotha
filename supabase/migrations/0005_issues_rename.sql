-- Phase 1 step 1b: cases -> issues, case_events -> issue_events, 13-status model (masterplan §9, §12).
-- Data-preserving, one transaction (the Supabase runner wraps each file). Not re-runnable once applied (it renames);
-- on a clean database run 0001..0005 in order.
--
-- Staging compatibility: the running app still reads views public_cases / public_case_events and writes to `cases`.
-- This migration keeps all of that working:
--   * public_cases / public_case_events keep the legacy 4-value `status` column (mapped) and add `status_detail`.
--   * a compatibility view `cases` (security_invoker, INSTEAD OF triggers) accepts the old inserts/updates/deletes.
-- The compatibility view and legacy text keys are removed in a later "contract" migration after the code is deployed.

create type issue_status as enum (
  'submitted','under_review','needs_information','acknowledged','assigned','referred_to_authority',
  'in_progress','resolved','closed','rejected','duplicate','out_of_jurisdiction','reopened'
);

-- Mapping between the legacy 4-value enum (case_status, kept) and the new model.
create or replace function legacy_to_issue_status(s case_status) returns issue_status
language sql immutable as $$
  select case s when 'received' then 'submitted' when 'acknowledged' then 'acknowledged'
                when 'referred' then 'referred_to_authority' else 'resolved' end::issue_status $$;

-- Temporary display mapping for UI labels that only know 4 states. Rejected/duplicate/out_of_jurisdiction have no
-- legacy equivalent; they show as 'acknowledged' (the office has seen it) until the UI knows the new labels.
-- Clients that can show the real state read status_detail.
create or replace function issue_to_legacy_status(s issue_status) returns case_status
language sql immutable as $$
  select (case s
    when 'submitted' then 'received' when 'under_review' then 'received' when 'needs_information' then 'received' when 'reopened' then 'received'
    when 'acknowledged' then 'acknowledged' when 'assigned' then 'acknowledged' when 'in_progress' then 'acknowledged'
    when 'rejected' then 'acknowledged' when 'duplicate' then 'acknowledged' when 'out_of_jurisdiction' then 'acknowledged'
    when 'referred_to_authority' then 'referred'
    else 'resolved' end)::case_status $$;

-- Views depend on the columns being altered; drop and recreate below.
drop view if exists public_cases;
drop view if exists public_case_events;

-- Rename -----------------------------------------------------------------------------
alter table cases rename to issues;
alter table case_events rename to issue_events;
alter table issue_events rename column case_id to issue_id;
alter table issue_events rename column status to to_status;
alter table issue_events rename column note to public_message;
drop trigger if exists case_event_trg on issues;
drop function if exists log_case_event();

-- Status column conversion ---------------------------------------------------------
alter table issues alter column status drop default;
alter table issues alter column status type issue_status using legacy_to_issue_status(status);
alter table issues alter column status set default 'submitted';
alter table issue_events alter column to_status drop not null;
alter table issue_events alter column to_status type issue_status using legacy_to_issue_status(to_status);

-- issues: proper FKs and lifecycle columns ---------------------------------------------
alter table issues add column if not exists constituency_id uuid references constituencies;
alter table issues add column if not exists category_id uuid references issue_categories;
alter table issues add column if not exists agency_id uuid references agencies;
alter table issues add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent'));
alter table issues add column if not exists public_visibility boolean not null default true;
alter table issues add column if not exists assigned_to uuid references profiles;
alter table issues add column if not exists master_issue_id uuid references issues;
alter table issues add column if not exists submitted_at timestamptz;
alter table issues add column if not exists updated_at timestamptz not null default now();
alter table issues add column if not exists resolved_at timestamptz;
alter table issues add column if not exists closed_at timestamptz;
alter table issues add column if not exists retention_until timestamptz;
alter table issues add constraint issues_not_own_master check (master_issue_id is null or master_issue_id <> id);

update issues set submitted_at = created_at where submitted_at is null;
update issues i set constituency_id = c.id from constituencies c where c.key = i.constituency_key and i.constituency_id is null;
update issues i set category_id = c.id from issue_categories c where c.slug = i.category and i.category_id is null;
update issues i set agency_id = a.id from agencies a where a.key = i.ai_agency and i.agency_id is null;
update issues set resolved_at = created_at where status = 'resolved' and resolved_at is null;
alter table issues alter column submitted_at set not null;
alter table issues alter column submitted_at set default now();

create index if not exists issues_constituency_status_idx on issues (constituency_id, status);
create index if not exists issues_category_idx on issues (category_id);
create index if not exists issues_created_idx on issues (created_at desc);
create index if not exists issues_assigned_idx on issues (assigned_to) where assigned_to is not null;
create index if not exists issues_master_idx on issues (master_issue_id) where master_issue_id is not null;
create index if not exists issues_reporter_idx on issues (reporter_id);

-- issue_events: richer audit-style columns -------------------------------------------------
alter table issue_events add column if not exists event_type text not null default 'status_change';
alter table issue_events add column if not exists from_status issue_status;
alter table issue_events add column if not exists internal_note text;
alter table issue_events add column if not exists metadata jsonb not null default '{}';
alter table issue_events add column if not exists is_public boolean not null default true;
create index if not exists issue_events_issue_idx on issue_events (issue_id, created_at);

-- Keep text keys and FK ids in step with each other while both exist (old and new code paths) ----
create or replace function issues_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.constituency_id is null then
    select id into new.constituency_id from constituencies where key = new.constituency_key;
  else
    select key into new.constituency_key from constituencies where id = new.constituency_id;
  end if;
  if new.category_id is null then
    select id into new.category_id from issue_categories where slug = new.category;
  else
    select slug into new.category from issue_categories where id = new.category_id;
  end if;
  if new.agency_id is null and new.ai_agency is not null then
    select id into new.agency_id from agencies where key = new.ai_agency;
  elsif new.agency_id is not null then
    select key into new.ai_agency from agencies where id = new.agency_id;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at = now();
    if new.status = 'resolved' and old.status is distinct from 'resolved' then new.resolved_at = coalesce(new.resolved_at, now()); end if;
    if new.status = 'closed' and old.status is distinct from 'closed' then new.closed_at = coalesce(new.closed_at, now()); end if;
  end if;
  return new;
end $$;
drop trigger if exists issues_before_write_trg on issues;
create trigger issues_before_write_trg before insert or update on issues for each row execute function issues_before_write();

-- Every insert / status change writes an issue event (replaces log_case_event). ----------------------
create or replace function log_issue_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into issue_events (issue_id, event_type, to_status, actor_id) values (new.id, 'submitted', new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into issue_events (issue_id, event_type, from_status, to_status, actor_id) values (new.id, 'status_change', old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists issue_event_trg on issues;
create trigger issue_event_trg after insert or update on issues for each row execute function log_issue_event();

-- Existing events: first event per issue is the submission.
update issue_events e set event_type = 'submitted'
  where e.id = (select e2.id from issue_events e2 where e2.issue_id = e.issue_id order by e2.created_at, e2.id limit 1);

-- Satellite tables --------------------------------------------------------------------------------
create table if not exists issue_media (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues on delete cascade,
  uploader_id uuid references profiles on delete set null,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video','audio','document')),
  caption text,
  visibility text not null default 'private' check (visibility in ('private','office','public')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  retention_until timestamptz
);
create index if not exists issue_media_issue_idx on issue_media (issue_id);

create table if not exists issue_assignments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues on delete cascade,
  assigned_to uuid not null references profiles,
  assigned_by uuid references profiles,
  reason text,
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz
);
create index if not exists issue_assignments_issue_idx on issue_assignments (issue_id);
create unique index if not exists issue_assignments_one_active on issue_assignments (issue_id) where unassigned_at is null;

create table if not exists issue_agency_referrals (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues on delete cascade,
  agency_id uuid references agencies,
  agency_name text not null,
  agency_contact_or_channel text,
  external_reference text,
  forwarded_by uuid references profiles,
  forwarded_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  notes text,
  visibility text not null default 'office' check (visibility in ('office','public'))
);
create index if not exists issue_agency_referrals_issue_idx on issue_agency_referrals (issue_id);

-- Built from redacted public text only (§12.2). Dimension fixed in the Duplicate Agent migration.
create table if not exists issue_embeddings (
  issue_id uuid not null references issues on delete cascade,
  model text not null,
  embedding vector,
  content_hash text,
  created_at timestamptz not null default now(),
  primary key (issue_id, model)
);

alter table issue_media enable row level security;
alter table issue_assignments enable row level security;
alter table issue_agency_referrals enable row level security;
alter table issue_embeddings enable row level security;

-- Views: the privacy boundary stays an explicit column list --------------------------------------------
create or replace view public_cases with (security_invoker = false) as
  select ref, title, category, description, area, issue_to_legacy_status(status) as status, created_at,
         ai_summary, ai_agency, ai_confidence, ai_similar, constituency_key, is_demo, status as status_detail
  from issues where public_visibility;

create or replace view public_case_events with (security_invoker = false) as
  select i.ref as case_ref, issue_to_legacy_status(e.to_status) as status, e.public_message as note, e.created_at, e.to_status as status_detail
  from issue_events e join issues i on i.id = e.issue_id
  where e.is_public and i.public_visibility and e.to_status is not null;

revoke all on public_cases, public_case_events from anon, authenticated;
grant select on public_cases, public_case_events to anon, authenticated;

-- Compatibility view `cases` for the currently deployed app ---------------------------------------------
create view cases with (security_invoker = true) as
  select id, ref, reporter_id, title, category, description, area, issue_to_legacy_status(status) as status,
         ai_summary, ai_agency, ai_confidence, ai_similar, constituency_key, is_demo, created_at
  from issues;

create or replace function cases_compat_write() returns trigger language plpgsql as $$
declare n integer;
begin
  if tg_op = 'INSERT' then
    insert into issues (reporter_id, title, category, description, area, constituency_key, ai_summary, ai_agency, ai_confidence, ai_similar, is_demo)
    values (new.reporter_id, new.title, new.category, new.description, new.area, new.constituency_key, new.ai_summary, new.ai_agency, new.ai_confidence, coalesce(new.ai_similar, '{}'), coalesce(new.is_demo, false))
    returning id, ref, created_at into new.id, new.ref, new.created_at;
    new.status = 'received';
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      update issues set status = legacy_to_issue_status(new.status) where id = old.id;
      get diagnostics n = row_count;
      if n = 0 then return null; end if; -- RLS denied the write: report 0 rows, as a plain table would
    end if;
    return new;
  else
    delete from issues where id = old.id;
    get diagnostics n = row_count;
    if n = 0 then return null; end if;
    return old;
  end if;
end $$;
create trigger cases_compat_ins instead of insert on cases for each row execute function cases_compat_write();
create trigger cases_compat_upd instead of update on cases for each row execute function cases_compat_write();
create trigger cases_compat_del instead of delete on cases for each row execute function cases_compat_write();
revoke all on cases from anon;
