import { run } from "@/lib/api";
import { priorityAction } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/priorities/[ref]/status">) { return run(req, await ctx.params, { name: "POST /api/v1/office/priorities/{ref}/status", auth: "required", limit: { user: 20, ip: 60 }, feature: "priority_ranking" }, priorityAction); }
