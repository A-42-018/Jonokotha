import { createHash } from "node:crypto";
import { logAiRun } from "./ai/log";
import { redactPii, type PiiKind } from "./pii";

/** Speech to text through any OpenAI-compatible POST {base}/audio/transcriptions (Whisper family or a hosted bn-BD model). Env: TRANSCRIBE_BASE_URL, TRANSCRIBE_API_KEY, TRANSCRIBE_MODEL. */
export const transcribeConfigured = () => !!(process.env.TRANSCRIBE_BASE_URL && process.env.TRANSCRIBE_API_KEY);
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** The real type comes from the first bytes, not the file name or the declared type. */
export function sniffAudio(h: Uint8Array): { mime: string; ext: string } | null {
  const is = (o: number, ...b: number[]) => b.every((v, i) => h[o + i] === v);
  if (is(0, 0x1a, 0x45, 0xdf, 0xa3)) return { mime: "audio/webm", ext: "webm" };
  if (is(0, 0x4f, 0x67, 0x67, 0x53)) return { mime: "audio/ogg", ext: "ogg" };
  if (is(0, 0x52, 0x49, 0x46, 0x46) && is(8, 0x57, 0x41, 0x56, 0x45)) return { mime: "audio/wav", ext: "wav" };
  if (is(0, 0x49, 0x44, 0x33) || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", ext: "mp3" };
  if (is(4, 0x66, 0x74, 0x79, 0x70)) return { mime: "audio/mp4", ext: "m4a" };
  return null;
}

export type TranscribeResult =
  | { available: true; text: string; pii_warnings: PiiKind[]; language: string }
  | { available: false; reason: "not_configured" | "timeout" | "provider_error" };

export async function transcribe(audio: Uint8Array, kind: { mime: string; ext: string }, language: "bn" | "en", ctx: { actorId?: string | null; requestId?: string | null } = {}): Promise<TranscribeResult> {
  if (!transcribeConfigured()) return { available: false, reason: "not_configured" };
  const model = process.env.TRANSCRIBE_MODEL || "whisper-large-v3";
  const started = Date.now(), inputHash = createHash("sha256").update(audio).digest("hex");
  const log = (status: "ok" | "timeout" | "error", errorClass: string | null) => logAiRun({ agent: "transcription", status, model, promptId: "transcribe", promptVersion: "v1", inputHash, output: null,
    latencyMs: Date.now() - started, usage: null, costUsd: null, issueId: null, actorId: ctx.actorId ?? null, requestId: ctx.requestId ?? null, errorClass });
  try {
    const form = new FormData();
    form.set("file", new Blob([audio as BlobPart], { type: kind.mime }), `speech.${kind.ext}`);
    form.set("model", model); form.set("language", language); form.set("response_format", "json");
    const res = await fetch(`${process.env.TRANSCRIBE_BASE_URL!.replace(/\/$/, "")}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${process.env.TRANSCRIBE_API_KEY}` }, body: form, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { await log("error", `http_${res.status}`); return { available: false, reason: "provider_error" }; }
    const json = (await res.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof json?.text !== "string") { await log("error", "bad_response"); return { available: false, reason: "provider_error" }; }
    await log("ok", null);
    const { text, found } = redactPii(json.text.trim().slice(0, 4000)); // personal data a speaker says aloud is removed before it reaches the form
    return { available: true, text, pii_warnings: found, language };
  } catch (e) {
    const timeout = /timeout|abort/i.test(String((e as Error)?.name));
    await log(timeout ? "timeout" : "error", (e as Error)?.name ?? "Error");
    return { available: false, reason: timeout ? "timeout" : "provider_error" };
  }
}
