import { run } from "@/lib/api";
import { respondCheckin } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/checkins/[id]/response">) { return run(req, await ctx.params, { name: "POST /api/v1/office/checkins/{id}/response", auth: "required", limit: { user: 30, ip: 60 }, feature: "project_checkins" }, respondCheckin); }
