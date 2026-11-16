import { ApiError, run } from "@/lib/api";
import { runCopilot } from "@/lib/ai/copilot";

// POST: summary, missing-information checklist and a Bangla reply draft as pending suggestions with citations and confidence. Nothing is sent.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/issues/[ref]/copilot">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/issues/{ref}/copilot", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: 1024 }, async (c) => {
    if (!/^[A-Za-z0-9-]{3,40}$/.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    return { data: await runCopilot(c, params.ref) };
  });
}
