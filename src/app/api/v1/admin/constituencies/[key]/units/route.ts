import { run } from "@/lib/api";
import { linkUnits } from "@/lib/hierarchy";

// POST {unit_codes[], country?}: admin links administrative units to a constituency. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/constituencies/[key]/units">) {
  return run(req, await ctx.params, { name: "POST /api/v1/admin/constituencies/{key}/units", auth: "required", limit: { user: 10, ip: 30 } }, linkUnits);
}
