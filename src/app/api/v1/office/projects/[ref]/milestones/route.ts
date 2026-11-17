import { run } from "@/lib/api";
import { addMilestone } from "@/lib/reps-projects";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/projects/[ref]/milestones">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/projects/{ref}/milestones", auth: "required", limit: { user: 30, ip: 60 } }, addMilestone);
}
