# Runbook: restoring service

1. Identify what is down (`/api/health` answers 503 when the database is unreachable).
2. **App down, database fine:** roll back the deployment in Vercel; check env vars exist (`npm run check:env` locally against the same values).
3. **Database unreachable:** check the Supabase status page and project health; wait before restoring (a restore overwrites newer data). If the project is gone or corrupted:
   1. Create a new Supabase project (same region).
   2. Apply migrations in order: `npx supabase link --project-ref <new>`, `npx supabase db push --remote`.
   3. Restore data from the newest decrypted backup (`pg_restore --data-only --schema=public --schema=auth`), following `docs/aibc/restore-drill.md` (practise this first).
   4. Re-create the private `issue-media` bucket (migration 0015 does it) and re-upload photos if a copy exists.
   5. Update Vercel env vars (URL, anon key, service key), Supabase Auth redirect URLs and SMTP, redeploy.
   6. Run `npm run check:env`, then the smoke test in `docs/backend-setup.md`.
4. Record RTO/RPO actually achieved in the incident log and in the drill table.
