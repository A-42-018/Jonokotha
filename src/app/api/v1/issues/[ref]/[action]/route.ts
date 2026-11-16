import { ApiError, run } from "@/lib/api";
import { isCitizenAction, performCitizenAction } from "@/lib/citizen-actions";

const REF = /^[A-Za-z0-9-]{3,40}$/;

// POST /api/v1/issues/{ref}/additional-information | reopen | feedback: the reporter acting on their own issue.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/[action]">) {
  const params = await ctx.params;
  const known = isCitizenAction(params.action);
  return run(req, params, { name: `POST /api/v1/issues/{ref}/${known ? params.action : "unknown"}`, auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional" }, async (c) => {
    if (!known || !REF.test(params.ref)) throw new ApiError("not_found", "Not found.");
    // RLS lets a citizen read only their own issue here, so a stranger's ref looks like "not found".
    const { data: issue } = await c.sb.from("issues").select("id,status").eq("ref", params.ref).eq("reporter_id", c.user!.id).maybeSingle();
    if (!issue) throw new ApiError("not_found", "Issue not found.");
    return performCitizenAction(c, params.action as Parameters<typeof performCitizenAction>[1], issue as { id: string; status: string });
  });
}
