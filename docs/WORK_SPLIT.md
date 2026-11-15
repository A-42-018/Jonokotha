# Work split: frontend and backend

Two long-lived branches off `main`: **`frontend`** and **`backend`**. Merge both into `main` through pull requests; merge `main` back into your branch daily to stay in sync.

## Ownership by folder

| Area | Frontend (`frontend` branch) | Backend (`backend` branch) |
|---|---|---|
| Pages and UI | `src/app/**/page.tsx`, `layout.tsx`, `globals.css`, `not-found.tsx`, `offline/`, `login/` page | — |
| Components | `src/components/**` | — |
| Static / PWA | `public/**` (illustrations, `sw.js`), `src/app/manifest.ts` | — |
| Text and language | `src/lib/i18n.ts` (bn/en strings, formatting) | — |
| API routes | calls them, never edits | `src/app/api/**`, `src/app/lang/route.ts` |
| Data and logic | — | `src/lib/store.ts`, `intake.ts`, `types.ts`, `demo-data.ts`, `src/lib/supabase/**`, `src/proxy.ts` |
| Database | — | `supabase/migrations/**`, RLS, seeds |
| AI | prompts' UI (draft form, AI panel) | agents, prompts, embeddings, eval set |
| Docs | `docs/aibc/video-script.md` | `docs/aibc/ai-architecture.md`, `data-sovereignty.md`, `problem.md` |

Shared files (`package.json`, `next.config.ts`): small, separate commits; tell the other person.

## The contract between the two
Frontend relies only on these. Change them together, in a PR that both approve.

| Endpoint | Purpose |
|---|---|
| `POST /api/intake` `{text}` → `{draft, source}` | AI draft of a report |
| `POST /api/cases` draft → `{ref}` (401 if signed out) | submit a report |
| `POST /api/cases/[ref]/approve` `{action: acknowledge|refer}` | staff approval (403 if not staff) |
| Server helpers `getCase`, `listCases`, `currentUser` | read data in pages |
| Types in `src/lib/types.ts` (`CaseRecord`, `IntakeDraft`) | shared shapes |

When the backend adds a field, it updates `types.ts` first and tells the frontend.

## Task list from the masterplan

### Frontend
- Sprint 0: finish bn/en polish, desktop layout, constituency picker UI, sign-out and account menu, loading and error states (use `state-*.svg`), onboarding screens (`onboard-*.svg`), empty states.
- Sprint 1: status timeline design, request-info flow UI, office actions UI, accessibility pass.
- Sprint 2: voice input UX, ideas feed, "I have this problem too", follow, rating and appeal, find-your-MP, share links, hotspot map view, analytics dashboard, admin moderation screens.
- Sprint 3: performance and low-bandwidth, accessibility audit, Playwright mobile and desktop tests.
- Sprint 4: demo polish, backup recording.

### Backend
- Sprint 0: apply migrations 0001 and 0002, sign-in working end to end, verified agency directory per area, staging deploy and env keys, `docs/aibc/` drafts.
- Sprint 1: roles and RLS with Vitest permission tests, audit events, full case state machine, Duplicate Agent (embeddings, pgvector, graph edges), AI eval set and baseline, GitHub Actions CI.
- Sprint 2: Bangla speech-to-text and translation, full copilot panel, ideas and similar-idea search, personalised feed, MP profile counts, AI run log, hotspot and analytics queries.
- Sprint 3: security and RLS review, backup and restore drill, monitoring, published AI evaluation results.
- Sprint 4: demo seed and reset script, freeze fixes.

## Working rules
- Never commit `.env.local` or any key. Each person uses their own keys.
- Every AI output needs human approval before it changes anything.
- Branch names for features: `frontend/<topic>` or `backend/<topic>`, merged into the long-lived branch first.
