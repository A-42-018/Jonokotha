import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

beforeEach(resetRateLimits);

describe("rateLimit", () => {
  it("allows up to the limit then returns 429-style failure with Retry-After", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60_000, 1000).ok).toBe(true);
    const r = rateLimit("k", 3, 60_000, 1000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBe(60);
  });
  it("is per key and resets after the window", () => {
    for (let i = 0; i < 4; i++) rateLimit("a", 3, 1000, 0);
    expect(rateLimit("b", 3, 1000, 0).ok).toBe(true);
    expect(rateLimit("a", 3, 1000, 1001).ok).toBe(true);
  });
});
