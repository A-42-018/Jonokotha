# Phase 3 audit report: production hardening

Date: 2026-11-16. Build: production (`next build`, `next start`), Chrome (Playwright and Lighthouse 12.8.2). Raw evidence is next to this file.

## Verdict

| Exit criterion | Result |
|---|---|
| Zero serious accessibility issues | **Met by machine checks.** axe (WCAG 2.2 AA tags) found 0 violations at any impact level on 14 screens, Bangla and English, at 375 and 1280 px (`phase3/axe-*.json`). The TalkBack and VoiceOver pass is **not done** (needs a person with devices): `screen-reader-checklist.md`. |
| Performance budget met | **Met.** First-load JavaScript for `/` is 149 KB gzip (budget 150; was 315 before this phase). Lighthouse performance 98 to 100 on all pages with applied mobile 3G throttling; see the notes on simulated throttling below. |

## 3.1 Accessibility

- Signed-in screens (report wizard, issue, office overview, case workspace, announcements, admin queues) cannot be opened without a Supabase session, so they are rendered with labelled demo data at `/dev/screens/<name>` (not in production unless `JK_AUDIT=1`). The same markup and components are used.
- Automatic checks in `tests/e2e/audit.spec.ts`: axe serious/critical on each screen in both languages; no horizontal scroll at 200% zoom (640 px wide) and at 400% (320 px, WCAG 1.4.10); no running animation with reduced motion; every keyboard stop in the report wizard shows a focus ring; every public page renders in both languages without an error page.
- Found and fixed: the target-size rule failed where a tab bar overlapped the wizard's Back/Next bar (demo route only); heading order on `/area` and `/ideas` (h3 under h1); the page-level reduced-motion rule and map animation were missing (`globals.css`, `lib/map.ts`).
- Not covered: TalkBack and VoiceOver (checklist provided), real signed-in sessions.

## 3.2 Performance and low bandwidth

| Page | Perf (3G applied) | A11y | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 | 2.2 s | 20 ms | 0 |
| `/area` | 99 | 100 | 100 | 100 | 1.7 s | 30 ms | 0 |
| `/ideas` | 99 | 100 | 100 | 100 | 1.9 s | 30 ms | 0 |
| `/login` | 100 | 100 | 100 | 100 | 1.5 s | 20 ms | 0 |
| `/report` (demo screen) | 99 | 100 | 100 | 100 | 1.8 s | 20 ms | 0 |
| `/issue` (demo screen) | 99 | 100 | 100 | 100 | 1.9 s | 30 ms | 0 |
| `/office` (demo screen) | 99 | 100 | 100 | 100 | 1.8 s | 40 ms | 0 |
| `/` desktop preset | 99 | 100 | 100 | 100 | 0.8 s | 0 ms | 0.003 |

Settings: mobile emulation, CPU 4x slower, network 300 ms round trip and 1.6 Mbps, **applied** throttling (`--throttling-method=devtools`). With Lighthouse's default simulated Slow-4G profile `/` scores **86** (LCP 3.8 s). With a harsher *simulated* profile (300 ms, 1.6 Mbps) it scores 71 to 76: that model assumes every font and script competes for the link before the hero image, which the applied run does not show. Files: `lighthouse/*.report.json`; the default-profile HTML report is kept for `/`.

What changed:
- First-load JS for `/`: 315 KB to 149 KB gzip (scripts a modern browser runs; the 40 KB `noModule` polyfill chunk is not counted). The strings dictionary was 29 KB of it: it is now handed to client components per language by `I18nProvider` (the page's language only; the strings ride in the HTML instead, about 14 KB gzip). The Supabase client (68 KB) loads only on sign-in and sign-out; Zod and the category list were split so the home page no longer bundles the validator; number and date formatters moved to `lib/format.ts`.
- MapLibre is not in first-load JS for `/` (checked by `tests/e2e/perf.spec.ts`, together with Supabase and Zod).
- Fonts: the heading font uses one static weight (57 KB instead of 156 KB); fonts are not preloaded and use `display: optional`, so a slow font never shifts the layout (it showed up as CLS 0.23 before) and the system font is used for that first visit.
- Images: SVG illustrations stay as plain `<img>` (an SVG through `next/image` is not optimised; none is above 87 KB, heroes 64 to 87 KB, checked by a test); below-the-fold images are lazy; the hero has `fetchpriority=high` and explicit size. The only raster images are on-device photo previews (blob URLs) and `share-image.png` (Open Graph, not rendered).
- Skeletons for the office, admin, explore, ideas and issue routes; install banner appears only after the first tap, key or scroll (it was the LCP element on sparse pages).
- Tight margin: 149 of 150 KB. `perf.spec.ts` fails the build if it grows.

## 3.3 Offline and resilience

- Offline banner existed; it now has company: a report sent with no signal is saved on the phone (`jonokotha:report-queue:v1`), shown in My Reports ("waiting to send", send now, discard with confirm) and sent automatically when the connection returns or the app opens (`QueueSync`). A sign-in or validation problem marks that report and does not block the others. Logic in `lib/offline-queue.ts`.
- Service worker: cache named from the build id (`/sw.js?v=<build>`), old caches deleted on activate, only public static files are cached, pages and `/api` never are; offline navigations show `/offline`.
- Error boundaries for report, office, admin, area, me and issue, each with a retry and a route-specific hint, inside the app shell.
- Backend gaps: no idempotency on `POST /api/cases` (the key is sent, ignored today); no background-sync or dedicated offline endpoint. Next.js's experimental `useOffline` was not enabled.

## 3.4 Language QA

Automated (`tests/unit/language.test.ts`): matching bn and en keys; no Latin letters in Bangla strings (named exceptions: language names, file formats, the OpenStreetMap credit); no ASCII digits; no sadhu forms; none of the formal words from the §19.2 avoid-list; sentences at most 20 words; glossary terms, §19.4 status labels and §19.5 category labels match the masterplan; dates in Asia/Dhaka with Bangla digits and everyday day parts ("১৬ নভেম্বর ২০২৬, রাত ২:৩০"). Changed: "অভিযোগ" to "সমস্যা" everywhere, "সমস্যা নম্বর", "খবর রাখুন", "আমিও চাই", status and category labels, "সংশ্লিষ্ট" and "সম্পাদনা" replaced, page title and description follow the language, long unbroken text wraps (two layout bugs fixed). **A native Bangla speaker has not reviewed the strings**: `language/strings-review.csv` lists all 959 with English and blank columns for the reviewer. Some staff-screen words (for example "ঊর্ধ্বতন", "রেফার") are still formal and are flagged for that review.

## 3.5 Tests

Playwright at 375 and 1280 px: smoke, axe, audit, golden path (describe, AI draft with labels, five steps, send, reference number), staff approval (note required, confirm, toast; copilot changes nothing alone), role denial (401 on both API routes, 403 keeps the note, no-access screens, redirects), offline page and queue, performance budget, security, and visual regression of 10 screens (22 baselines, macOS; other OSes skip unless `VISUAL=1`).

## 3.6 Security UI checks

See `security-ui.md`: bundle secret scan (clean, runs in CI), safe rendering, safe links, photo limits, CSP proven violation-free and proposed to the backend.

## F.8 Frontend release gates (2026-11-16)

Run all of these before a release: `npm test`, `npm run build && npm run check:bundle`, `npx playwright test release-gates a11y`.

| Gate (§21.6, §29 UX) | Result | How |
|---|---|---|
| No private data in public pages | **Ticked** | `tests/e2e/release-gates.spec.ts` fetches 13 public pages as a signed-out visitor, bn and en: no email (except example addresses and the configured support mailbox), no Bangladesh mobile number, no service-role name, no internal-note or user-id field, no JWT. Office and admin pages send a signed-out visitor to sign-in. |
| No keys in the browser bundle | **Ticked** | `npm run check:bundle` (in CI) plus `tests/unit/release-gates.test.ts`: no client component reads a server-only environment variable. |
| Bangla and English both tested | **Ticked** | `tests/unit/language.test.ts` and `i18n.test.ts` (matching keys, glossary, status labels), pages render in both languages, axe in both. Native-speaker review still **open** (3.4). |
| Empty, error and offline states on every screen | **Ticked** | `tests/unit/release-gates.test.ts`: app-wide error boundary, not-found, loading, `/offline` and service worker exist; every component that loads from the API has an error state and an empty or no-result state (the check lists the few that are exempt by name). Per-route offline behaviour is the service-worker cache plus the report queue. |
| Axe on every public page | **Ticked** | `tests/e2e/a11y.spec.ts` (`/terms`, `/challenge`, `/metrics` and `/privacy` clean at 375 and 1280). Pages that call the API need the API running to reach network-idle; run with the local Supabase. |
| Keyboard and screen-reader pass | **Open** | Needs a person with TalkBack and VoiceOver: `screen-reader-checklist.md`. |
| Signed-in axe and the real-stack scenarios | **Open** | `npm run test:e2e:real` has not been executed: Docker was not found on the author's machine. |
| Device and network matrix (F.3) | **Open** | `device-matrix.md` not started. |

## Evidence

- `phase3/screenshots/`: 14 screens, Bangla and English, 375 and 1280 px.
- `phase3/axe-<lang>-<width>.json`: full axe results.
- `lighthouse/`: Lighthouse JSON for the pages above.
- Reproduce: `npm run build`, `JK_AUDIT=1 npm run start -- -p 3100`, then `AUDIT_OUT=docs/aibc/phase3 PW_PORT=3100 npx playwright test evidence`.
