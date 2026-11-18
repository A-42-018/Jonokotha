# Jonokotha — UI/UX audit and responsive optimisation report

Date: 2026-11-18 · Branch: `ui-home-redesign` · Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, native `<dialog>`, no UI library · Language audited: Bangla (default); English spot-checked.

All numbers below come from the audit harness [`scripts/ui-audit.mjs`](scripts/ui-audit.mjs) (`npm run audit:ui`), which uses the project's own Playwright, axe-core and Chrome (no new dependency), plus screenshots, targeted probes and the existing unit tests. Nothing was committed.

---

## 1. Executive summary

The public site was already in good shape: on the first pass none of the 40 public routes had horizontal overflow or a serious axe violation, and the design system (tokens, 44 px targets, focus rings, dark theme, reduced motion) is applied consistently. The audit found its real problems in places the earlier work had not looked at: the **staff workspaces on phones and tablets**, the **header at 320 px**, **layout shift on load**, and a handful of **WCAG 2.5.3 / 2.4.11 / heading** defects.

| | Before | After |
|---|---|---|
| Office and admin pages with horizontal page scroll below 1024 px | every one (page up to +662 px wider than a 320 px phone) | **0** |
| Route × viewport checks with overflow, off-screen element or overlapping controls | hundreds (all workspaces; the 320 px header was found by eye) | **0 of 2,025** |
| axe violations (WCAG 2.0/2.1/2.2 A+AA + best-practice), phone + desktop | 3 rules (1 serious, 2 moderate) | **0 on all 81 routes** |
| Routes with layout shift (CLS) above 0.05 | about 25 (worst 0.29) | **2** (worst 0.25, `/settings` signed in) |
| Console errors on public pages | 3 errors + 1 warning on 25 pages | 2 expected errors (see §6) |
| Unit tests | 812 pass | 813 pass, lint and `tsc` clean |

Coverage: **81 routes** (39 public, 8 citizen, 23 staff, plus officer, MP, liaison and moderator views) + 9 detail/dynamic pages, each at **25 viewports** (the 16 requested sizes plus a landscape twin of every phone/tablet size) = 2,025 route × viewport measurements, axe at 375 and 1280 wide, 61 internal link targets fetched as visitor and as staff (all HTTP 200).

## 2. Project discovery (Phase 1)

- **Framework:** Next.js 16.4 App Router; server components with client islands; `src/app` (≈100 pages incl. `office/*`, `admin/*`, `dev/*`), `src/components` (≈190 files, `ui/` is the design system documented in `docs/design-system.md`).
- **Styling:** Tailwind 4 tokens in `globals.css` (`civic`, `brand-deep`, `brick`, `cream`, `ink`, `muted`, …), `.jk-card/.jk-h1–h3/.jk-lift`, dark theme through `html[data-theme="dark"]` overrides, logical properties for RTL.
- **Breakpoints:** Tailwind defaults; the shell switches at `xl` (1280 px): bottom tab bar below, top nav above. Workspaces (`office`, `admin`) switch their sidebar at `lg`.
- **Roles / layouts:** public shell (header, `MainShell`, footer, tab bar); office and admin layouts add `PanelSidebar`. Demo login exists for 6 roles (no admin).
- **Existing test workflow:** Playwright (`mobile-375`, `desktop-1280`) with axe and visual snapshots, vitest. The harness reuses these tools.
- **Duplicated patterns noticed:** three separate "loading" skeletons, two empty-state wrappers (`State`/`EmptyState`); consolidated where it mattered (heading level, height).

## 3. Device compatibility report (Phase 2 / 7)

Viewports run: 320×568, 360×800, 375×812, 390×844, 414×896, 430×932 · 600×960, 768×1024, 820×1180, 1024×768 · 1280×720, 1366×768, 1440×900 · 1600×900, 1920×1080, 2560×1440 · plus landscape of every phone/tablet size (568×320 … 1180×820).

| Class | Result after fixes |
|---|---|
| Mobile 320–430 (portrait + landscape) | No overflow, no clipped or overlapping controls on any audited route. The 320 px header was broken before (see I-2) and is fixed. Bottom tab bar no longer hides focused content. |
| Tablet 600–1024 | Pass. Workspace nav strip scrolls inside its own box instead of widening the page. |
| Laptop 1280–1440 | Pass. Top nav, sticky header and sidebars fit; no overlaps. |
| Desktop 1600–2560 | Pass. Content is capped at 90 rem and centred (design choice; wide empty margins at 2560). |

Method note: each page is loaded once at 375 px and then the window is resized through the viewport list (CSS and JS that react to resize are exercised; server-rendered differences keyed on device are not).

## 4. Issues found

### Critical
| # | Issue | Where | Status |
|---|---|---|---|
| I-1 | **Whole page scrolled sideways on phones and tablets in the office and admin workspaces** (+222 to +662 px). The one-column grid track grew to the width of the 20-link nav strip. | `src/app/office/layout.tsx`, `src/app/admin/layout.tsx` | Fixed |

### High
| # | Issue | Where | Status |
|---|---|---|---|
| I-2 | Header at 320 px: area picker squeezed to a sliver, the "sample" badge spilled over the bell and language button. At 375–430 px the area name was cut to nothing (only "…" + badge). | `TopNav`, `ConstituencyPicker`, `AccountMenu` | Fixed |
| I-3 | Two modal dialogs opened at once on a staff member's first visit (area picker + office tour), hiding the page. | `ConstituencyPicker` | Fixed |
| I-4 | Signed-out `/area`: "follow this area" button spun forever and a 401 error was logged on every visit. | `ExploreView`, `area/page.tsx` | Fixed |

### Medium
| # | Issue | Status |
|---|---|---|
| I-5 | Layout shift 0.09–0.29 on about 25 pages: the footer sat in the first screen while content streamed in, then jumped. | Fixed (`MainShell` min-height, loading skeletons fill the screen) |
| I-6 | `/mp` shifted 0.29: loading text → planned panel, with one empty frame in between. | Fixed (reserved height) |
| I-7 | WCAG 2.5.3 label-in-name (axe *serious*): account button (initial letter was part of its text) and the My Reports filter chips ("সব১" vs "সব: ১টি"). | Fixed |
| I-8 | WCAG 2.4.11 focus obscured: keyboard focus on phones landed under the fixed tab bar (9 elements on the home page alone). | Fixed (`scroll-padding-bottom` below 1280 px) |
| I-9 | Chart category labels were cut with "…" on phones (four columns ≈ 70 px), and clipped Bangla marks vertically. | Fixed (`ColumnChart` wraps to two lines, value stays above its bar) |
| I-10 | Empty-state heading used the page-title size inside pages (larger than the real H1, wrapped badly). | Fixed (`State`: h2 uses `jk-h2`) |
| I-11 | No `<h1>` on four states: signed-out inbox, signed-out new idea, idea not found, project not found; `/mp` skipped h1 → h3. | Fixed |
| I-12 | Targets under the project's 44 px rule: footer links (40 px), emergency "call 999" link (23 px, also under WCAG 2.5.8's 24 px), office table checkboxes (20 px wide). | Fixed |
| I-13 | Browser warning on 25 pages: not-found illustration preloaded but never used. | Fixed (`State` image lazy, with explicit size) |

### Low
| # | Issue | Status |
|---|---|---|
| I-14 | Dark theme: illustrations with a baked-in cream background showed as hard squares. | Fixed (rounded) |
| I-15 | Donut centre label rendered at about 10 px. | Fixed (13 px in SVG units) |
| I-16 | "How is this counted" link is 24 px high (passes AA 2.5.8, below the 44 px house rule). | Open |

## 5. Fixes implemented (all verified; see §7)

- **Workspaces:** `grid-cols-[minmax(0,1fr)] … lg:grid-cols-[13rem_minmax(0,1fr)]` in both layouts.
- **Header (<360 px / <640 px):** tighter padding and gap under 360; area picker becomes a 44 px icon button below `sm` (full accessible name kept); language button shows a short code under 360 px; the sign-in button tightens. Above `sm` nothing changed.
- **First-run dialog:** the area prompt no longer auto-opens under `/office` and `/admin`.
- **Layout shift:** `MainShell` main area `min-h-[calc(100svh-4rem)]`; the three route skeletons `min-h-[100svh]`; MP finder reserves the panel height.
- **Accessibility:** account button initial drawn with CSS; filter-chip label strings changed to "{label} {n}" (bn + en) with a real space in the markup; `scroll-padding-bottom: 7rem` below 80 rem; `<h1>` added/levels fixed; signed-out follow control is a sign-in link.
- **Touch targets:** footer links `min-h-11`; emergency link `min-h-11`; table checkboxes get a 44 × 44 label.
- **Components:** `ColumnChart` (wrap, value-above-bar preserved), `Donut`, `State` (`jk-h2` for h2, intrinsic image size, lazy), `EmptyState` (`as` prop).
- **Dark theme:** rounded corners for baked-background illustrations.
- **Tooling:** `scripts/ui-audit.mjs` + `npm run audit:ui` (read-only; roles use the dev demo login).

Files changed by this audit: `src/app/{admin,office}/layout.tsx`, `src/app/area/page.tsx`, `src/app/ask/inbox/page.tsx`, `src/app/globals.css`, `src/app/loading.tsx`, `src/app/me/loading.tsx`, `src/components/{AccountMenu,ConstituencyPicker,EmergencyNote,SiteFooter}.tsx`, `src/components/charts/{ColumnChart,Donut}.tsx`, `src/components/explore/ExploreView.tsx`, `src/components/ideas/{IdeaDetail,NewIdeaForm}.tsx`, `src/components/me/MyReports.tsx`, `src/components/mp/AreaPicker.tsx`, `src/components/office/CaseTable.tsx`, `src/components/projects/ProjectDetail.tsx`, `src/components/ui/{EmptyState,MainShell,PageLoading,State,TopNav}.tsx`, `src/lib/i18n.ts`, `package.json`, `scripts/ui-audit.mjs`.
**Not mine:** the working tree also holds uncommitted edits to `src/app/layout.tsx`, `src/lib/auth.ts`, `src/lib/guard.ts` and `src/lib/supabase/server.ts` (an auth/latency refactor). They were left untouched and should be committed separately.

## 6. Remaining issues and why

| Issue | Severity | Why not resolved |
|---|---|---|
| `/settings` (signed in): CLS 0.16–0.25 when the preference cards finish loading from the API. | Medium | Needs per-card skeletons sized to the loaded card (six client-fetched cards); changes several components' loading states. Worth a follow-up. |
| Console 404 for `GET /api/v1/areas` on `/mp`, and 404 on the not-found page. | Low | Expected: the area cascade feature is switched off server-side and the UI handles it; the 404 page is a real 404. |
| Console warning on staff pages: "Using the user object as returned from `supabase.auth.getSession()`…". | Low | Appeared after the in-progress auth change in `src/lib/supabase/server.ts` (not mine); absent in the earlier run. Needs the owner of that change. |
| 22 Playwright visual-snapshot tests fail (11 per project). | Medium (test hygiene) | They fail identically on the untouched baseline (verified by stashing): snapshots predate the redesign. I did not regenerate them, to avoid blessing unreviewed pixels. |
| `perf.spec.ts` first-load JS budget fails (924 KB gzip) | n/a | It measures the dev server; the budget only makes sense on `next build && next start`. Not measured in production here. |
| "Home" tab hidden under the Next dev badge on phones | n/a | Dev-only overlay, not shipped. |
| `/?track=invalid#track` (bad tracking number) shifts when the page streams in | Low | Rare error path; the anchor scrolls before content arrives. |
| 2560 px: content centred at 90 rem with wide margins | Low | Intentional line-length cap. |
| 18 admin pages not rendered | Unknown | No admin demo account (by design). Only `/admin`, moderation, appeals and users were audited (as staff and moderator). |
| Not tested: form submissions (report wizard end to end, OTP, comments), real screen readers, real devices, production performance, English mode across all pages | — | Submitting writes to the live Supabase project; the rest needs hardware/tools not available here. |

## 7. Verification performed

- Full harness re-run after the fixes: 81 routes × 25 viewports, 0 overflow / off-screen / overlap, 0 axe violations (phone and desktop).
- Visual: screenshots at 320, 375, 768, 1280, 1920, 2560 (light and dark) of home, ideas, area, help, login, polls, settings, office; header at 320 px and office charts at 375 px compared before/after.
- Interaction (Playwright, phone and desktop): area picker opens, fits the viewport, searches (20 results), Esc closes it (first Esc clears the search field, standard for `type=search`) and focus returns; bottom/top navigation reaches Area, Ideas, Me, Home, Projects; language toggle bn ↔ en; "More" menu opens with Enter and closes with Esc; invalid e-mail is rejected on sign-in; no page errors; reduced motion leaves 0 running animations; keyboard sweep shows 0 elements under the tab bar after the fix.
- 61 internal links from all pages: HTTP 200 for visitor and staff.
- `tsc --noEmit`, `eslint src`, `vitest run` (813 pass). Existing Playwright smoke/a11y specs pass (one smoke run flaked while the dev server compiled and passed on re-run).

## 8. Final quality score

| Area | Score | Basis |
|---|---|---|
| Visual design | 89 | Consistent tokens, hierarchy and dark mode; art/empty states polished; wide-screen margins and baked-background art are the only nits. |
| Responsive design | 94 | 2,025 measurements clean across 25 viewports; the only genuine failures were the workspaces and 320 px header, now fixed. |
| User experience | 87 | Clear flows and states; first-run double modal and dead follow button fixed; settings still loads in jumps. |
| Accessibility | 91 | 0 axe violations on 81 routes (WCAG 2.2 AA rules), focus order and visibility checked, reduced motion honoured; no screen-reader pass. |
| Functionality | 88 | Navigation, picker, language, menus and all 61 link targets work; form submissions not exercised against the live backend. |
| Performance | 78 | CLS is good almost everywhere and images load correctly; production bundle and Core Web Vitals were not measured (dev server only). |

## 9. Final verdict

**Ready for a demo and pilot on the audited surface**, with three conditions before calling it production-ready: (1) commit and review the unrelated auth change that is in the working tree and clear its new console warning; (2) regenerate the visual snapshot baselines after reviewing them, and run the performance budget against a production build; (3) smoke-test the form flows (report, sign-in code, comments) with a real account and, ideally, one real phone and one screen reader. Remaining UI risks are low: the `/settings` loading jump and the un-audited admin-only pages.
