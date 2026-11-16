import { ApiError, run } from "@/lib/api";
import { officePollResults, setPollStatus } from "@/lib/engagement5";

// POST .../publish (draft -> open) | close | cancel: MP or office manager. Audited. GET .../results: full results for the office, any time.
const MAP = { publish: "open", close: "closed", cancel: "cancelled" } as const;
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/polls/[ref]/[action]">) {
  const p = await ctx.params;
  return run(req, p, { name: `POST /api/v1/office/polls/{ref}/${p.action in MAP ? p.action : "x"}`, auth: "required", limit: { user: 20, ip: 60 }, feature: "polls" }, async (c) => {
    if (!(p.action in MAP)) throw new ApiError("not_found", "Unknown action.");
    return setPollStatus(c, MAP[p.action as keyof typeof MAP]);
  });
}
export async function GET(req: Request, ctx: RouteContext<"/api/v1/office/polls/[ref]/[action]">) {
  const p = await ctx.params;
  return run(req, p, { name: "GET /api/v1/office/polls/{ref}/results", auth: "required", limit: { user: 30, ip: 60 }, feature: "polls" }, async (c) => {
    if (p.action !== "results") throw new ApiError("not_found", "Unknown action.");
    return officePollResults(c);
  });
}
