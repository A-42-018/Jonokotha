# Backend setup checklist (Phase 0)

1. (Done 2026-11-16 on the project in `.env.local`.) Supabase SQL editor, in order: `supabase/migrations/0001_init.sql`, `0002_auth_staff.sql`, `0003_public_views_agencies.sql`, then `supabase/seed/seed.sql`. Migration 0003 must be applied before this branch is deployed: pages now read `public_cases`.
2. Sign-in uses an emailed magic link (`/auth/callback`), so no template change or custom SMTP is needed. Supabase → Authentication → URL Configuration: redirect URLs must include `http://localhost:3000/auth/callback` (added 2026-11-16) and `<staging URL>/auth/callback`. The link must be opened in the same browser that requested it. Custom SMTP via Resend is set (smtp.resend.com:465, sender `onboarding@resend.dev`, 2026-11-16). Without a verified domain, Resend only delivers to the Resend account owner's email, so verify a domain in Resend and change the sender before real users or judges sign in.
3. `.env.local` (local) and Vercel environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`. Add `SUPABASE_SERVICE_ROLE_KEY` locally only, for `npm run seed:demo`.
4. `npm run check:env` — every line should say OK.
5. Sign in once, then run `supabase/seed/promote_staff.sql` with your email.
6. `npm run seed:demo` for the video data.
7. Supabase → Authentication → URL configuration: set Site URL and redirect URLs to the staging URL.
8. Work through `docs/aibc/auth-test-log.md`.

## Staging (2026-11-16)
Vercel project `jonokotha` (team devalif), production branch `backend`: https://jonokotha.vercel.app. Supabase redirect URLs include its `/auth/callback`. Env vars set in Vercel: Supabase URL and anon key, Anthropic key and model. While the Anthropic key is invalid, `/api/intake` returns `source: "fallback"`.

## Dev-period demo login (temporary)
Email delivery is limited (see step 2), so `/login` has one-click **Citizen** and **Office staff** buttons. They sign in to two real accounts (`demo-citizen@` and `demo-staff@jonokotha.test`), so RLS and the staff gate still apply; admin is not available.
- Enabled only when the server env vars `DEMO_LOGIN=true` and `DEMO_PASSWORD` are both set (`.env.local`, Vercel env). Unset `DEMO_LOGIN` to turn it off; no deploy needed beyond a redeploy.
- Create the accounts with `supabase/seed/demo_users.sql` (replace `__DEMO_PASSWORD__`; never commit the real value).
- **Before real users or judging:** unset `DEMO_LOGIN`, and delete the two demo users (SQL in the seed file header). Anyone who can reach the site while it is on can become demo staff. Revisit in the Phase 3 security review.

## Local Supabase for database tests (Phase 1)
Docker must be running. `npx supabase start` (first run pulls images), `npx supabase db reset` applies every migration and `supabase/seed/seed.sql` to a clean local database, `npm run test:db` runs the database tests against it (they refuse any non-local URL). The local stack never touches the live project.
Live project: 0004 and 0005 were applied on 2026-11-16 (SQL editor, in order). To repeat elsewhere, run migrations 0004 and 0005 in the SQL editor, in order, before deploying the code that reads `issues`. 0005 keeps the old app working through a compatibility view `cases` and the unchanged `public_cases` / `public_case_events` contracts (they gain a `status_detail` column).
Migrations 0006 (roles and scopes) and 0007 (RLS) were applied on the live project on 2026-11-16, in that order. 0006 backfilled the two existing staff accounts (demo-staff and the promoted owner account) as office managers of the sample constituency. Staff without an office membership see no private cases. Run `npm run check:env` after any live migration.

Migration 0008 (state machine) was applied on the live project on 2026-11-16 after 0007. Verified: 70 transitions, guard trigger present, anonymous callers cannot execute transition_issue, the live issue and its events are unchanged.

## Tests (local)
`npm test` (unit, no database), `npm run test:db` (schema, roles, RLS, state machine, API routes; needs `npx supabase start` and a database reset with `npx supabase db reset`), `npm run test:rls`, `npm run test:api`. The database tests refuse any non-local URL. API tests sign in real local users and call the route handlers directly; they take the local URL and keys from `supabase status`, or from `SUPABASE_API_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY_LOCAL` in CI.
Migration 0009 (feedback, idempotency, shared rate limits, notes) must be applied on the live project before the v1 routes are deployed.


Migration 0009 (API support: issue_feedback, idempotency keys, shared rate limits, add_issue_note) was applied on the live project on 2026-11-16 after 0008. Verified: RLS on the three new tables, anonymous callers cannot execute the new functions or read the tables, existing data unchanged. The /api/v1 routes can now be deployed.

Migration 0010 (immutable audit trail) was applied on the live project on 2026-11-16 after 0009. Verified by catalog: append-only triggers on audit_logs and issue_events, 8 audit triggers, audit_write not executable by API roles, no write privileges on audit_logs except via the audit functions; existing data unchanged. Not exercised live on purpose (a probe row would be permanent); covered by tests/db/audit.test.ts locally.

Migrations 0011 (SLA targets, timers, pauses; Phase 1.7) and 0012 (AI plumbing; 1.9) are applied to the local stack only. Set `SUPABASE_SERVICE_ROLE_KEY` as a server-only env var (Vercel) so AI runs are stored in `ai_runs`. Apply to the live project in the SQL editor after 0010, before deploying code that reads `issue_sla`.

## Evaluation (Phase 1.10)
`npm run eval` measures the keyword fallback, PII redaction and the lexical duplicate baseline on `tests/ai/dataset.v0.json`, and prints the report to `tests/ai/out/latest.md`. Add `EVAL_AI=1` to also call the model (sends the synthetic cases to the provider; needs the key in the environment, e.g. `EVAL_AI=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.eval.config.mts`). Set `EMBEDDINGS_BASE_URL` and `EMBEDDINGS_API_KEY` to measure duplicate precision/recall per threshold. `EVAL_WRITE=1` rewrites `docs/aibc/eval-baseline.md`; do that only for a deliberate, dated baseline.

## Phase 2 (migrations 0014-0020)
Applied to the local stack only (`npx supabase db reset` replays all twenty from scratch and passes the full suite). **Live project: run 0014 to 0020 in the SQL editor, in order, before deploying this branch.** 0015 creates the private `issue-media` storage bucket (hosted Supabase: confirm it exists under Storage afterwards) and needs the `pg_trgm` extension (available by default).

Server-only settings, all optional; a feature without its setting says `unavailable` or falls back, it never breaks the golden path (`npm run check:env` lists them):
| Setting | Feature |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | photo storage and signed URLs, AI suggestions (copilot, routing, duplicates), AI run log, knowledge ingest, notification worker |
| `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_API_KEY`, `TRANSCRIBE_MODEL` | `/ai/transcribe` (any OpenAI-compatible `/audio/transcriptions`: Whisper family or a hosted bn-BD model) |
| `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_API_KEY` | semantic duplicate search and semantic routing retrieval (otherwise lexical) |
| `MALWARE_SCAN_URL`, `MALWARE_SCAN_TOKEN` | scan hook for uploads (POST bytes, answer `{"clean": true}`); if set it fails closed |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push (`node scripts/gen-vapid.mjs` prints a key pair) |
| `EMAIL_PROVIDER` (`resend` or `postmark`), `EMAIL_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` | transactional email (notifications, invitations) |
| `CRON_SECRET` (16+ characters) | the scheduled delivery worker `POST` or `GET /api/internal/notifications/deliver` with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this header for you when `CRON_SECRET` is set; schedule it every minute or every few minutes) |

Local tests: the storage container must be running (`npx supabase start` without excluding storage; CI already does this). Test suites set the local keys themselves; nothing contacts a real provider (providers are faked in the tests).

Frontend contract notes: push is sent without a payload, so the service worker must fetch `GET /api/v1/me/notifications?unread=true` when a push wakes it; `x-unread-count` carries the badge number. Public issue items gained `affected_count` and `location`.
