import { run } from "@/lib/api";
import { setAffected } from "@/lib/engagement";

// POST adds "আমারও একই সমস্যা" for the signed-in user; DELETE withdraws it. Both idempotent. Returns the public count.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/affected">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/issues/{ref}/affected", auth: "required", limit: { user: 30, ip: 60 }, idempotency: "optional" }, (c) => setAffected(c, true));
}
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/affected">) {
  const params = await ctx.params;
  return run(req, params, { name: "DELETE /api/v1/issues/{ref}/affected", auth: "required", limit: { user: 30, ip: 60 } }, (c) => setAffected(c, false));
}
