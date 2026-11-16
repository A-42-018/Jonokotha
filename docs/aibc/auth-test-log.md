# Sign-in and approval test log (task 0.3)

Fill in as you run each step on staging. Do not paste codes, tokens or keys.

| # | Step | Expected | Result (pass/fail, date) |
|---|---|---|---|
| 1 | Open `/login`, enter a citizen email | Email arrives with a sign-in link | pending |
| 2 | Click the link in the same browser | Lands on `/report`, signed in | pending |
| 3 | Submit a report (`/report`) | Reference ID `JK-2026-…` returned | pending |
| 4 | Signed out: `POST /api/cases` | 401 | pending |
| 5 | Citizen: `POST /api/cases/<ref>/approve` | 403 | pending |
| 6 | Promote one account with `supabase/seed/promote_staff.sql`; sign in as staff | Office queue visible | pending |
| 7 | Staff: approve (acknowledge) | 200; timeline shows the new status | pending |
| 8 | Anonymous: query `cases` table via REST | No rows; `public_cases` has no `reporter_id` (`npm run check:env`) | pending |
| 9 | Burst 11 draft requests in a minute | 429 with `Retry-After` | pending |
