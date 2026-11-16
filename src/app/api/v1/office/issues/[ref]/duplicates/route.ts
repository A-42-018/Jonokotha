import { ApiError, run } from "@/lib/api";
import { suggestDuplicates } from "@/lib/ai/duplicates";

const REF = /^[A-Za-z0-9-]{3,40}$/;

// POST /api/v1/office/issues/{ref}/duplicates  — possible duplicates (same office and category), as pending AI suggestions.
// Office staff in scope only (find_similar_issues checks it). Staff then Accept / Edit / Dismiss through
// POST /api/v1/ai/suggestions/{id}/decision and, to close the issue as a duplicate, use the mark-duplicate action.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]/duplicates">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/issues/{ref}/duplicates", auth: "required", limit: { user: 30, ip: 60 } }, async (c) => {
    if (!REF.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    const { data: issue } = await c.sb.from("issues").select("id").eq("ref", params.ref).maybeSingle();
    if (!issue) throw new ApiError("not_found", "Issue not found.");
    if (c.actor?.role !== "admin" && !c.actor?.offices?.length) throw new ApiError("forbidden", "You are not allowed to do this.");
    const out = await suggestDuplicates(c.sb, issue.id, { actorId: c.user?.id, requestId: c.rid });
    return { data: { available: out.available, candidates: out.candidates.map((x) => ({ suggestion_id: x.suggestionId, ref: x.ref, score: x.score, reasons: x.reasons })) } };
  });
}
