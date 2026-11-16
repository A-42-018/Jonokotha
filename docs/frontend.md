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
| Issue engagement (`IssueActions`, `ResolutionFeedback`, follow area on `/area`) | **Live.** "Me too" `POST/DELETE /issues/{ref}/affected` (count from the server; the reporter gets a clear message), follow issue and area via `GET/POST/DELETE /me/follows` (`useFollows`), feedback `POST /issues/{ref}/feedback` (an already-sent rating shows as saved), reopen and appeal `POST /issues/{ref}/reopen` (one route: the server decides), report content `POST /reports` (reason mapped to the moderation reasons). Signed-out visitors see sign-in links. Gaps: the API does not say whether *I* pressed me-too or sent feedback, so this device remembers it to label the button; the home feed (`FollowedFeed`) still reads device-local follows until the feed task; `/area` follows the sample key `demo-1`, not the chosen constituency; appeal is only reachable from the resolved-issue card (a rejected issue has no card yet). |
| `/ask`, `/ask/inbox` | **Live.** `POST /questions` (Idempotency-Key; the topic becomes the first line of the body because the API has no topic field), emergency guidance shown from the server's `emergency` object, 429 shows the limit message; inbox from `GET /me/questions` with status, thread (`GET /questions/{ref}`) and follow-up (`POST /questions/{ref}/messages`). The two FAQ entries are still static sample content, labelled. |
| Home feed, `/notifications` | **Live.** Feed from `GET /me/feed` (followed first, then newest, never by popularity), "why am I seeing this" on every item, category follows through `/me/follows`, personal ordering can be switched off (`personalized=false`, remembered on this device); signed-out visitors get a sign-in card. Loaded lazily so TanStack Query stays out of the home page's first-load JS. Notifications from `GET /me/notifications` with server read state, mark one and mark all read, link by type; the text is the generic text the API sends. Gaps: no unread count in the header yet (`x-unread-count`), no push opt-in (F.10). |
| Office: case page, queue, announcements | **Live.** Internal notes and public replies via `POST /office/issues/{ref}/update` (a public reply asks for confirmation first; both lists come from `GET /office/issues/{ref}`), "assign to me" via `/assign` (also as bulk assign from the queue, one request per case, partial failure reported), status buttons on `/api/v1` (acknowledge keeps the note as an internal note; request information and resolve send the note as the citizen-visible message; forwarding still uses the legacy approve route that picks the suggested agency), announcements `POST /office/announcements` (confirm first) with the list from `GET /announcements` and withdraw. Copilot: "Get AI suggestions" calls `/copilot`, `/routing` and `/duplicates`; each suggestion shows its cited facts, a "rule-based, not AI" label for the fallback, and Accept / Edit / Dismiss through `/ai/suggestions/{id}/decision`; nothing decides before suggestions exist. Gaps (backend): no staff directory, so assigning to a colleague is not possible and the queue cannot show or filter by assignee; escalation, saved-filter sync and priority have no endpoint, so the escalation stub, the assignee column and the sample staff list were removed; announcements use the constituency cookie (the office's own area should come from the staff membership); an accepted routing suggestion is not applied (forward still picks the agency itself). |
| Admin: moderation, verification, AI runs, audit, stats | **Live.** Moderation queue from `GET /admin/moderation` (excerpts of public content only): reported items can be dismissed or hidden, ideas and public questions waiting for first review can be published or rejected, every decision needs a reason and goes to `/admin/moderation/items` or `/review`; the local audit list is gone. Verification is a form (`POST /admin/representatives/{id}/verify`, a source link is required to verify). AI runs from `GET /admin/ai/runs` (metadata only). New `/admin/audit` from `GET /admin/audit`. `/admin/stats` adds the platform KPIs from `GET /admin/kpis` (definition on each, small groups hidden, never shown as zero) and the hotspot map now uses public issues at approximate positions. The sample banner and sample review/AI-run data are removed. Gaps (backend): no list of representatives waiting for verification, so the form needs the id; "request edit" and "escalate" have no endpoint and were removed; AI runs show no per-run issue reference or confidence. |
| Still device-local on purpose or not yet wired | Settings and onboarding (`SettingsPanel`, `Onboarding*`: language, notification choices, privacy actions are F.6 and F.10), saved queue filters, the offline report queue (this is the design), the "did I press me too / support" button hints, the feed ordering switch, and the two static sample FAQ entries on `/ask`. `lib/sample.ts`, `lib/mp.ts` and `lib/places.ts` still hold sample data used by the audit screens, the location search in the report wizard (`places.ts`) and unit tests. |

Known gaps: offline-queued reports keep the text only (photos live in memory, not in storage); the full emergency screen is F.5; "data last updated" on `/area` is the fetch time because the list has no `updated_at`; status filter and text search work on the loaded pages only. Playwright could not be run here (no Supabase env); unit tests, typecheck, lint and `next build` + `check:bundle` pass.

### F.2 progress (real-stack e2e, written 2026-11-16, not yet run)

`tests/e2e/real/` holds scenarios 1-15 of §21.3 plus axe on signed-in screens, on the real `/api/v1` and a local Supabase, no mocks, at 375 and 1280px. Run with `npx supabase start` then `npm run test:e2e:real` (`scripts/e2e-real.mjs` reads `supabase status`, refuses a non-local URL, starts its own Next server with the local keys). Without `E2E_REAL=1` the specs skip, so `npm run test:e2e` and CI are unchanged.

| File | Covers |
|---|---|
| `lifecycle.spec.ts` | 1 register by email code (Mailpit on :54324) and pick constituency; 2 report with pin and photo; 3 reference and timeline; 4 acknowledge and assign; 5 public update vs private note; 6 forward with external reference; 7 resolve with evidence; 8 feedback once, reopen |
| `community.spec.ts` | 9 idea submit (moderator publishes) and support once; 14 me-too once per account, follower is notified; 15 rate, appeal, cannot close from reopened |
| `access.spec.ts` | 10 private data unreadable (API, public key, office page); 11 Office A vs B both ways; 12 abuse report, hide, contest, restore, audit; 13 find MP signed out |
| `axe.spec.ts` | citizen, office and admin pages with a real session, bn and en |

The six accounts are made per run through the Supabase admin API (`support.ts`, `buildWorld`) and removed afterwards; the session cookie is built with `@supabase/ssr` so the app sees a normal sign-in. Office A uses the sample constituency `demo-1` because the UI picker only offers that one; office B gets its own.
Notes: scenario 12's "appeal" is the moderator reversing a hide with a reason, because no endpoint lets an author contest a hidden item yet (F.6 content-challenge form). Linux visual baselines are still created in CI only. These specs were typechecked and linted but could not be executed in the authoring environment (no Docker), so expect to fix selectors or response shapes on the first real run.

### F.4 progress (two-step sign-in)

`/mfa` (`MfaPanel`): first time it links an authenticator (`supabase.auth.mfa.enroll`, QR plus typed secret, `challengeAndVerify`), afterwards it only asks for the code. Clearing a stuck unverified factor is automatic. Step-up: `guardStaff` and `guardAdmin` send a staff or admin session that `mfa_ok()` rejects to `/mfa?next=<page>` (the database decides, so there is no second copy of the `enforce_mfa` flag), and `api-client.ts` does the same when any `/api/v1` call returns 403 `mfa_required`. After a good code the person returns to the page they wanted. Strings in `strings/mfa.ts` (bn/en). Wrong code, rate limit and "TOTP not switched on" each have their own message.
- **Recovery codes are not built**: Supabase TOTP has no recovery codes, so inventing a list would be false comfort. The screen says what happens if a phone is lost (an administrator removes the factor after checking identity). If the masterplan needs codes, the backend must add a table and routes first.
- Shared file touched: `supabase/config.toml` now has `[auth.mfa.totp]` enabled (`enroll_enabled`, `verify_enabled`), needed locally and in the hosted project (Pro plan, see `permission-matrix.md`). `enforce_mfa` stays false until the backend turns it on.
- Tests: `tests/unit/mfa.test.tsx` (enrol, wrong code, already linked, switched off, lost phone, URL helpers). Real-stack spec `tests/e2e/real/mfa.spec.ts` (plays the authenticator with RFC 6238) runs alone with `npm run test:e2e:real -- --mfa` because it flips `enforce_mfa` for the whole database; written but not yet run (no Docker here).

### F.5 progress (emergency guidance)

- **Guidance screen** (`EmergencyGuidance`): when `POST /issues` or `POST /questions` returns an `emergency` object, the report form and the ask form show it instead of the normal success flow: the server's fixed `guidance[lang]` text as given (never rewritten), one large tap-to-call link per number (999, 109, 1098), the honest line that this is not an emergency service, and the reference number. "View my report" / "View my questions" continues to the normal screen, which keeps the guidance banner.
- **Quiet note** (`EmergencyNote`, "জরুরি হলে ৯৯৯-এ ফোন করুন।" with a link to `/help#emergency`) on `/report` and `/ask`; `/help` already has the emergency card, now with the anchor `#emergency`.
- **Issue pages**: every issue page says Jonokotha is not an official channel and that "sent" is not a registration; a referred issue adds "do not treat it as registered with the authority until it gives its own reference" (`isOfficialNote`, `isReferredNote`). F5.6 will extend the wording for "officially registered".
- Tests: `tests/unit/emergency-ui.test.tsx`; `tests/e2e/emergency.spec.ts` (mocked API like the golden path; 8 pass at 375 and 1280, bn and en, axe clean on the guidance screen).
- Gap: the draft step still calls the legacy `/api/intake`, which does not return `source: "emergency"`; moving it to `/api/v1/ai/intake` would also show the guidance before submitting. Strings are a draft for native-speaker and safety review (with the backend's guidance text).
- Unit tests under load: on this machine a full `npm test` while a dev server runs can time out 2-3 of the heavy component tests (they pass alone); not a logic failure.

### F.6 progress (privacy, terms, takedown, my data)

- **Pages**: `/privacy` (easy-Bangla summary on top, then the detail cards), `/terms` (terms plus the takedown section), `/challenge` (content-challenge form). Text follows `docs/aibc/privacy-notice.md` and `terms.md`; strings in `strings/legal.ts` (bn/en, checked by the language tests). The draft banner is gone, but legal review is not done: each page shows the version (`POLICY_VERSION` in `lib/legal.ts`) and says review is pending. Bump the version when the text changes. The operator name, address, retention periods and the children policy are still undecided, so the pages say "not decided yet" instead of printing `[placeholders]`.
- **Settings > my data** (`DataRights`): download (`GET /me/export` saved as `jonokotha-my-data.json`, 429 message), delete-account request behind a confirm (`POST /me/deletion-request`), pending date from `GET /me/profile` with cancel (`DELETE`), privacy-notice consent give or withdraw (`POST /me/consents`, `consent_type: privacy_notice`, current version; an older version is shown as "agreed earlier"). Signed-out visitors get a sign-in prompt.
- **Before sending**: `PublicNotice` on the report review step, new idea, and public questions says what becomes public and that sending accepts the notice and terms. It is a notice, not a tick box; acceptance is recorded only from Settings.
- **Content challenge gap (backend)**: no endpoint lets an author contest hidden content. The form checks the reference and reason, then prepares the text and hands it over by `mailto:` when `NEXT_PUBLIC_SUPPORT_EMAIL` is set, otherwise by copy, and says so. Needs a route plus a moderator queue entry before the form can submit inside the app.
- Not done: legal text matching backend M.9 once counsel signs off; settings still do not sync notification choices to `/me/notification-preferences` (F.10).
- Tests: `tests/unit/legal.test.tsx`.

### F.7 progress (public metric definitions)

- **`/metrics`** defines every public number (received, answered, waiting, median time to first answer, "me too", issues in an area): meaning, which period, limit. The page also says no MP is ranked and that small groups are hidden, never shown as zero. Ids and the list live in `lib/metrics.ts` (`PUBLIC_METRICS`); strings in `strings/metrics.ts`.
- **`MetricNote`** (period, updated, "how this is calculated" link to `/metrics#id`) is on `/area` (issue count, period from the date filter, updated = fetch time) and on the "me too" count (period "since the report was sent", updated = fetch time). The representative profile already showed period and fetch date; its link now also points to `/metrics#median`. Admin platform KPIs link to `/metrics` next to their own period and definition.
- **Office indicators** `/office/kpis` (`OfficeKpis`, `GET /office/kpis?constituency=&days=30`): all eight M.11 metrics, each with the server's definition, hidden when the group is under the minimum size, copilot comparison labelled as an association. A 403 or 404 says the person may not see it (office managers and the MP only). Linked from the office overview.
- Gaps: the server's KPI definitions are English only (shown with `lang="en"`, as on the admin page); `/area` "updated" is the fetch time because the list has no `updated_at`; the responsiveness card's `note` and `method_url` from the API are not shown.
- Tests: `tests/unit/metrics.test.tsx`. `/terms`, `/challenge`, `/metrics` were added to `tests/e2e/a11y.spec.ts`; Playwright could not be run here (no Supabase env or Docker), so those axe checks have not run.

### F.8 progress (release gates)

`tests/unit/release-gates.test.ts` (fallback screens exist, every data component has error and empty states, no server-only env var in client code, bundle scan in CI) and `tests/e2e/release-gates.spec.ts` (private-data probe on 13 public pages in bn and en, guarded pages redirect). Checklist with open items (screen reader, device matrix, real-stack run): `docs/aibc/phase3-audit.md`.

### F.10 progress (push on the client)

- **Service worker** (`public/sw.js`): on a payload-less `push` it asks `GET /api/v1/me/notifications?unread=true&limit=1` for the `x-unread-count` header and shows one fixed alert ("জনকথা · Jonokotha", "নতুন খবর আছে · There is news", with the count when more than one). Nothing from the API response is put in the alert, so a lock screen never shows report text, a name or a reference. If the call fails (signed out, offline) the generic alert still shows, because browsers require one. One tag, so a new push replaces the old alert. A tap opens `/notifications`.
- **Settings** (`PushSettings`, `lib/push.ts`): "Turn on push" asks for permission only on the button, reads the key from `GET /notifications/vapid-key`, subscribes, `POST /me/push-subscriptions`, then sets `channels.push` in `/me/notification-preferences`. Turning off unsubscribes and calls `DELETE`. Quiet hours (from, to, may cross midnight) are saved to `quiet_hours`; the server delays push and email, never the in-app item. Separate messages for: not supported, blocked in the browser, no VAPID key on the server, signed out, preferences failed to load (retry). The old disabled "coming soon" checkbox is gone.
- Not changed: the three device-local notification checkboxes (status, reply, area) still live on the phone only; the API has `muted_types` per notification type, which would be the place to sync them. Email channel has no control yet.
- **Not verified on a real phone.** Unit tests (`tests/unit/push.test.tsx`, 13) cover the worker's push and click handlers, the subscribe, deny, unavailable, unsupported, turn-off, quiet-hours and load-error paths against a faked browser. Working on Android Chrome with VAPID keys still needs a person: generate keys with `node scripts/gen-vapid.mjs`, set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, use a production build over HTTPS (the worker registers only in production), run the delivery job.

### F.11 progress (comments on ideas, report content)

- **Report content** was only on issue pages. It is now one shared component (`ReportContent`, `POST /api/v1/reports`) used on issues, on every idea card and on every public question. One reason is required, the note is optional, a second report of the same item says "you already reported this" (409), the daily limit has its own message (429), and signed-out visitors get a sign-in link instead of a button that cannot work. The old thanks text said review was "not live yet"; it is live, so the text now says the report went to a moderator.
- **Public questions**: `/ask` now lists them (`GET /api/v1/questions`, approved by a moderator, no asker identity), each with a report button. Loading, empty, error-with-retry and "more" are all handled. Before this, no screen showed another person's public question, so there was nothing to report.
- **Comments on ideas** (`IdeaComments`, `lib/comments-api.ts`): a "Show comments" toggle on each idea loads the list only when opened. States: loading, empty, error with retry, published, "waiting for review" (author only, with a badge), "removed by a moderator" (the text is never shown), more, signed-out sign-in link, and a post form (3 to 1000 characters, Idempotency-Key, 429 message, personal-detail removal note). A new comment is shown to its author as waiting for review.
- **Backend gap (needs the backend owner):** there is no comments route or table. `docs/api-v1.md` has no `/ideas/{ref}/comments`, and `POST /reports` accepts only `issue | idea | question | media`. The UI is written to the contract in `lib/comments-api.ts` (`GET` and `POST /ideas/{ref}/comments`; a comment has `id, body, status published|pending_review|hidden, created_at, mine`). Until that route exists the toggle shows "comments are not switched on at this server yet" (a 404 is read as that, not as a failure). Reporting a single comment needs `comment` added to the report types; it is not offered yet. Moderators also need comments in `/admin/moderation`.
- Tests: `tests/unit/community.test.tsx` (14), `engagement.test.tsx` updated (signed-out issue page now has a third sign-in link, for report). Not tested against a real server for the reasons above. Production build and `check:bundle` pass; `/ask` added to the release-gate probe.

### Handover: tests the backend engineer must run in Docker (written 2026-11-16)

Docker was not available on the frontend machine, so these were never executed. Please run them against a local Supabase (`npx supabase start`) and send back failures.

1. `npm run test:e2e:real` (F.2: scenarios 1-15 of §21.3, axe on signed-in office and admin pages). Expect to fix selectors or response shapes on the first run; the specs were only typechecked and linted. Files: `tests/e2e/real/`.
2. `npm run test:e2e:real -- --mfa` (F.4: `mfa.spec.ts`, flips `enforce_mfa` for the whole database, so it runs alone).
3. `npx playwright test tests/e2e/a11y.spec.ts` with the API running (pages that call the API cannot reach network-idle without it).
4. F.10 push: set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (`node scripts/gen-vapid.mjs`), build for production over HTTPS, opt in from Settings on Android Chrome, run the delivery job, check the alert shows only "There is news".
5. F.11 backend gap: add `GET/POST /ideas/{ref}/comments` (contract in `src/lib/comments-api.ts`), add `comment` to the `POST /reports` types, and list comments in `/admin/moderation`.

## Phase 5 progress (started 2026-11-16)

### F5.13 progress (capability labels)

- **What is live**: `lib/capability.ts` defines the four states (`live`, `sample`, `demo`, `planned`), reads the server's `data_status` when it is sent, falls back to the older `is_sample` / `is_demo` flags, and says "live" otherwise. `CapabilityLabel` (silent for live, icon plus text for the rest, never colour alone) replaced the hand-made "Sample" badges on the area map, home feed, ideas, public questions and MP cards. `PlannedPanel` is text only (no button, input or link) and is what every later task uses where the backend item does not exist. `FEATURES` in `lib/capability.ts` lists what this client knows the server lacks (polls, consultations, staff directory, author contest, MFA recovery codes, comment reports), each with the backend item that switches it on.
- **Controls that looked functional and were not**: the home "Share an idea · coming soon" button was a disabled button although `/ideas/new` works since F.1: now a link. The header bell opened a "coming soon" panel although `/notifications` is live: now a plain link. The stale strings were removed.
- **Stubbed**: nothing. `data_status` is not sent by the API yet, so only `is_sample` rows are labelled. The home representative card is still labelled sample until F5.2 replaces it.
- **Backend gap (B5.13)**: add `data_status` (`live|sample|demo|planned`) to list and detail items and to a feature-flag endpoint. When it arrives nothing in the UI changes except that `demo` and `planned` start to show.
- **Tests**: `tests/unit/capability.test.tsx` (9: status reading, label per state in bn and en, panel has no controls, no hard-coded disabled button or "coming soon" on a control anywhere in `src`). Full `npm test`: three heavy component tests (ask, admin moderation, office notes) time out when the whole suite runs together on this machine, as noted under F.5; they pass alone.

### F5.6 progress (referral wording)

- **What is live**: `ReferralStatus` shows three separate steps on the public issue page and on the office case page: received by the MP's office, forwarded to the authority, officially registered by the authority. The first two come from the timeline (and the referral row when the session may read it); the third says "not confirmed" after forwarding and "not yet" before it. It turns to "done" only when the server sends a `registered` proof record (B5.4 contract in `lib/referral.ts`: `registered: { at, proof_url }`); an office-typed reference number is shown labelled "written by the office, not confirmed by the authority" and never counts. The proof link goes through `safeHref`. Staff see a reminder not to promise registration; the office confirm text for "refer" now says this does not mean the authority registered it. Existing notes (`isOfficialNote`, `isReferredNote`) stay.
- **Data source today**: `readReferral` reads `issue_agency_referrals` through the session, so the reporter sees destination, date and office reference on their own issue when the office marked the row `public` (existing RLS), staff see their office's rows, everyone else sees the steps without a destination ("not shown").
- **Backend gaps (B5.4)**: no `stage` field on referrals and no `officially_registered` record, so "registered" can never show as done yet; the public `GET /issues/{ref}` does not expose a publishable referral to people other than the reporter. Needed: referral stage and proof in the API, and a public view of destination plus reference when `visibility = public`.
- **Tests**: `tests/unit/referral.test.tsx` (12: stage rules incl. "forwarded never implies registered", proof link safety, bn and en, issue page). Not run in a browser: no 375/1280 screenshot or axe pass yet for this card (it reuses Card and Badge, which are already axe clean).

### F5.3 progress (report and issue detail)

- **Report form**: two optional selects on the describe step, "how long" (today, days, weeks, months, a year or more) and "who is affected" (me, family, neighbours, many, children or school, older or sick, unknown). They are saved with the draft, shown on the review step and added to the end of the description as one labelled line (`lib/report-extras.ts`), because the API has no fields for them and rejects unknown keys. The person's own text is now limited to 1900 characters so the sent text always fits the API's 2000. Both are optional and the note under them says what happens.
- **Photos**: while sending, the button shows "Sending photos: 2 of 3 done". Photos that fail are kept in memory and the success screen offers "Send the remaining photos again", saying how many are left and when all are through (`uploadPhotosTracked`). Photos still go after the report is created, because the media route needs the reference.
- **Video**: not built. The evidence step shows a "not switched on yet" panel (`PlannedPanel`) and the file input accepts images only.
- **Issue page**: "Photos of the work" (`ProgressEvidence`, `GET /issues/{ref}/media`, only photos the office approved for public display, with loading, empty, error and retry states; each photo has a report button, type `media`); "Add more information" (`MoreInfo`, `POST /issues/{ref}/additional-information`) only while the issue is waiting for information, sign-in link for signed-out visitors; forwarding destination, date and the office's own reference come from F5.6. The three-step label (received, forwarded, registered) is the F5.6 card.
- **"Still happening"**: no endpoint, so there is no button. Signed-in visitors see a "not switched on" panel that points to "Me too".
- **Backend gaps**: B5.6 fields `duration`, `affected` and a video route (type and size limits, poster frame); a "still happening" action; the public issue API does not expose the forwarding destination to people other than the reporter (B5.4); the idea-style abuse report on a single photo needs a moderator view of media (type `media` is accepted by `POST /reports`).
- **Tests**: `tests/unit/report-extras.test.tsx` (11). Golden-path e2e passes serially (12 at 375px); in a parallel run on this machine 6 e2e tests time out while the dev server compiles, and pass alone. Unit test timeout raised to 20 s in `vitest.config.mts` (the heavy component tests failed at 5 s when the whole suite ran together; all 487 pass now). Not run: axe on the new report fields and the issue page cards, 1280px screenshots.
