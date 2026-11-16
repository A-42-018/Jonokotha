# AI evaluation baseline (dataset v0)

Run date: 2026-11-16. Dataset: 118 synthetic cases (66 bn, 37 en, 15 banglish), 10 duplicate groups, 8 cases with planted personal data. File: `tests/ai/dataset.v0.json`.

Limitations: synthetic text written by the project team, not real citizen reports; one author, so wording is less varied than reality; no reviewer-agreement score yet; small sample, so differences of a few points are noise. Numbers below are measured on this dataset only.

## Keyword fallback (no AI)

| Language | Category accuracy |
|---|---|
| bn | 66.7% (44/66) |
| en | 59.5% (22/37) |
| banglish | 40.0% (6/15) |
| all | 61.0% (72/118) |

Routing top-1 (category → sourced agency directory): 64.4% (76/118)

## PII redaction (phones, emails, ID numbers)

Recall: 100.0% (10/10). False positives on cases with no personal data: 0.0% (0/110). Names and addresses are not covered by this heuristic (documented limitation).

## Duplicate detection

Pairs are judged only within the same category (the production search is also restricted by office). Ground truth: same `dup_group`.

- Lexical baseline (token overlap, threshold 0.35): precision 36.4% (4/11), recall 40.0% (4/10)
- Embedding model: not measured (EMBEDDINGS_BASE_URL / EMBEDDINGS_API_KEY not set). The 0.80 threshold is unvalidated until this runs.

## AI drafting (model claude-sonnet-5-5, prompt intake@v1)

Calls that returned a valid AI draft: 99.2% (117/118); the rest used the keyword fallback (timeout, refusal, malformed output or provider error) and are scored with the fallback's category.

| Language | Category accuracy |
|---|---|
| bn | 95.5% (63/66) |
| en | 97.3% (36/37) |
| banglish | 100.0% (15/15) |
| all | 96.6% (114/118) |

Routing top-1 (category → sourced agency directory): 98.3% (116/118)

Unsupported-number rate (a number in the draft that is not in the citizen's message; a hallucination proxy): 0.0% (0/117)

Latency per draft: p50 7017 ms, p95 16793 ms. Cost: not measured (set AI_PRICE_IN_PER_MTOK / AI_PRICE_OUT_PER_MTOK on the server to log it per run).

Prompt-injection cases (2): 100.0% (2/2) kept their true category.

## Not yet measurable

- Routing top-3 and citation validity: the Routing Agent (RAG with citations) is Phase 2; today routing is a category lookup in the sourced directory.
- Hallucination rate beyond the number check, and reply-draft quality: Office Copilot is Phase 2.
- Bangla-vs-English parity is the per-language table above; the Banglish group is small (15 cases).
