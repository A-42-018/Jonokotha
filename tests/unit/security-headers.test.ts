import { describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security-headers";

describe("securityHeaders", () => {
  it("is report-only by default and enforcing on request", () => {
    expect(securityHeaders({})["Content-Security-Policy-Report-Only"]).toContain("frame-ancestors 'none'");
    expect(securityHeaders({})["Content-Security-Policy"]).toBeUndefined();
    const e = securityHeaders({ CSP_MODE: "enforce" });
    expect(e["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(e["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });
  it("always sets the basic headers; HSTS only in production", () => {
    const h = securityHeaders({});
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Strict-Transport-Security"]).toBeUndefined();
    expect(securityHeaders({ NODE_ENV: "production" })["Strict-Transport-Security"]).toContain("max-age");
  });
  it("allows the Supabase origin for connect-src", () => {
    expect(securityHeaders({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co/rest" })["Content-Security-Policy-Report-Only"]).toContain("https://x.supabase.co");
  });
});
