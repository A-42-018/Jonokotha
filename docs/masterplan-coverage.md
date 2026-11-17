# Masterplan coverage matrix

Source of truth: [`docs/masterplan_JONOKOTHA.md`](masterplan_JONOKOTHA.md) v1.7 (copy of the team Google Drive original; update both together). This file maps **every section** of the masterplan to the plan phase that delivers it, for **the whole product**: MVP, Release 1.1 and Release 2. The competition dates are reference points only; the plans are complete when every row below is Done.

Plan phases (same numbering in `docs/backend.md` and `docs/frontend.md`):

| Phase | Scope |
|---|---|
| 0–3 | Golden path, foundation, MVP build, production hardening (existing) |
| 4 | Freeze and rehearse (existing) |
| 5 | **MVP completion**: everything the masterplan requires of the MVP product that phases 0–4 did not plan (masterplan §4.2, §5, §6, §7, §10, §12, §17, §19, §31) |
| 6 | **Pilot readiness and operations**: one verified office, real data, legal, support (§2.8.3, §18, §24 After the Congress, §29) |
| 7 | **Release 1.1** (§4.3, §7.14–§7.16, §8.10–§8.12, §12 R1.1 tables, §13.9, §15, §19.6) |
| 8 | **Release 2** (§4.4) |

Tasks are numbered per side: backend `B5.n`, frontend `F5.n`, and so on. Earlier masterplan-alignment tasks M.x (backend) and F.x (frontend) stay where they are.

Status: **Done**, **Partial**, **Open**, as of 2026-11-16.

## By masterplan section

| § | Requirement | Backend | Frontend | Status |
|---|---|---|---|---|
| 1 | Product principle: received vs forwarded vs officially registered, always labelled | B5.4 | F5.6 | Partial |
| 2.1–2.3 | Rubric-driven design (all five components) | M.1–M.5, B6 | F.9, F.12 | Partial |
| 2.4 | Submission package docs | M.1–M.5 | F.12 | Open |
| 2.5–2.6 | Video, Congress demo, Q&A | Phase 4 | F.9, F.12 | Partial |
| 2.8.3 | Business model, pilot, cost per constituency | M.5, B6.1 | — | Open |
| 2.8.4 | Country adapters, configurable hierarchy, locale, currency, categories, channels | B5.12 | F5.12 | Open |
| 2.8.5 | Responsible AI rules | existing, M.3, M.8 | F.5 | Partial |
| 2.9 | Evidence: implemented vs prototype vs planned labels | B5.13 | F5.13 | Partial |
| 2.10 | Benchmark features | covered by §7 rows | | |
| 3.1–3.2 | Goals, north-star metric (verified issues reaching documented outcome per constituency per month) | M.11 | F.7 | Open |
| 3.3 | All supporting KPIs, incl. accessibility task completion and copilot vs no-copilot time | M.11, B6.6 | F.7, F6.3 | Open |
| 4.1 | Preliminary slice | Phase 0 | Phase 0 | Done |
| 4.2 | MVP list | Phases 1–2, 5 | Phases 1–3, F.1, 5 | Partial (frontend wiring) |
| 4.3 | Release 1.1 list | Phase 7 | Phase 7 | Open |
| 4.4 | Release 2 list | Phase 8 | Phase 8 | Open |
| 4.5 | Out of scope (no native apps, no leaderboards, no auto decisions) | guard in DoD | guard in DoD | Ongoing |
| 5.1 | Citizen rights incl. abuse report, data deletion, reopen within review period | existing, 0021 | F5.3, F.6 | Partial |
| 5.2 | MP: approve official statements and commitments, constituency analytics, delegate | B5.1 | F5.4 | Open |
| 5.3–5.4 | Office manager and case officer permissions | existing | existing | Done |
| 5.5 | Agency liaison role | B5.2 | F5.5 | Open |
| 5.6 | Admin: boundaries, categories, permissions, flags, config, security alerts | B5.3 | F5.7 | Partial |
| 5.7 | Moderator: hide temporarily, escalate, never rewrite | existing | existing | Done |
| 6.1–6.2 | Citizen nav incl. Projects, Polls & Surveys, Consultations (1.1) | B5.5, B7 | F5.1 | Partial |
| 6.3 | Office nav incl. Ideas, Questions, Projects, Polls, Staff & Roles, Audit, Office Settings | B5.1 | F5.4 | Partial |
| 6.4 | Admin nav incl. Users, Categories & SLA, Abuse, System Health, Integrations, Feature Flags | B5.3 | F5.7 | Partial |
| 7.1–7.2 | Design principles, visual direction; dark mode later | — | existing, F7.10 | Done / R1.1 |
| 7.3 | Home incl. constituency snapshot, popular ideas, active polls | B5.5 | F5.2 | Partial |
| 7.4 | Report wizard incl. duration, who is affected, video upload | B5.6 | F5.3 | Partial |
| 7.5 | Issue detail incl. forwarding destination, progress evidence, "still happening / more information" | existing | F5.3 | Partial |
| 7.6 | Explore incl. priority and distance filters | existing | F.1 | Partial |
| 7.7 | Ideas incl. full form, idea workflow states, public reason | existing | F5.8 | Partial |
| 7.8 | Ask Your MP incl. public FAQ from verified answers | existing | F.1 | Partial |
| 7.9 | Representative profile incl. term dates, office hours, commitments, projects | existing | F.1 | Partial |
| 7.10 | Office dashboard incl. saved filters, bulk assign, CSV export, evidence | existing | F.1, F5.4 | Partial |
| 7.11 | Moderation actions incl. request edit, appeal path | existing | F.1 | Partial |
| 7.12 | 12 states on every screen | — | existing | Done |
| 7.13 | Find your MP: district → upazila/city → ward/union picker, boundary uncertainty | B5.7 | F5.9 | Partial |
| 7.14 | Consultations with consensus mapping | B7.1 | F7.1 | Backend done (B7.1, 2026-11-17); frontend open |
| 7.15 | WhatsApp/SMS intake, area alerts | B7.2 | F7.2 | Backend done except live providers (B7.2, B7.4); frontend open |
| 7.16 | Project check-ins | B7.3 | F7.3 | Backend done (B7.3); frontend open |
| 8.1–8.9 | MVP workflows end to end | existing | F.1, F.2 | Partial |
| 8.5 | Public project lifecycle incl. budget source, procurement, delay explanation, post-completion feedback | B5.5 | F5.10 | Partial |
| 8.10–8.12 | Release 1.1 workflows | B7 | F7 | Backend done except live providers; frontend open |
| 9 | State machine, SLA config | existing | existing | Done |
| 10.1 | Realtime for status and inbox only, background jobs, privacy-conscious analytics, Sentry | B5.8 | F5.11 | Partial |
| 10.2 | Monorepo layout | B5.14 (decision record) | — | Open |
| 10.4 | All 16 domain modules incl. polls, integrations, personalization | B5.x | F5.x | Partial |
| 11 | Stack incl. shadcn/ui, RHF, TanStack Query | existing | F.1 | Partial |
| 12.1 | All core tables incl. polls, poll_options, poll_votes, idea_comments | B5.5 | — | Partial |
| 12.1 | Release 1.1 tables | B7 | — | Open |
| 12.2 | DB rules incl. PostGIS, soft deletion, retention | existing, 0021, 0022 | — | Partial |
| 13.1–13.10 | Full API | existing, B5 | F.1 | Partial |
| 14 | RLS and permission matrix | existing, M.6 | F.4 | Partial |
| 15 | Notifications incl. email, SMS, poll reminders, unsubscribe | existing, B5.9, B7.4 | F.10, F5.11 | Partial |
| 16 | Maps and location privacy incl. spoof review | existing, B5.7 | existing | Partial |
| 17.1–17.3 | Agents incl. Translation, Insight, Idea Assistant; RAG; graph | existing, B5.10 | F5.14 | Partial |
| 17.4 | Personalization incl. simple-language and voice-first modes, view/reset | B5.11 | F5.15 | Open |
| 17.5 | Model selection, prompt caching, glossary in every prompt | B5.10 | — | Partial |
| 17.6 | Real data sources (EC, Parliament, HDX, OSM, National Portal, GRS, 999/333) with lineage | B6.2 | — | Open |
| 17.7 | AI evaluation incl. real consented examples, dialect STT | M.10, B6.5 | — | Partial |
| 17.8 | Safety | existing, M.8 | F.5 | Partial |
| 18.1 | Security baseline incl. pen test, bot protection | 3.1, M.6, M.7 | F.4 | Partial |
| 18.2 | Privacy incl. anonymous-to-public reporting, legal counsel | 3.7, M.9, B6.3 | F.6 | Partial |
| 18.3 | Trust: verification, corrections, challenge process | existing, M.9 | F.6 | Partial |
| 18.4 | Data sovereignty and governance, data-protection owner | existing doc, B6.3 | — | Partial |
| 19.1 | Bangla-first incl. Bangla/Latin numeral setting, ৳ lakh/crore, Banglish search, digit-agnostic phone/OTP | B5.11 | F5.16 | Partial |
| 19.2–19.5 | Style, glossary, status, category labels | existing | existing | Done (native review open) |
| 19.6 | Bangla AI and voice; read-aloud (R1.1) | existing | F7.9 | Partial |
| 19.7 | Fonts, conjunct rendering in PDFs and exports, SMS length | B7.4 | F5.16 | Backend: SMS length and CSV done; PDF open (font and renderer) |
| 19.8 | WCAG 2.2 AA | — | Phase 3 | Partial |
| 19.9 | First-glance tests with citizens of different districts and ages | — | F6.3 | Open |
| 20 | Performance and reliability incl. status page, RPO/RTO | Phase 3 | Phase 3, F5.11 | Partial |
| 21 | Testing strategy incl. poll vote uniqueness, 17 E2E scenarios | B5.5, M.12 | F.2, F7.x | Partial |
| 22 | Analytics: public, office, admin, privacy | M.11 | F.7 | Open |
| 23 | Team roles, git workflow, DoD | M.4 | — | Partial |
| 24 | All sprints and After the Congress | Phases 0–8 | Phases 0–8 | Partial |
| 25 | Workstreams, completion test | F.1 + M.14 | F.1 | Open |
| 26 | Env vars, separate environments, rollback | M.13, B6.4 | — | Open |
| 27 | Demo mode | Phase 4 | F.9 | Partial |
| 28 | Risk mitigations (each has a feature row above) | | | |
| 29 | Launch checklist | M.12, B6 | F.8, F6 | Open |
| 30 | Product copy | — | existing | Done |
| 31 | Master build prompt requirements | all phases | all phases | Partial |


## Phase 5 update (2026-11-17)

Backend items B5.1-B5.15 are built on the Phase 5 branch (migrations 0030-0036); see the status block in `docs/backend.md` for what is built, tested, not measured and blocked. Sections this moves from planned to built on the backend side: §5.2 (MP approval, delegation), §5.5 (agency liaison), §5.6 and §6.4 (admin configuration), §1 and §28 (received / forwarded / officially registered), §4.2, §7.3, §8.5, §12 (comments, polls, snapshot, project transparency), §7.4 (report fields, video), §7.13 and §16 (administrative hierarchy, uncertain boundary), §10.1 and §20 (jobs, Realtime, Sentry, privacy-conscious analytics), §15 (notification events, opt-in, unsubscribe), §17.2 and §17.5 (idea assistant, translation label, caching, glossary), §17.4 and §19.1 (personalization, Banglish search), §2.8.4 (country adapters), §2.9 (capability labels), §13.10 (Open311-ready ids). Frontend rows are unchanged.


Backend items B7.1-B7.14 are built on the Phase 7 branch (migrations 0070-0074); see the Phase 7 status block in `docs/backend.md` and `docs/aibc/release11/open-items.md` for what is built, tested, not measured and blocked (live WhatsApp/SMS/TTS accounts, PDF font and renderer, real consultations and KPIs). Sections this moves on the backend side: §4.3, §7.14, §7.15, §7.16, §7.7 (for/against points and support threshold), §8.10, §8.11, §8.12, §12 (Release 1.1 tables), §15 (Release 1.1 events), §3.3 (Release 1.1 KPIs), §19.6 (read-aloud, provider needed), §19.7 (SMS length, CSV), §11 (graph evaluation), §21.3 scenarios 16 and 17. Frontend rows are unchanged.

Backend items B8.1-B8.10 are built on the Phase 8 branch (migrations 0080-0083); see the Phase 8 status block in `docs/backend.md` and `docs/aibc/release2/open-items.md`. Sections this moves to built on the backend side: §4.4 budget transparency from verified sources, assisted reporting with a consent record, open data with small-cell suppression, regional administration (counts only), participatory budgeting (gated on a verified budget and a public pledge), the RTI helper (drafts only, never files), sourced MP records without any score, an Open311 GeoReport v2 read API, and second-country readiness gates. Open: any agency integration (no agency offers one), volunteer and kiosk operations, counsel review of the licence, RTI rules and consent texts, a pilot office for participatory budgeting, an editorial team for MP records, and every second-country review.
