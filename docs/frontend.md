# Frontend implementation plan — Jonokotha (জনকথা)

Owner: `frontend` branch. Source of truth: `masterplan_JONOKOTHA.md` (§6 navigation, §7 UX, §19 language and accessibility, §20 performance). Backend contract: see `docs/WORK_SPLIT.md`.

Phases 0–4 follow the sprints (§24); phases 5–8 complete the whole masterplan (MVP completion, pilot, Release 1.1, Release 2). Dates are reference points, not the scope boundary. Every masterplan section is mapped in `docs/masterplan-coverage.md`.

## Stack and conventions

- Next.js 16 App Router, TypeScript, Tailwind v4. Read `node_modules/next/dist/docs/` before using any Next API (this version differs from older ones: `params` is a Promise, `proxy.ts` replaces middleware).
- Planned additions: shadcn/ui primitives (Radix), React Hook Form + Zod, TanStack Query for client mutations, Vitest + Testing Library, Playwright (mobile 375px and desktop 1280px).
- Server Components by default; `"use client"` only for forms, maps, voice and interactive widgets.
- Strings: all UI text goes in `src/lib/i18n.ts` (bn and en). No hard-coded text in components. Bangla written in plain everyday চলিত (§19.2); glossary in §19.3; status labels in §19.4.
- Design tokens (already in `globals.css`): civic blue `#1d5fa8`, teal `#0f8b8d`, leaf `#3a9d5d`, amber `#f2a33a`, light surface `#f4f8fc`. Fonts Anek Bangla (headings), Hind Siliguri (body, ≥16px). No party colours or symbols.
- Touch targets ≥ 44×44px, visible focus rings, never colour alone for status, `lang` attribute set per page.
- Folder layout: `src/app/(citizen)/…`, `src/app/(office)/office/…`, `src/app/(admin)/admin/…`, shared `src/components/{ui,citizen,office,admin}/`.

## Already built (Sprint 0, local)

Home, `/report` (type/speak, AI draft, edit, submit), `/issue/[ref]` with timeline, `/office` queue and `/office/[ref]` with AI panel and approve buttons, `/login` (email code), bn/en toggle, `/offline`, PWA manifest and service worker, 40 illustrations in `public/illustrations`.

---

## Phase 0 — Preliminary submission (15–20 Nov)

Goal: a polished golden path that records well on video.

| # | Task | Files | Done when |
|---|---|---|---|
| 0.1 | Verify sign-in flow end to end on phone width (send code, verify, redirect to `/report`). Add sign-out and an account menu in the header. | `LoginForm.tsx`, `layout.tsx`, new `AccountMenu.tsx` | Can sign in, see email in header, sign out |
| 0.2 | Constituency picker UI (one sample entry, labelled "নমুনা"). Shown at first sign-in and in the header. | `ConstituencyPicker.tsx` | Selection persists in a cookie and is sent with the report |
| 0.3 | Home v2 per §7.3: header with area, report CTA card, idea CTA (disabled "শীঘ্রই"), recent local issues (read from API), representative card (sample), footer with help/privacy/official-channel note. | `app/page.tsx`, `components/citizen/*` | Matches approved mockups |
| 0.4 | Report flow polish: AI-suggestion badges on drafted fields, privacy warning when text contains phone/ID numbers, local draft autosave, success screen with reference ID, copy and share link. | `ReportForm.tsx`, new `ReportSuccess.tsx` | Interrupted draft recovers; success screen shows ref ID |
| 0.5 | States: loading skeletons, empty, error/retry, offline banner, not-found, no-access, session-expired, using `state-*.svg`. | `app/loading.tsx`, `error.tsx`, `not-found.tsx`, `components/ui/State.tsx` | Each state reachable and visually checked |
| 0.6 | Office queue and case workspace polish: table on desktop, cards on phone, status chips, AI panel labelled "staff only", approve buttons with confirm dialog and success toast. | `app/office/**`, `components/office/*` | Video-ready |
| 0.7 | Desktop layout (≥ 1024px): top navigation per §6.2, two-column office workspace. | `layout.tsx`, `components/ui/TopNav.tsx` | Looks intentional at 1280px |
| 0.8 | Install prompt UX and `theme-color`; verify Lighthouse PWA and a11y ≥ 90 on `/`, `/report`, `/issue/[ref]`. | `RegisterSW.tsx`, manifest | Scores recorded in `docs/aibc/` |
| 0.9 | Video support: seed demo data helper screen is NOT shown; prepare screen order in `docs/aibc/video-script.md`. | docs | Rehearsed once |

Exit: golden path recorded; staging URL works on a real phone.

---

## Phase 1 — Foundation hardening (21 Nov – 1 Dec)

Goal: design system, navigation shell and trustworthy case screens.

1. **Design system** (`src/components/ui`): Button, Input, Textarea, Select, Checkbox, Radio, Dialog, Toast, Tabs, Badge/StatusChip, Card, Skeleton, EmptyState, Stepper, Table, Pagination. Storybook optional; a `/dev/ui` page is enough. Each has focus, disabled, error and RTL-safe spacing.
2. **Navigation shell** (§6.1, §6.2): bottom tab bar on phones (হোম, এলাকা, সমস্যা জানান centre button, আইডিয়া, আমি); top nav on desktop; persistent report CTA; language switcher; notification bell (stub).
3. **Report wizard v2** (§7.4): Stepper with 5 steps (category, describe, location, evidence, review). Quick-start "বলুন বা লিখুন" fills the draft. Zod validation with Bangla error messages; React Hook Form. Location step uses a text/area search for now (map in Phase 2). Evidence step: image picker with on-device compression, caption, warning text.
4. **Issue detail v2** (§7.5): status timeline component, official response block, "আমারও একই সমস্যা" button (UI wired in Phase 2), follow button, report-content action, share link, privacy: never render private fields.
5. **My Reports** page: list with status chips, filter by status.
6. **Office actions UI**: acknowledge, request more information, refer, resolve dialogs; each requires a note; shows who did what (audit list).
7. **Auth/role UI**: role-aware header (citizen / staff / admin), route guards messages (`noAccess`), session-expired state.
8. **Tests**: Vitest + Testing Library for ReportForm, StatusChip, LoginForm; Playwright smoke for golden path at 375px.
9. **Accessibility pass #1**: keyboard order, labels, focus, contrast check on all tokens, `aria-live` for toasts and AI draft loading.

Exit: all Phase 0 screens rebuilt on the design system; CI runs lint, typecheck, unit tests.

---

## Phase 2 — MVP build (2–12 Dec)

Goal: the full citizen MVP (§4.2) and office dashboard.

**Citizen**
1. **Explore issues** (§7.6): map/list toggle, search, filters (category, status, date), sort latest/updated/nearby, clustered markers, "data last updated" label. Map: MapLibre GL with an OSM provider (check Bangladesh tile coverage and terms). Public markers use approximate location only (§16).
2. **Location step with map**: current location only after explicit permission, tap to place pin, area search, manual fallback.
3. **Voice intake**: mic button using browser speech recognition (`bn-BD`) with typed fallback; live transcript; permission-denied state.
4. **Ideas** (§7.7): list with tabs (popular, newest, under review), idea card, support button (one per user), submit-idea form with similar-idea suggestions before publishing, status labels.
5. **Find your MP** (আপনার এমপি কে?, §7.13): works without an account; area search to representative card.
6. **Representative profile** (§7.9): verified badge and date, office contact, announcements, office response counts with date range and "how this is calculated" link; never ranks MPs.
7. **Engagement**: "আমারও একই সমস্যা" with count, follow issue/area, satisfaction rating (1–5) after resolution with reopen and appeal.
8. **Ask Your MP** (§7.8): private message vs public question; inbox.
9. **Personalised home feed**: by followed areas and categories; notification centre (in-app list first, push later).
10. **Share**: WhatsApp and Facebook link buttons; share image (`share-image.svg`) via Open Graph metadata on issue pages.
11. **Onboarding** (3 screens) and **Settings** (language, notifications, account); **Help & Safety**, **Privacy & Terms** pages.

**Office** (§6.3, §7.10)
12. Dashboard overview widgets, case table (saved filters, bulk assign with confirm, CSV export), full AI copilot panel (summary, missing-info checklist, similar cases, cited routing, reply draft editable before send), internal notes separated from public replies, assignment and escalation, public announcement composer.

**Admin** (§6.4, §7.11)
13. Verification queue, moderation queue (reason required, audit shown), AI run log viewer, basic analytics and hotspot view.

**Quality**: every screen has the 12 states in §7.12; no invented statistics shown as real; sample data labelled.

Exit: MVP feature list in §4.2 works end to end on staging.

---

## Phase 3 — Production hardening (13–20 Dec)

1. **Accessibility audit** (§19.8): screen-reader pass (TalkBack and VoiceOver) on report, issue detail, office case; keyboard-only run; 200% zoom; reduced motion; fix all serious axe findings.
2. **Performance and low bandwidth** (§20): budget ≤ 150 KB JS on first load for `/`, route-level code splitting, lazy-load map, `next/image` for raster, SVG sizes ≤ budget (heroes ~40–90 KB), font subsets, skeletons, 3G throttled Lighthouse ≥ 85 performance.
3. **Offline and resilience**: offline banner, queue a report draft while offline and send when back, service-worker cache versioning, error boundaries per route.
4. **Language QA** (§19.9): native-speaker review of all Bangla strings, no mixed-language labels, number and date formatting (Bangla digits, Asia/Dhaka), long-text wrapping.
5. **Tests**: Playwright suites on mobile and desktop for citizen golden path, staff approval, role denial, offline page; visual regression screenshots of key screens.
6. **Security UI checks**: no keys in the bundle (grep build output), CSP headers coordinated with backend, safe rendering of user text, file-upload type and size limits in UI.
7. **Docs**: UI evidence for `docs/aibc/` (screenshots, accessibility and Lighthouse reports).

Exit: audit report with zero serious a11y issues and performance budget met.

---

## Phase 4 — Freeze and rehearse (21–25 Dec)

1. Feature freeze; only fixes.
2. Demo polish: seeded sample constituency clearly labelled; reset script run before each rehearsal; hide unfinished features behind flags.
3. Recorded backup demo (phone screen capture) and offline-safe screenshots.
4. Rehearse the 3-minute pitch on the actual demo device and network; checklist for projector resolution, language set to Bangla, sound.
5. Final cross-browser check: Chrome Android, Safari iOS, Chrome desktop.

---

## Phase 5 — MVP completion

Goal: every screen and control the masterplan requires of the MVP (§4.2, §5, §6, §7, §17.4, §19, §31). Every control works or is hidden from production navigation (§31 UI bar). Each item: bn and en, 375 and 1280, all §7.12 states, axe clean, e2e test, wired to the backend item named.

| # | Task | Masterplan | Backend |
|---|---|---|---|
| F5.1 | **Citizen navigation complete**: desktop top nav adds Projects, Ask Your MP, Find your MP, About/Help; additional pages Project Tracker and Polls & Surveys; Consultations entry hidden behind a flag until Release 1.1. | §6.1, §6.2 | B5.5 |
| F5.2 | **Home v3**: constituency snapshot (reported, in progress, resolved with date range), popular community ideas, verified representative card, active polls, footer with accessibility link and official-channel disclaimer. | §7.3 | B5.5 |
| F5.3 | **Report and issue detail completion**: report fields "how long" and "who is affected"; video upload with progress and retry; issue detail shows forwarding destination and reference when publishable, progress evidence, "এখনও হচ্ছে / আরও তথ্য আছে" action, received / forwarded / officially registered label; abuse report on every public item. | §7.4, §7.5, §1 | B5.4, B5.6 |
| F5.4 | **Office dashboard complete** (§6.3 sidebar): My Assigned Cases, All Constituency Issues, Ideas & Proposals review with decision and public reason, Questions & Messages inbox with assign and reply, Projects & Commitments (create, milestones, delay notes, budget source), Polls & Surveys (create, publish, close), Analytics & Reports (KPIs from M.11 with definitions), Staff & Roles (invite, role, suspend), Audit Log, Office Settings (SLA targets, categories in use); MP approval step for official statements; evidence attachments on updates and resolution; appeal queue; affected counts on cases. | §5.2, §6.3, §7.10, §31 office | B5.1, B5.5, M.11 |
| F5.5 | **Agency liaison workspace**: list of referred cases only, acknowledge, update, add external reference or link, close with evidence; banner that this is not an official integration unless confirmed. | §5.5 | B5.2 |
| F5.6 | **Status language for referrals**: "received by office", "forwarded to authority", "officially registered" shown everywhere a referral appears, never implied. | §1, §28 | B5.4 |
| F5.7 | **Admin console complete** (§6.4): Platform Overview, Constituencies & Boundaries, Representatives (verify with source and date), Office Verification, Users (role, suspend), Categories & SLA Configuration, Content Moderation, Abuse Reports, Appeals, System Health, Audit & Security (alerts), Integrations, Feature Flags, Knowledge Sources, AI evaluation results, Demo data (staging only). | §5.6, §6.4, §31 admin | B5.3 |
| F5.8 | **Ideas complete**: full submit form (problem, solution, benefit, area, citizen cost estimate labelled not official, attachments, conduct acknowledgement); every idea workflow status with public reason; comments list with moderation states; share and report actions. | §7.7, §8.4 | B5.5 |
| F5.9 | **Find your MP picker**: district → upazila/city → ward/union cascade from real data, or location once; shows all possible constituencies when the boundary is uncertain and lets the citizen confirm; same picker in onboarding and profile, with "request correction". | §7.13, §8.1 | B5.7 |
| F5.10 | **Projects**: `/projects` and `/projects/[id]` with milestones, budget source and verification date, delay explanations, completion evidence, follow, post-completion feedback; never show citizen estimates as official. | §6.1, §8.5 | B5.5 |
| F5.11 | **Realtime and polls**: live status and inbox counts via Realtime for own items only; polls list and vote (one per user), results per office setting; notification preferences per event type with unsubscribe; status page link. | §10.1, §15, §20 | B5.5, B5.8, B5.9 |
| F5.12 | **Country-ready UI**: admin hierarchy labels, currency, date format and categories come from configuration, not hard-coded Bangladesh names in components. | §2.8.4 | B5.12 |
| F5.13 | **Capability labels**: render `data_status` (live, sample, demo, planned) consistently; planned features never look functional. | §2.9, §31 #20 | B5.13 |
| F5.14 | **Translation and AI helpers**: "অনুবাদ দেখুন" on public text (labelled, original one tap away); Idea Assistant clarity suggestions in the idea form; Insight brief view in office analytics with review step. | §17.2 | B5.10 |
| F5.15 | **Personalization controls**: simple-language mode (shorter copy, more icons), voice-first mode (mic first on report and ask), view why an item is in my feed, reset, switch off. | §17.4 | B5.11 |
| F5.16 | **Language completeness**: setting for Bangla or Latin numerals; money as ৳ with lakh and crore grouping; Banglish search in every search box; phone and OTP fields accept both digit sets; conjunct, reph and ya-phala rendering checked on low-end Android and in exports. | §19.1, §19.7 | B5.11 |
| F5.17 | **Terms and About** pages; accessibility statement; emergency and official-channel disclaimers in footer. | §6.2, §21.6, §29 | M.9 |

Exit: every §31 required citizen, office and admin feature is reachable, functional and tested; no decorative control remains.

---

## Phase 6 — Pilot readiness

| # | Task | Masterplan |
|---|---|---|
| F6.1 | Office onboarding and training screens for the pilot office (first-run tour of queue, copilot, approvals); in-app help for staff. | §2.8.3, §24 |
| F6.2 | Citizen help and support contact flow; feedback form for testers. | §29 Operations |
| F6.3 | **Field testing**: first-glance test with citizens of basic reading skills from different districts, ages and education levels, including older and first-time smartphone users; accessibility task-completion rate measured; fixes logged in `docs/aibc/language/`. | §19.9, §3.3 |
| F6.4 | Native-speaker plain-language sign-off on every string (part of Definition of Done from here on). | §19.1, §19.9 |
| F6.5 | Real-device pass of the whole product on the §21.4 matrix with production data volumes. | §21.4 |

---

## Phase 7 — Release 1.1

| # | Task | Masterplan | Backend |
|---|---|---|---|
| F7.1 | **Consultations**: list and detail; one statement at a time with একমত / একমত নই / জানি না; add a short statement (moderated); no reply threads; aggregate agreement view in plain Bangla with minimum group size; "আপনারা বললেন, যা করা হলো" report page; office composer with MP approval, open and close. | §7.14, §8.10 | B7.1 |
| F7.2 | **WhatsApp and SMS entry points**: "WhatsApp-এ জানান" links and number display; reports from channels appear in My Reports with the same timeline; area alert preferences. | §7.15 | B7.2, B7.4 |
| F7.3 | **Project check-ins**: follow a project; add dated photo check-in ("আজ গিয়ে দেখলাম…") labelled citizen-submitted; office response shown. | §7.16 | B7.3 |
| F7.4 | **For / against points** on ideas (পক্ষে, বিপক্ষে, helpful marks) replacing open comment threads where enabled. | §7.7 | B7.5 |
| F7.5 | **Support threshold**: progress toward the office threshold, "উত্তরের অপেক্ষায়" with due date, public overdue label, office setting screen. | §7.7, §8.11 | B7.5 |
| F7.6 | Public polls and surveys for citizens; satisfaction surveys after closure. | §4.3 | B7.6 |
| F7.7 | Project and commitment tracker pages. | §4.3 | B7.7 |
| F7.8 | Community priority ranking (non-binding label) and weekly insight brief view for offices; exportable office reports (CSV, PDF). | §4.3 | B7.8–B7.10 |
| F7.9 | **Read-aloud** button on key screens and office replies. | §19.6 | B7.12 |
| F7.10 | Better map clustering and heatmaps; **dark mode**. | §4.3, §7.2 | B7.11 |
| F7.11 | P3 illustrations (4, not generated yet) for consultations, check-ins and channels. | §31 UI bar | — |
| F7.12 | E2E scenarios 16–17 (§21.3) and Release 1.1 KPIs in office analytics. | §21.3, §3.3 | B7.13 |

---

## Phase 8 — Release 2

| # | Task | Masterplan | Backend |
|---|---|---|---|
| F8.1 | Budget and expenditure transparency pages, each figure with its source document. | §4.4 | B8.1 |
| F8.2 | "Officially registered" referral display with external tracking link where an agency integration exists. | §4.4 | B8.2 |
| F8.3 | Assisted reporting mode for volunteers and kiosks (shared device, on-behalf-of consent, auto sign-out). | §4.4 | B8.3 |
| F8.4 | Open-data portal pages with download and licence. | §4.4 | B8.4 |
| F8.5 | Regional administration views. | §4.4 | B8.5 |
| F8.6 | Participatory budgeting flow where an office controls a real budget. | §4.4 | B8.6 |
| F8.7 | Right to Information helper (draft, then link to the official channel). | §4.4 | B8.7 |
| F8.8 | MP activity pages from official records with plain-Bangla summaries, never a score. | §4.4 | B8.8 |
| F8.9 | Second-locale UI pass for the next country adapter. | §2.8.4 | B8.10 |

## Illustration map

Home hero: `hero-mobile` / `hero-desktop`. Categories: `cat-*` (12). Report steps: `spot-speak-or-type`, `spot-report-sent`. Status: `spot-in-progress`, `spot-resolved`, `spot-need-info`. Engagement: `spot-me-too`, `spot-follow`, `spot-rate`, `spot-idea`, `spot-ask-mp`, `spot-find-mp`. Onboarding: `onboard-1/2/3-*`. Empty: `empty-no-reports`, `empty-no-results`, `office-empty-inbox`, `office-all-done`. System states: `state-offline`, `state-error`, `state-not-found`, `state-maintenance`, `state-no-access`. Brand: `logo-mark`, `app-icon`, `share-image`.

## Definition of done (every task)

Works at 375px and 1280px, Bangla and English, all relevant states, keyboard and screen-reader usable, no hard-coded strings, no private data in public views, unit test where logic exists, screenshot checked in the browser.

## Phase 1 status (16 Nov)

All nine Phase 1 tasks are built. Checks: `npm run lint`, `npm run typecheck`, `npm test` (Vitest + Testing Library: StatusChip, LoginForm, ReportForm, guard, colour contrast), `npm run test:e2e` (Playwright at 375px and 1280px: smoke, axe serious/critical on public pages, keyboard focus). CI runs all of them (`.github/workflows/ci.yml`).

Not covered yet: screen-reader pass (TalkBack/VoiceOver) and axe on signed-in pages (`/report`, `/office`) — need a test Supabase session; planned for Phase 3.

## Phase 2 status (16 Nov)

All 13 Phase 2 items are built; each commit message ends with its task number. Backend gaps are marked in code and listed here. Everything that stands in for missing backend data is labelled "নমুনা / Sample" or "ডেমো" on screen, and device-local stubs say so.

| # | Built | Real data today | Stub or gap (needs backend) |
|---|---|---|---|
| 2.1 | `/area` Explore: list/map tabs, search, category/status/date filters, sort, MapLibre clusters, "data last updated", approximate positions | cases from `listCases` (list only, no coordinates) | public coordinates and "me too" counts on cases; sample rows (12) give the map content |
| 2.2 | Report location step: area search, tap-to-place pin, current location on click only, manual fallback | area text | `lat`/`lng` are sent in the POST body but `CaseInput` drops them; add them to the schema |
| 2.3 | Voice intake: live transcript, stop, bn-BD, denied/silence/network/unsupported states | browser speech API | none (server STT is a backend sprint-2 item) |
| 2.4 | `/ideas`, `/ideas/new`: tabs, search, category, status labels, similar ideas, one support per idea | none | ideas table and endpoints; support and submit are device-local |
| 2.5 | `/mp` Find your MP, no account | none | verified representative and constituency data per area; sample reps and wards |
| 2.6 | `/mp/[id]`, `/mp/method` profile and responsiveness | none | verified profiles, announcements, response counts API |
| 2.7 | me-too with count, follow issue/area/categories, rating, reopen, appeal | none | endpoints for support, follow, rating, reopen, appeal; all device-local |
| 2.8 | `/ask`, `/ask/inbox` | none | messages API with rate limit; device-local, sample FAQ |
| 2.9 | Home feed from follows, `/notifications` | none | feed and notifications API; items are sample |
| 2.10 | WhatsApp/Facebook links, Open Graph metadata, `share-image.png` | case title, category, area | set `NEXT_PUBLIC_SITE_URL` in staging/production |
| 2.11 | `/welcome` onboarding, `/settings`, `/help`, `/privacy` | none | privacy text is a draft needing legal review |
| 2.12 | Office overview, case table, copilot, notes/public reply split, assignment, escalation, `/office/announcements` | counts by status and date | priority, assignee, targets, ratings, reply-draft AI, notes/replies/assignment/announcement endpoints |
| 2.13 | `/admin`, verification, moderation, AI log, `/admin/stats` | counts from real cases | verification/moderation queues, AI run table; admin role is checked by `guardAdmin` |

Shared pieces: Phase 2 strings are in `src/lib/strings/*` (bn and en keys are type-checked equal, plus `tests/unit/i18n.test.ts`); sample data in `src/lib/sample.ts`, `mp.ts`, `admin.ts`; `useLocalValue` (localStorage-backed shared state) powers every device-local stub; the map worker is vendored in `public/vendor` (see its README).

Checks: `npm run lint`, `npm run typecheck`, `npm test` (79 tests), `npm run test:e2e` (mobile 375 and desktop 1280, axe on every new public page). Not covered: axe on signed-in office and admin pages, screen-reader pass (Phase 3).

## Phase 3 status (16 Nov)

All seven Phase 3 items are built; each commit message ends with its task number. Full report and evidence: `docs/aibc/phase3-audit.md`.

| # | Built | Blocked or needs someone |
|---|---|---|
| 3.1 | axe WCAG 2.2 AA on 14 screens x bn/en x 375/1280 with zero violations; 200% and 400% reflow; reduced motion; keyboard focus run. Signed-in screens are audited through labelled demo screens at `/dev/screens/<name>` | TalkBack and VoiceOver pass needs a person with devices: `docs/aibc/screen-reader-checklist.md` |
| 3.2 | First-load JS for `/` 315 to 149 KB gzip; map, Supabase and Zod kept out (tested); Lighthouse mobile 3G 98 to 100 | Margin is 1 KB; default simulated Slow-4G profile scores 86 |
| 3.3 | Offline report queue (saved on the phone, sent when back online, visible in My Reports), versioned service-worker cache, per-route error boundaries | Backend: idempotency on `POST /api/cases` (key already sent) |
| 3.4 | Glossary, status and category labels aligned with section 19; automated language tests; Dhaka-time Bangla dates; review sheet | **Native-speaker review not done** (`docs/aibc/language/strings-review.csv`) |
| 3.5 | Golden path, staff approval, role denial, offline, budget, security suites; 22 visual baselines | Linux CI skips visual tests until baselines are created there (`VISUAL=1 ... --update-snapshots`) |
| 3.6 | `npm run check:bundle` (in CI), photo type by content and size limit, safe links, XSS test, CSP builder with zero violations | Backend: send the CSP and the other headers (`docs/aibc/security-ui.md`) |
| 3.7 | Audit report, screenshots, axe and Lighthouse results in `docs/aibc/` | none |

Things to know:
- **Strings in client components** now come from `I18nProvider` (root layout, `useT()`), not from importing `dict`. Never import `dict` into a client component: it puts both languages (about 29 KB gzip) back into the first-load bundle. Format helpers live in `lib/format.ts`; the category list in `lib/categories.ts` (also re-exported by `types.ts`).
- `/dev/screens/<name>` (report, issue, issue-long, issue-xss, office, case, case-long, announcements, admin-verification, admin-moderation, no-access-*, boom) needs `NODE_ENV !== production` or `JK_AUDIT=1`. Playwright's own server sets it; never set it in staging or production.
- Shared files touched: `next.config.ts` (build id for the service-worker cache), `package.json` (`check:bundle`), `.github/workflows/ci.yml` (build and bundle scan before e2e), `src/lib/types.ts` (re-exports `CATEGORIES`). Tell the backend owner.
- Fixed in the language commit: the I18nProvider introduced in 3.2 crashed English pages (server render asked for the Bangla strings); new tests render every page in both languages.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:bundle`.

---

## Masterplan alignment (added 2026-11-16)

Full requirement map: `docs/masterplan-coverage.md`. The backend finished its Phase 2 (`docs/api-v1.md`), so the biggest open frontend job is replacing stubs with real endpoints. Items below were in the masterplan but in no phase above.

### Phase 3 additions (13–20 Dec)

| # | Task | Masterplan | Done when |
|---|---|---|---|
| F.1 | **Wire to the real API**, one screen at a time, deleting the stub and the "নমুনা" label as each goes live: `/area` and map (public coordinates, me-too counts), report (`lat`/`lng`, media upload with signed URLs, `Idempotency-Key` on submit and on the offline queue), `/ideas` (support, comments, similar), `/mp` and `/mp/[id]` (lookup, responsiveness), engagement (affected, follows, feedback, reopen, appeal), `/ask`, home feed (`/me/feed`, `personalized=false` toggle), `/notifications`, office (assign, notes, replies, announcements, duplicates, copilot suggestions with Accept/Edit/Dismiss), admin (verification, moderation, AI runs, stats, audit). Replace `useLocalValue` stubs with TanStack Query mutations. Keep the sample data only behind the audit and demo screens. | §4.2, §25 | A citizen can submit a real test issue and a staff user processes it with an auditable status update on staging (§25 completion test) |
| F.2 | **E2E scenarios 1–15 of §21.3** as Playwright specs against local Supabase with the six test accounts: register and constituency, report with pin and photo, timeline, office acknowledge and assign, public update vs private note, forward, resolve with evidence, feedback and reopen, idea submit and support, unauthorised private read, Office A cannot see Office B, moderator abuse and appeal, find MP signed out, "me too" counted once per account with follow-up notification, rate then appeal. Axe on signed-in office and admin pages with a real session. Linux visual baselines created in CI. | §21.3 | All 15 pass at 375 and 1280 |
| F.3 | **Device and network matrix** (§21.4): record results in `docs/aibc/device-matrix.md` for low-end Android, current Android Chrome, iOS Safari in browser and as PWA, desktop Chrome, Firefox, Safari, Edge; slow 3G; location and camera permission denied; large or invalid upload; offline draft; Bangla input and font rendering. | §21.4 | Table filled with date, device, result, issues |
| F.4 | **MFA enrolment UI** for MP, moderator and admin (TOTP QR, code entry, recovery codes shown once, AAL2 step-up prompt before privileged pages); depends on backend M.6. | §5, §18.1 | Admin pages ask for a code; denied state tested |
| F.5 | **Emergency guidance UI**: persistent but quiet "জরুরি হলে ৯৯৯" note on report, ask and help pages; when the backend flags imminent harm, show the guidance screen instead of the normal success flow; official-channel disclaimer wording on issue pages ("referred" vs "officially registered"). | §17.8, §21.6, §28 | Screen reachable and checked in bn and en |
| F.6 | **Privacy, terms, takedown**: render the final notice from backend M.9 (easy-Bangla summary on top, full text, English), terms page, consent prompts that explain what is public before submission, data export and deletion requests in Settings (consents, export, deletion routes exist), content-challenge form. | §18.2, §18.3 | No draft banner left; legal text matches backend |
| F.7 | **Public metric definitions**: every public number (counts, median time to first answer, responsiveness) shows date range, last-updated and a "how this is calculated" link; never ranks MPs. Office analytics views for the KPIs in backend M.11. | §22, §3.3 | Each metric has all three elements |
| F.8 | **Frontend release gates** (§21.6, §29 UX): add to CI or a manual checklist: no private data in public pages (probe), no keys in bundle (exists), Bangla and English tested, keyboard and screen-reader checks (needs a person), empty, error and offline states present on every screen. Output to `docs/aibc/phase3-audit.md`. | §21.6 | Checklist all ticked or listed as open |
| F.10 | **Push on the client**: service worker fetches `/api/v1/me/notifications` on a payload-less push, opt-in and quiet-hours controls in Settings, no sensitive text in notification previews. | §15 | Works on Android Chrome with VAPID keys |
| F.11 | **Comments on ideas and "report content"** buttons on issues, ideas and questions wired to moderation; comment list with states. Verify these exist in the UI; build if missing. | §4.2, §7.5, §7.7 | Visible and tested |

### Competition and demo (Phase 4, 21–25 Dec)

| # | Task | Done when |
|---|---|---|
| F.9 | **Demo kit**: one-click demo citizen and demo office sign-in on staging only (env-gated, absent in production build); "ডেমো" labels on all seeded data; scripted reset; backup screen recording of the golden path on the real demo phone; offline-safe screenshots; printed one-pager with the architecture diagram; slides stored locally. Presenter owns the Q&A sheet (`docs/aibc/qa.md`, backend drafts the content). | Rehearsed to time with every role clear |
| F.12 | **Final video support**: update `docs/aibc/video-script.md` to the §2.5 timeline (problem 0:30, solution 1:00, demo 2:00, AI approach 2:30, impact 3:00) and label any mock step on screen. | Script matches rubric table |

### Definition of done additions

Every screen that shows data states whether it is live, sample or demo; no screen ships with a device-local stub after F.1 except the audit screens. Every public number has its definition. Every outward action keeps a confirm step and a note where the masterplan requires one.

### F.1 progress (wired to /api/v1)

| Screen | Status |
|---|---|
| Report (`ReportForm`) | **Live.** `POST /api/v1/issues` with `Idempotency-Key` (one key per report, reused by the offline queue), `lat`/`lng`/`locationSource`, TanStack Query mutation, photos uploaded after submit (`POST /issues/{ref}/media`, multipart: the backend takes the file itself, not a signed upload URL; signed URLs are for reading), `emergency` guidance shown on the success screen. "Photos are not sent" note removed. |
| `/area` and map | **Live.** `GET /api/v1/issues` with cursor paging ("show more"), server-side category and date filters, approximate `location`, `affected_count`. Sample banner shows only if the API returns `is_sample` rows. |
| `/ideas`, `/ideas/new` | **Live.** `GET /ideas` (area from the constituency cookie, category filter, cursor paging), support `POST/DELETE /ideas/{ref}/support` with the server's count, submit `POST /ideas` with Idempotency-Key (form parts joined into one labelled body, cost estimate included as text), similar ideas from `GET /ideas/new/similar`, pending-review and personal-data-removed notices. Gap: the API does not say whether *I* supported an idea, so this device remembers it only to label the button. Status mapping: published = open, declined = "not planned". Idea list shows no area name (the item has only a constituency key). |
| `/mp`, `/mp/[id]` | **Live.** `GET /representatives/lookup` by typed area or by location (explicit click), more than one area asks to confirm; profile from `GET /representatives/{id}` (each contact field shows its check date and source host) plus `GET /constituencies/{key}/responsiveness` (period, median in hours or days, fetch time). Home's representative card now links only to `/mp` (F5.2 wires it). |
| Everything else (engagement on issues, follows, `/ask`, feed, notifications, office, admin) | Still device-local stubs, next in F.1. |

Known gaps: offline-queued reports keep the text only (photos live in memory, not in storage); the full emergency screen is F.5; "data last updated" on `/area` is the fetch time because the list has no `updated_at`; status filter and text search work on the loaded pages only. Playwright could not be run here (no Supabase env); unit tests, typecheck, lint and `next build` + `check:bundle` pass.
