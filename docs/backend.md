# Backend implementation plan — Jonokotha (জনকথা)

Owner: `backend` branch. Source of truth: `masterplan_JONOKOTHA.md` (§9 status model, §12 database, §13 API, §14 RLS, §15 notifications, §16 maps, §17 AI core, §18 security, §20 reliability, §21 testing). Frontend contract: `docs/WORK_SPLIT.md`.

Phases 0–4 follow the sprints (§24); phases 5–8 complete the whole masterplan (MVP completion, pilot, Release 1.1, Release 2). Dates are reference points, not the scope boundary. Every masterplan section is mapped in `docs/masterplan-coverage.md`.

## Stack and conventions

- Next.js 16 route handlers (`src/app/api/**`) plus Supabase (Auth, Postgres, Storage, RLS, pgvector). Read `node_modules/next/dist/docs/` before using Next APIs (`params` is a Promise; `proxy.ts` replaces middleware).
- TypeScript, Zod for every input and every AI output, Vitest for unit and RLS tests, GitHub Actions for CI.
- LLM: official Anthropic SDK, server-side only, default model `claude-opus-5-5` (`ANTHROPIC_MODEL`). Embeddings: multilingual model with strong Bangla (e.g. BGE-M3), chosen after a Bangla retrieval test.
- Keys only in server environment variables (`.env.local` locally, Vercel env in staging). The service-role key is never in a browser bundle and never in `NEXT_PUBLIC_*`.
- Never trust client-supplied role, constituency, status, reporter or owner IDs. Identity comes from the session.
- Folder layout: `src/lib/{db,auth,ai,notify,geo}/`, `src/lib/ai/prompts/` (versioned), `supabase/migrations/NNNN_*.sql`, `supabase/seed/`, `tests/{unit,rls,ai}/`, `scripts/`.
- API conventions (§13.10): cursor pagination, `Idempotency-Key` on creates, stable reference codes (`JK-2026-1001`), structured errors `{code, message, field_errors, request_id}`, rate limits and size limits, versioned breaking changes.

## Already built (Sprint 0, local)

- Migrations `0001_init.sql` (profiles, cases, case_events, constituencies, agencies, RLS on) and `0002_auth_staff.sql` (profile trigger, `is_staff()`, staff update policy, ref sequence, event trigger).
- `src/lib/supabase/{server,client}.ts`, `src/proxy.ts` (session refresh), email-code auth, `store.ts` (Postgres), `/api/intake`, `/api/cases`, `/api/cases/[ref]/approve`, keyword fallback and Claude drafting/summary, sourced agency directory in code.
- Known gaps: Anthropic key rejected (401); migrations need to be run in Supabase; public case reads include `reporter_id`; agencies are in code, not the DB; similar-case matching is token overlap only.

---

## Phase 0 — Preliminary submission (15–20 Nov)

**Status 2026-11-16:** code for 0.2, 0.4, 0.5, 0.6, 0.7, 0.9, 0.10 is done (migration 0003, `seed.sql`, `check:env`, `seed:demo`, `pii.ts`, rate limits, tests). Done since: migrations applied (0.1), AI key valid via gateway (0.2), sign-in and staff approval verified (0.3), staging deployed at https://jonokotha.vercel.app (0.8). Still open: service-role key and `npm run seed:demo` (0.10), phone PWA check, citizen API 403 check. See `docs/backend-setup.md`.

Goal: the golden path works on staging with real auth and real AI.

| # | Task | Done when |
|---|---|---|
| 0.1 | Run migrations 0001 and 0002 in the Supabase project; set the "Magic Link" email template to include `{{ .Token }}`. | Tables exist; the login email shows a code |
| 0.2 | Replace the invalid Anthropic key; add a startup check script `npm run check:env` that reports set/missing and calls the models endpoint without printing keys. | AI draft and summary return `source: "ai"` |
| 0.3 | Test sign-in end to end; promote one account to staff by SQL; verify citizen gets 403 on approve and staff gets 200. | Manual test log in `docs/aibc/` |
| 0.4 | Close the public-read leak: create a view `public_cases` with safe columns only (no `reporter_id`), point public pages at it; keep the full table staff/owner only. | Anonymous query cannot see `reporter_id` |
| 0.5 | Move agencies and the sample constituency into tables with seed SQL (`supabase/seed/`), keeping source URL and checked date. Keep the "নমুনা" label flag. | Routing reads from the DB |
| 0.6 | Rate-limit `/api/intake` and `/api/cases` (per user and IP), cap body size, validate lengths. | 429 on burst, tested |
| 0.7 | Redact phone numbers, emails and ID numbers before any model call; return a PII warning to the UI. | Unit test with Bangla and English samples |
| 0.8 | Deploy staging on Vercel with env vars; set Supabase redirect/site URL; confirm the PWA works over HTTPS. | Public staging URL works on a phone |
| 0.9 | Write the `docs/aibc/` drafts that are backend-owned (problem, AI architecture, data sovereignty) with real details: region, retention, model provider notice, source list. | Drafts reviewed |
| 0.10 | Seed script for the video: one demo constituency, a few synthetic cases (labelled), one duplicate pair. | `npm run seed:demo` is repeatable |

Exit: golden path on staging; keys safe; nothing public leaks personal data.

---

## Phase 1 — Foundation hardening (21 Nov – 1 Dec)

**Status 2026-11-16:** items 1–12 are done (migrations 0004–0013; 0011–0013 applied locally only; 1.8 uses hosted BGE-M3, provider chosen by env, Bangla retrieval test still to run once a key is set). CI now has a `database` job (all DB/RLS/API tests on a local Supabase) and a `security` job (gitleaks, npm audit). Item 10 is done: 118-case dataset, `npm run eval`, baseline in `docs/aibc/eval-baseline.md` (keyword fallback and AI drafting measured; embedding duplicate precision/recall not measured until `EMBEDDINGS_*` is set, which also tunes the 0.80 threshold). Open: an index back-fill for existing issues.

Goal: secure core with tested permissions and first AI metrics (§24).

1. **Schema completion** (§12): add `representatives`, `representative_constituencies`, `office_members`, `issue_categories`, `issue_media`, `issue_assignments`, `issue_agency_referrals`, `notifications`, `audit_logs`, `consents`, `user_preferences`, `knowledge_sources`, `knowledge_chunks`, `issue_embeddings`, `graph_edges`, `ai_runs`, `ai_suggestions`. Rename working tables toward masterplan names (`cases` → `issues`, `case_events` → `issue_events`) in one migration with data preserved. UUID PKs, UTC timestamps, indexes, FKs, retention columns.
2. **Roles and scopes** (§5, §14): roles citizen, staff, case officer, office manager, MP, moderator, admin; `office_members` ties staff to constituencies; staff see only their scope. MFA required for MP, moderator, admin accounts.
3. **RLS** (§14): deny by default; public reads only through safe views; citizen sees own private data; staff scoped by office; moderator sees queues only; admin elevated. **RLS test suite** with six accounts (citizen A, citizen B, office A, office B, moderator, admin) and a permission matrix document. CI fails if any test fails.
4. **State machine** (§9): all 13 statuses with a transition table in code and in a DB function; each transition validates required fields (e.g. `REFERRED_TO_AUTHORITY` needs destination, `RESOLVED` needs notes, `DUPLICATE` needs a master case, `REJECTED` needs reason and appeal route). Unit tests cover every allowed and forbidden transition.
5. **Office actions API** (§13.3): `acknowledge`, `assign`, `request-information`, `forward`, `update`, `resolve`, `close` under `/api/v1/office/issues/{id}/…`; citizen `additional-information`, `reopen`, `feedback`. Move current routes under `/api/v1`.
6. **Audit** (§18): immutable `audit_logs` and `issue_events` written by triggers and server code; every privileged action records actor, action, target, before/after, request id.
7. **SLA config** (§9.1): per-office/category response targets as configuration, timers paused with a reason when waiting for the citizen or an agency; displayed as targets, not guarantees.
8. **Duplicate Agent** (§17.2): embeddings stored in pgvector (`issue_embeddings`), similarity search restricted by category and area, reasons and scores returned; office links or rejects; `graph_edges` records issue–area–category–agency edges and "duplicate_of".
9. **AI plumbing**: `src/lib/ai/` with typed tool definitions, JSON-schema structured outputs validated by Zod, prompt versions in files, `ai_runs` logging (model, prompt version, tokens, latency, cost, decision), `ai_suggestions` with Accept/Edit/Dismiss endpoint; fallback to the manual path on timeout, refusal or malformed output.
10. **Evaluation set v0** (§17.7): 100+ Bangla and English synthetic cases with expected category, route and duplicates; scripted runner `npm run eval`; baseline report saved to `docs/aibc/eval-baseline.md` with date and dataset size. Never publish unmeasured numbers.
11. **CI** (GitHub Actions): install, lint, typecheck, unit tests, RLS tests (against a local Supabase via CLI), build; secret scanning and dependency audit.
12. **Idempotency and errors**: `Idempotency-Key` table; one error format across the API; request ids in logs.

Exit: RLS and transition tests green in CI; baseline AI metrics recorded.

---

## Phase 2 — MVP build (2–12 Dec)

Goal: every MVP backend feature in §4.2.

**Status 2026-11-16:** all 15 items are built and tested (migrations 0014–0020, applied to the local stack only; the live project still needs them in order). API list: `docs/api-v1.md` (Phase 2). Tests: `npm run test:db` (235), `npm test` (345), clean-database reset verified. Not measured yet: Bangla speech accuracy (no provider key), embedding-based routing and similar-idea quality (needs `EMBEDDINGS_*`), push delivery to real devices (needs VAPID keys and the frontend service worker). Those are Phase 3 evaluation work.

**Citizen features**
1. **Speech and translation**: `POST /api/v1/ai/transcribe` (Bangla and English; evaluate Whisper-family and cloud bn-BD), translation endpoint labelled and on demand; typed input always works.
2. **Intake v2**: `POST /ai/intake` returns title, category, description, area hint, urgency guidance, PII warnings; never submits; Banglish accepted; output always plain চলিত Bangla unless the user chose English.
3. **Issues**: create with media (Storage buckets, signed URLs, MIME/size limits, image resize, EXIF GPS stripped from public derivatives, malware scan hook), list with cursor pagination and filters (category, status, area, date, distance), detail via public view.
4. **Location and maps** (§16): constituency lookup by area or lat/lng (`/representatives/lookup`), boundary data from verified HDX files, approximate public coordinates with a configurable privacy offset, coordinate validation, manual area fallback.
5. **Engagement**: `issue_affected` ("আমারও একই সমস্যা", one per user, count only to public), `follows` (issue/area/category), `issue_feedback` ratings, reopen and appeal flows.
6. **Ideas** (§7.7, §8.4): CRUD, support (one per verified account), moderation states, office decision endpoint, similar-idea search (`/ideas/{id}/similar`).
7. **Questions** (§7.8): private vs public questions, messages, assignment, rate limits and anti-spam.
8. **Representatives and projects**: directory, verified profile fields with source and date, announcements, projects and milestones, **responsiveness** endpoint (received/answered/pending, median time to first response, stated date range, method link; never rankings).
9. **Feed**: `GET /me/feed` ordered by followed areas, categories and recency; `personalized=false` supported; never by engagement alone; no sensitive-trait inference.
10. **Notifications** (§15): in-app table and API, preferences and quiet hours, dedupe, retry with backoff, delivery status; Web Push (VAPID) opt-in; transactional email via Resend or Postmark; no sensitive details in previews. Events listed in §15.

**Office and AI**
11. **Office Copilot**: summary, missing-information checklist, reply draft in plain Bangla, all stored as `ai_suggestions` with citations and confidence; staff edit and approve; public replies always staff-approved.
12. **Routing Agent (RAG)**: knowledge ingest of the agency directory and service rules into `knowledge_chunks` (locale, source, fetch date, checksum); retrieval with citations; no valid citation means "no confident suggestion". Demo and real sources never share an index.
13. **Insight Agent and analytics**: aggregated, privacy-filtered hotspot and trend queries (recursive SQL over `graph_edges`), basic analytics endpoint, office review before sharing.
14. **MCP server**: read-only tools (search cases, agency directory, case timeline, area statistics) with audit logging; write tools require a confirmed human action.

**Admin**
15. Verification (office staff by invitation, MPs from official sources), moderation queue with required reasons and audit events, `GET /admin/ai/runs` and `/admin/ai/evals`, constituency import, audit log API.

Exit: all §4.2 features work end to end against the frontend on staging.

---

## Phase 3 — Production hardening (13–20 Dec)

1. **Security review** (§18.1): re-run the full RLS matrix; CSP and secure headers; CSRF where cookie sessions are used; rate limits on login, OTP and AI routes; request-size limits; dependency and secret scanning clean; signed URLs for private media; no secrets in client bundles (grep build output).
2. **AI evaluation run and publication** (§17.7): run the suite on the final prompts and model; measure category accuracy, routing top-1/top-3 and citation validity, duplicate precision/recall, PII-redaction recall, hallucination rate, Bangla vs English parity, latency and cost; compare to baseline; fix regressions; publish `docs/aibc/eval-results.md` with date, dataset size and limitations.
3. **Backups and restore drill**: scheduled Postgres backups, a tested restore into a scratch project, recovery point and time objectives recorded.
4. **Monitoring**: Sentry for errors and performance, uptime check, alerting on 5xx rate, queue failures and AI error rate; dead-letter handling for notification and AI jobs.
5. **Runbooks**: incident response, key rotation, restoring service, taking content down, handling threats of imminent harm (emergency guidance, not an AI reply).
6. **Performance**: indexes reviewed with `EXPLAIN` on feed, list and similarity queries; pagination everywhere; cache public read-only data safely; retry/backoff on external calls.
7. **Privacy** (§18.2): retention and deletion jobs, data export and correction endpoints, consent records, privacy impact assessment draft, privacy notice content (Bangla first).
8. **Docs**: finish backend-owned `docs/aibc/` documents with evidence.

Exit: security checklist signed, eval results published, restore drill passed.

**Status 2026-11-16 (Phase 3 built; exit criteria NOT all met):**

| Item | State | Where |
|---|---|---|
| 1 Security review | Done as a self-review; open findings listed | `docs/aibc/security-review.md`. Built: security headers (CSP report-only), CSRF origin check, MFA gate with stable error, 0 audit findings |
| 2 AI evaluation | Run and published with limitations; several measures **not measured** (embeddings, copilot quality, citations, Bangla speech) | `docs/aibc/eval-results.md`; offline gate `npm run eval:gate` in CI |
| 3 Backups and restore drill | Script and interim nightly backup workflow built; **no production drill done; backups not running until secrets are set; Free plan has no Supabase backups** | `docs/aibc/restore-drill.md` |
| 4 Monitoring | Sentry hook and alert webhook built (inactive until `SENTRY_DSN`, `ALERT_WEBHOOK_URL` are set); `/api/health` for an uptime check (the uptime service itself is not set up); dead-letter state already existed for deliveries; health counts in the daily job | `src/lib/monitor.ts` |
| 5 Runbooks | Written, names and numbers blank | `docs/aibc/runbooks/` |
| 6 Performance | `EXPLAIN` on 50,000 issues; filtered lists and the office list were scanning (5 to 35 ms, growing); migration 0022 adds matching indexes (office list 5 ms to 0.05 ms). Similarity and feed queries were not load-tested | migration 0022 |
| 7 Privacy | Export, correction, deletion with 14-day grace, consent records, retention sweep, PIA, notice and terms drafts (counsel review pending) | migration 0021, `docs/aibc/pia.md` |
| 8 Docs | Backend-owned documents above written with evidence; items still needing people are listed in each file | `docs/aibc/` |
| M.6 MFA | Enforcement tested; **flag still off** until TOTP screens exist | `security-review.md` |
| M.8 Emergency path | Rules, fixed guidance, moderator flag, tests; wording needs native and counsel review | `docs/aibc/runbooks/imminent-harm.md` |
| M.10 Eval in CI | Offline floors fail the build on regression; live-model measures stay manual | `.github/workflows/ci.yml` |
| M.11 KPIs | Office and admin KPI queries with definitions and suppression (migration 0023) | `docs/api-v1.md` |
| M.12 Release gate | `npm run check:release` (automatable items) | `scripts/check-release.mjs` |
| M.13 Env names | §26 aliases accepted; `check:env` lists the new settings | `src/lib/env-aliases.ts` |

Not done and needing people: independent penetration test, restore drill on real backups, TOTP enrolment screens then `enforce_mfa=true`, counsel review of privacy notice and terms, native-Bangla review of emergency wording, Sentry project and uptime monitor, a shared IP rate limiter, malware scanner, Storage backup. M.7 quarantine bucket not built. M.9 notice and PIA exist as drafts; the frontend still has to render them.

---

## Phase 4 — Freeze and rehearse (21–25 Dec)

1. Feature freeze; only fixes, each with a regression test.
2. Demo seed and reset: `npm run seed:demo` and `npm run reset:demo` tested from a clean database; synthetic data clearly labelled; production data never touched.
3. Keep staging and demo environments separate; pin the model version and prompt versions for the demo; keep a pre-recorded AI response fallback if the network fails.
4. Verify keys, quotas and credits for the demo day; confirm Supabase region and Vercel limits.
5. Join the rehearsals: health check script before every run.

---

## Phase 5 — MVP completion

Goal: everything the masterplan requires of the MVP product (§4.2, §5, §6, §10, §12, §13, §17, §19, §31) that phases 0–4 did not plan. Each item: migration, RLS and tests, `docs/api-v1.md` entry, audit where privileged.

| # | Task | Masterplan |
|---|---|---|
| B5.1 | **MP role features**: approve official statements and commitments before publish (approval record on announcements, public replies, project changes); constituency-level analytics for MP; delegation of tasks to office staff; MP cannot alter audit history or delete reports. | §5.2 |
| B5.2 | **Agency liaison**: invited per agency and constituency; sees only cases referred to their agency; acknowledge receipt, add authorised updates, record external reference or channel link, close agency task with evidence; never labelled as official integration unless confirmed. | §5.5, §12 `issue_agency_referrals` |
| B5.3 | **Admin configuration APIs**: users and role management (invite, suspend, change role with audit); categories CRUD (bn/en names, parent, default priority, active); SLA targets per office and category; constituency boundaries and directory records management; feature flags table and server check; integrations config (providers enabled, keys present, never returned); system health endpoint (DB, storage, queues, AI provider, notification delivery); security alerts feed (auth failures, rate-limit hits, RLS denials); knowledge-source management (add, refresh, retire); safe demo-data management (load, reset, never in production). | §5.6, §6.4, §31 admin |
| B5.4 | **Received vs forwarded vs officially registered**: explicit field on referrals (`received`, `forwarded`, `officially_registered` with proof); public view exposes it; never infer "registered" without an integration record. | §1, §28, §31 #18 |
| B5.5 | **Missing MVP tables and endpoints**: `idea_comments` (moderated, rate-limited, report action) with `POST /ideas/{id}/comments`; `polls`, `poll_options`, `poll_votes` (unique per user) with office create, publish, close and citizen vote APIs, results only after close or per office setting; constituency snapshot endpoint for home (reported, in progress, resolved, with date range); projects: budget source and verification date, procurement and work details where lawful, delay explanation required, post-completion feedback; follows on projects and representatives. | §4.2, §7.3, §8.5, §12, §21.2 |
| B5.6 | **Report fields**: duration ("how long"), who/what is affected, video upload (size and type limits, poster frame, no transcoding of private originals). | §7.4 |
| B5.7 | **Administrative hierarchy**: division → district → upazila/city → ward/union tables from verified data; lookup returns all possible constituencies when the boundary is uncertain; PostGIS for point-in-polygon if enabled; coordinate change that moves jurisdiction goes to review. | §7.13, §8.1, §12.2, §16 |
| B5.8 | **Runtime services**: background job runner (notifications, media processing, AI tasks, ingestion) with retry and dead letters; Realtime channels only for a user's own status changes and office inbox counts; Sentry for server and edge; privacy-conscious product analytics (no personal data, no cross-site tracking). | §10.1, §11, §20 |
| B5.9 | **Notification completeness**: every §15 event wired (incl. poll closing reminder, appeal answered, announcement opt-in); unsubscribe for non-essential; email templates in Bangla first; SMS only for critical verification where consented and budgeted. | §15 |
| B5.10 | **Remaining agents**: Translation (bn ↔ en on demand, labelled, original kept); Idea Assistant clarity suggestions; Insight Agent hotspot and trend brief linking to cases, office review before sharing; prompt caching with stable content first; Bangla glossary in every system prompt; refusal, timeout and malformed-output fallbacks logged. | §17.2, §17.5 |
| B5.11 | **Personalization and language**: `simple_language_mode` and `voice_first` respected by agents and feed; view, reset and switch off personalization; Banglish search (transliteration index so "rasta bhanga" finds "রাস্তা ভাঙা"); phone and OTP accept Bangla digits; numeral preference stored. | §17.4, §19.1 |
| B5.12 | **Country adapters**: country, admin hierarchy, locale, currency, date format, categories, agency directory, identity checks and notification channels as configuration; Bangladesh as the first adapter; no Bangladesh-specific logic in shared modules. | §2.8.4, §31 #21 |
| B5.13 | **Capability labels**: every API response for a feature flag, sample or demo record carries `data_status` (`live`, `sample`, `demo`, `planned`) so the UI can label it. | §2.9, §31 #20 |
| B5.14 | **Architecture record**: `docs/architecture.md` with the decision to keep the single Next.js app instead of the §10.2 monorepo (or the migration plan), domain module map (§10.4), data-flow diagram; `docs/runbooks/`, `docs/security.md`, `docs/workflows.md` as listed in §10.2. | §10.2, §10.4 |
| B5.15 | **Open311-ready IDs**: stable public IDs and category codes now, so the Release 2 GeoReport v2 API needs no migration. | §13.10, §4.4 |

Exit: every §31 "required" feature has a working endpoint, test and documented contract.

**Status 2026-11-17 (Phase 5 built on branch `claude/backend-phase5-e8d6bf`; all 15 items built, tested locally, NOT applied to the live project):**

*Migrations (only 0030-0036 used; Phase 6 owns 0060-0079):* 0030 MP approvals, delegation, agency liaison, referral stages · 0031 admin configuration, feature flags, categories, SLA, platform invitations, integrations, security events, demo data · 0032 idea comments, polls, snapshot, project transparency and feedback, follows for projects and representatives, report fields, video · 0033 administrative hierarchy, candidate lookup, reviewed location changes · 0034 background jobs, Realtime inbox counts, product events · 0035 notification events, opt-in and essential types, personalization, Banglish search, Insight links · 0036 country adapters, Open311-ready views. Each re-runs without error on a database that already has it, and the whole chain applies on a clean `supabase db reset`.

*Tests:* `npm test` 385 pass (1 skipped, as before); `npm run test:db` 353 pass on a clean reset (was 256 at the start); lint and typecheck clean. New: `tests/unit/phase5.test.ts`, `tests/rls/phase5.test.ts` (every new table: who reads what, no direct writes from any role, function privileges), `tests/api/phase5-mp-agency.test.ts`, `tests/api/phase5-admin-engagement.test.ts`, `tests/api/phase5-platform.test.ts`. Docs: `docs/api-v1.md` (Phase 5 section), `docs/architecture.md`, `docs/security.md`, `docs/workflows.md`, `docs/runbooks/`, appended notes in `permission-matrix.md` and `masterplan-coverage.md`.

*Item by item:* **B5.1** approvals (announcement, public reply, project change) with `approve` and `delegate` permissions, tasks, MP overview, MP cannot touch audit or reports (tested). **B5.2** liaison invited per agency and area, reads only `liaison_cases()`, five audited actions. **B5.3** all listed admin APIs; health covers DB, storage, queues, jobs, AI provider, delivery. **B5.4** `forwarded` / `received` / `officially_registered`, the last impossible without a confirmed integration and proof (database constraint); public view `public_case_referrals`. **B5.5** comments (moderated by report and hide), polls, snapshot, project budget source, delay explanation (required when the end date moves later), feedback after completion, follows. **B5.6** duration, who is affected, one video per issue via signed upload, poster frame, no transcoding. **B5.7** hierarchy import and link, `constituency_candidates()`, ambiguous points make the person choose, location changes that move jurisdiction go to review. **B5.8** job runner with retry and dead letters, Realtime only for own notifications and inbox counts, Sentry through `instrumentation.ts` (server and proxy), product events with nothing identifying. **B5.9** every §15 event has a producer; announcements are opt-in; essential types cannot be muted; signed unsubscribe; Bangla-first email templates; SMS adapter with consent and budget gate (no provider). **B5.10** translation labelled with original kept, Idea Assistant with rules fallback, Insight brief links cases and the previous period, prompt blocks cacheable (shared rules and Bangla glossary first), refusal, timeout and bad-output fallbacks logged and tested with a mocked model. **B5.11** `/me/personalization` (view, change, reset), simple language mode and voice-first reach agents and the feed, Banglish search, Bangla digits in OTP (login form) and the Bangladesh phone normaliser, numeral preference stored. **B5.12** `country_adapters` table plus `src/lib/country/` (Bangladesh first). **B5.13** `data_status` on every response, `feature_disabled` for flagged routes. **B5.14** documents listed above. **B5.15** `service_request_id`, immutable category `service_code`, Open311-shaped views.

*Decisions made without asking:* (1) MP approval is an area setting and applies only while an active MP exists; the generic public-note path refuses public notes there so it cannot be bypassed. (2) A liaison gets a purpose-built read function, never table access, because `issue_events` holds internal notes. (3) `received` means the agency's liaison confirmed receipt. (4) PostGIS is not enabled (point-in-polygon stays in SQL with a bounding-box prefilter; revisit past a few hundred polygons). (5) Video goes straight to storage on a signed URL because serverless bodies are too small; the server checks container type and size afterwards. (6) Idea comments publish at once and are moderated by reports (post-moderation), 10 a day. (7) Public poll results need at least 5 votes. (8) Admin-created categories are stored and returned, but the report form still validates against the 12 built-in slugs (`src/lib/categories.ts`, shared with the frontend) until the frontend reads `GET /categories`. (9) Local verification used a second Supabase stack on ports 55xxx (`project_id` changed in an uncommitted `supabase/config.toml`) so it did not clash with the Phase 6 session.

*Not measured:* Realtime delivery latency; job runner throughput; Banglish search precision (the consonant skeleton can over-match; no relevance test set exists); Idea Assistant, translation and Insight quality with the live model (all tested with a mocked model only); prompt-cache hit rate (needs live traffic); video upload on real phones and networks; the inbox-count trigger under load.

*Blocked or needs people:* a confirmed agency integration (agreement with an agency) before anything can be `officially_registered`; an SMS provider, budget and consent wording before SMS verification; verified boundary and hierarchy files to import (`POST /admin/admin-units/import`); a Sentry DSN; a malware scanner (`MALWARE_SCAN_URL`); native-speaker review of the glossary, the rule-based idea questions and the Bangla email texts; frontend work to subscribe to Realtime, show `data_status`, `GET /categories`, the approval, polls, liaison and admin screens. **Open follow-ups:** retention sweeps do not yet delete `issue-video` objects of erased reports; `check:release` and `check:env` do not yet know the Phase 5 checks or variables (Phase 6 owns those scripts); migrations 0030-0036 (and 0014-0023) are not on the live project (M.14).

*Merge notes for whoever combines branches:* shared files edited append-only or minimally: `tests/rls/coverage.test.ts` (three `push` lines before the `describe`), `tests/rls/phase2.test.ts` (one function signature: `create_office_invitation` now has five arguments), `tests/api/admin.test.ts` (two invitations use `case_officer` because a liaison needs an agency), `tests/api/notifications-feed.test.ts` and `tests/api/v1.test.ts` (new notification and item fields), `src/lib/api.ts` (feature flag, `data_status`, security events), `src/lib/auth.ts` (two permissions), `src/components/LoginForm.tsx` (one import and one call).

---

## Phase 6 — Pilot readiness and operations

Goal: one verified MP office and a citizen tester group using the live product (§24 After the Congress, §2.8.3, §29).

| # | Task | Masterplan |
|---|---|---|
| B6.1 | Pilot plan: one constituency, verified office, limited categories, onboarding and training material, support contact and escalation; cost tracking against the M.5 model. | §2.8.3, §29 Operations |
| B6.2 | **Real data ingestion** with lineage (source, licence, fetch date, checksum) and scheduled refresh: constituencies and current MPs (Election Commission, Parliament), administrative boundaries (HDX, licence checked), OSM with ODbL attribution, public-service directory (National Portal, agency sites), GRS link, 999 and 333 helplines verified before display. Scrapers respect robots.txt and rate limits; no personal data collected; demo and real indexes separate. | §17.6, §17.3 |
| B6.3 | Legal and governance: counsel review of Bangladesh data-protection, cyber-security and platform obligations; named data-protection owner; retention per data class with legal hold; anonymous-to-public reporting with abuse controls; residency map confirmed. | §18.2, §18.4 |
| B6.4 | Environments: separate dev, staging and production Supabase and Vercel projects; migrations only through reviewed CI/CD; rollback plan for app and forward-fix for DB; least-privilege deploy credentials; status page or service notice. | §20, §26 |
| B6.5 | AI with real use: consented real examples added to the eval set; Bangla speech tested with different districts, ages and noisy streets; routing accuracy checked against office final decisions; thresholds set from measured baselines. | §17.7, §19.6, §3.3 |
| B6.6 | KPI baselines measured in the pilot (north-star metric, time to acknowledgement, copilot vs no-copilot handling time, accessibility task completion); published with method. | §3.2, §3.3 |
| B6.7 | Independent penetration test before large-scale public launch; fix and retest. | §18.1 |

Exit: §29 launch checklist fully ticked.

**Phase 6 status (2026-11-17, branch `claude/backend-phase6-9e2129`, migrations 0060–0062, local stack only, nothing applied to the hosted project):** everything in B6.1–B6.7 that code, scripts, CI and documents can do is built; items that need people, accounts or real data are listed as open in `docs/aibc/pilot/open-items.md`.

| # | Built | Open (needs people / accounts / data) |
|---|---|---|
| B6.1 | `pilot_sites` (live needs verified office, contacts, categories), `pilot_budget_lines`, `pilot_cost_entries`, `pilot_cost_report` (AI cost from `ai_runs`, per-site figure); `docs/aibc/pilot/{pilot-plan,onboarding-training,support-escalation,cost-model}.md` | Real office and testers, named owners, M.5 budget figures (`business.md` is not on this branch) |
| B6.2 | Ingestion framework `src/lib/ingest/` (robots.txt parser, polite fetcher with per-host rate limit, https-only, size cap, no redirects; parsers; runner), `ingestion_sources/_runs/_records` with CHECK-enforced "robots obeyed, no personal data, licence checked before enabling", lineage into `knowledge_sources` (checksum, licence, fetch time, retire previous), daily refresh via `/api/internal/maintenance` and `/api/internal/ingest`, PII-bearing records rejected, demo/real separation (`is_demo`, `knowledge_index_summary`, `public_data_sources`); helplines with propose / second-person verify / expiry and public view `public_helplines`; `docs/aibc/pilot/data-sources.md` | Reading each real source's licence, 999 and 333 verification by two people, frontend attribution. No real site was fetched; tests inject a fake fetch |
| B6.3 | `retention_policies` (public safe view, enforced vs proposed), `legal_holds` that block account erasure (`erase_user_data` wrapped, `run_retention` counts `accounts_held`), `docs/aibc/pilot/governance.md` (counsel checklist, owners, abuse controls, residency map), `counsel-review.md` | Counsel review, named data-protection owner, confirmed retention periods |
| B6.4 | `config/environments.json` + `npm run check:environment`, `npm run lint:migrations` (also in CI and `check:release`), `.github/workflows/migrate.yml` (plan, approval-gated apply), `scripts/migrate-env.sh`, runbooks `environments.md` and `deploy-and-rollback.md` (rollback and forward-fix), `service_notices` with public `GET /service-notices` | Hosted dev/staging/prod projects, GitHub Environments with reviewers, secrets |
| B6.5 | Consented-example intake (`eval_candidates`, consent `ai_eval_example`, review, export, forgotten on withdrawal or deletion), `EVAL_REAL_EXPORT` in `npm run eval`, `routing_accuracy()`, `ai_thresholds` with evidence rule and `eval-real/baseline.ts` threshold choosers, `stt_test_runs` and summary, `docs/aibc/pilot/ai-real-use.md` | Real consented examples, native reviewers, the speech test with volunteers, wiring measured thresholds into duplicate/routing code (table exists, code still reads `DUPLICATE_MIN_SCORE`) |
| B6.6 | `kpi_baselines`, `snapshot_kpi_baseline` (incl. north-star), manual metrics with method, publish/withdraw, `public_kpi_baselines`, `docs/aibc/pilot/kpi-baselines.md` | Baseline weeks of real use, accessibility test, copilot time study |
| B6.7 | `pentest_findings` with fix/retest rules, `pentest_summary().blocking_launch`, `docs/aibc/pilot/pentest.md` (scope, rules, ASVS checklist) | The independent tester and retest rounds |

Decisions made without asking: the north-star counts documented terminal outcomes per month; helplines need a different administrator than the proposer and expire after 7 to 365 days (default 90); a legal hold protects the account, its reports and the audit trail, not routine operational deletions; critical and high pen-test findings cannot be risk-accepted; redirects are never followed by the fetcher; a third scheduled cron was avoided (Vercel Hobby) by chaining ingestion into the daily maintenance route.
Tests: `npm test` 385 passed; `npm run test:db` 290 passed (new: `tests/db/phase6.test.ts` 22, `tests/rls/phase6.test.ts` 3, `tests/api/phase6.test.ts` 9; coverage guard extended); unit tests for robots, fetcher, parsers, thresholds, migration lint and environment policy; lint and typecheck clean; `check:release --skip-db` passes. API list: `docs/api-v1.md` "Phase 6".

---

## Phase 7 — Release 1.1

| # | Task | Masterplan |
|---|---|---|
| B7.1 | **Consultations with consensus mapping**: `consultations`, `consultation_statements`, `statement_votes` (unique per user and statement), `consultation_reports`; MP or delegate approval before opening; moderated statements; AI groups voting patterns and summarises agreement and differences (aggregates only, minimum group size, no individual profiling); office review of the AI summary; "you said, we did" report; notifications to participants and area followers. | §7.14, §8.10, §12 R1.1 |
| B7.2 | **WhatsApp and SMS intake** through approved providers: `channel_messages`; inbound webhooks with signature check; consent and privacy notice first; Intake Agent draft reply; "হ্যাঁ" creates the case with the same reference, timeline and privacy rules; updates on the same channel within preferences; Unicode SMS length budget; provider cost alerts. | §7.15, §8.12, §19.7 |
| B7.3 | **Project check-ins**: `project_checkins` (photo, note, visited_at, moderation), labelled citizen-submitted, never changes official status; office response. | §7.16 |
| B7.4 | **Email and SMS notification integration** where available; area alerts for followed areas. | §4.3, §7.15 |
| B7.5 | **Ideas**: `idea_arguments` and `idea_argument_votes` (for/against points, helpful votes); per-area support threshold and office response time; threshold reached alerts office, idea shows awaiting response with due date, missed date shown publicly as overdue. | §7.7, §8.11 |
| B7.6 | **Public polls and surveys** opened to citizens (tables from B5.5), citizen satisfaction surveys after closure. | §4.3 |
| B7.7 | **Project and commitment tracker**: commitments linked to announcements, projects and ideas, with evidence and status history. | §4.3 |
| B7.8 | **Community priority ranking** of local needs: non-binding, clearly labelled, one ranking per verified local account, aggregate only. | §4.3 |
| B7.9 | **Weekly AI insight briefs** for offices from the Insight Agent, office review before sharing. | §4.3 |
| B7.10 | **Exportable office reports** (CSV and PDF with correct Bangla conjunct rendering), permission-checked. | §4.3, §19.7 |
| B7.11 | **Better clustering and heatmaps** data endpoints with small-group suppression. | §4.3, §22 |
| B7.12 | **Read-aloud** (text-to-speech) for key screens and office replies, Bangla voice. | §19.6 |
| B7.13 | Release 1.1 notification events (§15) and KPIs (§3.3); E2E scenarios 16–17 (§21.3). | §15, §3.3, §21.3 |
| B7.14 | Evaluate PostgreSQL recursive graph queries against Apache AGE once query size grows. | §11 |

---

## Phase 8 — Release 2

| # | Task | Masterplan |
|---|---|---|
| B8.1 | Public budget and expenditure transparency with verified source documents only. | §4.4 |
| B8.2 | Agency integrations only where official APIs or authorised workflows exist; marks referrals "officially registered" with proof. | §4.4, B5.4 |
| B8.3 | Assisted reporting through community volunteers and kiosks: volunteer role, on-behalf-of reports with consent record. | §4.4 |
| B8.4 | Open-data portal with privacy-safe aggregated datasets and licence. | §4.4 |
| B8.5 | Multi-constituency and regional administration support (regional admins, cross-office views within scope). | §4.4 |
| B8.6 | Participatory budgeting only where an office controls a real budget and agrees to follow the result. | §4.4 |
| B8.7 | Right to Information helper: drafts a request and points to the official channel; never files on the citizen's behalf. | §4.4 |
| B8.8 | MP activity from official parliamentary records with plain-Bangla AI summaries; sourced, neutral, never a score. | §4.4 |
| B8.9 | Open311 GeoReport v2–compatible public API. | §4.4, §13.10 |
| B8.10 | Second-country adapter pilot after local legal, electoral and data-protection review. | §2.8.4 |

## Endpoint checklist (target, §13)

Auth and profile; constituencies and representatives; issues and office actions; ideas; questions; projects and announcements; admin and moderation; AI endpoints; engagement (affected, follows, responsiveness, lookup); notifications; feed. Each endpoint needs: Zod validation, session-based identity, resource-level authorization, rate limit, structured errors, audit event where privileged, and a test.

## Definition of done (every task)

Input validated, authorization tested for allowed and denied roles, RLS test added for any new table, audit event for privileged actions, no private data in public views, AI output validated and logged with a manual fallback, migration is repeatable on a clean database, documented in the API list, CI green.

---

## Masterplan alignment (added 2026-11-16)

Full requirement map: `docs/masterplan-coverage.md`. Items below were in the masterplan but in no phase above. Each belongs to the phase shown; the rest of this file is unchanged.

### Phase 3 additions (13–20 Dec)

| # | Task | Masterplan | Done when |
|---|---|---|---|
| M.6 | **MFA** for MP, moderator and admin: enforce Supabase TOTP (AAL2) in `guardAdmin`, office-manager and MP routes and in RLS-backed RPCs; recovery path documented; test with an AAL1 session (403) and AAL2 (200). | §5, §14, §18.1 | AAL1 session cannot call any privileged route |
| M.7 | **Upload safety and review**: malware-scan adapter (ClamAV or provider) wired to the existing hook, quarantine bucket, fail closed; written security review of every route with a checklist; schedule an independent penetration test or a documented self-test using OWASP ASVS L2. Report in `docs/aibc/security-review.md`. | §18.1, §21.6 | Infected test file rejected; review signed |
| M.8 | **Emergency path**: detect imminent-harm language (rules first, AI second, never an AI reply), return Bangla emergency guidance (999 and the official channel) from intake and questions; notify moderator queue; eval cases for it. | §17.8, §21.6 | Test set passes; copy approved by the team |
| M.9 | **Privacy and terms content**: privacy notice (easy-Bangla summary on top, then full Bangla and English), terms, takedown and challenge process (§18.3), privacy impact assessment `docs/aibc/pia.md`; counsel review recorded. Frontend renders them. | §18.2, §21.6 | PIA complete; counsel status written down |
| M.10 | **Eval in CI**: `npm run eval` runs on every prompt, model or schema change (path filter) against a pinned fixture mode and fails on regression beyond a stated tolerance; live-model run stays manual. Add copilot reply quality, routing citation validity, Bangla readability and glossary adherence (native reviewers) and Bangla vs English parity to the report. | §17.7, §21.5 | CI blocks a deliberate regression |
| M.11 | **KPI and analytics queries**: office-only (unassigned workload, time to acknowledgement, time in status, forwarding rate, resolution with evidence, reopen rate, copilot vs no-copilot handling time, AI acceptance rate per agent), admin (adoption, abuse and spam rate, auth failures, API errors, notification delivery, cost), public metrics each with a definition string, date range and last-updated. Small-group suppression. Documented in `docs/api-v1.md`. | §3.3, §22 | Every §3.3 KPI has a query or is marked "pilot only" |
| M.12 | **Release-gate script** `npm run check:release`: runs the §21.6 list that can be automated (RLS suite, private-data-in-public-endpoints probe, cross-constituency probe, audit-log presence for critical transitions, restore drill timestamp, privacy and terms present, eval gate) and prints the manual ones. | §21.6, §29 | One command gives a pass/fail list |
| M.13 | **Env names**: reconcile `.env.example` and `check:env` with §26 (`NEXT_PUBLIC_APP_URL`, `AI_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_ENDPOINT`, `STT_PROVIDER`, `STT_API_KEY`, `MAP_PROVIDER`, `SENTRY_DSN`, email and push keys); keep old names as accepted aliases for one release; separate dev, staging and production projects documented. | §26 | `check:env` passes on all three environments |
| M.14 | **Apply migrations 0014–0021 to the live project** in order, then run the Phase 2 smoke test on staging; record the date here. | §24 | Staging runs every `/api/v1` route in `docs/api-v1.md` |

### Competition package (owner: backend unless noted; due before the 20 Dec docs freeze)

| # | Document | Content |
|---|---|---|
| M.1 | `docs/aibc/problem.md` | Replace draft: cited figures only (or qualitative), at least a few citizen and staff interviews, local and global context. Business analyst owns the evidence. |
| M.2 | `docs/aibc/scalability.md` | Infrastructure (Vercel, Supabase tiers, read replicas, queues), country adapters, multilingual design, cost per constituency, roadmap to Release 1.1 and 2, load-test result for the feed, list and similarity queries (measured, with date). |
| M.3 | `docs/aibc/ethics.md` | Bias mitigation (Bangla vs English parity, no ranking of MPs, no inference of identity, affiliation or credibility), human-approval points, AI inventory (each agent, model, prompt version, data it sees), redaction, appeal, known limits. |
| M.4 | `docs/aibc/team.md`, `collaborators.md`, `ai-usage.md` | Named owner for each of the five AIBC roles; every advisor and NRB contribution (advisors never write product code or influence judging); AI tools used to build Jonokotha and what each produced. Team lead owns; facts only. |
| M.5 | `docs/aibc/business.md` | Institutional buyer model (offices, administrations, civic or development partners), pilot plan (one constituency, verified office, limited categories, training), per-constituency cost model (hosting, AI inference, support, moderation), measurable value proposition (staff time saved per case, time to acknowledgement, duplicates merged), free citizen reporting, no sale of personal data, no political ads. No claim of partners, revenue or customers that do not exist. |

### Phase 4 additions (21–25 Dec)

- **Q&A sheet** (`docs/aibc/qa.md`): why AI is essential, hallucination and wrong routing, privacy and data residency, Bangla quality, how MP offices adopt it, who pays, what is real versus planned. Answers cite measured numbers only.
- **Demo accounts** (§27): one-click demo citizen and demo office sign-in on staging only, hidden in production by env check; demo constituency cannot reach production; no fake verified MP; never send a real agency a demo case.
- **Pinned model and prompt versions** for the demo, plus a recorded AI-response fallback (already listed above).
- **Pilot readiness checklist** (§29 Operations): support contact, escalation owner, incident owner, rollback runbook, first verified office onboarding notes.

### Definition of done additions

Every endpoint also states: public or private, audit event, rate limit, and the §22 definition string if it returns a public metric. Every new AI feature adds eval cases in Bangla and English and a manual fallback test.
