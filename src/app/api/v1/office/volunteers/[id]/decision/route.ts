import { run } from "@/lib/api";
import { volunteerDecision } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/volunteers/[id]/decision">) { return run(req, await ctx.params, { name: "POST /api/v1/office/volunteers/[id]/decision", auth: "required", limit: { user: 20, ip: 60 }, feature: "assisted_reporting" }, volunteerDecision); }
