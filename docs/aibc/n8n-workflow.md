# n8n workflow: alert on urgent cases

Files: `workflows/n8n/urgent-cases.json` (import into n8n), `src/app/api/internal/urgent-cases/route.ts`, `src/lib/urgent-cases.ts`. Tests: `tests/unit/urgent-cases.test.ts`, `tests/unit/urgent-route.test.ts`.

## What it does
A schedule trigger (every 15 minutes) calls `GET /api/internal/urgent-cases?hours=1` with `Authorization: Bearer $CRON_SECRET`. The route is read-only and returns open cases whose priority is `urgent`, with only `ref`, `title`, `category`, `area`, `status` and `created_at` (titles are redacted before storage; no reporter data). Sample cases are left out unless `demo=1`. A Code node keeps the refs it has already alerted on (workflow static data, 7 days) so one case alerts once. A final HTTP node posts `{ "text": ... }` to `ALERT_WEBHOOK_URL`, the same alert hook the app's own health check uses (Slack, Telegram bridge, anything that accepts that body). Nothing in the workflow changes a case. A "Run now (test)" manual trigger is included for the n8n editor.

## Set up
1. Start n8n with these environment variables: `JONOKOTHA_URL` (for example `https://jonokotha.vercel.app`), `CRON_SECRET` (the same value the app has), `ALERT_WEBHOOK_URL`, and `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (the nodes read these with `$env`).
2. Import `workflows/n8n/urgent-cases.json`, then activate it. Static data (the "already alerted" list) is only kept for active workflows.
3. Urgent priority comes from the issue's `priority` column. Intake v2 reports urgency to the citizen; whether the office sets `priority = urgent` is a staff step today, so the workflow alerts on cases staff have marked urgent.

## What was tested (2026-11-20)
- n8n (npx, current release) was started on a laptop, the workflow imported with `n8n import:workflow` and run with `n8n execute`. The app endpoint and the alert hook were **mock servers on localhost** that returned the real response shape: n8n read two urgent cases, formatted the message and posted it to the hook (one alert listing both cases). With a wrong `CRON_SECRET` the endpoint returned 401, the workflow stopped with that error and no alert was sent.
- The `n8n execute` command needs an "Execute Workflow Trigger" node, so that run used a copy of the file with that one extra trigger node. The nodes after the trigger are identical to the shipped file.
- **Not tested:** the real endpoint against a real database (no local Supabase in that session), the schedule firing on its own, the once-per-case memory across scheduled runs, and delivery to a real chat service.
