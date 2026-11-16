import { ApiError, run } from "@/lib/api";
import { isOfficeAction, performOfficeAction, type OfficeEndpoint } from "@/lib/office-actions";

const REF = /^[A-Za-z0-9-]{3,40}$/;

// POST /api/v1/office/issues/{ref}/{action}
//   acknowledge | assign | request-information | forward | update | resolve | close   (masterplan §13.3)
//   reject | mark-duplicate | out-of-jurisdiction | reopen                            (decisions, §9)
// The database (transition_issue / assign_issue / add_issue_note) is the authority for who may do what.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]/[action]">) {
  const params = await ctx.params;
  const known = isOfficeAction(params.action);
  return run(req, params, { name: `POST /api/v1/office/issues/{ref}/${known ? params.action : "unknown"}`, auth: "required", limit: { user: 60, ip: 120 }, idempotency: "optional" }, async (c) => {
    if (!known || !REF.test(params.ref)) throw new ApiError("not_found", "Not found.");
    const { data: issue } = await c.sb.from("issues").select("id,status").eq("ref", params.ref).maybeSingle();
    if (!issue) throw new ApiError("not_found", "Issue not found.");
    return performOfficeAction(c, params.action as OfficeEndpoint, issue as Parameters<typeof performOfficeAction>[2]);
  });
}
