# Privacy impact assessment (draft)

Date: 2026-11-16. Status: **draft by the engineering team for counsel review. Counsel review: not yet done.** Written for the Bangladesh context; the team must confirm which laws apply (the Personal Data Protection Ordinance status and any sector rules) with counsel and not rely on this document for that.

## 1. What the service does

Citizens report local problems, propose ideas and ask questions; verified offices handle them; some content is public. AI drafts reports and office replies; humans approve everything public.

## 2. Personal data (what, why, who sees it, how long)

| Data | Purpose | Visible to | Kept |
|---|---|---|---|
| Email, display name, language | Sign-in, notifications | The person; office staff see display name for cases in their scope | Until erasure |
| Report text, category, area, time | Handling the issue | Public (title, description, approximate area) after publication; office in scope | Issue: kept as a public civic record; `retention_until` set per row |
| Exact coordinates | Routing to the right constituency | Owner and office in scope; public sees an approximate point only | Cleared on erasure |
| Photos | Evidence | Owner and office; public only after approval; EXIF stripped on upload | Deleted on erasure |
| Private questions and messages | Asking an MP office | Asker and the office | Text removed on erasure |
| Follows, preferences, consents, notification history, push subscriptions | Personalisation and delivery | The person | Deleted on erasure; notifications by `retention_until` |
| AI run logs | Quality, cost, audit | Administrators | 180 days (`ai_runs.retention_until`); inputs are stored as hashes after redaction, not raw text |
| Audit log | Accountability | Administrators | Kept; append-only; holds ids and actions, not content |

Special categories: reports may reveal health, religion, politics or victimhood in free text. The system does not infer such traits and does not rank people. **Free text cannot be fully screened**; redaction covers phones, emails and ID numbers only.

## 3. Rights and how they are met

| Right | Mechanism |
|---|---|
| Access / portability | `GET /api/v1/me/export` (JSON download, audited) |
| Correction | `PATCH /api/v1/me/profile`; issue text is immutable by design (staff add notes; the person can resubmit) |
| Deletion | `POST /api/v1/me/deletion-request`, cancellable for 14 days, then `erase_user_data` runs in the daily job; keeps the public record and audit rows, removes what identifies the person. Photos are deleted from Storage |
| Consent and withdrawal | `GET/POST /api/v1/me/consents`, versioned, timestamped |
| Objection to AI | Every AI output is a draft the human can ignore; typed input always works |

## 4. Risks and controls

| Risk | Control | Residual |
|---|---|---|
| Reporter identified from a public issue | Approximate public point; reporter id never in public views (tested); PII redaction | Free text can still identify (names, addresses) |
| Staff over-reach | Scoped RLS, audit of admin reads, MFA (built, off) | Staff reads in scope are not logged |
| Sending citizen text to a model provider | Redaction before the call; synthetic data only in evaluation; provider and region listed in `data-sovereignty.md` | Provider processes redacted text abroad; counsel must decide acceptability |
| Data loss | Backups (interim, not running until secrets are set) | No production restore drill yet |
| Harassment through public ideas and questions | Moderation queue, reasons stored, hide/restore | Staffing of moderation is a team decision |
| Child data | No age gate is built; the service assumes adults | Decide policy; a report may concern a child |
| Imminent harm | Fixed guidance and flagging (`runbooks/imminent-harm.md`) | Not an emergency service; wording unreviewed |

## 5. Open decisions for the team and counsel

1. Legal basis and applicable law; whether a data protection officer or registration is needed.
2. Retention periods per table (the periods above are proposals except where set in migrations).
3. Model provider region and contract terms.
4. Age policy; handling of reports about minors.
5. Whether staff reads in scope need logging.
6. Counsel sign-off on `privacy-notice.md` and `terms.md`.
