import { run } from "@/lib/api";
import { publicReferrals } from "@/lib/liaison";

// GET: published referrals of a public issue, with the stage (received, forwarded, officially_registered) and whether an integration is confirmed.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/referrals">) {
  return run(req, await ctx.params, { name: "GET /api/v1/issues/{ref}/referrals", auth: "optional", limit: { ip: 120 } }, publicReferrals);
}
