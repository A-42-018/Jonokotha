# Masterplan coverage matrix

Source of truth: `masterplan_JONOKOTHA.md` (kept in the team Drive, not in this repo). This file maps each masterplan requirement to an owner and a plan item, so nothing is left without a home. Detailed tasks live in `docs/backend.md` and `docs/frontend.md` (sections "Masterplan alignment"). Status as of 2026-11-16: **Done** (built and tested), **Partial**, **Open**, **Deferred** (Release 1.1 or 2 by design).

## 1. Competition package (§2.4, §23.1, §29)

| Requirement | Owner | Plan item | Status |
|---|---|---|---|
| `problem.md` with cited figures and interview evidence | Business analyst + backend | backend M.1 | Partial (draft, sources open) |
| `ai-architecture.md` | Backend | existing | Done (agents 2.x not yet measured) |
| `data-sovereignty.md` | Backend | existing | Done (residency to confirm with counsel) |
| `scalability.md` | Backend | backend M.2 | Open |
| `ethics.md` | Backend + frontend | backend M.3 | Open |
| `team.md` (named owner per AIBC role) | Team lead | backend M.4 | Open |
| `collaborators.md` | Team lead | backend M.4 | Open |
| `ai-usage.md` | Team lead | backend M.4 | Open |
| Business value: buyer model, pilot plan, cost model, staff-time-saved | Business analyst | backend M.5 | Open |
| 180 s video, `video-script.md` | Frontend + presenter | frontend existing | Done for Phase 0 |
| Recorded backup demo, printed one-pager, architecture diagram, Q&A sheet | Presenter | frontend M.9 | Open |

## 2. MVP features (§4.2)

| Feature | Backend | Frontend | End to end |
|---|---|---|---|
| Register, login, profile | Done | Done | Done |
| Constituency and representative directory | Done | Done on samples | Open (wire, F.1) |
| Report with AI intake, voice, media, manual path | Done | Done | Open (wire, F.1) |
| Issue list, map, detail, timeline, notifications | Done | Done | Open (wire, F.1) |
| Personalised feed, find your MP | Done | Done on samples | Open (wire, F.1) |
| "আমারও একই সমস্যা", follow, rating, reopen, appeal | Done | Done device-local | Open (wire, F.1) |
| Share links, OG metadata | n/a | Done | Done |
| MP responsiveness counts with method | Done | Done on samples | Open (wire, F.1) |
| Ideas, support, comments, similar ideas | Done | Done device-local (no comments UI to verify) | Open (wire, F.1) |
| Office dashboard, copilot, duplicates, assignment, workflows, announcements | Done | Done on samples | Open (wire, F.1) |
| Admin verification, moderation, AI run log, analytics, audit log | Done | Done on samples | Open (wire, F.1) |
| Bangla and English, responsive PWA | n/a | Done | Done |
| AI evaluation suite with published results | Partial (baseline only) | n/a | Open (backend 3.2) |

## 3. Quality, security and trust (§14, §17.7, §18, §20, §21, §29)

| Requirement | Owner | Plan item | Status |
|---|---|---|---|
| RLS matrix, six accounts | Backend | existing 1.3 | Done |
| MFA for MP, moderator, admin | Backend (+ frontend enrolment UI) | backend M.6, frontend F.4 | Open |
| Security headers, CSP | Backend | existing 3.1 | Partial (report-only) |
| Penetration test or independent review | Backend | backend M.7 | Open |
| Upload malware scan | Backend | backend M.7 | Open (hook only) |
| Emergency / imminent-harm path and disclaimer | Backend + frontend | backend M.8, frontend F.5 | Open |
| Terms, privacy notice, privacy impact assessment | Backend + counsel | backend M.9, frontend F.6 | Open |
| Backup restore drill, RPO/RTO | Backend | existing 3.3 | Open |
| Monitoring, alerts, runbooks | Backend | existing 3.4, 3.5 | Partial (health route, monitor lib) |
| Eval run in CI, blocks regressions | Backend | backend M.10 | Open |
| Office and admin KPI queries (§3.3, §22) | Backend | backend M.11 | Open |
| Public metrics with definition and timestamp | Backend + frontend | backend M.11, frontend F.7 | Partial |
| Accessibility audit incl. screen reader | Frontend + person with devices | existing 3.1 | Partial |
| E2E scenarios 1–15 (§21.3) | Frontend + backend | frontend F.2 | Partial |
| Device and network matrix (§21.4) | Frontend | frontend F.3 | Open |
| Release gates (§21.6) | Both | backend M.12, frontend F.8 | Open |
| Env variable names per §26 | Backend | backend M.13 | Open |

## 4. Deferred by design (§4.3, §4.4)

Polls and surveys, consultations with consensus mapping, WhatsApp/SMS intake, for/against points, support thresholds, project check-ins, insight briefs, Open311, RTI helper, participatory budgeting, agency integrations. Tables for these are not created in MVP migrations.
