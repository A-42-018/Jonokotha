import { describe, expect, it } from "vitest";
import { analytics, decide, hotspots, REASON_MIN, SAMPLE_REVIEW, validReason } from "@/lib/admin";
import type { CaseRecord } from "@/lib/types";

const mk = (ref: string, area: string, category: CaseRecord["category"] = "roads", status: CaseRecord["status"] = "received"): CaseRecord => ({
  ref, title: "t", category, description: "d", area, constituencyId: "demo-1", status, createdAt: "2026-11-01T00:00:00Z", timeline: [], ai: { summary: "", similarRefs: [], agencyId: "a", confidence: 0.5 },
});

describe("admin decisions", () => {
  it("require a reason of at least the minimum length", () => {
    expect(validReason("x".repeat(REASON_MIN - 1))).toBe(false);
    expect(validReason("   short  ")).toBe(false);
    expect(decide("m1", "hide", "", "2026-11-16T00:00:00Z")).toBeNull();
    expect(decide("m1", "hide", "contains a phone number", "2026-11-16T00:00:00Z")).toMatchObject({ itemId: "m1", action: "hide", reason: "contains a phone number" });
  });
  it("sample review items are all marked sample in their text", () => {
    for (const i of SAMPLE_REVIEW) expect(i.titleEn.toLowerCase()).toContain("sample");
  });
});

describe("analytics", () => {
  const cases = [mk("1", "ক"), mk("2", "ক"), mk("3", "খ", "water", "resolved"), mk("4", "")];
  it("counts by status and category from real cases", () => {
    const a = analytics(cases);
    expect(a.total).toBe(4);
    expect(a.byStatus).toEqual({ received: 3, resolved: 1 });
    expect(a.byCategory).toEqual({ roads: 3, water: 1 });
  });
  it("ranks areas by count, ignores empty areas and flags small counts", () => {
    expect(hotspots(cases, 2)).toEqual([{ area: "ক", count: 2, weak: false }, { area: "খ", count: 1, weak: true }]);
  });
});
