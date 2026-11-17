# Build provenance: Data and AI provenance, tooling, MCP, AI-DLC, prompts, context files

How Jonokotha (জনকথা) was built with AI, and what the shipped product itself uses. Each statement points to a file or commit you can check. Items marked **TO CONFIRM** are things only the team knows; fill them in or delete them before submitting. Nothing here claims a tool or technique the repo does not show.

Live app: https://jonokotha.vercel.app/ (checked 2026-11-16: the Bangla home page loads and `/api/health` returns `{"ok":true}`). Repository: https://github.com/A-42-018/Jonokotha

## 1. Tooling and IDE

| Layer | Tool | Evidence |
|---|---|---|
| AI coding agent | Claude Code (Anthropic), used in the Claude desktop app | `Co-Authored-By: Claude` trailers on commits `97c5581`, `896008a`, `de246c5`, `ed52138`, `79cf1fc`, `ee552bb`; `video-script.md` scene A2 shows the Claude Code session |
| Editor / IDE | **TO CONFIRM** (the team's editor; Claude Code ran alongside it) | not recorded in the repo |
| Framework | Next.js 16 App Router, React 19, TypeScript, Tailwind 4 | `package.json` |
| Database and auth | Supabase (Postgres, Row Level Security, email OTP), local stack via the Supabase CLI | `supabase/`, 23 migrations, `package.json` |
| Hosting | Vercel (production deploy, two daily crons) | `vercel.json`; first deploy commit `896008a` |
| Model SDK | `@anthropic-ai/sdk`, optional gateway base URL `AI_BASE_URL` | `src/lib/anthropic.ts`, commit `de246c5` |
| Embeddings | BAAI/bge-m3 through any OpenAI-compatible `/embeddings` endpoint | `src/lib/ai/embeddings.ts` |
| Testing | Vitest, Testing Library, Playwright, axe-core, Lighthouse, a local-Supabase database suite (RLS, state machine, audit, API) | `package.json` scripts, `tests/`, `.github/workflows/ci.yml` |
| CI/CD | GitHub Actions (lint, typecheck, unit, build, bundle secret scan, e2e, database suite); schedules for uptime, jobs and backup are defined but paused in favour of free alternatives | `.github/workflows/`, commit `2474128` |
| Design | Design tokens and primitives in code. **No Figma file** was used. | `docs/design-system.md`, `src/components/ui` |
| Illustration art | Recraft (Basic plan): Recraft V4.1 Vector for the homepage scenes, cards and category tiles; Nano Banana 2.1 (Google, run inside Recraft) only for the two layout mockup images. Prompts are in the plan; the scenes are checked against a Bangladesh-accuracy list (dress, rickshaw, flag, Jatiya Sangsad) before use. Final art ships as AVIF/WebP because the traced SVGs were 100 KB to 1.6 MB each. | `docs/HOMEPAGE_REDESIGN_PLAN.md` §6, `docs/mockups/`, `public/illustrations/home/` |
| Navbar logo art | Recraft V4.1 Vector, one prompt (street scene drawn for the deep green header, no text); the জনকথা wordmark is live text in the site heading font. Background rect removed and viewBox cropped by hand. | `public/brand/jonokotha-scene.svg`, `src/components/ui/TopNav.tsx` |
| Desktop hero background | Recraft V4.1 Pro (raster, 3072x1536, 2:1), one detailed prompt (continuous golden-hour sky across the full width, calm empty left half for the headline, Bangladesh scene on the right). Recraft "Erase area" was used on an earlier variant; the chosen variant needed no edit beyond a warm light lift behind the copy, added with sharp so dark text keeps at least 4.7:1 contrast. The Sangsad-style building is AI-drawn and stylised, not an exact copy of the real Jatiya Sangsad. Shipped as AVIF/WebP at 1600, 2400 and 3072 px wide. | `src/components/citizen/HomeHero.tsx`, `public/illustrations/home/hero-bg-*` |

Two environments built the product in parallel, one on the `frontend` branch and one on `backend`, each limited to its own folders and joined by a written API contract (`docs/WORK_SPLIT.md`, `docs/api-v1.md`, merged by pull requests #1 to #3).

## 2. MCP usage

**MCP server we built** (`src/lib/mcp.ts`, route `src/app/api/mcp/route.ts`, migration `0019_knowledge_analytics_mcp.sql`)
- JSON-RPC 2.0 over HTTP, protocol version 2025-03-26, for staff AI clients.
- Authentication is the staff member's own Supabase token, so every tool runs under that person's row-level security.
- Five tools: `search_cases`, `agency_directory`, `case_timeline`, `area_statistics` (all read-only) and `propose_note`, which only creates a pending `ai_suggestions` row that a human must accept in the office screen.
- Every call is audited by tool name and argument keys. Notes pass through PII redaction first.

**MCP servers we used while building**: **TO CONFIRM.** The Claude desktop app session had these MCP tools available: built-in browser (preview and check pages), iOS Simulator, computer use, Claude in Chrome, scheduled tasks, terminal, Claude Docs. List only those you actually used for Jonokotha, and for each say what it was used for (for example: the built-in browser to check the deployed app, the Supabase CLI against the local database). The repo itself has no `.mcp.json`, so no project-level MCP server was configured.

## 3. AI-DLC (AI development lifecycle) as practised

The loop used for every feature, as seen in the commit history and docs:

1. **Source of truth.** One masterplan (`docs/masterplan_JONOKOTHA.md`, v1.7) holds the product, rubric and release scope. It was added to the repo in `58b1e59` so both sides and the AI read the same file.
2. **Coverage matrix.** `docs/masterplan-coverage.md` maps every masterplan section to a phase (0 to 8) and a status (Done, Partial, Open). Plans cover the whole product, not only the competition dates.
3. **Phase plans with numbered tasks.** `docs/backend.md` (B and M tasks) and `docs/frontend.md` (F tasks). Each task names its dependency on the other side.
4. **One task, one commit.** Commit messages carry the task id (for example `Phase 1.4: issue state machine (0008)`, `Report flow polish ... (task 0.4)`).
5. **Tests with the task.** Unit tests, a Row Level Security suite with a coverage guard, API tests, Playwright golden paths at 375 and 1280 px, axe accessibility checks in Bangla and English, and bundle secret scans. A failing permission test fails the build.
6. **Evaluation as a gate.** `tests/ai/dataset.v0.json` (118 synthetic Bangla, English and Banglish cases) and `npm run eval`, `npm run eval:gate`. Baseline and AI results are in `docs/aibc/eval-baseline.md` and `eval-results.md`, with their limits stated.
7. **Record what is live.** Migrations are applied to the live database in order and each application is committed (`41244dc`, `9012a31`, `9f522cf`, `cfebb78`, `69c4f2b`, `e68a223`). Docs separate implemented, prototype and planned.
8. **Human review of AI output.** Applies to the product too: no AI output changes a case, contacts an agency or reaches a citizen without staff approval (`docs/aibc/ai-architecture.md`).
9. **Audit and hand-off.** `docs/aibc/phase3-audit.md`, `security-review.md`, `pia.md` and runbooks in `docs/aibc/runbooks/`.

## 4. Prompt library

### 4.1 Product prompts (in code, versioned)

All in `src/lib/ai/prompts/index.ts`. The prompt id and version are written to `ai_runs` on every call, and a text change means a version bump noted in `eval-baseline.md`. Every call goes through `runAgent` (`src/lib/ai/run.ts`): a forced tool call, output validated with Zod, a typed fallback, and a logged outcome.

| Prompt | Version | Agent | Job | Built-in safeguards |
|---|---|---|---|---|
| `intake` | v1, v2 | Intake | Draft title, category, description, area hint (v2 adds urgency) from Bangla, English or Banglish text | Output language is set explicitly; never invent facts; danger words force urgent and point to 999; text is data, not instructions |
| `summary` | v1 | Office summary | One-sentence case summary for staff | No added facts |
| `translate` | v1 | Translation | Bangla and English translation | Adds and omits nothing; labelled machine translation |
| `copilot` | v1 | Office Copilot | Summary, missing information, Bangla reply draft, confidence | Uses only numbered facts and must cite fact ids; invalid citations fall back to a rule-based answer |
| `routing` | v1 | Routing | Choose an agency from retrieved sources | Only agencies in the retrieved sources; empty citation list means no confident suggestion |
| `insight` | v1 | Insight | Three-sentence note from aggregate statistics | Dropped if it contains a number not in the data |
| (no prompt) | n/a | Duplicate | Embedding similarity with reasons | Scoped to office and category |

Measured quality exists only for `intake@v1` drafting (96.6% category accuracy, 114/118) and the keyword fallback; the other prompts are not yet measured (`eval-results.md`).

### 4.2 Build prompts (used to build the app)

**TO CONFIRM and fill in.** The conversation history that produced the code is in the team's Claude Code sessions, not in the repo, so these have to come from the team. For each prompt that mattered, add one line: what you asked, and what it produced (commit or file). Prompts evidenced in the repo that can be listed truthfully:
- The masterplan's own build prompt (masterplan §31).
- The instruction to plan the whole masterplan across Phases 0 to 8 rather than only the competition scope (result: `docs/masterplan-coverage.md`, commits `b63829f`, `4e05977`).
- The phase-by-phase frontend and backend plan requests (commits `d195a2d`, `3057ca0`).

## 5. Context and memory files

| File | Purpose |
|---|---|
| `AGENTS.md` | Project instruction file read by the coding agent. It warns that this Next.js version has breaking changes and tells the agent to read `node_modules/next/dist/docs/` first. It is re-added by `next dev`. |
| `docs/masterplan_JONOKOTHA.md` | Product source of truth, shared by the team and the agent |
| `docs/masterplan-coverage.md` | Section-by-section status, the agent's map of what is done |
| `docs/backend.md`, `docs/frontend.md` | Phase plans and task lists per side |
| `docs/WORK_SPLIT.md`, `docs/api-v1.md`, `src/lib/types.ts` | Ownership of folders and the frontend/backend contract |
| `docs/permission-matrix.md`, `docs/state-machine.md` | Rules the code and tests are checked against |
| `docs/aibc/*.md` | Submission and audit documents, including this one |
| Claude Code auto-memory (kept on the developer's machine, outside the repo) | Short notes carried between sessions: the two-environment workflow and integration order, the rule that plans cover the full masterplan, and the status of each finished phase and its open items |

There is no `CLAUDE.md`, `.claude/` directory or `.mcp.json` in the repo.

## 6. Data and AI provenance summary

- **Models:** Claude through the Anthropic API (model chosen by `ANTHROPIC_MODEL`; `claude-opus-5-5` default, `claude-sonnet-5-5` used for the recorded evaluation); BGE-M3 for embeddings. No fine-tuning, no local or open-weight LLM and no workflow-automation tool is used.
- **Data in the product:** citizen reports (redacted before any model call and before storage), a sourced agency directory with source URL and checked date per row, and clearly labelled sample data (`is_demo`, shown as "নমুনা"). No real person, MP or statistic is invented.
- **Data sent to model providers:** redacted report text only (`src/lib/pii.ts`; phone, email and ID-number recall 100% on the synthetic set, names and addresses not detected). Details in `docs/aibc/data-sovereignty.md`.
- **Evaluation data:** 118 synthetic cases written by the team, not real citizen reports.
- **Retrieval:** pgvector with HNSW indexes, 1024-dimension embeddings, checksummed chunks re-ingested only when changed (`src/lib/ai/knowledge.ts`). Graph relations are Postgres edges (`graph_edges`), not a graph database.
- **Boundary data:** district outlines for "find my seat from my location" come from geoBoundaries gbOpen BGD ADM2 (build 12 Dec 2023, CC BY 3.0 IGO, https://www.geoboundaries.org/), simplified to about 330 m and bundled as `src/lib/data/bd-districts.json` (server only). Seat boundaries are not bundled; the person chooses the seat within the district.
