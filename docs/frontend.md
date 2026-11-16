# Frontend implementation plan — Jonokotha (জনকথা)

Owner: `frontend` branch. Source of truth: `masterplan_JONOKOTHA.md` (§6 navigation, §7 UX, §19 language and accessibility, §20 performance). Backend contract: see `docs/WORK_SPLIT.md`.

Phases follow the sprints (§24). Dates are 2026.

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

## After the Congress (Release 1.1, §4.3)

Consultations with consensus map, WhatsApp/SMS entry points, citizen project check-ins, for/against points on ideas, support thresholds, P3 illustrations (4, not generated yet).

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
