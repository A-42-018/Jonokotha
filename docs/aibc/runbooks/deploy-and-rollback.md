# Deploy, rollback and forward-fix (B6.4)

## Principles

1. **Migrations only through the reviewed flow.** Nobody pastes SQL into the production SQL editor except in an incident, and then writes a migration file for it the same day.
2. **App rollback is instant; database rollback does not exist.** The database is fixed by a new migration (forward-fix). So every migration must be safe to run while the previous app version is still serving (expand, then contract).
3. One change at a time to production; announce with a service notice if users could notice.

## Flow

| Step | Where | Gate |
|---|---|---|
| 1. Change on a branch with migration `NNNN_name.sql` in your phase's number range | PR | `npm run lint:migrations` (numbers unique and increasing, `create table if not exists` + RLS in the same file, no destructive statement without `-- destructive-approved: <reason>`, no anon writes); CI: lint, typecheck, `npm test`, `npm run test:db` (applies all migrations to a fresh local database), eval gate |
| 2. Review | PR | Second person reads the SQL; RLS test and `docs/api-v1.md` entry present (definition of done) |
| 3. Staging | `scripts/migrate-env.sh staging` or the `Migrate` workflow with environment `staging` | Dry-run shows only the expected migration; then apply; smoke test on staging |
| 4. Production | `Migrate` workflow, environment `production`, **required reviewer approves** | Dry-run output attached to the approval; backup is less than 24 h old (`backup.yml`/`backup-local.sh`); a service notice posted if downtime is possible |
| 5. App deploy | Vercel promotes after the migration is applied | Health: `/api/health`; `npm run check:release` on the deploy; watch alerts for 30 minutes |

Local equivalent of steps 3 and 4 (works without GitHub Actions, which may be unavailable on the free budget): `scripts/migrate-env.sh <staging|production>` lints, prints the dry-run, asks you to type the environment name, then applies. It needs `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and the project ref for that environment in the shell. It refuses to run against anything but the project ref you pass for that environment.

## Expand and contract (so rollback of the app is always safe)

- Adding a column, table, function or view: one migration, ship, then ship the app that uses it.
- Renaming or removing: add the new thing, deploy the app that uses both, backfill, deploy the app that uses only the new one, and only then remove the old one in a later migration with `-- destructive-approved:` and a note of the backup taken.
- Never edit a migration that has been applied anywhere. Fix with a new one.

## Rollback of the app

Vercel > Deployments > promote the last good deployment (about a minute). Safe because of expand-and-contract. Record the time and cause in the incident log.

## Forward-fix of the database

1. Stop the bleeding in the app (feature switch from `incident-response.md`, or roll the app back).
2. Write the corrective migration (new number), test it on a fresh local database **and** on a copy restored from the latest backup (`restore-service.md`, `scripts/restore-drill.sh`).
3. Review and run it through the same flow, with the incident lead as reviewer.
4. If data was damaged: restore the affected tables into a scratch project, compare, and write a one-off repair migration; never restore over production without the data-protection owner and the incident lead agreeing in writing.
5. Add a regression test; update the runbook if it failed you.

## Service notices

`POST /api/v1/admin/service-notices {severity: info|maintenance|degraded|outage, title_bn, title_en, body_*?, starts_at?, ends_at?}`; `POST .../{id}/resolve`. Public `GET /api/v1/service-notices` returns active, current notices (cached 30 s) for the frontend banner. Use it for planned work and incidents. An independent status page and the uptime check (`.github/workflows/uptime.yml`, paused) remain separate; if the whole app is down the banner is down too, so also use the team's own channel for that case.

## Open (needs people and accounts)

The hosted projects, GitHub Environments with reviewers and secrets, and the release owner's name.
