# Data sovereignty and privacy (DRAFT)

## Data we handle
Citizen account (email/phone, display name), report text and area, optional
voice transcripts, case events. Personal contact data is kept separate from
public case content; the public issue page shows no personal data.

## Where data lives
- Postgres (Supabase) with Row Level Security. **Current project region: Oceania (Sydney, ap-southeast-2)**, free tier. Bangladesh has no nearby
  Supabase region; document the residency and latency trade-off before submission.
- Report text is sent to the model provider (Anthropic) for drafting and
  summaries. Inform users; send only the report text, never contact details.
- Browser speech-to-text may be processed by the browser vendor; typing is
  always available.

## What reaches the model provider
Before any call to the model, phone numbers, email addresses and ID-length
numbers (Bangla and English digits) are replaced with placeholders (`src/lib/pii.ts`,
unit-tested). The citizen is told what was removed. Names and street addresses
are not detected automatically, so the report form should tell citizens not to type them (frontend task).
Reports are also redacted before they are stored, because case pages are public.

## What is public
Public pages read only the views `public_cases` and `public_case_events`
(migration 0003). They omit `reporter_id`, staff ids and contact data. The raw
`cases` table is readable only by its owner and by staff (Row Level Security).

## Controls
- Secrets only in server environment variables.
- RLS on every table; staff status changes write an event row; full audit log in Phase 1.
- Rate limits on report drafting and submission; request size caps.
- Retention and deletion policy: proposal only, to be decided by the team and built in Phase 3 (export, correction, deletion jobs).

## Open items
- [ ] Pick the Supabase region and record the reasoning.
- [ ] Review the Anthropic data-handling terms and add a user-facing notice.
- [ ] Add consent text on first report.
