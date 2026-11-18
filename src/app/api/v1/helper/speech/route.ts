import { z } from "zod";
import { ApiError, parse, run } from "@/lib/api";
import { azureConfigured, MAX_CHARS, synthesize, VOICES } from "@/lib/helper/azure-speech";

const Body = z.strictObject({ text: z.string().trim().min(1).max(MAX_CHARS), lang: z.enum(["bn", "en"]) });

// GET: is the server voice there? (`available` is false without Azure keys; the page then uses the browser's voice, or shows no listen button.)
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/helper/speech", auth: "optional", limit: { ip: 120 }, feature: "helper_speech" }, async () => ({ data: { available: azureConfigured(), max_chars: MAX_CHARS, voices: VOICES }, headers: { "Cache-Control": "public, max-age=300" } }));
}

// POST {text, lang}: one short clip (mp3) in Dadu's male voice. Public, with a per-IP limit; the text is redacted before it leaves and never logged.
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/helper/speech", auth: "optional", limit: { user: 30, ip: 30 }, maxBytes: 4 * 1024, feature: "helper_speech" }, async (c) => {
    const b = parse(Body, c.body);
    const r = await synthesize(b.text, b.lang);
    if (!r.ok) throw new ApiError(r.reason === "daily_cap" ? "rate_limited" : "unavailable", "The server voice is not available right now.", { _: r.reason });
    return { raw: { body: r.audio as BodyInit, contentType: "audio/mpeg" }, headers: { "Cache-Control": "private, max-age=3600" } };
  });
}
