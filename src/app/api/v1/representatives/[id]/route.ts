import { run } from "@/lib/api";
import { getRepresentative } from "@/lib/reps-projects";

// GET: verified profile fields (each with source and date checked), recent announcements and projects of their areas.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/representatives/[id]">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/representatives/{id}", auth: "optional", limit: { ip: 120 } }, getRepresentative);
}
