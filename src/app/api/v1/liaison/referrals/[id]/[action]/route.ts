import { run } from "@/lib/api";
import { liaisonAction } from "@/lib/liaison";

// POST .../acknowledge | updates {note, public?} | reference {external_reference?, channel?} | close {evidence, note?}: the agency liaison of that referral.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/liaison/referrals/[id]/[action]">) {
  const p = await ctx.params;
  return run(req, p, { name: `POST /api/v1/liaison/referrals/{id}/${/^(acknowledge|updates|reference|close)$/.test(p.action) ? p.action : "x"}`, auth: "required", limit: { user: 30, ip: 60 }, idempotency: "optional" }, liaisonAction);
}
