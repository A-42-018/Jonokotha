# Phase 6: what still needs people, accounts or real data

Everything below is outside what code, scripts, CI and documents can do. Nothing is claimed as done.

| # | Item | Needs | B6 | Where the tooling is |
|---|---|---|---|---|
| 1 | A real pilot office, verified representative, tester group, named support/escalation/incident owners | People | B6.1 | `pilot/pilot-plan.md`, `/admin/pilot*`, `support-escalation.md` |
| 2 | Budget lines from real quotes (M.5), invoice entry | Team + finance | B6.1 | `cost-model.md`, `/admin/pilot/budget|costs` |
| 3 | Licence reading for each real data source; permissions from government sites | A person per source | B6.2 | `pilot/data-sources.md`, `/admin/ingestion/*` |
| 4 | Two-person verification of the 999 and 333 helplines | Two admins | B6.2 | `/admin/helplines*`, `/helplines` |
| 5 | Frontend: attribution (ODbL) display, helplines block, service-notice banner, eval-consent switch, public KPI baseline page, retention page | Frontend | B6.2-B6.6 | `docs/api-v1.md` Phase 6 |
| 6 | Counsel review of data-protection, cyber-security, platform and transfer obligations; terms for offices | A Bangladeshi lawyer | B6.3 | `pilot/governance.md` checklist |
| 7 | Named data-protection owner, incident lead, security contact | People | B6.3 | `pilot/governance.md` |
| 8 | Retention periods confirmed (the "proposed" rows) | Counsel + owner | B6.3 | `retention_policies` |
| 9 | Hosted dev/staging/production Supabase and Vercel projects; GitHub Environments with required reviewers; secrets | Accounts | B6.4 | `runbooks/environments.md`, `migrate.yml`, `scripts/migrate-env.sh` |
| 10 | Independent penetration tester, written authorisation, fix and retest rounds | A tester | B6.7 | `pilot/pentest.md`, `/admin/pentest*` |
| 11 | Consented real examples (needs real users); native-Bangla labellers | Users, reviewers | B6.5 | `pilot/ai-real-use.md`, `/me/eval-examples` |
| 12 | Bangla speech test across districts, ages, noisy places | Volunteers, devices | B6.5 | `ai-real-use.md` §4, `/admin/ai/speech-tests` |
| 13 | Routing accuracy and thresholds from real use (then wire thresholds into duplicate and routing code) | Pilot data | B6.5 | `/admin/ai/routing-accuracy`, `eval-real/baseline.ts` |
| 14 | KPI baseline weeks, accessibility task test, copilot time study, publishing | Pilot + testers | B6.6 | `pilot/kpi-baselines.md` |
| 15 | Apply migrations 0060-0062 to the hosted projects through the reviewed flow | Release owner | B6.4 | `runbooks/deploy-and-rollback.md` |
| 16 | Turn on `enforce_mfa`, delete demo users, set `CSP_MODE=enforce` before real users | Release owner | §29 | `npm run check:release` |

Merge note for the person combining phases: Phase 6 owns migrations 0060-0079 and edited these shared files append-only or by one line: `tests/rls/coverage.test.ts` (adds `PHASE6_TABLES` and `PHASE6_VIEWS`, two one-line expectation changes), `docs/api-v1.md` (new section at the end), `docs/backend.md` (status block), `package.json` (two scripts), `.github/workflows/ci.yml` (one step), `scripts/check-release.mjs` (migration numbering rule now allows gaps; extra items), `src/app/api/internal/maintenance/route.ts` (ingestion + pilot maintenance calls), `tests/ai/eval.run.ts` (optional real examples). Migration 0061 replaces `run_retention()` and wraps `erase_user_data()`; if Phase 5 redefines either, take the Phase 6 version and re-apply their change on top.
