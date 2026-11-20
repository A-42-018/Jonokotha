# Local model through Ollama

Date: 2026-11-20. Code: `src/lib/ai/ollama.ts`, the local branch in `src/lib/ai/run.ts`, `aiAvailable()` used by the helper route and the admin health check. Tests: `tests/unit/ollama.test.ts` (9 tests).

## What it is
With `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL` (for example `http://127.0.0.1:11434`) and optionally `OLLAMA_MODEL` (default `qwen2.5:7b`), every agent that goes through `runAgent` calls a local Ollama model instead of Claude. It uses Ollama's native `/api/chat` with the agent's JSON schema in `format` and temperature 0, then validates the answer with the same Zod schema as for Claude, so a wrong shape becomes `invalid_output` and the caller's fallback runs. The run is logged to `ai_runs` as `ollama:<model>`. No Anthropic key is needed in this mode. Embeddings can also come from Ollama: set `EMBEDDINGS_BASE_URL=http://127.0.0.1:11434/v1` and pull `bge-m3` (not done here).

Reason to have it: text never leaves the machine, no per-call cost, and it works offline. It is off by default, and the live site uses Claude.

## Measured run (the only one)
- Machine: Apple M2, 8 GB memory, Ollama on the GPU. Model: `qwen2.5:3b`, 3.1 billion parameters, quantization Q4_K_M, 1.9 GB, pulled from the Ollama registry.
- Task: the 118-case intake evaluation, prompt `intake@v1`, one run, one case at a time (`AI_PROVIDER=ollama EVAL_AI=1 npm run eval`). Same dataset and limits as `eval-results.md` (synthetic text, one author, one run).

| Measure | Local `qwen2.5:3b` | Claude `claude-sonnet-5-5` (2026-11-16) | Keyword fallback |
|---|---|---|---|
| Valid AI drafts | 89.8% (106/118) | 100% (118/118) | n/a |
| Category accuracy, all | **41.5% (49/118)** | 96.6% (114/118) | 61.0% (72/118) |
| Bangla | 37.9% (25/66) | 95.5% | 66.7% |
| English | 45.9% (17/37) | 97.3% | 59.5% |
| Banglish | 46.7% (7/15) | 100% | 40.0% |
| Routing top-1 | 53.4% (63/118) | 97.5% | 64.4% |
| Unsupported-number rate | 0.0% (0/106) | 0.0% (0/118) | n/a |
| Prompt-injection cases | 2 of 2 | 2 of 2 | n/a |
| Latency per draft | p50 11.7 s, p95 30.6 s | p50 8.0 s, p95 16.6 s | instant |

## What this means
- **A 3B local model is not good enough for intake drafting here.** Its category accuracy (41.5%) is below the plain keyword fallback (61.0%), and 12 of 118 calls returned nothing usable. Do not enable it for citizens. It is useful as an offline or privacy experiment and as a test of the provider plumbing.
- The gap is the model size and Bangla ability, not a setup error: the provider returned valid structured output in 106 of 118 calls and the numbers check was clean. A 7B or larger model (`qwen2.5:7b` and up) may do better, but it did not fit this machine comfortably (8 GB), so it was **not measured** and no figure is claimed for it.
- Not measured: any agent other than intake, reply or summary quality, cost, and any model other than `qwen2.5:3b`.

## Re-run
```bash
ollama pull qwen2.5:3b
AI_PROVIDER=ollama OLLAMA_BASE_URL=http://127.0.0.1:11434 OLLAMA_MODEL=qwen2.5:3b EVAL_AI=1 \
  node node_modules/vitest/vitest.mjs run --config vitest.eval.config.mts   # about 27 minutes on an M2; report in tests/ai/out/latest.md
```
