# Security checks on the UI (task 3.6)

Date: 2026-11-16. What the frontend checks, what it found, and what still needs the backend.

## Checks that run automatically

| Check | How | Result |
|---|---|---|
| No keys in the browser bundle | `npm run build && npm run check:bundle` scans `.next/static` for Anthropic keys, server env var names, private-key blocks, Supabase JWTs whose role is not `anon`, and the value of every server-only variable in `.env*` or the environment. Runs in CI before the e2e job. | 61 files, 3 server-only values compared, nothing found. The Supabase anon key is public by design and is allowed. |
| Safe rendering of user text | `tests/e2e/security.spec.ts`: a report whose title, description and area hold `<img onerror>`, `<script>` and a `javascript:` link (`/dev/screens/issue-xss`) | Shown literally as text; no script ran, no dialog, no injected element. React escapes text; the code has no `dangerouslySetInnerHTML` or `innerHTML`. |
| Links built from data | `src/lib/safe.ts` `safeHref` (http and https only) used for the agency link in the copilot; share links are built from encoded text | `javascript:` and `data:` URLs are dropped (unit tests). |
| Photo upload limits | `src/lib/image.ts`: only JPEG, PNG, WebP, decided by the file's first bytes (an SVG or HTML file renamed `.jpg` is refused), at most 15 MB before compression, at most 3 photos, caption at most 140 characters. Photos are re-encoded on the device (drops EXIF and GPS). | Unit and e2e tests. The server must repeat these limits (see below). |
| CSP the UI needs | `src/lib/csp.ts` `buildCsp()`. The e2e test injects that header on ten pages (home, sign-in, explore with the map open, ideas, report wizard, office, and more) and fails on any `securitypolicyviolation`. | Zero violations. |

## Backend gaps (not changed by the frontend)

1. **Send the CSP header.** Response headers belong to `src/proxy.ts` or `next.config.ts` (backend files). Proposed policy, from `buildCsp({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL })`:

   ```
   default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob: https://tile.openstreetmap.org; font-src 'self';
   connect-src 'self' <supabase origin> https://demotiles.maplibre.org https://tile.openstreetmap.org;
   worker-src 'self' blob:; manifest-src 'self'; media-src 'self'; object-src 'none';
   base-uri 'self'; form-action 'self'; frame-ancestors 'none'
   ```

   Start with `Content-Security-Policy-Report-Only`, watch for a week, then enforce. `'unsafe-inline'` for scripts is there because Next.js inlines hydration data; pass `nonce` to `buildCsp` from the proxy to get `'nonce-…' 'strict-dynamic'` instead (needs the proxy to generate the nonce and forward it as the `x-nonce` request header; see `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Move the map tile and glyph hosts to your own origin before production (the glyph server is a demo host).
2. **Other headers**, same place: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), geolocation=(self), microphone=(self)` (the report form asks for location and the microphone on a tap), `Strict-Transport-Security` on the production host.
3. **Server-side upload checks.** There is no attachment endpoint yet. When it exists it must re-check type by content, size and count; the UI limits are a convenience, not protection.
4. **Idempotency.** The offline queue sends an `Idempotency-Key` header with each saved report. The API ignores it today; honouring it prevents a duplicate if a request reached the server but the reply was lost.
5. **Rate limits and CSRF.** `POST /api/*` relies on the Supabase session cookie only. Check `SameSite` on that cookie and add per-user rate limits (reports, ask-your-MP messages).

## Not covered

- Real sign-in sessions: signed-in pages were checked on labelled demo screens, not with a live role.
- Third-party map tiles: their availability and terms are not a security matter but a risk for the demo day (see Phase 2 notes).
