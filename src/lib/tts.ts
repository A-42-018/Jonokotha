import { z } from "zod";
import { ApiError, parse, type Ctx, type Result } from "./api";
import { redactPii } from "./pii";

/**
 * Read-aloud (B7.12; masterplan §19.6). Bangla text-to-speech through a provider that returns audio for a text, configured by environment
 * (TTS_API_URL, TTS_API_KEY, optional TTS_VOICE). With no provider configured the route says so and names the fallback the app should use:
 * the browser's own speech synthesis with lang "bn-BD". Text is redacted of phone numbers, emails and ID numbers before it leaves the server,
 * is limited to 1200 characters, and is never stored. Not exercised against a live provider (needs an account and a chosen Bangla voice).
 */
export interface TtsProvider { speak(text: string, lang: string): Promise<{ ok: true; audio: Uint8Array; contentType: string } | { ok: false; error: string }> }
let override: TtsProvider | null | undefined;
export const setTtsProviderForTests = (p: TtsProvider | null | undefined) => { override = p; };
export const MAX_TTS_CHARS = 1200;

export function ttsProvider(): TtsProvider | null {
  if (override !== undefined) return override;
  const url = process.env.TTS_API_URL, key = process.env.TTS_API_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return { async speak(text, lang) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ text, lang, voice: process.env.TTS_VOICE ?? undefined, format: "mp3" }), signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return { ok: false, error: `http_${res.status}` };
      return { ok: true, audio: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "audio/mpeg" };
    } catch (e) { return { ok: false, error: (e as Error)?.name ?? "error" }; }
  } };
}

export async function ttsConfig(): Promise<Result> {
  const p = ttsProvider();
  return { data: { available: !!p, lang: "bn-BD", max_chars: MAX_TTS_CHARS, fallback: "browser_speech_synthesis",
    note: p ? "Audio is generated on the server for the text you send." : "No speech provider is configured: use the browser's speech synthesis with lang bn-BD." } };
}

export async function speak(c: Ctx): Promise<Result> {
  const b = parse(z.strictObject({ text: z.string().trim().min(1).max(MAX_TTS_CHARS), lang: z.enum(["bn-BD", "en-US"]).default("bn-BD") }), c.body);
  const p = ttsProvider();
  if (!p) throw new ApiError("unavailable", "No speech provider is configured. Use the browser's speech synthesis (lang bn-BD).", { _: "tts_not_configured" });
  const out = await p.speak(redactPii(b.text).text, b.lang);
  if (!out.ok) throw new ApiError("unavailable", "The speech provider did not answer. Try again, or use the browser's speech synthesis.", { _: "tts_failed" });
  return { raw: { body: out.audio as unknown as BodyInit, contentType: out.contentType } };
}
