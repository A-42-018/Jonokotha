import { run } from "@/lib/api";
import { updateProject } from "@/lib/reps-projects";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/projects/[ref]">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/projects/{ref}", auth: "required", limit: { user: 30, ip: 60 } }, updateProject);
}
