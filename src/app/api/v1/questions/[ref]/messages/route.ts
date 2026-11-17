import { run } from "@/lib/api";
import { postMessage } from "@/lib/ideas-questions";

// POST {body}: the asker or the office replies.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/questions/[ref]/messages">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/questions/{ref}/messages", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional" }, postMessage);
}
