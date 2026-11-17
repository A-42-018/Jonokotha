import { buildCsp } from "./csp";

/**
 * Security response headers (Phase 3 security review, backend plan item 1).
 * CSP starts as Report-Only (CSP_MODE=enforce turns it on) so a policy mistake cannot take the site down;
 * see docs/aibc/security-ui.md. No nonce yet: a nonce forces every page to render dynamically.
 */
export function securityHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const enforce = env.CSP_MODE === "enforce";
  const csp = buildCsp({ supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL });
  const h: Record<string, string> = {
    [enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only"]: csp,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), geolocation=(self), microphone=(self)",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  if (env.NODE_ENV === "production") h["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  return h;
}
