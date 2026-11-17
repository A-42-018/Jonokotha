# Roles, scopes and permission matrix

Source: masterplan §5 and §14. Implemented in migration `0006_roles_scopes.sql` and `src/lib/auth.ts`.
The database is the authority (functions `office_can`, `office_scope`, RLS in step 3); the TypeScript copy only gives clean 403s, and `tests/db/roles.test.ts` fails if the two ever differ.

## Two layers

| Layer | Where | Values |
|---|---|---|
| Platform role | `profiles.role` | `citizen`, `staff`, `moderator`, `admin` |
| Office role (per constituency) | `office_members.office_role` | `case_officer`, `office_manager`, `mp`, `agency_liaison` |

- Only a `staff` account can hold an active office membership (trigger `office_members_guard`).
- A user's role is never taken from a request. Platform role and account status change only from the SQL editor, the service role or an admin (trigger `profiles_guard`); nobody changes them through the API.
- Staff with no active membership have no office access at all. The legacy single `staff` role was backfilled as `office_manager` of the demo constituency only.
- Admin acts in every constituency, but only with MFA once enforced, and every privileged admin action is audited (step 6).
- Moderators have no office permissions; their access is limited to moderation queues (RLS, step 3).

## Office permissions (`office_permissions` table)

"Assigned" means the action is allowed only on issues assigned to the actor.

| Action | Office manager | MP | Case officer | Agency liaison |
|---|---|---|---|---|
| view | yes | yes | assigned | assigned |
| acknowledge | yes | | | |
| assign | yes | | | |
| request_information | yes | | assigned | |
| forward | yes | | | |
| update (progress, internal notes) | yes | | assigned | assigned |
| resolve | yes | | | |
| close | yes | | | |
| decide (reject, duplicate, out of jurisdiction, office reopen) | yes | | | |
| view_analytics | yes | yes | | |
| publish (announcements, projects and milestones) | yes | yes | | |

Case officers recommend forwarding or resolution; the office manager performs it (§5.4). The MP views, sees analytics and (Phase 2) publishes announcements; the MP does not change case status. Changing this table is a migration plus an edit to `OFFICE_PERMISSIONS`, never an ad-hoc SQL update.

## MFA plan (§14: MP, moderator and admin)

- Enforcement is built: `mfa_required()` is true for moderators, admins and anyone with an active `mp` membership; `mfa_ok()` requires a Supabase TOTP session (`aal2` in the JWT) when `app_settings.enforce_mfa` is `true`. `office_can`, `office_scope`, `is_admin` and `is_moderator` all call it, so with the flag on an `aal1` session loses every elevated permission.
- The flag is `false` for now because the sign-in UI cannot yet enrol or challenge TOTP (frontend work: `supabase.auth.mfa.enroll/challenge/verify`). Dev sign-in uses demo accounts, which are not MP, moderator or admin.
- Before real MP, moderator or admin accounts exist: enable TOTP in Supabase Auth settings, ship the enrol/challenge screens, create the accounts, then set the flag with `update app_settings set value = 'true' where key = 'enforce_mfa';`. This is a Phase 3 security-review gate at the latest.
- Hosted Supabase may require the Pro plan for some MFA settings; confirm before relying on it.

## Table-by-table RLS matrix (migration `0007_rls.sql`)

Deny by default: RLS is on for every table in `public`, and a table with no policy is unreachable from a user session. Tested with six accounts (citizen A, citizen B, office A, office B, moderator, admin) plus anonymous, in `tests/rls/read.test.ts` (reads), `tests/rls/write.test.ts` (writes) and `tests/rls/coverage.test.ts` (every table must be listed). Run with `npm run test:rls` against a local Supabase; a failing test fails CI.

"Office" means a staff account with an active membership whose role holds the `view` permission for that issue's constituency. "Own" means `reporter_id`, `user_id` or `uploader_id` equals the session user.

| Table | Anonymous | Citizen (own) | Office (own scope) | Moderator | Admin |
|---|---|---|---|---|---|
| public_cases, public_case_events (views) | read, safe columns only | same | same | same | same |
| constituencies, agencies, issue_categories, office_permissions, knowledge_sources, representative_constituencies | read | read | read | read | read |
| representatives | verified only | verified only | verified only | verified only | all |
| profiles | none | own | own + reporters of viewable issues | own | all (read) |
| issues | none | read own; insert own with clean initial state | read per role; update status/assignment only for manager-grade roles | none | read and update all |
| issue_events | none | none (public timeline via view) | read for viewable issues | none | read all |
| issue_media | none | read own; insert own, private and pending | read for viewable issues | none | read all |
| issue_assignments | none | none | read for viewable issues | none | read all |
| issue_agency_referrals | none | public-visibility rows on own issues | read for viewable issues | none | read all |
| notifications | none | read own; mark own read | none | none | none |
| consents | none | read, insert and withdraw own | none | none | none |
| user_preferences | none | read, insert, update own | none | none | none |
| office_members | none | none | own row; managers read their office roster | none | read all |
| audit_logs | none | none | none | none | read (append-only; see docs/audit.md) |
| ai_runs, ai_suggestions | none | none | read only for issues in scope | none | read all |
| knowledge_chunks | none | none | read | none | read |
| graph_edges | none | none | none | none | read |
| issue_embeddings, app_settings | none | none | none | none | none (service role only) |

Rules that hold across tables:
- Nobody deletes or truncates anything through the API (no privileges, no policies).
- Server-written tables (audit_logs, notifications, ai_runs, ai_suggestions, graph_edges, issue_events, issue_assignments, issue_agency_referrals, office_members, app_settings, knowledge_chunks, issue_embeddings) refuse inserts from every user session; server code uses the service role or SECURITY DEFINER functions.
- The content of a report (title, description, area, category, constituency, reporter, reference, timestamps) cannot be changed by any user session, including staff and admin (trigger `issues_guard`). Corrections need the service role and are audited.
- Anonymous visitors hold privileges only on reference tables and the two public views.
- Internal events (`issue_events.is_public = false`) and `internal_note` never reach `public_case_events`.
- Moderators can read none of this yet; they get access to moderation queues when `moderation_reports` is built (Phase 2).

## Phase 2 tables (migrations 0014-0020)

Tested in `tests/rls/phase2.test.ts` (read matrix for citizen A/B, office A/B, moderator, admin and anonymous; direct writes refused for every account) and listed in `tests/rls/coverage.test.ts`. No user session can insert, update or delete these tables directly: all writes go through audited SECURITY DEFINER functions, which re-check identity, scope and permission.

| Table | Who can read it |
|---|---|
| `issue_affected`, `idea_supports`, `follows`, `notification_deliveries`, `push_subscriptions` (id, user, dates only) | the user it belongs to |
| `ideas` | author, office with `view` in that constituency, moderators, admins (everyone else through `public_ideas`, published and decided only) |
| `questions`, `question_messages` | asker, in-scope office (`view`; case officers only when assigned), admins. **Not moderators.** Public moderated questions through `public_questions` and `public_question_messages` |
| `announcements`, `projects`, `project_milestones` | in-scope office, admins (everyone through the `public_*` views; drafts never) |
| `representative_fields` | everyone, but only for verified representatives; admins see all |
| `moderation_reports` | the reporter, moderators, admins |
| `office_invitations` | office managers of that office (`assign`), admins; never `token_hash` |
| `analytics_reports` | office with `view_analytics`, admins (approved reports through `public_analytics_reports`) |
| `ai_eval_runs` | admins |

The new office permission `publish` (announcements, projects, milestones) belongs to the office manager and the MP. Moderators act only through `moderation_queue()`, `moderate_item()` and `review_pending()`: they see excerpts of public content, never reporter or author identity and never private issue data. A citizen becomes staff only by accepting an invitation addressed to their confirmed email (`profiles_guard` allows exactly that one role change, for one minute after acceptance).

## Known gaps (tracked)
- **AI fields at insert.** `issues.ai_summary`, `ai_agency`, `ai_similar` and `ai_confidence` are written by the citizen's own session during submission, so a determined citizen could forge them through the API. Impact: advisory fields shown to staff. Fix: step 8/9 moves them into server-written `ai_suggestions`, after which the insert policy rejects them.
- **Status changes** go only through `transition_issue()` / `assign_issue()` (see `docs/state-machine.md`); direct edits of status and workflow columns are refused for everyone.
- **Citizen sees `assigned_to` on own issues** (a staff user id, no name). Acceptable for now; the office-actions API will expose a display name instead.
- **MFA is not enforced yet** (see above).


## Phase 5 additions (migrations 0030-0036)

New office permissions (kept identical in `src/lib/auth.ts`; `tests/db/roles.test.ts` compares): **`approve`** (MP) decides approval requests; **`delegate`** (MP, office manager) assigns tasks to office staff. An MP still holds no write access to `audit_logs`, `issue_events` or `issues` (`tests/rls/phase5.test.ts`).

| Table | Who can read it |
|---|---|
| `approval_requests` | the requester, MP of the area (`approve`), admins |
| `office_tasks` | the assignee, MP and manager of the area (`delegate`), admins |
| `agency_integrations`, `platform_invitations`, `integration_settings`, `security_events`, `background_jobs`, `product_events` | admins only |
| `feature_flags` | any signed-in user (anonymous clients use `public_feature_flags()`) |
| `idea_comments` | author, in-scope office, moderators, admins (published comments on public ideas through `public_idea_comments`, no author) |
| `polls`, `poll_options` | in-scope office (`view`), admins (open and closed ones through `public_polls`, `public_poll_options`) |
| `poll_votes` | the voter's own row only; results through `poll_results()` |
| `project_feedback` | the author, in-scope office, admins (counts through `public_project_feedback`, average from 5) |
| `admin_units`, `constituency_units`, `country_adapters` | everyone (reference data) |
| `location_change_requests` | the requester, offices that can view the issue, admins |
| `office_inbox_counts` | managers (`acknowledge`), MP (`view_analytics`), admins; published to Realtime |

**Agency liaison** (per agency and area): no direct table access to issues or events. `liaison_cases()` returns the safe columns for referrals to their agency in their area; `liaison_acknowledge`, `liaison_add_update`, `liaison_record_reference` and `liaison_close_task` are the only writes. **Platform roles** moderator and admin can also be granted by invitation (`create_platform_invitation`, `accept_platform_invitation`).
