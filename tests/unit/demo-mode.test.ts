import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";
import { DEMO_COOKIE, isDemoRef, setDemoCookie } from "@/lib/demo-mode";
import { DEMO_FEATURES } from "@/lib/demo/features";
import { demoCaseRecord, DEMO_CASES } from "@/lib/demo/cases";
import { demoDraft } from "@/lib/demo/intake";
import { simulate } from "@/lib/demo-sim";

afterEach(() => { setDemoCookie(false); vi.restoreAllMocks(); });

describe("simulated demo mode", () => {
  it("answers every example list from code and marks each record as a sample", async () => {
    for (const path of ["/issues", "/ideas", "/polls", "/projects", "/commitments", "/consultations", "/priorities", "/participatory-budgets", "/questions", "/announcements"]) {
      const r = await simulate(path, { method: "GET" });
      const rows = r?.data as { is_sample?: boolean }[];
      expect(Array.isArray(rows) && rows.length > 0, path).toBe(true);
      if (path !== "/announcements") expect(rows.every((x) => x.is_sample), path).toBe(true);
    }
  });

  it("gives every example ref the JKD- prefix, so it cannot be mistaken for a real case", () => {
    expect(DEMO_CASES.every((c) => isDemoRef(c.ref))).toBe(true);
    expect(isDemoRef("JK-2026-1001")).toBe(false);
  });

  it("keeps votes in memory only: a poll vote shows in the next read, a second vote is refused", async () => {
    const before = (await simulate("/polls/JKD-PL-0302", { method: "GET" }))!.data as { options: { id: string }[]; results: { my_option_id: string | null } };
    expect(before.results.my_option_id).toBeNull();
    await simulate("/polls/JKD-PL-0302/vote", { method: "POST", body: { option_id: before.options[0].id } });
    const after = (await simulate("/polls/JKD-PL-0302", { method: "GET" }))!.data as { results: { my_option_id: string | null } };
    expect(after.results.my_option_id).toBe(before.options[0].id);
    await expect(simulate("/polls/JKD-PL-0302/vote", { method: "POST", body: { option_id: before.options[1].id } })).rejects.toMatchObject({ status: 409 });
  });

  it("never lets an unlisted write reach the server, and lets an unlisted read through", async () => {
    expect(await simulate("/me/profile", { method: "PUT", body: { name: "x" } })).toEqual({ data: { simulated: true } });
    expect(await simulate("/me/profile", { method: "GET" })).toBeUndefined();
  });

  it("builds a case page for a report sent during the demo, and none for an unknown ref", () => {
    expect(demoCaseRecord("JKD-2026-9007", "bn")?.status).toBe("received");
    expect(demoCaseRecord("JKD-2026-0101", "en")?.status).toBe("resolved");
    expect(demoCaseRecord("JKD-NOPE", "bn")).toBeUndefined();
  });

  it("drafts a report from a few words", () => {
    expect(demoDraft("মিরপুর ১১ এ রাস্তায় বড় গর্ত")).toMatchObject({ category: "roads", area: "মিরপুর ১১" });
    expect(demoDraft("Drain is blocked").category).toBe("drainage");
  });

  it("lists every feature with at least one link and a bilingual text", () => {
    for (const f of DEMO_FEATURES) {
      expect(f.links.length).toBeGreaterThan(0);
      expect(f.title.bn && f.title.en && f.lead.bn && f.lead.en && f.tryIt.bn && f.tryIt.en).toBeTruthy();
    }
  });

  it("api() answers from code only while the demo cookie is set, and goes to the network otherwise", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ data: [{ ref: "REAL" }] }), { status: 200 }));
    expect(document.cookie).not.toContain(DEMO_COOKIE);
    expect((await api<{ ref: string }[]>("/ideas", {}, fetchSpy as unknown as typeof fetch)).data[0].ref).toBe("REAL");
    setDemoCookie(true);
    fetchSpy.mockClear();
    const demo = await api<{ ref: string }[]>("/ideas", {}, fetchSpy as unknown as typeof fetch);
    expect(demo.data[0].ref.startsWith("JKD-")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
