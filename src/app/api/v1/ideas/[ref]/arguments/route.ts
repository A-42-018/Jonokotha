import { run } from "@/lib/api";
import { listIdeaArguments, addIdeaArgument } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/arguments">) { return run(req, await ctx.params, { name: "GET /api/v1/ideas/{ref}/arguments", auth: "optional", limit: { ip: 120 }, feature: "idea_arguments" }, listIdeaArguments); }
export async function POST(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/arguments">) { return run(req, await ctx.params, { name: "POST /api/v1/ideas/{ref}/arguments", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "idea_arguments" }, addIdeaArgument); }
