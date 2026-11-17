# Sign-in and approval test log (task 0.3)

Fill in as you run each step on staging. Do not paste codes, tokens or keys.

| # | Step | Expected | Result (pass/fail, date) |
|---|---|---|---|
| 1 | Open `/login`, enter a citizen email | Email arrives with a sign-in link | pass 2026-11-16 (Resend log: link sent and clicked) |
| 2 | Click the link in the same browser | Lands on `/report`, signed in | pass 2026-11-16 (profile created; account on staging) |
| 3 | Submit a report (`/report`) | Reference ID `JK-2026-…` returned | pass 2026-11-16 (1 report saved for the test account) |
| 4 | Signed out: `POST /api/cases` | 401 | pass 2026-11-16 (staging returns 401) |
| 5 | Citizen: `POST /api/cases/<ref>/approve` | 403 | pass 2026-11-16 (local, via demo citizen session: 403 forbidden; signed out: 401) |
| 6 | Promote one account with `supabase/seed/promote_staff.sql`; sign in as staff | Office queue visible | pass 2026-11-16 (promoted by SQL; role verified as staff) |
| 7 | Staff: approve (acknowledge) | 200; timeline shows the new status | pass 2026-11-16 (JK-2026-1001 became acknowledged; case_events has received + acknowledged, both with actor) |
| 8 | Anonymous: query `cases` table via REST | No rows; `public_cases` has no `reporter_id` (`npm run check:env`) | pass 2026-11-16 (check:env: no reporter_id, anon sees no cases) |
| 9 | Burst 11 draft requests in a minute | 429 with `Retry-After` | pass 2026-11-16 on staging (10 x 400, then 429, Retry-After 54). In-memory limiter: per instance |
