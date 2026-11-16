import { ApiError, run } from "@/lib/api";
import { MAX_AUDIO_BYTES, sniffAudio, transcribe } from "@/lib/transcribe";

// POST /api/v1/ai/transcribe (multipart: audio, language=bn|en). The audio is never stored. Typing always works without this.
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/ai/transcribe", auth: "required", limit: { user: 8, ip: 20 }, maxBytes: MAX_AUDIO_BYTES + 64 * 1024, rawBody: true }, async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("audio");
    const lang = form?.get("language") ?? "bn";
    if (!(file instanceof File)) throw new ApiError("validation_failed", "Send the recording as the multipart field 'audio'.", { audio: "required" });
    if (lang !== "bn" && lang !== "en") throw new ApiError("validation_failed", "language must be bn or en.", { language: "invalid" });
    if (file.size < 200 || file.size > MAX_AUDIO_BYTES) throw new ApiError("validation_failed", "The recording must be between 200 bytes and 10 MB.", { audio: "size" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = sniffAudio(bytes.subarray(0, 16));
    if (!kind) throw new ApiError("validation_failed", "Unsupported audio type.", { audio: "type" });
    return { data: await transcribe(bytes, kind, lang, { actorId: c.user!.id, requestId: c.rid }) };
  });
}
