import { run } from "@/lib/api";
import { getIdea } from "@/lib/ideas-questions";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/ideas/{ref}", auth: "optional", limit: { ip: 120 } }, getIdea);
}
