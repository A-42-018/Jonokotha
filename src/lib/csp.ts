// Content-Security-Policy the UI needs (task 3.6). NOT applied by the frontend: response headers belong to the backend
// (src/proxy.ts / next.config.ts). docs/aibc/security-ui.md says how to switch it on; tests/e2e/security.spec.ts proves
// the app runs without a single violation under this policy.

export interface CspOptions {
  /** NEXT_PUBLIC_SUPABASE_URL: the browser talks to it for sign-in. */
  supabaseUrl?: string;
  /** Per-request nonce from the proxy. Without it the policy falls back to 'unsafe-inline' (Next.js inlines hydration data). */
  nonce?: string;
}

const origin = (u?: string) => { try { return u ? new URL(u).origin : ""; } catch { return ""; } };

export function buildCsp({ supabaseUrl, nonce }: CspOptions = {}): string {
  const supa = origin(supabaseUrl);
  const script = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : "'self' 'unsafe-inline'";
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [script],
    // Tailwind and React style attributes need inline styles; MapLibre sets inline styles at runtime.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Report photos are previewed from blob: URLs; map tiles come from OpenStreetMap; MP photos come from this project's public storage bucket.
    "img-src": ["'self'", "data:", "blob:", "https://tile.openstreetmap.org", ...(supa ? [supa] : [])],
    "font-src": ["'self'"],
    // Sign-in (Supabase) and map labels (glyph server). Add the speech or AI hosts here if they ever move to the browser.
    "connect-src": ["'self'", ...(supa ? [supa] : []), "https://demotiles.maplibre.org", "https://tile.openstreetmap.org"],
    // MapLibre runs its tile worker from /vendor (same origin) and may use a blob worker.
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}
