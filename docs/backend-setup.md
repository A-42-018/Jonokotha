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
