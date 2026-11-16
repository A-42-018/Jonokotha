import { run } from "@/lib/api";
import { projectDetails } from "@/lib/engagement5";

// POST {budget_source?, budget_verified_at?, procurement_ref?, contractor_name?}: MP or office manager. A budget source needs its verification date. Publish procurement details only where lawful. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/projects/[ref]/details">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/projects/{ref}/details", auth: "required", limit: { user: 20, ip: 60 } }, projectDetails);
}
