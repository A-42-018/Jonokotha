import { run } from "@/lib/api";
import { decideLocationChange } from "@/lib/hierarchy";

// POST {decision: approve|reject, target?: area key among the candidates, note?}: office manager of the current area or admin. Approving may move the issue to another area (assignee cleared). Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/location-changes/[id]/decision">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/location-changes/{id}/decision", auth: "required", limit: { user: 20, ip: 60 } }, decideLocationChange);
}
