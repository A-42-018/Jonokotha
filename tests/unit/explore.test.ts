import { describe, expect, it } from "vitest";
import { approxCoord, filterIssues, haversineKm, lastUpdated, NO_FILTERS, sortIssues } from "@/lib/explore";
import { SAMPLE_ISSUES } from "@/lib/sample";

const cat = (c: string) => c;
const st = (s: string) => s;
const now = Date.UTC(2026, 10, 16);

describe("explore", () => {
  it("rounds public coordinates to about 1 km", () => {
    expect(approxCoord(23.80694)).toBe(23.81);
    expect(Math.abs(approxCoord(90.36871) - 90.36871)).toBeLessThan(0.006);
  });
  it("sample coordinates are all approximate", () => {
    for (const i of SAMPLE_ISSUES) expect(i.lat).toBe(approxCoord(i.lat!));
  });
  it("filters by category, status, date range and text", () => {
    expect(filterIssues(SAMPLE_ISSUES, { ...NO_FILTERS, category: "roads" }, now, cat, st).every((i) => i.category === "roads")).toBe(true);
    expect(filterIssues(SAMPLE_ISSUES, { ...NO_FILTERS, status: "resolved" }, now, cat, st)).toHaveLength(2);
    expect(filterIssues(SAMPLE_ISSUES, { ...NO_FILTERS, range: "7" }, now, cat, st).every((i) => now - Date.parse(i.createdAt) <= 7 * 86_400_000 + 86_400_000)).toBe(true);
    expect(filterIssues(SAMPLE_ISSUES, { ...NO_FILTERS, q: "ড্রেন" }, now, cat, st)).toHaveLength(1);
    expect(filterIssues(SAMPLE_ISSUES, { ...NO_FILTERS, q: "zzzz" }, now, cat, st)).toEqual([]);
  });
  it("sorts by latest, updated and distance", () => {
    expect(sortIssues(SAMPLE_ISSUES, "latest")[0].ref).toBe("JK-SAMPLE-101");
    const upd = sortIssues(SAMPLE_ISSUES, "updated");
    expect(upd[0].updatedAt >= upd[1].updatedAt).toBe(true);
    const origin = { lat: 23.7905, lng: 90.3639 };
    expect(sortIssues(SAMPLE_ISSUES, "nearby", origin)[0].ref).toBe("JK-SAMPLE-111");
    expect(haversineKm(origin, origin)).toBe(0);
  });
  it("finds the newest update", () => {
    expect(lastUpdated(SAMPLE_ISSUES)).toBeDefined();
    expect(lastUpdated([])).toBeUndefined();
  });
});
