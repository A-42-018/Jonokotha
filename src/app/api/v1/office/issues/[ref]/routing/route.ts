import { ApiError, run } from "@/lib/api";
import { suggestRouting } from "@/lib/ai/routing";

// POST: which agency, with citations (source, URL, date checked). `suggestion: null` means "no confident suggestion": route by hand.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]/routing">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/issues/{ref}/routing", auth: "required", limit: { user: 20, ip: 60 }, maxBytes: 1024 }, async (c) => {
    if (!/^[A-Za-z0-9-]{3,40}$/.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    return { data: await suggestRouting(c, params.ref) };
  });
}
