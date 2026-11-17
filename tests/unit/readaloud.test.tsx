import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReadAloud from "@/components/ui/ReadAloud";
import { chunk, fetchAudio, hasVoice } from "@/lib/readaloud";
import { json } from "./helpers-r11";

let flagOn = true;
vi.mock("@/lib/flags-more", () => ({ FLAGS: { consultations: false, commitments: false, priorities: false, surveys: false, officeRelease11: false, channels: false, darkMode: false, get readAloud() { return flagOn; } } }));

interface Spoken { text: string; lang: string }
function stubSpeech(voices: { lang: string }[]) {
  const spoken: Spoken[] = [];
  const synth = { speak: vi.fn((u: { text: string; lang: string; onend?: () => void }) => { spoken.push({ text: u.text, lang: u.lang }); queueMicrotask(() => u.onend?.()); }), cancel: vi.fn(), getVoices: () => voices };
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; lang = ""; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } });
  return { synth, spoken };
}
function stubFetch(speak: () => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/ai/speak")) return init?.method === "POST" ? speak() : json(200, { data: { available: false, fallback: "browser" } });
    return json(404, { code: "not_found" });
  }));
}

beforeEach(() => { flagOn = true; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("read-aloud helpers (F7.9)", () => {
  it("chunks at sentence ends and never loses text", () => {
    const text = "প্রথম বাক্য। দ্বিতীয় বাক্য। তৃতীয় বাক্য এখানে।";
    const parts = chunk(text, 20);
    expect(parts.every((p) => p.length <= 20)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(text);
    expect(chunk("   ")).toEqual([]);
    expect(chunk("ab", 20)).toEqual(["ab"]);
    const long = chunk("a".repeat(50), 20);
    expect(long.join("")).toBe("a".repeat(50));
  });
  it("a Bangla voice is found by language, not by exact tag", () => {
    expect(hasVoice([{ lang: "en-US" }, { lang: "bn_BD" }], "bn-BD")).toBe(true);
    expect(hasVoice([{ lang: "bn-IN" }], "bn-BD")).toBe(true);
    expect(hasVoice([{ lang: "en-US" }], "bn-BD")).toBe(false);
  });
  it("the server audio is used only when it really answers with audio", async () => {
    expect(await fetchAudio("x", "bn", (async () => new Response("a", { headers: { "Content-Type": "audio/mpeg" } })) as unknown as typeof fetch)).not.toBeNull();
    expect(await fetchAudio("x", "bn", (async () => json(503, { code: "unavailable", field_errors: { _: "tts_not_configured" } })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchAudio("x", "bn", (async () => new Response("<html>", { headers: { "Content-Type": "text/html" } })) as unknown as typeof fetch)).toBeNull();
    expect(await fetchAudio("x", "bn", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
  });
});

describe("the Listen button", () => {
  it("draws nothing when the flag is off, when the device cannot speak, or when there is no text", () => {
    stubSpeech([{ lang: "bn-BD" }]);
    flagOn = false;
    const a = render(<ReadAloud text="অফিসের উত্তর" what="উত্তর" />);
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();
    flagOn = true;
    const b = render(<ReadAloud text="   " what="উত্তর" />);
    expect(b.container).toBeEmptyDOMElement();
    b.unmount();
    vi.unstubAllGlobals();
    const c = render(<ReadAloud text="অফিসের উত্তর" what="উত্তর" />);
    expect(c.container).toBeEmptyDOMElement();
  });
  it("reads the given text in the browser voice, in bn-BD, and is back to Listen when it ends", async () => {
    const { spoken } = stubSpeech([{ lang: "bn-BD" }]);
    stubFetch(() => json(503, {}));
    const u = userEvent.setup();
    render(<ReadAloud text="আপনার সমস্যাটি পেয়েছি।" what="অফিসের উত্তর" />);
    const btn = await screen.findByRole("button", { name: "শুনুন: অফিসের উত্তর" });
    await u.click(btn);
    await waitFor(() => expect(spoken).toEqual([{ text: "আপনার সমস্যাটি পেয়েছি।", lang: "bn-BD" }]));
    expect(await screen.findByRole("button", { name: /^শুনুন: / })).toHaveTextContent("শুনুন");
  });
  it("says so when the phone has no Bangla voice, and does not read in another voice", async () => {
    const { spoken } = stubSpeech([{ lang: "en-US" }]);
    stubFetch(() => json(503, {}));
    const u = userEvent.setup();
    render(<ReadAloud text="আপনার সমস্যাটি পেয়েছি।" what="উত্তর" />);
    await u.click(await screen.findByRole("button", { name: /^শুনুন: / }));
    expect(await screen.findByRole("status")).toHaveTextContent("বাংলা পড়ার মতো কণ্ঠ নেই");
    expect(spoken).toEqual([]);
  });
  it("stop cancels speech, and a long text is read in pieces", async () => {
    const { synth, spoken } = stubSpeech([{ lang: "bn-BD" }]);
    synth.speak.mockImplementation((u: { text: string; lang: string }) => { spoken.push({ text: u.text, lang: u.lang }); });   // never ends, so the button stays on Stop
    stubFetch(() => json(503, {}));
    const u = userEvent.setup();
    render(<ReadAloud text={`${"এটি একটি বাক্য। ".repeat(40)}`} what="উত্তর" />);
    await u.click(await screen.findByRole("button", { name: /^শুনুন: / }));
    await waitFor(() => expect(spoken.length).toBeGreaterThan(1));
    expect(spoken.every((s) => s.text.length <= 220)).toBe(true);
    await u.click(screen.getByRole("button", { name: /^থামান: / }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /^শুনুন: / })).toHaveTextContent("শুনুন");
  });
  it("uses the server voice when the server has one, and falls back to the browser voice when it fails", async () => {
    const { spoken } = stubSpeech([{ lang: "bn-BD" }]);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => (String(url).includes("/ai/speak") ? (init?.method === "POST" ? json(503, { code: "unavailable" }) : json(200, { data: { available: true, max_chars: 1200 } })) : json(404, {}))));
    const u = userEvent.setup();
    render(<ReadAloud text="আপনার সমস্যাটি পেয়েছি।" what="উত্তর" />);
    await u.click(await screen.findByRole("button", { name: /^শুনুন: / }));
    await waitFor(() => expect(spoken).toHaveLength(1));
  });
});
