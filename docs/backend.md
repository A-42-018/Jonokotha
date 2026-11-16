# Backend implementation plan — Jonokotha (জনকথা)

Owner: `backend` branch. Source of truth: `masterplan_JONOKOTHA.md` (§9 status model, §12 database, §13 API, §14 RLS, §15 notifications, §16 maps, §17 AI core, §18 security, §20 reliability, §21 testing). Frontend contract: `docs/WORK_SPLIT.md`.

Phases follow the sprints (§24). Dates are 2026.

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

**Status 2026-11-16:** items 1–9, 11 and 12 are done (migrations 0004–0013; 0011–0013 applied locally only; 1.8 uses hosted BGE-M3, provider chosen by env, Bangla retrieval test still to run once a key is set). CI now has a `database` job (all DB/RLS/API tests on a local Supabase) and a `security` job (gitleaks, npm audit). Open: 10 eval set v0 (also tunes the duplicate threshold) and an index back-fill for existing issues.

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

---

## Phase 4 — Freeze and rehearse (21–25 Dec)

1. Feature freeze; only fixes, each with a regression test.
2. Demo seed and reset: `npm run seed:demo` and `npm run reset:demo` tested from a clean database; synthetic data clearly labelled; production data never touched.
3. Keep staging and demo environments separate; pin the model version and prompt versions for the demo; keep a pre-recorded AI response fallback if the network fails.
4. Verify keys, quotas and credits for the demo day; confirm Supabase region and Vercel limits.
5. Join the rehearsals: health check script before every run.

---

## After the Congress (Release 1.1, §4.3)

Consultations with consensus mapping, WhatsApp/SMS reporting webhooks, project check-ins, for/against idea points, support thresholds, PostgreSQL graph queries evaluated against Apache AGE.

## Endpoint checklist (target, §13)

Auth and profile; constituencies and representatives; issues and office actions; ideas; questions; projects and announcements; admin and moderation; AI endpoints; engagement (affected, follows, responsiveness, lookup); notifications; feed. Each endpoint needs: Zod validation, session-based identity, resource-level authorization, rate limit, structured errors, audit event where privileged, and a test.

## Definition of done (every task)

Input validated, authorization tested for allowed and denied roles, RLS test added for any new table, audit event for privileged actions, no private data in public views, AI output validated and logged with a manual fallback, migration is repeatable on a clean database, documented in the API list, CI green.
