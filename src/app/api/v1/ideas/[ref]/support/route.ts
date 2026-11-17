import { run } from "@/lib/api";
import { setIdeaSupport } from "@/lib/ideas-questions";

// POST supports an idea (one per verified account, not your own); DELETE withdraws. Idempotent. Returns the public count.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/support">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/ideas/{ref}/support", auth: "required", limit: { user: 30, ip: 60 }, idempotency: "optional" }, (c) => setIdeaSupport(c, true));
}
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/support">) {
  const params = await ctx.params;
  return run(req, params, { name: "DELETE /api/v1/ideas/{ref}/support", auth: "required", limit: { user: 30, ip: 60 } }, (c) => setIdeaSupport(c, false));
}
