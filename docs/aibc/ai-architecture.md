# AI architecture (DRAFT)

## Principle
AI assists; people decide. No AI output changes a case status, contacts an
agency or reaches a citizen without explicit staff approval.

## Components in the preliminary slice
| Component | What it does | Where it runs |
|---|---|---|
| Intake Agent | Turns Bangla/English text (or browser speech-to-text) into a draft title, category, description, area | Server route `/api/intake`, Claude via the Anthropic SDK |
| Office summary | One-sentence case summary for staff | Server route `/api/cases`, same model |
| Similar-case finder | Token-overlap match inside the same category (placeholder) | App server |
| Routing suggestion | Category → agency from the `agencies` table (source URL and checked date per row), shown with source and confidence; in-code list is only a fallback | App server + Postgres |
| PII redaction | Strips phone, email and ID numbers before any model call and before storage | App server (`src/lib/pii.ts`) |

Default model: `claude-opus-5-5` (configurable via `ANTHROPIC_MODEL`).

## Safeguards
- API keys are server-side only; never in the browser bundle.
- User text is passed as data, with a system prompt that says it is not
  instructions; outputs are validated with Zod before use.
- If the model is unavailable or output is invalid, a keyword fallback drafts
  the report and the UI says AI summary is off. The citizen can always type.
- The citizen sees and edits the AI draft before submitting.
- Personal data is redacted before the model sees the text.
- Draft and submit endpoints are rate-limited and size-capped.
- Demo data is flagged `is_demo` and labelled "নমুনা"; no real person, MP or statistic is invented.

## Not yet measured
No accuracy figures are claimed. The evaluation set and baseline arrive in Phase 1 (`npm run eval`).

## Planned (Sprint 1+)
Multilingual embeddings + pgvector duplicate detection, graph edges between
cases, AI run log, and a versioned Bangla/English evaluation set with scripted
runs in CI. Results will be published here.
