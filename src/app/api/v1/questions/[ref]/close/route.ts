import { run } from "@/lib/api";
import { closeQuestion } from "@/lib/ideas-questions";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/questions/[ref]/close">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/questions/{ref}/close", auth: "required", limit: { user: 20, ip: 60 } }, closeQuestion);
}
