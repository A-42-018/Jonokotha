import { run } from "@/lib/api";
import { decideIdea } from "@/lib/ideas-questions";

// POST {decision: under_consideration|planned|declined, note?}: the office decides on an idea (decline needs a reason). Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/ideas/[ref]/decision">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/ideas/{ref}/decision", auth: "required", limit: { user: 60, ip: 120 }, idempotency: "optional" }, decideIdea);
}
