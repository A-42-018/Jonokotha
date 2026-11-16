import { describe, expect, it, vi } from "vitest";

describe("kickDeliveries", () => {
  it("does nothing under test and never throws outside a request", async () => {
    const { kickDeliveries, resetKick } = await import("@/lib/notify/opportunistic");
    resetKick();
    expect(() => kickDeliveries()).not.toThrow();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => kickDeliveries(Date.now() + 120_000)).not.toThrow();   // no request scope: swallowed
    vi.unstubAllEnvs();
  });
});
