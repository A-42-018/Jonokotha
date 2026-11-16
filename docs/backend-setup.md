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
