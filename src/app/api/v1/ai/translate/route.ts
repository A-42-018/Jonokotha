import { z } from "zod";
import { parse, run } from "@/lib/api";
import { styleFor } from "@/lib/ai/style";
import { translateText } from "@/lib/intake-v2";

const Body = z.strictObject({ text: z.string().trim().min(1, "required").max(2000, "at most 2000 characters"), to: z.enum(["bn", "en"]) });

// POST /api/v1/ai/translate: on demand, always labelled machine translation, the original is always returned. `available: false` (with `reason`) means show the original text.
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/ai/translate", auth: "required", limit: { user: 20, ip: 60 }, maxBytes: 8 * 1024 }, async (c) => {
    const b = parse(Body, c.body);
    return { data: await translateText(b.text, b.to, { actorId: c.user!.id, requestId: c.rid, simpleLanguage: (await styleFor(c.sb, c.user!.id)).simpleLanguage }) };
  });
}
