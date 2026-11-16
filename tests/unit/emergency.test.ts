import { describe, expect, it } from "vitest";
import { detectEmergency } from "@/lib/emergency";
import { draftIntakeV2 } from "@/lib/intake-v2";

describe("emergency detection", () => {
  it.each([
    ["আমি আত্মহত্যা করতে চাই", "self_harm"],
    ["I want to kill myself", "self_harm"],
    ["ami morte chai", "self_harm"],
    ["He is going to kill me tonight", "violence"],
    ["আমাকে মেরে ফেলার হুমকি দিয়েছে", "violence"],
    ["There is child abuse next door", "child_in_danger"],
    ["বাল্যবিবাহ হচ্ছে আজ রাতে", "child_in_danger"],
  ])("%s is %s", (text, kind) => {
    const e = detectEmergency(text);
    expect(e?.kind).toBe(kind);
    expect(e?.numbers).toContain("999");
    expect(e?.guidance.bn).toMatch(/৯৯৯/);
    expect(e?.guidance.en).toMatch(/999/);
  });
  it.each(["রাস্তায় গর্ত হয়ে আছে", "The street light on my road is broken", "Water supply stopped for three days", "A fire hydrant is leaking", ""])("%s is not an emergency", (text) => {
    expect(detectEmergency(text)).toBeNull();
  });
  it("intake returns fixed guidance and calls no model when danger is detected", async () => {
    const saved = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    const r = await draftIntakeV2("He said he will kill me and my kids, please help, I live near the market", "en");
    process.env.ANTHROPIC_API_KEY = saved;
    expect(r.source).toBe("emergency");
    expect(r.urgency).toBe("urgent");
    expect(r.emergency?.kind).toBe("violence");
    expect(r.urgency_guidance).toBe(r.emergency!.guidance.en);
  });
});
