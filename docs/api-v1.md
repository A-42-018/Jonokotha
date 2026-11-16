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

## Engagement (Phase 2.5, migration 0014)

| Method and path | Auth | Notes |
|---|---|---|
| `POST /issues/{ref}/affected` | signed in | "আমারও একই সমস্যা". One per user per issue, idempotent. Returns `{ref, affected: true, affected_count}`. 409 `rule_not_met` for the reporter (their report already counts); 404 for hidden or unknown issues. |
| `DELETE /issues/{ref}/affected` | signed in | Withdraws it (idempotent). |
| `GET /me/follows` | signed in | The caller's follows: `{id, type: issue\|area\|category, target, label, created_at}`. |
| `POST /me/follows` | signed in | `{type, target}`: issue ref, constituency key or category slug. 201, idempotent (same follow returned). Max 200 per user (409 `rule_not_met`). |
| `DELETE /me/follows/{id}` | signed in | Someone else's id is 404. |

Only the **count** of affected users is public: `affected_count` on `GET /issues` items and `GET /issues/{ref}`. Who is never exposed; `issue_affected` and `follows` are readable only by their owner, and writes go through `set_issue_affected()`, `add_follow()` and `remove_follow()` (SECURITY DEFINER). Feedback and reopen/appeal already exist (see Citizen above).


# Phase 2 (migrations 0015-0020)

Same conventions as above (envelope, errors, pagination, rate limits). New error code: `unavailable` (503) for a feature whose server setting is missing (photo storage, Web Push, AI).
Everything below needs an `Idempotency-Key` only where stated; POSTs accept one optionally.

## AI helpers (signed in)
| Method and path | Notes |
|---|---|
| `POST /ai/intake` `{text, language?: bn\|en\|auto}` | Draft only; nothing is stored or submitted. Returns `title, category, description, area_hint, urgency (routine\|soon\|urgent), urgency_guidance, language, pii_warnings, source (ai\|fallback)`. Banglish accepted; Bangla output unless English was chosen or the text is English. Danger words always force `urgent`, whose guidance is fixed text pointing to 999. |
| `POST /ai/transcribe` (multipart `audio`, `language`) | Bangla or English speech to text; audio type checked by content, 10 MB, never stored; spoken personal data is redacted. `{available:false, reason}` when no provider is configured. Env: `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_API_KEY`, `TRANSCRIBE_MODEL`. |
| `POST /ai/translate` `{text, to}` | On demand, always `machine_translated: true`; `available:false` means show the original. |

## Location, issues and media
| Method and path | Notes |
|---|---|
| `GET /constituencies/search?q=` | Manual area fallback (Bangla or English name, district, upazila). |
| `GET /representatives/lookup?lat=&lng=` or `?area=` | Constituency by point (boundary polygon with holes, else bounding box; `method` says which) and its verified current representatives. `needs_manual_choice: true` when nothing matches. |
| `POST /issues` | Now also takes `lat, lng` (inside Bangladesh), `locationSource (device\|map\|manual_area)`, `locationAccuracyM`; `constituencyId` is optional when coordinates are sent (derived from the boundary; 422 `constituencyId` if no area contains the point). The exact point is private; `GET /issues*` items carry `location: {lat, lng, approximate: true}` snapped to a grid cell (`app_settings.public_location_precision_m`, default 300 m). |
| `GET /issues` | New filters: `area` (text), `from`, `to` (dates), `near=lat,lng` with `radius_km` (0.1-50, on the approximate points). |
| `POST /issues/{ref}/media` (multipart `file`, `caption?`) | Reporter only. Type decided by content (JPEG, PNG, WebP), up to 8 MB; re-encoded as JPEG (longest edge 1600) so all EXIF/GPS is dropped; optional malware-scan hook (`MALWARE_SCAN_URL`, fails closed); max 5 per issue; stored in the private `issue-media` bucket, `private` and `pending` until the office reviews it. Needs `SUPABASE_SERVICE_ROLE_KEY`. |
| `GET /issues/{ref}/media` | Signed URLs (5 min). Reporter and office: all photos; everyone else: only photos approved for public display. |
| `POST /office/issues/{ref}/media/{id}` `{visibility, status}` | Office (`update` permission) approves or rejects a photo and sets `private\|office\|public`. Audited. |

## Ideas and questions
| Method and path | Notes |
|---|---|
| `GET /ideas`, `GET /ideas/{ref}` | Public (published and decided ideas): `constituency, category, status, sort=supported` filters, cursor pagination; `support_count`, never who. The author also sees their own pending idea. |
| `POST /ideas` `{constituency, category?, title, body}` | Verified account; 5 per day; personal data redacted; starts `pending_review` until a moderator publishes. |
| `POST/DELETE /ideas/{ref}/support` | One per verified account, not your own; returns the count. |
| `GET /ideas/{ref}/similar`, `GET /ideas/new/similar?constituency=&text=` | Similar ideas in the same area (trigram similarity); the second form checks a draft before posting. |
| `POST /office/ideas/{ref}/decision` `{decision: under_consideration\|planned\|declined, note?}` | Office manager (`decide`); a decline needs a note. Audited. |
| `GET /questions`, `GET /questions/{ref}` | Public questions (moderated) with their thread; the asker and the in-scope office also see private ones. |
| `POST /questions` `{constituency, visibility: private\|public, title, body}` | Verified account; 3 per hour, 10 per day. Public ones wait for moderation. |
| `POST /questions/{ref}/messages`, `POST /questions/{ref}/close` | Asker or office (`update`); 30 citizen messages per question, 5 per 10 minutes. |
| `GET /me/questions`, `GET /office/questions`, `POST /office/questions/{ref}/assign` | Own questions; office queue (RLS decides what a case officer sees); manager assigns to an active member. |

## Representatives, projects, responsiveness
| Method and path | Notes |
|---|---|
| `GET /representatives`, `GET /representatives/{id}` | Verified only. Profile fields each carry `source_url` and `checked_at`; detail adds recent announcements and projects. |
| `GET /constituencies/{key}/responsiveness?from=&to=` | `received, answered, pending, median_hours_to_first_response`, the stated date range and `method_url` for ONE area. "Answered" = a status change or note by someone other than the reporter. There is no comparison or ordering across areas. |
| `GET /announcements`, `POST /office/announcements`, `POST /office/announcements/{ref}/withdraw\|publish` | MP or office manager (`publish`). Audited. |
| `GET /projects`, `GET /projects/{ref}`, `POST /office/projects`, `POST /office/projects/{ref}`, `POST /office/projects/{ref}/milestones[/{id}]` | Projects with milestones; a source link needs the date it was checked; a delayed milestone needs a note. Audited. |

## Feed and notifications (signed in)
| Method and path | Notes |
|---|---|
| `GET /me/feed?personalized=true\|false` | Public issues; what you explicitly follow first, then newest. Never ordered by popularity; no inference about the person; each item has `why` (issue, area, category or null). `personalized=false` or the preference off gives plain newest-first. |
| `GET /me/notifications?unread=true`, `POST /me/notifications/{id}/read`, `POST /me/notifications/read-all` | Header `x-unread-count`. Text is generic (reference number and a short label, Bangla with `en`), never the issue content. |
| `GET/PUT /me/notification-preferences` | `channels {push,email}`, `muted_types`, `quiet_hours {start,end}` (HH:MM, your `timezone`), `personalization_enabled`. Quiet hours delay push and email, never the in-app item. |
| `GET /notifications/vapid-key`, `POST/DELETE /me/push-subscriptions` | Web Push opt-in. Push is sent **without a payload**; the service worker fetches `/me/notifications` after waking (frontend). |
| `POST /api/internal/notifications/deliver` | Scheduled worker, `Authorization: Bearer $CRON_SECRET`. Sends due push and email (Resend or Postmark: `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`), retries with backoff 1, 2, 4, 8 minutes, dead-letters after 5 tries. Events: status change (reporter and followers), new issue in followed area or category (once per day), question reply, idea decision or publication, announcement. |

## Office AI and analytics
| Method and path | Notes |
|---|---|
| `POST /office/issues/{ref}/copilot` | Summary, missing-information checklist and a Bangla reply draft as three pending `ai_suggestions` with citations (the facts used) and confidence; rule-based `source: fallback` without a model or when the answer cites nothing valid. Needs `update` on the issue. Nothing is sent; staff edit and approve through `/ai/suggestions/{id}/decision`, and a public reply is posted by staff via `update`. |
| `POST /office/issues/{ref}/routing` | Routing Agent: retrieves agency and rule chunks (semantic if embeddings are set, else lexical), proposes an agency with citations (source, URL, date checked). `suggestion: null` + `reason` means no confident suggestion. Demo and real sources never mix. |
| `GET /office/analytics?constituency=&days=` | `view_analytics` (office manager, MP). Groups under 5 are hidden; hotspots are approximate grid cells; duplicate clusters come from a recursive walk over `duplicate_of` edges. |
| `POST /office/analytics/reports`, `GET /office/analytics/reports`, `POST .../{id}/approve\|withdraw`, `GET /analytics/reports` | A frozen snapshot is a draft until an office manager approves it; only approved reports are public. A generated narrative is dropped if it contains a number not in the statistics. |
| `POST /api/mcp` | MCP server (JSON-RPC over HTTP), `Authorization: Bearer <staff access token>`; row-level security applies as that person. Tools: `search_cases`, `agency_directory`, `case_timeline`, `area_statistics` (read-only) and `propose_note` (creates a pending suggestion only). Every call is audited (tool and argument keys). |

## Admin and moderation
| Method and path | Notes |
|---|---|
| `POST /reports` `{type: issue\|idea\|question\|media, ref, reason, details?}` | Verified account; one report per person and item; 10 per day. |
| `GET /admin/moderation`, `POST /admin/moderation/items`, `POST /admin/moderation/review` | Moderators and admins. The queue shows excerpts of public content only (no reporter or author, no private issue data). `hide\|restore\|dismiss` and `publish\|reject` need a reason; audited. |
| `POST /office/invitations`, `GET /office/invitations`, `POST /office/invitations/{id}/revoke`, `POST /invitations/accept` | Staff join by invitation (single-use token, only its hash is stored, 7 days). Office managers invite case officers and agency liaisons into their own office; admins invite anyone; an MP invitation needs a verified representative of that area. Accepting needs the matching confirmed email. |
| `POST /admin/representatives/{id}/verify`, `PUT /admin/representatives/{id}/fields`, `POST /admin/accounts/{id}` | Admins. Verification needs an official source link; each field a source and check date; role or suspension changes need a reason and not on yourself. Audited. |
| `GET /admin/ai/runs`, `GET/POST /admin/ai/evals`, `GET /admin/audit` | Admins. Reading the run log or the audit trail is itself audited (`admin.access`). |
| `POST /admin/constituencies/import` `{source, geojson}`, `POST /admin/knowledge/ingest` `{rules?}` | Boundary import from a sourced file (closed rings inside Bangladesh, source name, URL, licence and fetch date required); knowledge index rebuild (idempotent). |

## Phase 3 (migrations 0021–0023)

All routes follow the common rules (session identity, Zod validation, rate limit, structured errors, `request_id`). A browser request that changes data and carries an `Origin` header for another site gets 403 `cross_site`. On `/admin/*` and `/office/*`, MPs, moderators and admins on a password-only session get 403 `mfa_required` once `enforce_mfa` is true.

| Method and path | Public or private | Audit | Notes |
|---|---|---|---|
| `GET /me/profile` | private | no | Own profile and `deletion_requested_at`. |
| `PATCH /me/profile` `{display_name?, preferred_language?: bn\|en}` | private | `privacy.profile_corrected` (before and after) | Strict body; unknown fields are 422. 10 per minute. |
| `GET /me/export` | private | `privacy.export` | Everything the person gave or caused, as a JSON download (`Content-Disposition: attachment`, `no-store`). Excludes role, staff notes and other people's data. 3 per minute. |
| `POST /me/deletion-request` | private | `privacy.deletion_requested` | 202. Repeating is harmless. Erasure runs in the daily job after 14 days. |
| `DELETE /me/deletion-request` | private | `privacy.deletion_cancelled` | `{cancelled: boolean}`. |
| `GET /me/consents`, `POST /me/consents` `{consent_type, policy_version, granted}` | private | `privacy.consent_granted` / `_withdrawn` | One open row per type; withdrawing stamps `withdrawn_at`. |
| `GET /office/kpis?constituency=&days=30` | private | no | Office manager or MP (`view_analytics`). Every metric has `definition`; groups under 5 are `null` with `suppressed: true`. Metrics: received, unassigned workload, median hours to first response, forwarding rate, reopen rate, median hours in each status, handling time with versus without an accepted copilot draft (an association, not proof of effect), AI acceptance per agent. |
| `GET /admin/kpis?days=30` | private | no | Administrators. New accounts, active reporters, issues submitted, abuse report rate, content hidden, notification delivery and dead letters, AI error rate, AI cost. |
| `GET /api/health` | public | no | `{ok}` only; 503 when the database is unreachable. For uptime checks. |
| `POST\|GET /api/internal/maintenance` | internal | `privacy.retention_run` | `Authorization: Bearer $CRON_SECRET`. Daily: deletes expired idempotency keys, rate-limit rows, notifications, AI runs and old deliveries; erases accounts past the 14-day grace; removes their photos from Storage; checks queue and AI health and posts alerts to `ALERT_WEBHOOK_URL`. |

Imminent-harm fields (no new route): `POST /ai/intake` may return `source: "emergency"` and an `emergency` object; `POST /issues` and `POST /questions` may return the same `emergency` object next to their normal result. Shape: `{kind: self_harm|violence|child_in_danger, guidance: {bn, en}, numbers: ["999", ...]}` (type `Emergency` in `src/lib/types.ts`). The UI must show `guidance` prominently and must not replace it with model text. The item is flagged in the moderators' queue as `unsafe` (automatic).

Error codes added: `forbidden` with `field_errors._` = `cross_site` or `mfa_required`.

### Frontend handoff for Phase 3 (backend cannot do these)

1. **TOTP enrolment and challenge** (`supabase.auth.mfa.enroll / challenge / verify`) for MP, moderator and admin sign-in. When it ships, backend sets `enforce_mfa` to true. Until then a 403 with `field_errors._ = "mfa_required"` on `/admin/*` or `/office/*` should route the person to the challenge screen.
2. **Privacy notice and terms pages** from `docs/aibc/privacy-notice.md` and `docs/aibc/terms.md` (Bangla first, drafts until counsel signs off). Record acceptance with `POST /me/consents`.
3. **"আমার তথ্য" and "অ্যাকাউন্ট মুছুন"** in settings: `GET /me/export`, `POST` and `DELETE /me/deletion-request`, date from `GET /me/profile`.
4. **Emergency guidance**: when `source === "emergency"` or an `emergency` object is returned, show `guidance[lang]` and the numbers prominently, above any other result.
5. **Report-only CSP**: open the app with the browser console and report any `Content-Security-Policy-Report-Only` violation; backend switches `CSP_MODE=enforce` when a week passes clean.
