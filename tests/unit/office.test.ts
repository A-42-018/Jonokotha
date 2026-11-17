import { describe, expect, it } from "vitest";
import { casesToCsv, csvCell, filterCases, missingInfo, NO_CASE_FILTER, overviewStats, templateReply } from "@/lib/office";
import type { CaseRecord } from "@/lib/types";

const mk = (ref: string, status: CaseRecord["status"], over: Partial<CaseRecord> = {}): CaseRecord => ({
  ref, title: `T ${ref}`, category: "roads", description: "রাস্তায় গত সপ্তাহ থেকে বড় গর্ত হয়ে আছে, রিকশা চলতে পারছে না।", area: "ওয়ার্ড ৩", constituencyId: "demo-1",
  status, createdAt: "2026-11-02T00:00:00Z", timeline: [{ status, at: "2026-11-05T00:00:00Z" }],
  ai: { summary: "", similarRefs: [], agencyId: "ag-lged", confidence: 0.7 }, ...over,
});
const now = Date.UTC(2026, 10, 16);

describe("office overview", () => {
  const cases = [mk("1", "received"), mk("2", "acknowledged"), mk("3", "referred"), mk("4", "resolved"), mk("5", "resolved", { timeline: [{ status: "resolved", at: "2026-09-01T00:00:00Z" }] })];
  it("counts from status and dates only", () => {
    expect(overviewStats(cases, now)).toEqual({ total: 5, newReports: 1, waiting: 2, forwarded: 1, resolved: 2, resolvedThisMonth: 1 });
  });
});

describe("case filters", () => {
  const cases = [mk("1", "received"), mk("2", "referred", { category: "water", area: "বাজার" })];
  it("filters by status, category, text and assignment", () => {
    expect(filterCases(cases, { ...NO_CASE_FILTER, status: "referred" }, {}).map((c) => c.ref)).toEqual(["2"]);
    expect(filterCases(cases, { ...NO_CASE_FILTER, category: "water" }, {}).map((c) => c.ref)).toEqual(["2"]);
    expect(filterCases(cases, { ...NO_CASE_FILTER, q: "বাজার" }, {}).map((c) => c.ref)).toEqual(["2"]);
    expect(filterCases(cases, { ...NO_CASE_FILTER, assigned: "mine-none" }, { "1": "st-1" }).map((c) => c.ref)).toEqual(["2"]);
    expect(filterCases(cases, { ...NO_CASE_FILTER, assigned: "st-1" }, { "1": "st-1" }).map((c) => c.ref)).toEqual(["1"]);
  });
});

describe("missing info", () => {
  it("flags missing area, thin detail and no time reference", () => {
    expect(missingInfo({ area: "", description: "গর্ত" })).toEqual(["area", "detail", "when"]);
    expect(missingInfo({ area: "ওয়ার্ড ৩", description: "রাস্তায় গত সপ্তাহ থেকে বড় গর্ত হয়ে আছে, রিকশা চলতে পারছে না।" })).toEqual([]);
  });
});

describe("csv export", () => {
  it("quotes and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(5)).toBe("5");
  });
  it("exports only public columns plus assignment, never notes or AI text", () => {
    const c = mk("1", "received", { timeline: [{ status: "received", at: "x", note: "SECRET NOTE" }], ai: { summary: "AI SECRET", similarRefs: [], agencyId: "a", confidence: 1 } });
    const csv = casesToCsv([c], { "1": "st-1" }, ["ref", "title"]);
    expect(csv).not.toContain("SECRET");
    expect(csv.split("\r\n")[1].startsWith("1,T 1,roads")).toBe(true);
    expect(csv.endsWith("st-1")).toBe(true);
  });
});

describe("template reply", () => {
  it("mentions the title in both languages", () => {
    expect(templateReply({ title: "গর্ত", status: "received" }, "bn")).toContain("গর্ত");
    expect(templateReply({ title: "Pothole", status: "referred" }, "en")).toContain("agency");
  });
});
