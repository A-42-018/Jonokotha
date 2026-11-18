import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { azureConfigured, resetSpeechForTests, speakable, ssml, synthesize } from "@/lib/helper/azure-speech";

const audio = () => new Response(new Uint8Array(500), { status: 200 });
beforeEach(() => { resetSpeechForTests(); process.env.AZURE_SPEECH_KEY = "test-key"; process.env.AZURE_SPEECH_REGION = "southeastasia"; delete process.env.AZURE_SPEECH_DAILY_CHARS; });
afterEach(() => { delete process.env.AZURE_SPEECH_KEY; delete process.env.AZURE_SPEECH_REGION; });

describe("Dadu's server voice", () => {
  it("is off without keys, and does not call out", async () => {
    delete process.env.AZURE_SPEECH_KEY;
    const f = vi.fn();
    expect(azureConfigured()).toBe(false);
    expect(await synthesize("হ্যালো", "bn", f as never)).toEqual({ ok: false, reason: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });
  it("sends SSML with the male Bangla voice, numbers in words and no personal details", async () => {
    const f = vi.fn().mockResolvedValue(audio());
    const r = await synthesize("৯৯৯-এ ফোন করুন। আমার নম্বর ০১৭১২৩৪৫৬৭৮ & <b>২০২৬</b>", "bn", f as never);
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1");
    expect((init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("test-key");
    const body = String(init.body);
    expect(body).toContain('name="bn-BD-PradeepNeural"');
    expect(body).toContain("নয় নয় নয়-এ");
    expect(body).toContain("দুই হাজার ছাব্বিশ");
    expect(body).not.toContain("০১৭১২৩৪৫৬৭৮");
    expect(body).toContain("&amp;");
    expect(body).not.toContain("<b>");
  });
  it("uses a male English voice for English", () => {
    expect(ssml("Hello", "en")).toContain("en-IN-PrabhatNeural");
    expect(speakable("see https://x.example now", "en")).toBe("see now");
  });
  it("caches repeated lines and caps the day's characters", async () => {
    const f = vi.fn().mockImplementation(async () => audio());
    await synthesize("স্বাগতম", "bn", f as never);
    const again = await synthesize("স্বাগতম", "bn", f as never);
    expect(again.ok && again.cached).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    process.env.AZURE_SPEECH_DAILY_CHARS = "10";
    expect(await synthesize("অনেক লম্বা একটি নতুন বাক্য", "bn", f as never)).toEqual({ ok: false, reason: "daily_cap" });
  });
  it("reports provider failures without throwing", async () => {
    expect(await synthesize("ক", "bn", (async () => new Response("no", { status: 500 })) as never)).toEqual({ ok: false, reason: "provider_error" });
    expect(await synthesize("খ", "bn", (async () => { throw new DOMException("t", "TimeoutError"); }) as never)).toEqual({ ok: false, reason: "timeout" });
  });
});
