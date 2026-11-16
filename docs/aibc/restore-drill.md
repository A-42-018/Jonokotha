# Backups and restore drill

Backend plan 3.3. Status: **a partial production drill was done on 2026-11-16 (public schema only); the full drill is still open.**

## What exists

| Piece | State |
|---|---|
| Supabase built-in backups | **Not available on the Free plan** (the dashboard showed "Last backup: no backups" on 2026-11-16). Daily backups need a paid plan; point-in-time recovery needs a paid add-on. Decide before pilot. |
| Interim backup | `.github/workflows/backup.yml`: nightly `pg_dump` (public and auth schemas), encrypted with `BACKUP_PASSPHRASE`, kept 14 days as a workflow artifact. Needs repository secrets `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE`. **Not running until the secrets are set.** Not stored: Storage objects (photos), Auth settings, edge config. |
| Restore drill | `npm run drill:restore` (`scripts/restore-drill.sh`). Reads the source, restores into a throwaway database in the local Supabase container, compares row counts of nine tables, prints recovery time and the age of the newest audit row. Never writes to the source. |

## How to run the drill (production, read-only on the source)

1. `npx supabase start` (Docker running).
2. Download the newest `db-backup` artifact, decrypt (`gpg --decrypt`), or take the connection string from Dashboard > Connect.
3. `SRC_DB_URL='<connection string>' npm run drill:restore`
4. Copy the output into the log below. Write `Drill result: PASSED` only if the row counts match and an operator also opened the scratch database and checked an issue, its events and the audit trail.

## Objectives (proposed; the team must accept or change them)

- Recovery point objective (RPO): 24 hours with the nightly interim backup; minutes with point-in-time recovery on a paid plan.
- Recovery time objective (RTO): 4 hours to a working read-only site, 8 hours to full service. **Not yet measured on production-sized data.**

## Photos

Photos in the private `issue-media` bucket are not covered by the database dump. Until Storage backup is set up, losing the bucket loses the photos (issue text and metadata survive). Options: Supabase paid backups do not include Storage objects either; a periodic `supabase storage cp` to a second private location is the usual answer.

## Drill log

| Date | Source | Recovery time | Row counts | Result |
|---|---|---|---|---|
| 2026-11-16 | local stack (dev dry run of the script) | 1 s | match (audit_logs 78, others 0) | script works; **not a production drill** |
| 2026-11-16 | **production**, read-only `supabase db dump --remote` (schema, then data), restored into a scratch database in the local container | 1 s (tiny data: 3 profiles, 1 issue) | 11 tables compared, all match; 283 functions and 57 policies restored | **public schema restores.** Not covered: the `auth` schema (scratch used a stub `auth.users`, so sign-in accounts were not restored or checked), Storage objects, extensions on a real new project. Dump files were deleted afterwards (they held emails) |

Drill result: PARTIAL (public schema restored and counted; auth, Storage and a restore into a real Supabase project not yet done)
