# AI evaluation results (Phase 3)

Run date: 2026-11-16. Model: `claude-sonnet-5-5`, prompt `intake@v1` (the final intake prompt). Dataset: `tests/ai/dataset.v0.json`, 118 synthetic cases (66 bn, 37 en, 15 banglish), 10 duplicate groups, 8 cases with planted personal data. Reproduce: `EVAL_AI=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.eval.config.mts` (sends the synthetic cases to the model provider). Baseline for comparison: `docs/aibc/eval-baseline.md` (keyword fallback, 2026-11-16).

## Limitations (read before quoting any number)

Synthetic text written by the project team, not real citizen reports; one author, so wording is less varied than real life; no second-reviewer agreement score; 118 cases is small, so differences of a few points are noise; the Banglish group is only 15 cases; one run, so run-to-run variation is not measured. These numbers describe this dataset, not field performance. A real-report sample with consent is needed before any claim about deployed accuracy.

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

Calls that returned a valid AI draft: 100.0% (118/118); the rest used the keyword fallback (timeout, refusal, malformed output or provider error) and are scored with the fallback's category.

| Language | Category accuracy |
|---|---|
| bn | 95.5% (63/66) |
| en | 97.3% (36/37) |
| banglish | 100.0% (15/15) |
| all | 96.6% (114/118) |

Routing top-1 (category → sourced agency directory): 97.5% (115/118)

Unsupported-number rate (a number in the draft that is not in the citizen's message; a hallucination proxy): 0.0% (0/118)

Latency per draft: p50 8043 ms, p95 16625 ms. Cost: not measured (set AI_PRICE_IN_PER_MTOK / AI_PRICE_OUT_PER_MTOK on the server to log it per run).

Prompt-injection cases (2): 100.0% (2/2) kept their true category.

## Not yet measurable

- Routing top-3 and citation validity: the Routing Agent (RAG with citations) is Phase 2; today routing is a category lookup in the sourced directory.
- Hallucination rate beyond the number check, and reply-draft quality: Office Copilot is Phase 2.
- Bangla-vs-English parity is the per-language table above; the Banglish group is small (15 cases).

## Comparison to baseline

| Measure | Keyword fallback (baseline) | Model `intake@v1` |
|---|---|---|
| Category accuracy, all | 61.0% | 96.6% |
| bn / en / banglish | 66.7 / 59.5 / 40.0% | 95.5 / 97.3 / 100% |
| Routing top-1 | 64.4% | 97.5% |

No regression against the baseline in any language. Bangla (95.5%) is slightly below English (97.3%); with 66 and 37 cases that gap is within noise, so it is reported, not claimed as a real difference.

## What this publication does NOT cover (not measured; no number is given)

- **Routing top-3 and citation validity** (Routing Agent with retrieval), **reply-draft quality** (Office Copilot) and **hallucination rate beyond the number check**: these need human review of generated text on the final prompts; no reviewer has scored them.
- **Duplicate precision and recall with embeddings**: `EMBEDDINGS_BASE_URL` and `EMBEDDINGS_API_KEY` are not set, so only the lexical baseline (precision 36.4%, recall 40.0%) is measured. The 0.80 similarity threshold stays unvalidated.
- **Bangla speech accuracy**: no transcription provider key (`TRANSCRIBE_*`) is set.
- **Cost per draft**: price variables not set.
- **Latency** is real-network latency from one machine (p50 about 8 s, p95 about 17 s, well above a good interactive target); the intake form must keep working with a visible wait and the keyword fallback.
- **PII redaction** covers phones, emails and ID numbers only (recall 100% on 10 planted items, 0 false positives on 110 clean cases); names and addresses are not covered.

## Follow-ups

1. Set the embeddings key and re-run to validate the duplicate threshold.
2. Have two Bangla-speaking reviewers score copilot replies and routing citations on a 50-case sample.
3. Collect a consented real-report sample; re-run before the demo with prompt and model versions pinned.
