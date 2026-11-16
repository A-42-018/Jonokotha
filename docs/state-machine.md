# Issue state machine

Source: masterplan §9. Authority: the database function `transition_issue()` (migration `0008_state_machine.sql`).
Mirrors: `src/lib/transitions.ts` (validation, UI hints) and the table `issue_transitions` (readable by anyone, so the rules are transparent).
`tests/unit/transitions.test.ts` checks all 169 status pairs against an independent spec; `tests/db/transitions.test.ts` checks the database against the TypeScript table, every allowed and forbidden pair, every required field, and every office role.

## How status changes
- Status and the workflow columns (`assigned_to`, `master_issue_id`, `resolution_note`, `status_reason`, `appeal_route`, `resolved_at`, `closed_at`) cannot be edited directly by anyone. A trigger refuses it, including for the service role (status) and for any signed-in user (the rest). Change them only through:
  - `transition_issue(p_issue, p_to, p_fields jsonb, p_request_id)` — changes status.
  - `assign_issue(p_issue, p_assignee, p_reason, p_request_id)` — changes the assignee without changing status (not allowed on closed, rejected, duplicate or out-of-jurisdiction issues).
- Each transition writes exactly one `issue_events` row (actor, from, to, public message, internal note, metadata). Assignment changes write a non-public event.
- Callers: signed-in users through `supabase.rpc(...)` (permissions checked inside), the trusted server through the service role (any listed transition, required fields still enforced).
- An issue you cannot see behaves as "not found" (no information leak).

## Statuses (13)
`submitted` (system, on creation), `under_review`, `needs_information`, `acknowledged`, `assigned`, `referred_to_authority`, `in_progress`, `resolved`, `closed`, `rejected`, `duplicate`, `out_of_jurisdiction`, `reopened`.

## Allowed transitions
Actor: **office** needs the listed permission from `docs/permission-matrix.md`; **owner** is the reporting citizen; **system** is a trusted job.

| To | From | Actor / permission | Required fields |
|---|---|---|---|
| under_review | submitted, needs_information, reopened | office / update | none |
| under_review | needs_information | owner | message (the additional information) |
| acknowledged | submitted, under_review, needs_information, reopened | office / acknowledge | none |
| assigned | submitted, under_review, acknowledged, needs_information, referred_to_authority, reopened | office / assign | assignee |
| needs_information | submitted, under_review, acknowledged, assigned, referred_to_authority, in_progress, reopened | office / request_information | message (the question) |
| referred_to_authority | submitted, under_review, acknowledged, assigned, in_progress, needs_information, out_of_jurisdiction, reopened | office / forward | destination (agency_id or agency_name), forwarding_details (contact_channel or external_reference) |
| in_progress | under_review, acknowledged, assigned, referred_to_authority, reopened | office / update | responsible_party (an assignee, a referral on record, or an assignee/destination supplied now) |
| resolved | under_review, acknowledged, assigned, referred_to_authority, in_progress, reopened | office / resolve | resolution_note; evidence if the policy requires it |
| closed | resolved | office / close, or system | none after the review period; a reason before it (system waits) |
| closed | needs_information | office / close, or system | reason |
| rejected | submitted, under_review, acknowledged, assigned, needs_information, reopened | office / decide | reason, appeal_route |
| duplicate | same six as rejected | office / decide | master_issue |
| out_of_jurisdiction | same six as rejected | office / decide | reason |
| reopened | resolved, closed, rejected, duplicate, out_of_jurisdiction | office / decide | reason |
| reopened | resolved, closed, rejected | owner | reason (reopen or appeal) |

Everything else is refused (`JK001`). Nothing enters `submitted` after creation; no status moves to itself.

## Rules the database enforces
- **Duplicate:** `master_issue` must be another issue of the same office, itself not a duplicate, and the issue being marked must not already be a master (no chains). The original record is kept; the link is stored in `master_issue_id`.
- **Assignee:** must be an active `case_officer`, `office_manager` or `agency_liaison` of the issue's office (an MP cannot be assigned).
- **Closing a resolved issue:** after `citizen_review_period_days` (default 7) it needs no reason and the system can close it; before that an office needs a reason and the system is refused (`JK003`).
- **Reopening by the reporter:** from `resolved` or `closed` only within `reopen_window_days` (default 30) of resolution/closure (`JK003` after); appeals of a rejection are not time-boxed. The office can reopen at any time. Reopening clears `resolved_at`/`closed_at`, and the event metadata keeps the previous closure time and master link.
- **Evidence:** with `resolution_evidence_required = true`, resolving needs at least one `issue_media` row (or an `evidence_url`).
- **Citizen-facing text:** an explicit `message`; otherwise the required reason for `rejected` and `out_of_jurisdiction`, or the `resolution_note` for `resolved`. Internal notes and reasons for other transitions are never public.
- **Policy values are settings** (`app_settings`), not code: `citizen_review_period_days`, `reopen_window_days`, `resolution_evidence_required`. The defaults are pilot placeholders for the office to set; they are targets, not promises.

## Error codes (SQLSTATE) and HTTP mapping used by the API
| Code | Meaning | HTTP |
|---|---|---|
| `JK404` | issue not found, or not visible to the caller | 404 |
| `42501` | caller may not make this transition | 403 |
| `JK001` | transition not in the table | 409 |
| `JK002` | missing or invalid field (`DETAIL` = field name) | 422 |
| `JK003` | rule not met (review period, reopen window) | 409 |

## Legacy UI labels
The current UI knows four labels. `public_cases.status` stays one of `received | acknowledged | referred | resolved` (mapped); `public_cases.status_detail` and `CaseRecord.statusDetail` carry the real status. Mapping: submitted, under_review, needs_information, reopened -> received; acknowledged, assigned, in_progress, rejected, duplicate, out_of_jurisdiction -> acknowledged; referred_to_authority -> referred; resolved, closed -> resolved. The last three of the acknowledged group are temporary until the UI shows the real labels.

The existing `POST /api/cases/[ref]/approve` (acknowledge or refer) now runs through `transition_issue()`. "Refer" sends the issue to the agency the routing suggested and the staff member approved, and records the referral with that agency's official site as the channel. It can now also return 409 (transition not allowed from the current status), 422 or 500, in addition to 401, 403 and 404.

## What the frontend must change (when ready)
- Read `statusDetail` and show labels for all 13 statuses (Bangla labels are in masterplan §19.4).
- Handle the new approve failures (409, 422).
- Office actions beyond acknowledge/refer arrive with the `/api/v1/office/issues/{id}/...` endpoints (step 5).
