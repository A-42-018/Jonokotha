import { ApiError, auditAdminRead, run } from "@/lib/api";
import { getOffice } from "@/lib/issues-service";

const REF = /^[A-Za-z0-9-]{3,40}$/;

// GET /api/v1/office/issues/{ref}: full detail with internal notes. Out-of-scope issues look like "not found".
// An administrator reading it leaves an audit row first (masterplan §5.6).
export async function GET(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/office/issues/{ref}", auth: "required", limit: { user: 240, ip: 240 } }, async (c) => {
    if (!REF.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    await auditAdminRead(c, "issue", params.ref);
    return { data: await getOffice(c.sb, params.ref) };
  });
}
