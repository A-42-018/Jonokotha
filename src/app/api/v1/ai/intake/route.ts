import { z } from "zod";
import { parse, run } from "@/lib/api";
import { styleFor } from "@/lib/ai/style";
import { draftIntakeV2 } from "@/lib/intake-v2";

const Body = z.strictObject({ text: z.string().trim().min(3, "at least 3 characters").max(3000, "at most 3000 characters"), language: z.enum(["bn", "en", "auto"]).default("auto") });

// POST /api/v1/ai/intake: draft only. Nothing is stored or submitted; the citizen reviews it and posts to /issues.
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/ai/intake", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: 8 * 1024 }, async (c) => {
    const b = parse(Body, c.body);
    return { data: await draftIntakeV2(b.text, b.language, { actorId: c.user!.id, requestId: c.rid, simpleLanguage: (await styleFor(c.sb, c.user!.id)).simpleLanguage }) };
  });
}
