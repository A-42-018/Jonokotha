import { run } from "@/lib/api";
import { responsiveness } from "@/lib/reps-projects";

// GET ?from=&to= (default last 90 days): received, answered, pending, median hours to first response for ONE area. Never a ranking.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/constituencies/[key]/responsiveness">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/constituencies/{key}/responsiveness", auth: "optional", limit: { ip: 60 } }, responsiveness);
}
