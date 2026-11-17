# Audit trail

Source: masterplan §18 and §5.6. Implemented in migration `0010_audit.sql`; tests in `tests/db/audit.test.ts` and `tests/api/v1.test.ts`.

## What is immutable
- **`audit_logs`**: no UPDATE, DELETE or TRUNCATE for anyone (a trigger refuses it, and the service role and API roles hold no such privilege). Corrections are new rows.
- **`issue_events`** (the issue timeline): no UPDATE or TRUNCATE; DELETE only as part of deleting the issue itself (a privileged act that is audited as `issue.delete`).
- A retention/erasure job for personal data (Phase 3, masterplan §18.2) will be the one sanctioned way to remove old rows, as an explicit, audited migration or function. Until then nothing is deleted.

## What is recorded, and where
Audit rows are written by database triggers, so no code path can skip them (API, server job, service role, SQL editor). `actor_kind` is `user` (a signed-in session) or `system` (service role or a direct connection); `actor_role` is the platform role at the time.

| Action | Written when | before / after |
|---|---|---|
| `issue.create` | a report is submitted | after: ref, status, constituency, category, reporter |
| `issue.status_change` | status changes (always through `transition_issue`) | changed columns, e.g. `{status}` and the workflow fields touched |
| `issue.assign` | assignee changes | `{assigned_to}` |
| `issue.update` | any other change to an issue (priority, visibility, AI fields...) | changed columns |
| `issue.note` | an office note or progress update | `{event_id, is_public, status}`; the note text stays in `issue_events` |
| `issue.referral` | a referral to an agency is recorded | agency, external reference, visibility |
| `issue.delete` | an issue is deleted (service role only) | ref, status, constituency, reporter |
| `office_member.insert/update/delete` | office membership or office role changes | user, constituency, office role, status |
| `profile.update` | platform role or account status changes | `{role, account_status}` (renames are not audited) |
| `setting.*` | `app_settings` changes (MFA flag, review period...) | key and value |
| `permission.*` | the permission matrix changes | role, action, assigned-only |
| `transition_rule.*` | the state-machine table changes | the rule |
| `admin.access` | an administrator reads private issue data through the API (`GET /api/v1/office/issues` and `/{ref}`) | none; `resource_type` is `issue` or `issue_list`, metadata holds filter names only |

Rules:
- **No report text in the log.** Title, description, area and AI summary are never copied; only the names of changed content columns are recorded (`metadata.content_columns_changed`). Internal note text lives in `issue_events`, which only the office and admins can read.
- **Fail closed for admin reads.** If the `admin.access` row cannot be written, the read is refused.
- Every row has `actor_id`, `action`, `resource_type`, `resource_id`, `before_data`, `after_data`, `request_id`, `created_at` (wall-clock time per row, so entries within one transaction keep their order), `metadata`, and `retention_until` (empty until the retention policy exists).

## Request ids
The API generates or accepts an `x-request-id`, returns it in the response and the JSON log line, and forwards it to the database as `x-jk-request-id` on every call it makes for that request. The database reads it from PostgREST's `request.headers` (or from `app.request_id`, which server scripts can set). Malformed values are ignored. So one id ties together: HTTP response, API log line, `issue_events.metadata.request_id`, and every `audit_logs` row written during the request.

## Who can read it
Only administrators, through RLS (`audit_logs_admin`). Nobody can insert through the API; `audit_write()` is not callable by any API role. Offices see an issue's history through `issue_events`.

## Known gaps
- `ip_hash` is not populated: the database only sees the platform's proxy address, not the end user's. A salted hash of the client IP can be forwarded the same way as the request id once a salt is configured.
- Office staff reading issues in their own scope are not logged (their access is scoped and routine); only administrator reads are. Revisit in the Phase 3 security review.
- Moderation actions will be audited when `moderation_reports` exists (Phase 2).
