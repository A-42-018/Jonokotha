import { run } from "@/lib/api";
import { getPriorityRound } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/priorities/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/priorities/{ref}", auth: "optional", limit: { ip: 120 }, feature: "priority_ranking" }, getPriorityRound); }
