import { ApiError, run } from "@/lib/api";
import { getPublic } from "@/lib/issues-service";

const REF = /^[A-Za-z0-9-]{3,40}$/;

// GET /api/v1/issues/{ref}: public detail with the public timeline.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/issues/{ref}", auth: "optional", limit: { ip: 120 } }, async (c) => {
    if (!REF.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    return { data: await getPublic(c.sb, params.ref) };
  });
}
