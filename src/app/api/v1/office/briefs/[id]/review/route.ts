import { run } from "@/lib/api";
import { reviewBrief } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/briefs/[id]/review">) { return run(req, await ctx.params, { name: "POST /api/v1/office/briefs/{id}/review", auth: "required", limit: { user: 20, ip: 60 }, feature: "weekly_briefs" }, reviewBrief); }
