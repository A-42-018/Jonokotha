import { describe, expect, it } from "vitest";
import { areaCounts, categoryCounts, statusCounts } from "@/lib/office-charts";
import type { CaseRecord } from "@/lib/types";

const c = (category: string, status: string, area = ""): CaseRecord => ({ category, status, area }) as unknown as CaseRecord;

describe("office chart counts", () => {
  it("sorts categories by count and folds the tail into other", () => {
    const cats = ["roads", "drainage", "water", "electricity", "waste", "flooding", "health", "education"];
    const cases = [c("roads", "received"), c("roads", "received"), ...cats.slice(1).map((k) => c(k, "received"))];
    const out = categoryCounts(cases);
    expect(out[0]).toEqual({ key: "roads", value: 2 });
    expect(out).toHaveLength(7);
    expect(out.at(-1)).toEqual({ key: "other", value: 2 });
    expect(out.reduce((a, x) => a + x.value, 0)).toBe(cases.length);
  });
  it("orders statuses by workflow and skips absent ones", () => {
    const out = statusCounts([c("roads", "resolved"), c("roads", "received"), c("roads", "received")]);
    expect(out.map((x) => x.key)).toEqual(["received", "resolved"]);
  });
  it("counts trimmed areas, skips blanks, limits to n", () => {
    const out = areaCounts([c("roads", "received", " Mirpur "), c("roads", "received", "Mirpur"), c("roads", "received", ""), c("roads", "received", "Gulshan")], 1);
    expect(out).toEqual([{ key: "Mirpur", value: 2 }]);
  });
});
