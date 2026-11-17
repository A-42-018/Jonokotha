-- Phase 1 step 3 (masterplan §14): row-level security, deny by default.
-- Replaces the Sprint-0 policies that used the unscoped is_staff() with scoped checks from 0006.
-- Public reads go through the views public_cases / public_case_events (explicit safe columns).
-- Full table-by-table matrix: docs/permission-matrix.md. Tested by tests/rls/*.test.ts with six accounts.
-- Requires 0006.

-- Helpers (SECURITY DEFINER so policies never recurse through RLS) ----------------------------------
create or replace function try_uuid(t text) returns uuid language sql immutable as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end $$;

create or replace function can_view_issue(i uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from issues where id = i and office_can(constituency_id, 'view', assigned_to)) $$;

create or replace function is_issue_owner(i uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from issues where id = i and reporter_id = auth.uid()) $$;

create or replace function has_office_scope() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from office_scope()) $$;

-- Staff may read the profile of a citizen who reported an issue they can view (display name, language only).
create or replace function can_view_reporter(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from issues i where i.reporter_id = p and office_can(i.constituency_id, 'view', i.assigned_to)) $$;

-- Manager-grade status/assignment changes. Per-transition rules arrive with the state machine (0008).
create or replace function can_manage_issue(c uuid, assignee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select office_can(c, 'acknowledge', assignee) or office_can(c, 'assign', assignee) or office_can(c, 'forward', assignee)
      or office_can(c, 'resolve', assignee) or office_can(c, 'close', assignee) $$;

-- ai_runs gets an issue link so staff see AI records only for issues in their scope (§12.2).
alter table ai_runs add column if not exists issue_id uuid references issues on delete set null;
create index if not exists ai_runs_issue_idx on ai_runs (issue_id) where issue_id is not null;

-- Content of a report is immutable for everyone using a user session (no silent rewriting, §5.7).
-- Service role / SQL editor (no JWT user) can still correct data; those changes are audited from 0009.
create or replace function issues_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if (new.id, new.ref, new.reporter_id, new.title, new.description, new.area, new.category, new.category_id,
      new.constituency_id, new.constituency_key, new.created_at, new.submitted_at, new.is_demo)
     is distinct from
     (old.id, old.ref, old.reporter_id, old.title, old.description, old.area, old.category, old.category_id,
      old.constituency_id, old.constituency_key, old.created_at, old.submitted_at, old.is_demo) then
    raise exception 'issue content is immutable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists issues_guard_trg on issues;
create trigger issues_guard_trg before update on issues for each row execute function issues_guard();

-- Drop every Sprint-0 policy that is replaced below ------------------------------------------------------
drop policy if exists "owner or staff read cases" on issues;
drop policy if exists "citizen creates own case" on issues;
drop policy if exists "staff update cases" on issues;
drop policy if exists "staff read events" on issue_events;
drop policy if exists "staff read profiles" on profiles;

-- issues ---------------------------------------------------------------------------------------------------
drop policy if exists issues_select on issues;
create policy issues_select on issues for select
  using (reporter_id = auth.uid() or office_can(constituency_id, 'view', assigned_to));

drop policy if exists issues_insert on issues;
create policy issues_insert on issues for insert
  with check (reporter_id = auth.uid() and app_role() is not null
              and status = 'submitted' and assigned_to is null and master_issue_id is null
              and priority = 'normal' and public_visibility and not is_demo
              and resolved_at is null and closed_at is null);

drop policy if exists issues_update on issues;
create policy issues_update on issues for update
  using (can_manage_issue(constituency_id, assigned_to))
  with check (can_manage_issue(constituency_id, assigned_to));
-- No delete policy: nobody deletes issues through the API.

-- issue_events (internal notes live here, so citizens read the timeline only via public_case_events) ----------
drop policy if exists issue_events_select on issue_events;
create policy issue_events_select on issue_events for select using (can_view_issue(issue_id));

-- profiles ---------------------------------------------------------------------------------------------------
drop policy if exists profiles_staff_read on profiles;
create policy profiles_staff_read on profiles for select using (can_view_reporter(id) or is_admin());

-- issue satellites ---------------------------------------------------------------------------------------------
drop policy if exists issue_media_select on issue_media;
create policy issue_media_select on issue_media for select
  using (uploader_id = auth.uid() or is_issue_owner(issue_id) or can_view_issue(issue_id));
drop policy if exists issue_media_insert on issue_media;
create policy issue_media_insert on issue_media for insert
  with check (uploader_id = auth.uid() and is_issue_owner(issue_id) and visibility = 'private' and moderation_status = 'pending');

drop policy if exists issue_assignments_select on issue_assignments;
create policy issue_assignments_select on issue_assignments for select using (can_view_issue(issue_id));

drop policy if exists issue_referrals_select on issue_agency_referrals;
create policy issue_referrals_select on issue_agency_referrals for select
  using (can_view_issue(issue_id) or (visibility = 'public' and is_issue_owner(issue_id)));
-- issue_embeddings: no policy (server/service role only).

-- personal data ---------------------------------------------------------------------------------------------------
drop policy if exists notifications_own_select on notifications;
create policy notifications_own_select on notifications for select using (user_id = auth.uid());
drop policy if exists notifications_own_update on notifications;
create policy notifications_own_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists consents_own_select on consents;
create policy consents_own_select on consents for select using (user_id = auth.uid());
drop policy if exists consents_own_insert on consents;
create policy consents_own_insert on consents for insert with check (user_id = auth.uid());
drop policy if exists consents_own_update on consents;
create policy consents_own_update on consents for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists prefs_own_select on user_preferences;
create policy prefs_own_select on user_preferences for select using (user_id = auth.uid());
drop policy if exists prefs_own_insert on user_preferences;
create policy prefs_own_insert on user_preferences for insert with check (user_id = auth.uid());
drop policy if exists prefs_own_update on user_preferences;
create policy prefs_own_update on user_preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- offices and directory ------------------------------------------------------------------------------------------------
drop policy if exists office_members_roster on office_members;
create policy office_members_roster on office_members for select
  using (is_admin() or office_can(constituency_id, 'assign', null));

drop policy if exists representatives_public on representatives;
create policy representatives_public on representatives for select using (verification_status = 'verified' or is_admin());
drop policy if exists rep_constituencies_public on representative_constituencies;
create policy rep_constituencies_public on representative_constituencies for select using (true);

-- audit, AI, knowledge, graph ------------------------------------------------------------------------------------------------
drop policy if exists audit_logs_admin on audit_logs;
create policy audit_logs_admin on audit_logs for select using (is_admin());

drop policy if exists ai_runs_select on ai_runs;
create policy ai_runs_select on ai_runs for select using (is_admin() or (issue_id is not null and can_view_issue(issue_id)));
drop policy if exists ai_suggestions_select on ai_suggestions;
create policy ai_suggestions_select on ai_suggestions for select
  using (is_admin() or (target_type = 'issue' and can_view_issue(try_uuid(target_id))));

drop policy if exists knowledge_sources_public on knowledge_sources;
create policy knowledge_sources_public on knowledge_sources for select using (true);
drop policy if exists knowledge_chunks_staff on knowledge_chunks;
create policy knowledge_chunks_staff on knowledge_chunks for select using (has_office_scope());
drop policy if exists graph_edges_admin on graph_edges;
create policy graph_edges_admin on graph_edges for select using (is_admin());
-- app_settings: no policy (service role / SQL editor only).

-- Privileges: least privilege on top of RLS ------------------------------------------------------------------------------------
-- Anonymous visitors get only reference data and the two public views.
revoke all on all tables in schema public from anon;
grant select on public_cases, public_case_events, constituencies, agencies, issue_categories, office_permissions,
  representatives, representative_constituencies, knowledge_sources to anon;
-- Signed-in users can never delete or truncate through the API.
revoke delete, truncate, references, trigger on all tables in schema public from authenticated;
-- New tables must be granted explicitly (they no longer inherit access for anon).
alter default privileges in schema public revoke all on tables from anon;
-- Column-level limits: users may only mark notifications read / withdraw their own consent.
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
revoke update on consents from authenticated;
grant update (withdrawn_at) on consents to authenticated;
revoke update on user_preferences from authenticated;
grant update (followed_areas, followed_categories, simple_language_mode, voice_first, personalization_enabled, quiet_hours, updated_at) on user_preferences to authenticated;
revoke insert on notifications, audit_logs, ai_runs, ai_suggestions, graph_edges, knowledge_chunks, issue_embeddings, issue_events,
  issue_assignments, issue_agency_referrals, office_members, representatives, app_settings from authenticated;
