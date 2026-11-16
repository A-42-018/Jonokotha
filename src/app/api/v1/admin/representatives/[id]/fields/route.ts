import { run } from "@/lib/api";
import { setRepresentativeField } from "@/lib/admin-service";

// PUT {field, value, source_url, checked_at}: every public fact needs a source and the date it was checked.
export async function PUT(req: Request, ctx: RouteContext<"/api/v1/admin/representatives/[id]/fields">) {
  const params = await ctx.params;
  return run(req, params, { name: "PUT /api/v1/admin/representatives/{id}/fields", auth: "required", limit: { user: 60, ip: 120 } }, setRepresentativeField);
}
