# Security overview

Short, current summary for the team. Detailed checklist and findings: `docs/aibc/security-review.md`; privacy impact: `docs/aibc/pia.md`; incident and key procedures: `docs/aibc/runbooks/` and `docs/runbooks/README.md`. Masterplan §14, §18.

## Model
- **Identity** comes only from the session. Roles: citizen, staff (per-area office roles: case officer, office manager, MP, agency liaison), moderator, admin. MFA (TOTP, `aal2`) is required for MP, moderator and admin once `enforce_mfa` is on (built, still off until the sign-in screens enrol TOTP).
- **The database is the authority**: RLS on every table (`tests/rls/coverage.test.ts` fails if a table lacks RLS or a test), privileged changes only through `SECURITY DEFINER` functions that check `office_can()` / `is_admin()` and write `audit_write()`. Audit rows are append-only for everyone, including the service role.
- **Public data** leaves only through views with explicit column lists. No reporter, author, voter, proof, token or exact coordinate is in any view (`tests/rls/phase5.test.ts` checks the column names).
- **Server secrets** never reach a bundle (`npm run check:bundle`). The service-role key is used by scheduled jobs and storage signing only.

## Phase 5 additions
| Area | Control |
|---|---|
| MP approval and delegation | An area can require the MP's approval for announcements, public replies and project changes; the generic note path refuses public notes there so approval cannot be bypassed. MPs hold no write access to audit history or reports. |
| Agency liaison | Reads only through `liaison_cases()` (no reporter, no internal notes), writes only through five audited functions, scoped to their agency **and** the area. "Officially registered" is impossible without a confirmed `agency_integrations` row and proof (database constraint). |
| Admin APIs | Every function is admin-only (including the MFA check) and audited; reading accounts, security events and health is itself logged as an admin read. Integrations never return keys, only `key_present`. |
| Alerts | `security_events` records rate-limit hits, auth failures, permission denials and blocked cross-site requests; IPs are salted one-way hashes, capped at 300 rows a minute, purged after 90 days. |
| Demo data | Refused in production by `APP_ENV`/`VERCEL_ENV` and by `app_settings.environment`; fails closed if the setting is missing. |
| Uploads | Video: type decided by content, 20 MB, 180 s, one per issue, private bucket, signed upload and download URLs, malware hook fails closed, rejected files are deleted. Poster frames are re-encoded (metadata removed). |
| Jobs | One queue, `skip locked` claims, backoff, dead letters; job functions are callable only by the service role. The scheduled routes need `CRON_SECRET`. |
| Notifications | Generic text only; essential types cannot be unsubscribed; unsubscribe links are HMAC-signed and bound to user and type. SMS only for verification, with consent and a budget. |
| Analytics | Product events accept a name and language only (no id, IP, device, URL). |
| Location | A coordinate change that would move jurisdiction is held for review; the guard that makes reports immutable opens only inside the reviewed move. |

## Known limits (honest list)
- Per-IP rate limits are in memory per instance. A shared limiter is still open (see the security review).
- No independent penetration test has happened. Phase 6 owns the pen-test plan.
- MFA enforcement is off until TOTP enrolment exists in the UI.
- The malware scanner is a hook; none is configured, so uploads are re-encoded (photos) or type-checked (video) but not scanned.
- Video originals are not transcoded or inspected beyond container type and size; the poster frame is device-generated.
