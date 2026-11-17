import { run } from "@/lib/api";
import { registerReferral } from "@/lib/liaison";

// POST {reference?, proof}: office manager records that the agency's system registered the case. Needs a confirmed integration.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/referrals/[id]/register">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/referrals/{id}/register", auth: "required", limit: { user: 20, ip: 60 } }, registerReferral);
}
