import { z } from "zod";
import { ApiError, fromDbError, parse, run } from "@/lib/api";

const Body = z.strictObject({ visibility: z.enum(["private", "office", "public"]), status: z.enum(["approved", "rejected"]) });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /office/issues/{ref}/media/{id}: the office approves or rejects a photo and decides whether it may be shown publicly.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]/media/[id]">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/issues/{ref}/media/{id}", auth: "required", limit: { user: 60, ip: 120 } }, async (c) => {
    if (!UUID.test(params.id)) throw new ApiError("not_found", "Photo not found.");
    const b = parse(Body, c.body);
    const { error, data } = await c.sb.rpc("review_issue_media", { p_media: params.id, p_visibility: b.visibility, p_status: b.status });
    if (error) throw fromDbError(error);
    return { data };
  });
}
