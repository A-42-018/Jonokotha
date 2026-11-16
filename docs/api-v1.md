# API v1

Base path `/api/v1`. Source of truth for behaviour: the database functions (`docs/state-machine.md`) and RLS (`docs/permission-matrix.md`). This page is the endpoint list required by the definition of done. Implementation: `src/lib/api.ts` (pipeline), `src/lib/office-actions.ts`, `src/lib/citizen-actions.ts`, `src/lib/issues-service.ts`, routes under `src/app/api/v1/`. Tests: `tests/api/v1.test.ts` (run with `npm run test:api` against a local Supabase).

## Conventions
- **Identity** comes from the session cookie. Nothing in a body or query can set the reporter, role, constituency scope, status or assignee-by-others. Unknown body keys are rejected (422), not ignored.
- **Success:** `{ "data": ..., "page"?: { "next_cursor": string|null, "limit": n }, "request_id": "..." }`.
- **Error (one format everywhere):** `{ "code": "...", "message": "...", "field_errors": { "field": "reason" }, "request_id": "..." }`. `message` is for developers; the UI shows its own Bangla/English text chosen by `code`. Every response, success or error, has an `x-request-id` header. A client may send its own `x-request-id` (8-64 letters, digits, `.`, `_`, `-`); otherwise one is generated. The id is stored in the event metadata of every status change and written to one structured JSON log line per request (route, method, path, status, duration, actor id; never bodies, tokens or query strings).
- **Pagination:** `?limit=` (1-50, default 20) and `?cursor=` (opaque, from `page.next_cursor`). Order is newest first with the reference as tie-breaker, so pages never skip or repeat rows. A bad cursor is 422 `cursor`.
- **Idempotency:** `Idempotency-Key: <8-64 of A-Z a-z 0-9 _ ->` is required on `POST /issues` and optional on every other POST. A retry with the same key and the same request replays the stored response (header `Idempotent-Replay: true`) without doing the work again; the same key with a different request is 409 `idempotency_conflict`; a request still running is 409 `idempotency_in_progress` (retry in 2 s). Failed requests (4xx/5xx) do not consume the key. Keys are per user and expire after 24 hours.
- **Rate limits:** per signed-in user (shared across server instances, stored in the database) and per IP (best effort, per instance). 429 `rate_limited` with `Retry-After`.
- **Sizes:** JSON bodies up to 16 KB (413 `payload_too_large`).

| code | HTTP | meaning |
|---|---|---|
| `invalid_json` | 400 | body is not JSON |
| `idempotency_key_required` | 400 | `POST /issues` without the header |
| `unauthenticated` | 401 | sign in |
| `forbidden` | 403 | your role/scope may not do this |
| `not_found` | 404 | no such issue, unknown action, **or an issue you may not see** |
| `invalid_transition` | 409 | not allowed from the issue's current status |
| `rule_not_met` | 409 | a rule failed (review period, reopen window, feedback before resolution) |
| `conflict` | 409 | already done (for example feedback already sent) |
| `idempotency_conflict` / `idempotency_in_progress` | 409 | see Idempotency |
| `payload_too_large` | 413 | |
| `validation_failed` | 422 | see `field_errors` |
| `rate_limited` | 429 | |
| `internal_error` | 500 | quote the `request_id` |

Order of checks: authentication, size and JSON, rate limit, idempotency, validation, visibility (not found), whether the transition exists (409), then permission (403).

## Public
| Method and path | Auth | Notes |
|---|---|---|
| `GET /issues` | none | Filters `category`, `status` (one of the 13), `constituency` (key). Items: `ref, title, category, description, area, status` (13-state), `legacy_status` (4-label), `created_at, summary, similar_refs, constituency, is_sample`. No reporter, no confidence number. |
| `GET /issues/{ref}` | none | Same item plus `timeline: [{status, at, message}]`, public messages only. |

## Citizen (the reporter, on their own issue; others get 404)
| Method and path | Body | Effect |
|---|---|---|
| `POST /issues` | `title, category, description, area?, constituencyId?` (default `demo-1`) | 201 `{ref, status: "submitted"}`. Needs `Idempotency-Key`. Personal data is redacted before storing. 5 per minute per user. |
| `POST /issues/{ref}/additional-information` | `message` | `needs_information` -> `under_review`. |
| `POST /issues/{ref}/reopen` | `reason` | `resolved`/`closed` (within `reopen_window_days`) or `rejected` (appeal, no limit) -> `reopened`. |
| `POST /issues/{ref}/feedback` | `rating` 1-5, `comment?` | 201. Only after `resolved`/`closed`, once per issue. |

## Office (staff; scope enforced by RLS, permission by the database)
| Method and path | Body | Effect / who |
|---|---|---|
| `GET /office/issues` | filters `status`, `category`, `assigned` (`me`\|`none`) | The queue for the caller's offices; case officers see only assigned issues; admin sees all. |
| `GET /office/issues/{ref}` | | Detail with internal events, assignments, referrals and feedback. |
| `POST /office/issues/{ref}/acknowledge` | `message?`, `internal_note?` | manager. -> `acknowledged`. |
| `POST .../assign` | `assignee`, `reason?` | manager. -> `assigned` where the table allows, otherwise only the assignee changes. |
| `POST .../request-information` | `message` | manager, assigned case officer. -> `needs_information`. |
| `POST .../forward` | `agency_id` or `agency_name`, `contact_channel` or `external_reference`, notes | manager. -> `referred_to_authority`; records the referral. |
| `POST .../update` | `{note, public?}` **or** `{status: under_review\|in_progress, ...}` | manager, assigned case officer or liaison. A note writes an event (public only if `public: true`); a status needs a responsible party for `in_progress`. |
| `POST .../resolve` | `resolution_note`, `evidence_url?` | manager. -> `resolved`. |
| `POST .../close` | `reason?` | manager. -> `closed`; before the review period a `reason` is required. |
| `POST .../reject` | `reason`, `appeal_route` | manager. -> `rejected`. |
| `POST .../mark-duplicate` | `master_ref` | manager. -> `duplicate`, linked to the master. |
| `POST .../out-of-jurisdiction` | `reason` | manager. |
| `POST .../reopen` | `reason` | manager. From resolved, closed, rejected, duplicate, out of jurisdiction. |

MPs can read the queue and detail but cannot change status. Agency liaisons and case officers act only on issues assigned to them.

## Legacy routes (kept until the frontend moves; same services underneath)
| Route | Notes |
|---|---|
| `POST /api/intake` | unchanged (`{draft, source, pii}`). AI drafting moves to `/api/v1/ai/intake` in Phase 2. |
| `POST /api/cases` | `{ref}` / `{error}`; alias of `POST /api/v1/issues` without an Idempotency-Key. |
| `POST /api/cases/[ref]/approve` | alias of `acknowledge` (`acknowledge`) and `forward` (`refer`, to the suggested agency). Extra failure codes: 409, 422, 500. |

## AI suggestions (Phase 1.9)

`POST /api/v1/ai/suggestions/{id}/decision` — body `{ "decision": "accept" | "edit" | "dismiss", "final_value"?: object }` (`final_value` required for `edit`). Office staff in scope (or admin) only; 403 otherwise, 409 `rule_not_met` if already decided, 422 for a missing `final_value`. Returns `{ id, decision, decided_at, final_value }`. Every decision is audited and mirrored onto `ai_runs.decision`. Nothing a suggestion contains is applied to an issue automatically.

AI calls go through `src/lib/ai/run.ts` (forced tool call, Zod-validated, typed outcome, logged to `ai_runs` through `log_ai_run()` which only the service role can call; without `SUPABASE_SERVICE_ROLE_KEY` on the server the run is a JSON log line). Prompts are versioned in `src/lib/ai/prompts/`. Cost appears only if `AI_PRICE_IN_PER_MTOK` and `AI_PRICE_OUT_PER_MTOK` are set.

## Duplicate Agent (Phase 1.8)

`POST /api/v1/office/issues/{ref}/duplicates` → `{ available, candidates: [{ suggestion_id, ref, score, reasons }] }`. Office staff in scope (or admin). Candidates are the nearest issues of the same office and category (cosine score at or above `DUPLICATE_MIN_SCORE`, default 0.80, to be tuned on the eval set); each becomes a pending suggestion. `available: false` means embeddings are not configured, so the office uses manual search. Accept or Edit through `/ai/suggestions/{id}/decision` records a `duplicate_of` graph edge (the master must be another issue of the same office); the status change itself is the separate `mark-duplicate` action.

Embeddings: hosted BGE-M3 (1024 dimensions) through any OpenAI-compatible `/embeddings` service. Server env: `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_API_KEY` (and optional `EMBEDDINGS_MODEL`, default `BAAI/bge-m3`). Text is redacted before it leaves the server; new reports are indexed best-effort at submission (capped at 3 s), and `/duplicates` indexes the issue it is asked about. Existing issues are not back-filled yet.
