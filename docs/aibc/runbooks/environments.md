# Environments: development, staging, production (B6.4)

Three separate environments. Nothing is shared between them except the code.

| | Development | Staging | Production |
|---|---|---|---|
| Supabase | Local (`npx supabase start`) or a personal dev project | Own hosted project, no real citizen data | Own hosted project; region decided with counsel (`../pilot/governance.md`) |
| Vercel | `next dev` | Own project; staging domain; deploys from the integration branch | Own project; production domain; deploys from `main` only |
| Keys | `.env.local` | Vercel env (staging scope) | Vercel env (production scope); different from staging for every secret |
| Demo login | Allowed | Allowed (never with real people) | **Forbidden** (`DEMO_LOGIN` must be unset) |
| CSP | Report-only | Report-only until a clean week | `enforce` |
| MFA | Off | On when testing office flows | On (`enforce_mfa = true`) |
| Data | Seed and test data | Seed data, synthetic reports | Real |
| Who can deploy | Anyone locally | Team | Named release owner after approval |

Source of truth: `config/environments.json`. Check any environment's settings:

```bash
node --env-file=.env.production.local scripts/check-environment.mjs production
```

It fails when a required variable is missing, `DEMO_LOGIN=true` or a non-enforcing `CSP_MODE` is set in production, a production URL points at a local database, or production reuses the staging project (set `SUPABASE_STAGING_URL` to compare). Run it from the machine or CI job that has the environment's variables, never by pasting secrets into chat.

## Least-privilege credentials

| Credential | Held by | Scope |
|---|---|---|
| Supabase service-role key | Vercel server env only | Never `NEXT_PUBLIC_*`; checked by `npm run check:bundle`; rotate per `key-rotation.md` |
| Supabase access token + DB password for migrations | The `staging` and `production` GitHub Environments only (secret scope), not repository-wide | Used only by the migration workflow; production has required reviewers |
| Vercel deploy | Git integration (no long-lived token in CI) | Production deploys only from `main` |
| `CRON_SECRET` | Vercel env and the scheduler | 16+ characters, different per environment |
| Read-only database role for support | To create when needed | Not built; prefer the audited admin API |

Open (needs accounts): create the two hosted Supabase projects and two Vercel projects, the GitHub Environments with reviewers, and fill the secrets. The repository cannot create them.
