import { run } from "@/lib/api";
import { requestLocationChange } from "@/lib/hierarchy";

// POST {lat, lng}: the reporter (or office) changes the report's location. Inside the same area it applies (200); if it would move the report to another area or cannot be placed it waits for review (202). Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/location">) {
  return run(req, await ctx.params, { name: "POST /api/v1/issues/{ref}/location", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, requestLocationChange);
}
