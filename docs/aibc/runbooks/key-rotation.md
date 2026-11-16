# Runbook: key rotation

Rotate on a schedule (every 6 months), after anyone with access leaves, and **immediately** if a key may have been exposed (committed, pasted in chat, in a screenshot, in a log).

| Secret | Where it lives | Rotate by | After rotating |
|---|---|---|---|
| Supabase service-role key | Vercel env `SUPABASE_SERVICE_ROLE_KEY`; local `.env.local` | Dashboard > Settings > API > roll the secret key | Update Vercel, redeploy, run `npm run check:env`; old key stops working at once |
| Supabase anon (publishable) key | Public by design; in the browser bundle | Roll only if abused | Update Vercel (two vars), redeploy |
| Database password | Dashboard > Settings > Database | Reset password | Update `SUPABASE_DB_URL` GitHub secret (backups) |
| Anthropic key | Vercel `ANTHROPIC_API_KEY` | console.anthropic.com > API keys: create new, then delete old | Redeploy; `npm run check:env` probes it |
| CRON_SECRET | Vercel env and the scheduler | Generate 32+ random characters | Update both; the job returns 401 until they match |
| VAPID key pair | Vercel `VAPID_*` | `node scripts/gen-vapid.mjs` | **Every device must resubscribe** (old subscriptions stop working); plan it |
| Email API key | Vercel `EMAIL_API_KEY` | Provider dashboard | Redeploy |
| Embeddings / transcription keys | Vercel `EMBEDDINGS_*`, `TRANSCRIBE_*` | Provider dashboard | Redeploy |
| Sentry DSN / alert webhook | Vercel | Project settings / webhook owner | Redeploy |
| Backup passphrase | GitHub secret and password manager | New passphrase | Old backups need the old one: keep it until they expire |

## Exposure checklist

1. Rotate first, investigate second.
2. Search for the value: `git log -S'<first 8 chars>' --all`, CI logs, chat. If it was committed, rotating is mandatory; rewriting history is optional and does not make the old value safe.
3. Check provider logs for use you did not make (Supabase logs, Anthropic usage page).
4. Run `npm run check:bundle` on a fresh build to prove no secret value is in browser files.
5. Record it in the incident log.
