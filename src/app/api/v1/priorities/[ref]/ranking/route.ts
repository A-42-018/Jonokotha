import { run } from "@/lib/api";
import { submitPriorityRanking } from "@/lib/release11";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/priorities/[ref]/ranking">) { return run(req, await ctx.params, { name: "PUT /api/v1/priorities/{ref}/ranking", auth: "required", limit: { user: 20, ip: 60 }, feature: "priority_ranking" }, submitPriorityRanking); }
