import { describe, expect, it, vi } from "vitest";
import { alertText, clampHours, urgentCases, type UrgentCase } from "@/lib/urgent-cases";

const rows: UrgentCase[] = [
  { ref: "JK-2026-1", title: "Live wire down", category: "electricity", area: "Ward 3", status: "received", created_at: "2026-11-20T08:00:00Z" },
  { ref: "JK-2026-2", title: "Gas smell", category: "other", area: null, status: "acknowledged", created_at: "2026-11-20T07:00:00Z" },
];

describe("clampHours", () => {
  it("accepts 1 to 168 and falls back to 24", () => {
    expect([clampHours("6"), clampHours("168"), clampHours("0"), clampHours("500"), clampHours("x"), clampHours(null), clampHours("2.7")]).toEqual([6, 168, 24, 24, 24, 24, 2]);
  });
});

describe("alertText", () => {
  it("is empty with no cases so nothing is sent", () => { expect(alertText([], 24)).toBe(""); });
  it("lists each case, with singular and plural", () => {
    expect(alertText(rows, 24)).toBe("2 urgent open cases in the last 24 h:\n- JK-2026-1: Live wire down (electricity, Ward 3, received)\n- JK-2026-2: Gas smell (other, acknowledged)");
    expect(alertText([rows[0]], 6)).toMatch(/^1 urgent open case in the last 6 h:/);
  });
});

describe("urgentCases", () => {
  function fake(result: { data: unknown; error: unknown }) {
    const calls: [string, ...unknown[]][] = [];
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "gte", "order", "limit"]) q[m] = (...a: unknown[]) => { calls.push([m, ...a]); return q; };
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return { sb: { from: vi.fn(() => q) } as never, calls };
  }
  it("asks for urgent, open, recent, non-demo cases and never selects the reporter", async () => {
    const { sb, calls } = fake({ data: rows, error: null });
    const r = await urgentCases(sb, { hours: 24, demo: false, now: new Date("2026-11-20T12:00:00Z") });
    expect(r).toHaveLength(2);
    expect(calls).toContainEqual(["eq", "priority", "urgent"]);
    expect(calls).toContainEqual(["not", "status", "in", "(resolved,closed)"]);
    expect(calls).toContainEqual(["gte", "created_at", "2026-11-19T12:00:00.000Z"]);
    expect(calls).toContainEqual(["eq", "is_demo", false]);
    expect(JSON.stringify(calls.find((c) => c[0] === "select"))).not.toMatch(/reporter/);
  });
  it("includes demo cases only when asked", async () => {
    const { sb, calls } = fake({ data: [], error: null });
    await urgentCases(sb, { hours: 1, demo: true });
    expect(calls.some((c) => c[0] === "eq" && c[1] === "is_demo")).toBe(false);
  });
  it("throws on a database error", async () => {
    const { sb } = fake({ data: null, error: { message: "boom" } });
    await expect(urgentCases(sb, { hours: 1, demo: false })).rejects.toBeTruthy();
  });
});
