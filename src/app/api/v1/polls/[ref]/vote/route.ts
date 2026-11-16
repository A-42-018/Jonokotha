import { run } from "@/lib/api";
import { votePoll } from "@/lib/engagement5";

// POST {option_id}: a verified account votes once per poll while it is open.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/polls/[ref]/vote">) {
  return run(req, await ctx.params, { name: "POST /api/v1/polls/{ref}/vote", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional", feature: "polls" }, votePoll);
}
