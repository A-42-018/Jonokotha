import { run } from "@/lib/api";
import { getQuestion } from "@/lib/ideas-questions";

// GET: the asker and the office see their question; others see it only if it is a public, moderated question.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/questions/[ref]">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/questions/{ref}", auth: "optional", limit: { ip: 120 } }, getQuestion);
}
