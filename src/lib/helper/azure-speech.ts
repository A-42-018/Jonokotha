import { redactPii } from "../pii";
import { speakableBangla } from "./speech-text";
import type { Lang } from "./types";

/**
 * Dadu's server voice: Azure Speech (the official REST API), a male Bangla voice for Bangla and a male English voice for English.
 * The key stays on the server (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION). Personal details are removed before the text leaves; numbers are written out in words;
 * the text itself is never logged. A small in-memory cache keeps repeated lines (greetings, page guides) from being synthesised twice, and a daily character cap
 * keeps a runaway client from spending the quota. When Azure is not set up, `available` is false and the page falls back to the browser's own voice.
 */
export const VOICES: Record<Lang, { name: string; locale: string }> = { bn: { name: "bn-BD-PradeepNeural", locale: "bn-BD" }, en: { name: "en-IN-PrabhatNeural", locale: "en-IN" } };
export const MAX_CHARS = 600;
const FORMAT = "audio-24khz-48kbitrate-mono-mp3";

export const azureConfigured = (): boolean => !!process.env.AZURE_SPEECH_KEY && /^[a-z0-9-]{3,30}$/.test(process.env.AZURE_SPEECH_REGION ?? "");

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] as string);
/** Plain speakable text: personal details out, markdown out, numbers in words (Bangla). */
export function speakable(text: string, lang: Lang): string {
  const clean = redactPii(text).text.replace(/[*_`#>\[\]]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
  return lang === "bn" ? speakableBangla(clean) : clean;
}
export function ssml(text: string, lang: Lang): string {
  const v = VOICES[lang];
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.locale}"><voice name="${v.name}"><prosody rate="-6%">${xml(text)}</prosody></voice></speak>`;
}

const cache = new Map<string, Uint8Array>();
let day = "", used = 0;
const cap = () => Number(process.env.AZURE_SPEECH_DAILY_CHARS) || 15000;

export type Speech = { ok: true; audio: Uint8Array; cached: boolean } | { ok: false; reason: "not_configured" | "empty" | "daily_cap" | "provider_error" | "timeout" };

export async function synthesize(rawText: string, lang: Lang, fetcher: typeof fetch = fetch): Promise<Speech> {
  if (!azureConfigured()) return { ok: false, reason: "not_configured" };
  const text = speakable(rawText, lang);
  if (!text) return { ok: false, reason: "empty" };
  const key = `${lang}\n${text}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return { ok: true, audio: hit, cached: true }; }
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; used = 0; }
  if (used + text.length > cap()) return { ok: false, reason: "daily_cap" };
  try {
    const res = await fetcher(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": FORMAT, "User-Agent": "jonokotha-dadu" },
      body: ssml(text, lang),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: "provider_error" };
    const audio = new Uint8Array(await res.arrayBuffer());
    if (audio.byteLength < 100) return { ok: false, reason: "provider_error" };
    used += text.length;
    cache.set(key, audio);
    while (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return { ok: true, audio, cached: false };
  } catch (e) {
    return { ok: false, reason: /timeout|abort/i.test(String((e as Error)?.name)) ? "timeout" : "provider_error" };
  }
}
export const resetSpeechForTests = () => { cache.clear(); day = ""; used = 0; };
