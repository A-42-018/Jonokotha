# Legal, governance and retention (B6.3)

**Status: engineering has built what code can do. Counsel has not reviewed anything. No sentence here is legal advice or a statement of what Bangladeshi law requires.** The team must confirm with a Bangladeshi lawyer which laws apply (data-protection law and its current status, cyber-security law, platform and telecom rules, election and parliament-related rules) and record the answer in `counsel-review.md`.

## Counsel review (open: needs a lawyer)

Questions to put (also the checklist to tick off):
- [ ] Which data-protection obligations apply to a platform that processes citizens' reports about public matters; lawful basis; what notice and consent text is needed (`../privacy-notice.md`, `../terms.md`, `../pia.md` are drafts for this review).
- [ ] Cyber-security and online-content obligations: takedown and challenge process (`../runbooks/content-takedown.md`), what we must retain and for how long, lawful requests from authorities and how to answer them (the legal-hold tool exists; the policy does not).
- [ ] Transfer of personal data outside Bangladesh: our database region (Sydney, free tier), AI provider (reports are sent redacted), email provider. Is this allowed, with what safeguards, or must data live in-country.
- [ ] Whether the platform must register or report anywhere, and rules on political content around elections.
- [ ] Retention periods for each class in the register below, and the 730-day proposal for audit logs.
- [ ] Anonymous-to-public reporting and its abuse limits (below).
- [ ] Terms for MP offices (what they are responsible for when they use the tool).
Record: date, lawyer, scope, advice summary, what changed. Until then every document stays "draft, not reviewed by counsel" and the public retention view shows `counsel_reviewed: false`.

## Named owners (open: needs people)

| Role | Name | Since |
|---|---|---|
| Data-protection owner (privacy requests, retention, legal holds, notice) | [name] | [date] |
| Incident lead and backup | [names] | [date] |
| Security contact (receives reports, pen-test liaison) | [name] | [date] |

Put the names in `../privacy-notice.md` and the incident runbook. The code has no concept of "the owner"; admin accounts do the actions and each action is audited.

## Retention per data class, with legal hold

`retention_policies` (admin) and `GET /api/v1/retention-policies` (public, safe columns) state, per class: what it is, how long, the action (delete, anonymise, keep), whether a legal hold applies, and whether code **enforces** it today or it is only **proposed**. Enforced now (migration 0021 sweep): idempotency keys and rate-limit counters (1 day), notification deliveries (90 days), notifications and AI runs (their own expiry), accounts after a deletion request (14-day grace, then erasure; civic record and audit trail kept without identity). Proposed (needs counsel): the civic record after the reporter leaves, audit logs (730 days), staged ingestion records (365 days), uploaded photos for open reports.

**Legal hold** (`POST /admin/legal-holds`, release with `.../{id}/release`): admin only; needs a reason (10+ characters) and an authority reference (court, regulator, counsel); one open hold per subject. A hold on a person, or on any report they filed, **blocks erasure** (`erase_user_data` returns `held: true`; the sweep counts `accounts_held` and leaves the deletion request open; an audit row `privacy.erasure_blocked_by_hold` is written). Releasing the hold lets the next sweep erase. The person is not told by the system that a hold exists; the data-protection owner and counsel decide what to say. Every hold, release and blocked erasure is in the audit log.
Limit: the sweep's own deletions of operational data (idempotency, notifications, AI logs) are not held; a hold protects the account, its reports and the audit trail, which is what a preservation request normally targets. Confirm with counsel.

## Anonymous-to-public reporting and abuse controls

"Anonymous to the public" means: the public sees the report without the reporter's name, contact or exact location; the office sees who reported (needed to ask for more information); an account is required, so the platform can limit abuse. Controls that exist: email-verified accounts, per-user and per-IP rate limits, redaction of phones, emails and ID numbers before storing, moderation queue with reports on any public item, hide with reason and appeal path, suspension (`/admin/accounts/{id}`), emergency-language flag (`../runbooks/imminent-harm.md`), duplicate detection. Not built, by design: truly account-free anonymous posting. Open: counsel's view on whether the office-visible reporter identity needs stronger safeguards (for example for reports about the office itself).

## Residency map (confirmed by people, not by this file)

| Data | Where today | Notes |
|---|---|---|
| Database, auth, storage | Supabase, Sydney (ap-southeast-2) | Production region to be decided with counsel; document in `../data-sovereignty.md` |
| App hosting | Vercel | Edge and function regions to be pinned |
| AI inference | Anthropic API via the configured gateway | Redacted report text only; no contact data |
| Email | Resend or Postmark | Address and message content |
| Backups | Encrypted dumps (`scripts/backup-local.sh`, `backup.yml`) | Where the copy lives is the owner's choice; keep it in an agreed place |

The pilot cannot be called "data stays in Bangladesh". Say what is true.
