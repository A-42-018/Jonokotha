# Backups and restore drill

Backend plan 3.3. Status: **script built and verified on a local database; no production restore drill has been done yet.**

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

Drill result: PENDING (no production drill yet)
