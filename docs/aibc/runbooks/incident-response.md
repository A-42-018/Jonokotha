# Runbook: incident response

Draft for the team to adopt. Names and phone numbers are blank on purpose: fill them in before the pilot (an unanswered runbook is worse than none).

**Roles.** Incident lead: ______ . Backup lead: ______ . Communications: ______ . Written by whoever is on call, in the incident log (a dated file in `docs/incidents/` or the team's tracker).

## Severity

| Level | Meaning | First response |
|---|---|---|
| S1 | Private data exposed, wrong person can read or change private cases, site down for everyone, a threat to someone's safety reached the system | Immediately; wake the lead |
| S2 | A feature is broken for many people (sign-in, reporting, notifications), AI errors above 30%, backups failing | Within 2 hours |
| S3 | One feature degraded, one person affected | Next working day |

## First 30 minutes

1. Open the incident log with the time, who noticed, what they saw. Do not delete evidence.
2. Check `/api/health`, Vercel deployment status, Supabase status page, Sentry (when configured), and `GET /api/internal/maintenance` output (health block) with the cron secret.
3. Stop the bleeding before finding the cause:
   - Bad deploy: Vercel > Deployments > promote the last good one (rollback).
   - Data exposure: switch the affected feature off (see "Switching things off"), then rotate keys (`key-rotation.md`).
   - Abuse or spam wave: lower the per-route limits in the route's `limit` option and redeploy, or block at the platform firewall.
   - A single bad item: take it down (`content-takedown.md`).
4. If personal data may have been exposed: this is a reportable event under the privacy notice. Record what, whose, when. Tell affected people in plain Bangla and English without delay; the team decides on notifying authorities with counsel.
5. Tell users what happens next if the site is degraded for more than an hour (status line on the home page: ask the frontend owner).

## Switching things off

| Thing | How |
|---|---|
| All AI features | Unset `ANTHROPIC_API_KEY` in Vercel and redeploy. Intake falls back to the keyword draft and says so. |
| Email or push | Unset `EMAIL_API_KEY` / `VAPID_PRIVATE_KEY`. In-app notifications continue. |
| Photo upload | Set `MALWARE_SCAN_URL` to an unreachable URL: uploads fail closed. |
| Demo login | Unset `DEMO_LOGIN`. |
| Office or admin elevated access | `update app_settings set value='true' where key='enforce_mfa'` (needs TOTP sessions) or suspend the account: `POST /api/v1/admin/accounts/{id}`. |

## After

Within 3 working days: a short blameless write-up (timeline, cause, what limited the damage, what would have caught it sooner), one regression test or alert per lesson, and a runbook edit if this one failed you.
