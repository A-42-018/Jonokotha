import { z } from "zod";
import { parse, run } from "@/lib/api";
import { ideaAssist } from "@/lib/ai/idea";
import { styleFor } from "@/lib/ai/style";

const Body = z.strictObject({ title: z.string().trim().min(3, "at least 3 characters").max(120), body: z.string().trim().min(3, "at least 3 characters").max(2000) });

// POST {title, body}: clarity suggestions before posting an idea (Idea Assistant). Suggestions only; nothing is stored or posted. Falls back to rule-based questions when the model is unavailable (`source: "rules"`).
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/ai/idea-assist", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: 8 * 1024 }, async (c) => {
    const b = parse(Body, c.body);
    return { data: await ideaAssist(b.title, b.body, { actorId: c.user!.id, requestId: c.rid, simpleLanguage: (await styleFor(c.sb, c.user!.id)).simpleLanguage }) };
  });
}
