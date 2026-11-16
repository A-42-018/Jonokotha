# Design system (`src/components/ui`)

Review every primitive and state at `/dev/ui` (bn and en side by side). The page calls `notFound()` when `NODE_ENV === "production"`, so it never ships.

## Rules every primitive follows

- Strings come from `src/lib/i18n.ts`. Callers pass labels; built-in text (close, error prefix, pagination) uses `useT()`. Components that have built-in text accept an optional `lang` prop to override the page language (used only by `/dev/ui`).
- 44px minimum touch target, visible `focusRing` (from `cx.ts`), disabled state, error state (icon + words + `aria-invalid`, never colour alone).
- Logical properties only (`ms-`, `pe-`, `text-start`, `rtl:rotate-180`), so layout survives RTL.
- Colours: use `text-teal-strong`, `bg-leaf-strong`, `text-muted`, `border-line`, `text-danger`. Brand `teal` (4.1:1) and `leaf` (3.4:1) fail AA as text or behind white text; keep them for decoration and tints.

## Primitives

| Component | File | Notes |
|---|---|---|
| Button, `buttonClass()` | `Button.tsx` | variants primary/secondary/success/danger/ghost; `loading`; `buttonClass` styles links |
| Input, Textarea, Select | `Input.tsx` `Textarea.tsx` `Select.tsx` | `label`, `hint`, `error`, `optional`; ids and `aria-describedby` wired by `Field.tsx` |
| Checkbox, RadioGroup | `Choice.tsx` | whole row is the touch target; RadioGroup is a fieldset with legend |
| Dialog | `Dialog.tsx` | native `<dialog>`; controlled `open`; `busy` blocks dismissal |
| Toast | `Toast.tsx` | `ToastProvider` is in the root layout; `useToast()("success" \| "error" \| "info", message)` |
| Tabs | `Tabs.tsx` | roving tabindex, arrow/Home/End keys |
| Badge, StatusChip | `Badge.tsx` `StatusChip.tsx` | StatusChip maps case status to tone + icon |
| Card | `Card.tsx` | tones default/info/warning/danger |
| Skeleton, SkeletonText | `Skeleton.tsx` | decorative; wrap in `role="status"` with a sr-only label |
| EmptyState, State | `EmptyState.tsx` `State.tsx` | EmptyState wraps State (compact, h2) |
| Stepper | `Stepper.tsx` | container-query layout: labels from 32rem wide, "Step n of N" below |
| Table | `Table.tsx` | table from md, label/value cards on phones |
| Pagination | `Pagination.tsx` | `hrefFor` (links) or `onPageChange` (buttons); Bangla digits |

## Migrated as proof

`LoginForm` (Input, Button, i18n; removed hard-coded bn/en strings and raw Supabase error text) and `ApproveButtons` (Button, Dialog, Toast). Other Phase 0 screens still use their own markup and are rebuilt in later Phase 1 tasks.

## Navigation shell

`TopNav` (header, all widths), `BottomTabBar` (phones, below lg), `MainShell` (container and bottom padding), `NotificationBell` (stub dialog), `ComingSoon` (placeholder page), shared rules in `nav.ts`. Tabs: হোম `/`, এলাকা `/area`, centre report button `/report`, আইডিয়া `/ideas`, আমি `/me`. `/area` and `/ideas` are labelled "শীঘ্রই" pages. The tab bar is hidden on `/report` and `/login` (typing flows); `MainShell` pads the bottom to match. Toast and install prompt sit above the bar on phones. Note: do not combine `hidden` with a component that sets `inline-flex` (Badge, `buttonClass`); wrap it in a `hidden` div instead.

## Report wizard (task 1.3)

`ReportForm` is a 5-step wizard (ধরন, বিবরণ, জায়গা, ছবি, দেখুন) on React Hook Form + Zod; schema and limits in `src/lib/report.ts` (messages from `i18n.ts`, limits match the API's `CaseInput`). Parts in `src/components/report/`: `CategoryPicker` (cat-* tiles, native radio group), `EvidenceStep` (on-device compression via `src/lib/image.ts`, caption, face/ID warning), `PrivacyWarning`. The Back/Next bar is `fixed` and lifts above the keyboard with `useKeyboardInset` (`ui/`). Draft autosave key is `jonokotha:report-draft:v2` (v1 drafts are migrated). Photos are compressed and previewed only; the API has no attachment field yet, so they are not sent and the UI says so.

## My Reports (task 1.5)

`/me` shows the signed-in citizen's reports via `components/me/MyReports` (server component): URL-driven status filter chips with counts (`?status=received|acknowledged|referred|resolved`, `?page=n`, 10 per page), each row a `Card` linking to `/issue/[ref]` (title, ref, category Badge, area, `fmtDate`, StatusChip), `ReportsPager` (client wrapper, because `Pagination.hrefFor` is a function), `EmptyState` for none and for an empty filter, `State kind="expired"` with a sign-in button when signed out, `me/loading.tsx` skeleton. Strings are the `mr*` keys. Data comes from `lib/my-reports.ts` (`listMyReports`, public columns only, no ai.* and no notes). Review with demo data at `/dev/my-reports` (`?state=empty`, `?state=one&status=resolved`); dev only.

**Backend to add:** `store.ts` has no list-by-user function and `CaseRecord` has no `reporter_id`. Until then `listMyReports` selects `ref,title,category,area,status,created_at` from `cases` filtered by `reporter_id` (works because of the "public read cases" policy; capped at 200, filtered and paged in memory). Please add `listMyCases(sb, userId, { status, page })` returning `{ rows, counts, total }` so counts and paging happen in SQL, then swap the call in `app/me/page.tsx`.

## Issue detail v2 (task 1.4)

`/issue/[ref]` renders `components/issue/IssueView` (two columns from lg: report + official response left, timeline + actions right). Parts: `StatusTimeline` (StatusChip + `fmtDate` per step, notes never shown), `OfficialResponse` (placeholder until the API exposes a public reply), `IssueActions` (client, UI only: "আমারও একই সমস্যা" disabled with "শীঘ্রই", follow toggle, copy/share, report-content Dialog with required reason). Copy/share logic is the shared `ui/useShare` hook, also used by `ReportSuccess`. Privacy: the view reads title, category, area, description, status and timeline `status/at` only; `ai.*` and reporter data are never rendered. Strings are the `is*` keys in `i18n.ts`.

## Phase 3 additions

- **Strings in client components:** `I18nProvider` (root layout) carries the page language and its dictionary; `useT()` and `useLang()` read it. Do not import `dict` in a client component (it ships both languages). Number and date helpers: `lib/format.ts`.
- `RouteError` (route `error.tsx` body with a route-specific hint) and `PageLoading` (list or detail skeleton for `loading.tsx`).
- Offline queue UI: `components/offline/` (`QueueSync`, `QueuedReports`, `ReportQueued`); logic in `lib/offline-queue.ts`.
- Audit-only demo screens: `/dev/screens/<name>` (see `docs/frontend.md`, Phase 3 status).
- Reduced motion is handled globally in `globals.css`; maps use `mapAnimate()`.
