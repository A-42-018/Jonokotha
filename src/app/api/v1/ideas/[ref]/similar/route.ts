import { run } from "@/lib/api";
import { similarForDraft, similarIdeas } from "@/lib/ideas-questions";

// GET /ideas/{ref}/similar: look-alike ideas in the same area. With ref "new": ?constituency=&text= checks a draft before posting.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/similar">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/ideas/{ref}/similar", auth: "optional", limit: { ip: 60 } }, (c) => (params.ref === "new" ? similarForDraft(c) : similarIdeas(c)));
}
