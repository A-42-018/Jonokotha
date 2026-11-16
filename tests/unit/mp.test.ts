import { describe, expect, it } from "vitest";
import { answeredShare, findRepsByArea, repById, SAMPLE_REPS } from "@/lib/mp";

describe("find your MP", () => {
  it("maps a ward to its representative", () => {
    const r = findRepsByArea("ওয়ার্ড ৩", "bn");
    expect(r).toHaveLength(1);
    expect(r[0].reps.map((x) => x.id)).toEqual(["rep-demo-1"]);
  });
  it("returns two candidates for a boundary ward so the citizen confirms", () => {
    expect(findRepsByArea("ward 5", "en")[0].reps).toHaveLength(2);
  });
  it("returns nothing for unknown areas or empty text", () => {
    expect(findRepsByArea("zzz", "en")).toEqual([]);
    expect(findRepsByArea("", "bn")).toEqual([]);
  });
  it("every sample rep is flagged as sample and verified with a date and source", () => {
    for (const r of SAMPLE_REPS) { expect(r.sample).toBe(true); expect(r.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(r.source).toBeTruthy(); }
    expect(repById("nope")).toBeUndefined();
  });
  it("computes the answered share without dividing by zero", () => {
    expect(answeredShare({ from: "", to: "", received: 120, answered: 84, pending: 36, medianFirstResponseDays: 3 })).toBe(70);
    expect(answeredShare({ from: "", to: "", received: 0, answered: 0, pending: 0, medianFirstResponseDays: 0 })).toBe(0);
  });
});
