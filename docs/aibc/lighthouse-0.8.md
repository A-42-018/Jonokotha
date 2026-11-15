# Lighthouse and PWA check (task 0.8)

Date: 2026-11-16. Lighthouse 13.6.0 (CLI), headless Chrome, production build (`next build`, `next start`), dummy Supabase env (no live data).

## Scores (mobile / desktop)

| Page | Accessibility | Best practices | SEO |
|---|---|---|---|
| `/` | 100 / 100 | 100 / 100 | 100 / 100 |
| `/report` | 100 / 100 | 100 / 100 | 100 / 100 |
| `/issue/[ref]` | 100 / 100 | 100 / 100 | 100 / 100 |

Target was >= 90 on accessibility. Met on all three pages.

Notes:
- Lighthouse 12 and later removed the PWA category and its score, so a numeric PWA score is no longer available. Installability was checked by hand instead (below).
- `/issue/[ref]` needs a real case from Supabase. With no backend, the route renders the not-found state, so the case markup was audited through a temporary page with the same markup and a fake case (deleted afterwards). Re-run against real data once the backend is connected.

## Fixes made from the first run

- Issue page: timestamp text was `text-slate-500` on the tinted background (contrast 4.46, needs 4.5). All `text-slate-500` text changed to `text-slate-600`.
- Constituency button: `aria-label` did not contain the visible text ("এলাকা বাছুন") when no area was chosen. The label now starts with the visible text.

## Installability checklist

- Manifest at `/manifest.webmanifest`: `name`, `short_name`, `start_url`, `id`, `scope`, `display: standalone`, `theme_color`, `background_color`.
- Icons: 192 and 512 PNG (`any`), 512 PNG (`maskable`), plus the SVG. All return 200 with the right content type.
- `theme-color` meta tag is `#1d5fa8` (from the viewport export in `layout.tsx`).
- Service worker `/sw.js` served with 200 and registered in production by `RegisterSW`. Registration could not be confirmed in the embedded preview browser (it blocks service workers); confirm on Chrome Android with the staging URL.
- Install prompt (`InstallPrompt.tsx`): shows only after the browser fires `beforeinstallprompt`; 44px buttons; "এখন নয়" stores `jk-install-dismissed` in localStorage and hides it for good; hidden when running standalone and after `appinstalled`. iOS Safari has no install event, so no prompt is shown there.
