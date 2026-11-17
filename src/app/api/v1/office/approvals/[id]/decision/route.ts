import { run } from "@/lib/api";
import { decideApproval } from "@/lib/mp-office";

// POST {decision: approve|reject, note?}: MP of the area or admin. A rejection needs a reason. Audited; the requester is notified.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/approvals/[id]/decision">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/approvals/{id}/decision", auth: "required", limit: { user: 30, ip: 60 }, idempotency: "optional" }, decideApproval);
}
