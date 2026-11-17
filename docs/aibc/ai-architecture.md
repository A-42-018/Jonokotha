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


## Phase 2 agents (2026-11-16)

Every agent goes through `runAgent` (forced tool call, Zod-validated, typed fallback, `ai_runs` log). None of them applies anything: output is a draft, or a pending `ai_suggestions` row that staff Accept, Edit or Dismiss.

| Agent | Input (always redacted) | Output | Citations and fallback |
|---|---|---|---|
| Intake v2 (`prompts` intake@v2) | citizen's text | title, category, description, area hint, urgency | urgency guidance is fixed text, danger words force `urgent` and point to 999; keyword fallback |
| Translation (translate@v1) | text | translation, labelled machine translation | `available:false` shows the original |
| Transcription | audio (never stored) | text, redacted | provider optional; typing always works |
| Office Copilot (copilot@v1) | numbered facts of one issue | summary, missing information, Bangla reply draft, confidence | every output cites fact ids that exist; an answer citing nothing valid becomes the rule-based fallback |
| Routing (routing@v1) | issue + retrieved agency/rule chunks | agency | citations are source name, URL, date checked; model choices outside the retrieved set are ignored; no chunk above the threshold means "no confident suggestion"; demo and real sources never share an index |
| Insight (insight@v1) | aggregate statistics only | three-sentence note | dropped if it contains a number that is not in the statistics |
| Duplicate (Phase 1.8) | redacted public text | candidates with reasons | scoped to office and category |

Confidence figures are the model's own report or absent; retrieval scores are not probabilities and are labelled as such. Quality of the Phase 2 agents is **not yet measured**: the evaluation run on the final prompts (Phase 3) must cover copilot reply quality, routing top-1/top-3 and citation validity, and Bangla speech accuracy before any number is published.
