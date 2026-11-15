# Data sovereignty and privacy (DRAFT)

## Data we handle
Citizen account (email/phone, display name), report text and area, optional
voice transcripts, case events. Personal contact data is kept separate from
public case content; the public issue page shows no personal data.

## Where data lives
- Postgres (Supabase) with Row Level Security. **Region decision pending:**
  choose a region and document the residency and cost trade-off.
- Report text is sent to the model provider (Anthropic) for drafting and
  summaries. Inform users; send only the report text, never contact details.
- Browser speech-to-text may be processed by the browser vendor; typing is
  always available.

## Controls
- Secrets only in server environment variables.
- RLS on every table; staff and admin actions audited (Sprint 1).
- Retention and deletion policy: to be written (Sprint 1).

## Open items
- [ ] Pick the Supabase region and record the reasoning.
- [ ] Review the Anthropic data-handling terms and add a user-facing notice.
- [ ] Add consent text on first report.
