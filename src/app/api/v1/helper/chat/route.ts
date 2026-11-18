import { z } from "zod";
import { parse, run } from "@/lib/api";
import { reply } from "@/lib/helper/chat";
import { loginUrl } from "@/lib/guard";
import { helperAi } from "@/lib/ai/helper";
import { styleFor } from "@/lib/ai/style";
import { flagState } from "@/lib/capabilities";
import { liveFlags } from "@/lib/helper/navigate";

const Turn = z.strictObject({ role: z.enum(["user", "bot"]), text: z.string().max(500) });
const Body = z.strictObject({
  messages: z.array(Turn).min(1).max(10),
  lang: z.enum(["bn", "en"]),
  page: z.string().max(200).regex(/^\/[A-Za-z0-9/_\-.?=&%#]*$/, "a path on this site").default("/"),
  voice: z.boolean().default(false),
});

// POST /api/v1/helper/chat: Dadu's answer to the last user message. Public (no sign-in needed) because the scripted brain calls no model; only a per-IP limit applies.
// The reply is a list of blocks (docs/api-v1.md, "Dadu"). A `navigate` block appears only for a spoken request, and its href always comes from a fixed table.
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/helper/chat", auth: "optional", limit: { user: 30, ip: 20 }, maxBytes: 8 * 1024, feature: "helper" }, async (c) => {
    const b = parse(Body, c.body);
    const out = reply(b, { signedIn: !!c.user, loginUrl });
    // The model layer: only for a signed-in person, only with its own switch on (unlike other routes, a missing row means OFF here), only for what the scripted brain answered weakly.
    const weak = out.source === "kb" || out.intent === "out_of_scope" || (out.source === "rules" && out.confidence < 0.8 && !out.intent.startsWith("nav_") && out.intent !== "page_help");
    if (weak && c.user && process.env.ANTHROPIC_API_KEY && (await flagState(c.sb, "helper_ai"))?.enabled === true) {
      const last = [...b.messages].reverse().find((m) => m.role === "user")?.text ?? "";
      const ai = await helperAi(last, out.lang, b.page, liveFlags(), { actorId: c.user.id, requestId: c.rid, simpleLanguage: (await styleFor(c.sb, c.user.id)).simpleLanguage });
      if (ai) return { data: { ...out, blocks: ai.blocks, source: "ai" as const, intent: "ai_answer", mood: "talk" as const } };
    }
    return { data: out };
  });
}
