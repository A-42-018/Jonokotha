import { run } from "@/lib/api";
import { setApprovalSetting } from "@/lib/mp-office";

// POST {required}: MP of the area or admin turns "MP approves publications" on or off. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/constituencies/[key]/mp-approval">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/constituencies/{key}/mp-approval", auth: "required", limit: { user: 10, ip: 30 } }, setApprovalSetting);
}
