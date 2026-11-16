# Jobs stuck, failing or dead

**Symptoms:** `GET /api/v1/admin/system-health` shows `jobs` or `queues` not ok; notifications are late; polls did not close.
1. `GET /api/v1/admin/jobs?status=dead` (and `failed`): read `kind`, `attempts`, `last_error` (no personal data is stored there).
2. Is the scheduler calling `POST /api/internal/jobs/run` with `Authorization: Bearer $CRON_SECRET`? A 401 means the secret differs from the server's. On Vercel Hobby crons run at most daily: also call it from the free scheduler (see `docs/backend-setup.md`) or rely on the opportunistic delivery kick after writes.
3. Fix the cause (provider key, outage, bad payload). Then `POST /api/v1/admin/jobs/{id}/requeue`: attempts reset, runs on the next call. Handlers are idempotent, so a requeue is safe.
4. A job `running` for over 10 minutes is taken again automatically (crashed worker).
5. Dead jobs older than the incident can be left; they hold no personal data. Record what happened in the incident log if users were affected.
