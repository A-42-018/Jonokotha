import { run } from "@/lib/api";
import { getProject } from "@/lib/reps-projects";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/projects/[ref]">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/projects/{ref}", auth: "optional", limit: { ip: 120 } }, getProject);
}
