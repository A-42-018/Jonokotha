# Security review (Phase 3, backend plan 3.1 and M.7)

Date: 2026-11-16. Scope: the backend in this repository on branch `backend` (migrations 0001–0023). Method: code reading, automated suites, local database probes. **This is a self-review. It is not an independent penetration test and no ASVS L2 sign-off is claimed.** An outside review is still recommended before real users.

## Checklist

| # | Item (plan 3.1) | Result | Evidence |
|---|---|---|---|
| 1 | Full RLS matrix re-run | PASS | `npm run test:rls` and the coverage guard (every public table listed and tested, including `deletion_requests`); `npm run test:db` 244 tests on a clean `supabase db reset` |
| 2 | CSP and secure headers | PASS, CSP report-only | `src/lib/security-headers.ts`, sent by `src/proxy.ts`: CSP, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, COOP, HSTS in production. Set `CSP_MODE=enforce` after a week with no violations in the browser console. No nonce yet (a nonce forces dynamic rendering of every page) |
| 3 | CSRF | PASS (two layers) | Session cookie is SameSite=Lax (Supabase SSR default); additionally `run()` refuses a state-changing request whose `Origin` names another host (`cross_site`). Tests: `tests/api/phase3.test.ts` |
| 4 | Rate limits on login, OTP and AI routes | PARTIAL | Every `/api/v1` route has a per-user (database, shared) and per-IP limit; AI routes 10 per minute per user. Sign-in and OTP are Supabase Auth, limited by Supabase's own settings (Dashboard > Auth > Rate limits; not changed here). **Per-IP limits are in memory per server instance: best effort on serverless.** A shared IP limiter (Redis or a platform firewall rule) is still open |
| 5 | Request-size limits | PASS | JSON bodies capped at 16 KB by default (`maxBytes`, 8 KB on intake); uploads capped by declared size, type by content, count, and re-encoded (EXIF stripped) |
| 6 | Dependency and secret scanning | PASS | `npm audit --omit=dev`: 0 vulnerabilities (2026-11-16); gitleaks in CI; `npm run check:bundle` clean on a fresh build (61 files, 4 server-only values compared) |
| 7 | Signed URLs for private media | PASS | `issue-media` bucket is private; `createSignedUrls(..., 300)` (5 minutes) in `src/lib/media.ts`; bucket MIME and size limits in migration 0015 |
| 8 | No secrets in client bundles | PASS | `check:bundle` above |
| 9 | MFA for MP, moderator, admin (M.6) | BUILT, OFF | `mfa_ok()` is in every elevated policy and function (migration 0006); `run()` returns 403 `mfa_required` on `/api/v1/admin` and `/api/v1/office` for an aal1 session once `enforce_mfa` is true (tested). **The flag is still false because the sign-in screens cannot enrol or challenge TOTP (frontend work). Turn it on before any real MP, moderator or admin account exists** |
| 10 | Upload safety (M.7) | PARTIAL | Malware hook exists and fails closed when configured (`MALWARE_SCAN_URL`); not configured, so no scan runs today. A quarantine bucket is not built |
| 11 | Internal job endpoints | PASS | `/api/internal/*` need `CRON_SECRET` (16+ characters, constant-time compare); 401 otherwise (tested) |
| 12 | Audit trail | PASS | Append-only triggers; privacy actions (`privacy.*`) and administrator reads are written; no update or delete grant |

## Findings that remain open (ranked)

1. **Demo login** (`DEMO_LOGIN`): anyone who can reach the site while it is on can sign in as demo staff. Must be off, and the two demo users deleted, before real users. `npm run check:release` fails while it is on.
2. **MFA enforcement is off** (item 9).
3. **CSP is report-only** (item 2).
4. **In-memory IP rate limit** (item 4); sign-in/OTP limits not reviewed in the Supabase dashboard.
5. **No malware scanner configured** (item 10).
6. **Admin reads of private data are logged; staff reads in their own scope are not** (by design, `docs/audit.md`); revisit if the privacy impact assessment requires it.
7. **Live database migration state**: see `docs/backend-setup.md` for what is applied to the hosted project.

## Not done

Independent penetration test; ASVS L2 line-by-line; dynamic scanning (ZAP) of a staging deploy; load or denial-of-service testing; review of Supabase project settings beyond what the CLI showed.
