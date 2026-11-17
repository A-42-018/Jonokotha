import { run } from "@/lib/api";
import { setArgumentHelpful } from "@/lib/release11";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/arguments/[id]/helpful">) { return run(req, await ctx.params, { name: "PUT /api/v1/ideas/{ref}/arguments/{id}/helpful", auth: "required", limit: { user: 60, ip: 120 }, feature: "idea_arguments" }, setArgumentHelpful); }
