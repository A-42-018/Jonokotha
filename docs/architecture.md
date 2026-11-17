# Architecture record — Jonokotha (জনকথা)

Written for backend Phase 5 (B5.14; masterplan §10.1–§10.4). Source of truth for requirements: `docs/masterplan_JONOKOTHA.md`; for the endpoint list: `docs/api-v1.md`; for who can do what: `docs/permission-matrix.md`.

## Decision: keep one Next.js application (not the §10.2 monorepo)

**Decision (2026-11-17):** the product stays a single Next.js 16 application with Supabase, a *modular monolith* in one package. We do not split into `apps/web`, `apps/office`, `apps/admin` and `packages/*` now.

**Why.** (1) The masterplan itself asks for a modular monolith first (§10.1). (2) The citizen, office and admin surfaces share one session, one design system, one API and one deploy; three apps would triple the deploy, preview and CI surface for a team of two environments (frontend, backend) with no benefit before the pilot. (3) Every boundary a monorepo would give us already exists as a folder, and the database (RLS plus audited SQL functions) is the real authority, not the app layer, so extracting a service later does not move security. (4) A package split costs real time (workspace tooling, versioned internal packages, CI per package) that Phases 6–8 need for pilot work.

**What we keep from §10.2 anyway:** the folder layout below maps one-to-one to the proposed packages, `docs/` holds `architecture.md`, `workflows.md`, `security.md` and `runbooks/` (operational procedures, indexed in `docs/runbooks/README.md`), `supabase/migrations` and `tests/` are where the masterplan puts them.

**Migration plan if and when we split** (triggers: a second team owns the office or admin app; build time passes ~10 minutes; an app needs a different deploy cadence or runtime):
1. Move `src/lib/ai/**`, `src/lib/types.ts`, the Zod schemas and `src/lib/strings/**` into `packages/{ai,types,validation,i18n}` with no behaviour change (they already import nothing from `src/app`).
2. Introduce `packages/api-client` generated from `docs/api-v1.md` and the Zod schemas; the apps stop importing `src/lib/*` services directly.
3. Split `src/app/office/**` and `src/app/admin/**` into `apps/office` and `apps/admin` behind the same `/api/v1`, each with its own `proxy.ts`; the route handlers stay in `apps/web` (or become `apps/api`).
4. Run both layouts in CI for one release before removing the old paths. The database does not change in any step.

## Domain module map (§10.4)

| Domain module | Code (`src/lib/...`) | Routes (`src/app/api/v1/...`) | Tables / functions (migrations) |
|---|---|---|---|
| Identity and access | `auth.ts`, `guard.ts`, `supabase/*` | `invitations/*`, `admin/accounts`, `admin/platform-invitations`, `me/profile` | `profiles`, `office_members`, `office_permissions`, `office_can()`, `is_admin()`, invitations (0002, 0006, 0020, 0030, 0031) |
| Constituencies, representatives, hierarchy | `geo.ts`, `constituency*.ts`, `reps-projects.ts`, `hierarchy.ts` | `constituencies/*`, `representatives/*`, `admin-units`, `admin/constituencies/*` | `constituencies`, `representatives`, `representative_fields`, `admin_units`, `constituency_candidates()` (0004, 0015, 0017, 0033) |
| Issue reporting and case management | `issues-service.ts`, `office-actions.ts`, `store.ts`, `transitions.ts` | `issues/*`, `office/issues/*` | `issues`, `issue_events`, `transition_issue()`, SLA tables (0005–0011) |
| Referrals and agency liaison | `liaison.ts` | `liaison/*`, `office/referrals/*`, `admin/agency-integrations`, `issues/{ref}/referrals` | `issue_agency_referrals`, `agency_integrations`, `liaison_*()` (0005, 0030) |
| Media and evidence | `media.ts`, `video.ts`, `image.ts` | `issues/{ref}/media`, `issues/{ref}/video/*` | `issue_media`, buckets `issue-media`, `issue-video` (0015, 0032) |
| Ideas and voting | `ideas-questions.ts`, `engagement5.ts` | `ideas/*`, `office/ideas/*` | `ideas`, `idea_supports`, `idea_comments` (0016, 0032) |
| Questions and messages | `ideas-questions.ts`, `ask.ts` | `questions/*`, `me/questions` | `questions`, `question_messages` (0016) |
| Projects and commitments | `reps-projects.ts`, `engagement5.ts` | `projects/*`, `office/projects/*`, `office/announcements/*` | `projects`, `project_milestones`, `project_feedback`, `announcements`, `approval_requests` (0017, 0030, 0032) |
| Polls and surveys | `engagement5.ts` | `polls/*`, `office/polls/*` | `polls`, `poll_options`, `poll_votes` (0032) |
| Notifications | `notifications.ts`, `notify/*` | `me/notifications*`, `notifications/*` | `notifications`, `notification_deliveries`, `notify_user()` and the event triggers (0018, 0030–0035) |
| Moderation and abuse reports | `admin-service.ts` | `reports`, `admin/moderation/*` | `moderation_reports`, `moderate_item()` (0020, 0032) |
| Analytics and exports | `analytics.ts`, `engagement.ts` | `analytics/*`, `office/analytics*`, `office/mp/overview`, `office/kpis`, `admin/kpis`, `me/export` | `analytics_overview()`, `analytics_reports`, KPI functions, `product_events` (0019, 0021, 0023, 0034) |
| Audit and compliance | `api.ts` (`auditAdminRead`), `privacy.ts` | `admin/audit`, `me/deletion-request`, `me/consents` | `audit_logs`, `audit_write()`, retention and erasure (0010, 0021) |
| Administration and configuration | `admin-config.ts`, `capabilities.ts` | `admin/*`, `features`, `categories`, `country` | `feature_flags`, `integration_settings`, `security_events`, `country_adapters` (0031, 0036) |
| AI core | `ai/*`, `intake*.ts`, `anthropic.ts` | `ai/*`, `office/issues/{ref}/copilot` | `ai_runs`, `ai_suggestions`, `knowledge_*`, `graph_edges` (0004, 0012, 0013, 0019) |
| Runtime services | `jobs.ts`, `ops5.ts`, `monitor.ts`, `instrumentation.ts` | `internal/*`, `admin/jobs`, `admin/system-health`, `events` | `background_jobs`, `office_inbox_counts` (0034) |

Module rule: route handlers hold no business logic beyond `run()` options; services validate with Zod and call a database function or an RLS-protected table; **the database decides** (authorization, state transitions, audit). A service never trusts an identity, role or constituency from a request body.

## Data flow

```
Browser / installed PWA                         Scheduled worker (cron)
   │  HTTPS, cookie session                          │  Bearer CRON_SECRET
   ▼                                                 ▼
 src/proxy.ts  (session refresh, security headers)  /api/internal/jobs/run, /maintenance, /notifications/deliver
   ▼                                                 │ service role (server only)
 /api/v1/**  →  run(): auth, MFA gate, CSRF origin check, size and rate limits,
                idempotency, request id, structured log, data_status label,
                security-event record (blocked requests)
   ▼
 service module (Zod validation, redaction of personal data, feature flag check)
   ├──────────────► Postgres (user's JWT): RLS tables and SECURITY DEFINER functions
   │                  office_can() / is_admin() (+MFA) · audit_write() · notify_user() · triggers
   │                  └─ Realtime: own notifications, office_inbox_counts only
   ├──────────────► Storage (service role signs URLs; private buckets issue-media, issue-video)
   ├──────────────► AI provider (server only): runAgent() → forced tool call, Zod-validated,
   │                  logged in ai_runs, manual fallback on timeout, refusal or bad output
   └──────────────► Email / Web Push / (SMS adapter) via the job runner with retry and dead letters
Observability: JSON log line per request · Sentry (server, via instrumentation.ts) · security_events · admin system-health
```

## Environments and configuration

Secrets only in server environment variables; names are in `scripts/check-env.mjs` and `docs/backend-setup.md`. Phase 5 adds optional variables: `UNSUBSCRIBE_SECRET` (falls back to `CRON_SECRET`), `SECURITY_HASH_SALT`, `APP_ENV` (`production` disables demo tools), `COUNTRY_CODE`, `SMS_PROVIDER` / `SMS_API_KEY` (reserved; no provider is wired). Behavioural switches live in the database (`feature_flags`, `integration_settings`, `app_settings.environment`, `app_settings.country_code`) so they are audited and need no deploy.

## Capacity notes (not measured)

The pilot assumes tens of areas and thousands of public issues. Point-in-polygon runs in SQL with a bounding-box prefilter (PostGIS is not enabled; enable it and replace `geometry_contains()` past a few hundred polygons). The inbox-count trigger recomputes one area's counts per issue change (indexed; fine at pilot volume, revisit with a counter table at scale). The job runner is a single scheduled worker with `skip locked` claims, safe to run in parallel.
