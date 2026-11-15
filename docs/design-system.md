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
