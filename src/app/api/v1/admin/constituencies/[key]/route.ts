import { run } from "@/lib/api";
import { updateConstituency } from "@/lib/admin-config";

// POST {name_bn?, name_en?, district?, upazila_or_city?, is_active?}: admin edits a directory record. Boundaries come from the import endpoint. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/constituencies/[key]">) {
  return run(req, await ctx.params, { name: "POST /api/v1/admin/constituencies/{key}", auth: "required", limit: { user: 20, ip: 60 } }, updateConstituency);
}
