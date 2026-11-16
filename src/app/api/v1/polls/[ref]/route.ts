import { run } from "@/lib/api";
import { getPoll } from "@/lib/engagement5";

// GET: the poll, its options and results (only after close or when the office chose "always", and only with 5 or more votes).
export async function GET(req: Request, ctx: RouteContext<"/api/v1/polls/[ref]">) {
  return run(req, await ctx.params, { name: "GET /api/v1/polls/{ref}", auth: "optional", limit: { ip: 120 }, feature: "polls" }, getPoll);
}
