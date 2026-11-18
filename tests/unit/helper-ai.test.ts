import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/run", () => ({ runAgent: vi.fn() }));
import { runAgent } from "@/lib/ai/run";
import { helperAi, leaks } from "@/lib/ai/helper";
import type { Flags } from "@/lib/helper/navigate";

const flags: Flags = { consultations: false, commitments: false, priorities: false, budget: false, budgeting: false, openData: false, mpRecords: false, rti: false, assisted: false };
const mocked = vi.mocked(runAgent);
const ok = (data: object) => mocked.mockResolvedValueOnce({ ok: true, data, runId: null, latencyMs: 5 } as never);

beforeEach(() => mocked.mockReset());

describe("Dadu's model layer", () => {
  it("returns the answer with only whitelisted pages, and chips for follow-ups", async () => {
    ok({ text: "রিপোর্টের পাতায় যান।", known: true, pages: ["/report", "/admin", "/rti", "/polls"], follow_ups: ["পাঠানোর পর কী হয়?"] });
    const r = await helperAi("সমস্যা কীভাবে জানাব", "bn", "/", flags);
    const links = r!.blocks.filter((b) => b.type === "link").map((b) => (b as { href: string }).href);
    expect(links).toEqual(["/report", "/polls"]);                       // /admin is not a page, /rti is flagged off
    expect(r!.blocks.some((b) => b.type === "chips")).toBe(true);
    expect(r!.blocks.some((b) => b.type === "handoff")).toBe(false);
  });
  it("adds a way to a person when the model says it is not sure", async () => {
    ok({ text: "আমি নিশ্চিত নই।", known: false, pages: [], follow_ups: [] });
    expect((await helperAi("কিছু অদ্ভুত প্রশ্ন", "bn", "/", flags))!.blocks.some((b) => b.type === "handoff")).toBe(true);
  });
  it("throws away an answer with a phone number, an email or a web address", async () => {
    for (const text of ["ফোন করুন ০১৭১২৩৪৫৬৭৮", "write to a@b.com", "see https://x.example", "call +8801712345678"]) {
      ok({ text, known: true, pages: [], follow_ups: [] });
      expect(await helperAi("প্রশ্ন", "bn", "/", flags)).toBeNull();
    }
    ok({ text: "ঠিক আছে", known: true, pages: [], follow_ups: ["০১৭১২৩৪৫৬৭৮৯ নম্বরে ফোন?"] });
    expect(await helperAi("প্রশ্ন", "bn", "/", flags)).toBeNull();
  });
  it("returns null when the model fails, so the scripted answer stays", async () => {
    mocked.mockResolvedValueOnce({ ok: false, reason: "timeout", runId: null } as never);
    expect(await helperAi("প্রশ্ন", "bn", "/", flags)).toBeNull();
  });
  it("sends the question redacted, the page guide and the allowed pages, as data", async () => {
    ok({ text: "ঠিক আছে", known: true, pages: [], follow_ups: [] });
    await helperAi("আমার নম্বর ০১৭১২৩৪৫৬৭৮ সমস্যা জানাব", "bn", "/polls", flags);
    const call = mocked.mock.calls[0][0] as { agent: string; input: string; prompt: { id: string } };
    expect(call.agent).toBe("helper");
    expect(call.prompt.id).toBe("helper");
    expect(call.input).not.toContain("০১৭১২৩৪৫৬৭৮");
    expect(call.input).toContain("PAGE: /polls");
    expect(call.input).toMatch(/ALLOWED_PAGES: .*\/report/);
    expect(call.input).not.toMatch(/ALLOWED_PAGES: .*\/rti/);
  });
  it("leak detector", () => { expect(leaks("৯৯৯")).toBe(false); expect(leaks("সাহায্যের পাতা দেখুন")).toBe(false); });
});
