# Pilot cost tracking against the M.5 model (B6.1)

`docs/aibc/business.md` (M.5) holds the per-constituency cost model. It is not in this branch; the lines below are the structure the tooling uses so that M.5 and the measured pilot cost use the same names. **No price here is a quote or a claim.** Budget amounts are entered by the team from real quotes, with a basis.

## Lines

`hosting_app` (Vercel), `hosting_database` (Supabase), `ai_inference`, `speech`, `email_sms`, `support` (staff time), `moderation` (staff time), `security_testing`, `other`.

## How it works

1. `PUT /api/v1/admin/pilot/budget` `{line, monthly_budget_usd, basis}`: one row per line, from M.5.
2. `POST /api/v1/admin/pilot/costs` `{month, line, amount_usd, note?, source_ref?}`: invoices and time sheets, by hand, with the invoice reference.
3. AI inference is not typed by hand: `ai_runs.cost_usd` is summed for the month automatically.
4. `GET /api/v1/admin/pilot?month=YYYY-MM-01` returns per line: budget, actual, variance, over-budget flag, total, **actual per active pilot site**, and any cost entered for a line with no budget.

## Questions to answer at the end of the pilot

Actual versus M.5 per line; cost per constituency per month; cost per handled case (cases from `office_kpis.received`); which line surprised us; what would change at ten constituencies. Publish the figures only with the method and the limits (one constituency is not a cost curve).

Open: the real quotes and staff-time estimates that fill the budget lines; whether the AI provider bills in USD.
