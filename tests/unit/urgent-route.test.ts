import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const urgent = vi.fn();
vi.mock("@/lib/supabase/service", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/urgent-cases", async (orig) => ({ ...(await orig<typeof import("@/lib/urgent-cases")>()), urgentCases: (...a: unknown[]) => urgent(...a) }));
import { GET } from "@/app/api/internal/urgent-cases/route";

const SECRET = "0123456789abcdef-secret";
const req = (qs = "", auth: string | null = `Bearer ${SECRET}`) => new Request(`http://x/api/internal/urgent-cases${qs}`, { headers: auth ? { authorization: auth } : {} });
beforeEach(() => { urgent.mockReset(); process.env.CRON_SECRET = SECRET; });
afterEach(() => { delete process.env.CRON_SECRET; });

describe("GET /api/internal/urgent-cases", () => {
  it("refuses a missing or wrong secret and reads nothing", async () => {
    expect((await GET(req("", null))).status).toBe(401);
    expect((await GET(req("", "Bearer nope-nope-nope-nope"))).status).toBe(401);
    expect(urgent).not.toHaveBeenCalled();
  });
  it("returns the count, the alert text and the cases, uncached", async () => {
    urgent.mockResolvedValue([{ ref: "JK-1", title: "Live wire", category: "electricity", area: "W3", status: "received", created_at: "2026-11-20T08:00:00Z" }]);
    const r = await GET(req("?hours=6"));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const j = await r.json();
    expect(j.data.count).toBe(1);
    expect(j.data.text).toMatch(/1 urgent open case in the last 6 h/);
    expect(urgent.mock.calls[0][1]).toMatchObject({ hours: 6, demo: false });
  });
  it("hides demo cases unless demo=1 and clamps hours", async () => {
    urgent.mockResolvedValue([]);
    await GET(req("?hours=9999&demo=1"));
    expect(urgent.mock.calls[0][1]).toMatchObject({ hours: 24, demo: true });
  });
  it("answers 500 with the standard error body when the read fails", async () => {
    urgent.mockRejectedValue(new Error("db"));
    const r = await GET(req());
    expect(r.status).toBe(500);
    expect((await r.json()).code).toBe("internal_error");
  });
});
