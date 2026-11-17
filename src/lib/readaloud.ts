import { api, ApiError } from "@/lib/api-client";
import { country } from "@/lib/country";

/**
 * Read-aloud (F7.9, masterplan 19.6). Two ways to speak, in this order:
 *  1. the server voice (`POST /ai/speak`, B7.12), when `GET /ai/speak` says it is available. Text is redacted of personal data on the server first.
 *  2. the browser's own voice (`speechSynthesis`, bn-BD), which needs no network and sends nothing anywhere.
 * If neither can speak the button is not drawn. The text is only ever text already on the screen.
 */
export interface SpeakInfo { available: boolean; lang?: string; max_chars?: number; fallback?: string }
export const SERVER_MAX = 1200;

/** Cuts text into pieces of at most `max` characters at sentence ends (। . ? !), then at spaces, so the voice never stops mid-word. */
export function chunk(text: string, max = SERVER_MAX): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    const win = rest.slice(0, max);
    let cut = Math.max(win.lastIndexOf("। "), win.lastIndexOf(". "), win.lastIndexOf("? "), win.lastIndexOf("! "));
    if (cut < max * 0.4) cut = win.lastIndexOf(" ");
    if (cut <= 0) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

export async function fetchSpeakInfo(): Promise<SpeakInfo> {
  try { return (await api<SpeakInfo>("/ai/speak")).data; } catch { return { available: false }; }
}

/** One piece of audio from the server voice. 503 `tts_not_configured` and any other failure mean "use the browser voice". */
export async function fetchAudio(text: string, lang: string, doFetch: typeof fetch = fetch): Promise<Blob | null> {
  try {
    const res = await doFetch("/api/v1/ai/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang }) });
    if (!res.ok || !(res.headers.get("Content-Type") ?? "").startsWith("audio/")) return null;
    return await res.blob();
  } catch { return null; }
}

export const browserCanSpeak = (w: Pick<Window, "speechSynthesis"> | undefined = typeof window === "undefined" ? undefined : window): boolean => !!w && "speechSynthesis" in w && typeof SpeechSynthesisUtterance !== "undefined";

/** The BCP-47 tag for speech, from the country adapter (Bangla for Bangladesh pages). */
export const speechLang = (lang: "bn" | "en") => country().speechLocale[lang];

/** Does this device have a voice for the language? Some phones have none for Bangla: then we say so instead of reading in a wrong voice. */
export function hasVoice(voices: readonly Pick<SpeechSynthesisVoice, "lang">[], tag: string): boolean {
  const base = tag.split("-")[0].toLowerCase();
  return voices.some((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
}

export const isNotConfigured = (e: unknown) => e instanceof ApiError && (e.fieldErrors._ === "tts_not_configured" || e.status === 503);
