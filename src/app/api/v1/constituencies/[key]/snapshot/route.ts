import { run } from "@/lib/api";
import { snapshot } from "@/lib/engagement5";

// GET ?from=&to=: reported, in progress and resolved counts of PUBLIC issues in an area for a date range (default last 30 days), with the definition and last update. Not a ranking.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/constituencies/[key]/snapshot">) {
  return run(req, await ctx.params, { name: "GET /api/v1/constituencies/{key}/snapshot", auth: "optional", limit: { ip: 120 } }, snapshot);
}
