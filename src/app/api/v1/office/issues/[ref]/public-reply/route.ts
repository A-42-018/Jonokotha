import { run } from "@/lib/api";
import { publicReply } from "@/lib/mp-office";

// POST {note}: a reply the citizen sees. 201 when published, 202 when it waits for the MP's approval.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]/public-reply">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/issues/{ref}/public-reply", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional" }, publicReply);
}
