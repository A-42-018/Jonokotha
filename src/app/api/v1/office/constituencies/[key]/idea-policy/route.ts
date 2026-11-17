import { run } from "@/lib/api";
import { getIdeaPolicy, setIdeaPolicy } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/office/constituencies/[key]/idea-policy">) { return run(req, await ctx.params, { name: "GET /api/v1/office/constituencies/{key}/idea-policy", auth: "required", limit: { user: 30, ip: 60 }, feature: "idea_threshold" }, getIdeaPolicy); }
export async function PUT(req: Request, ctx: RouteContext<"/api/v1/office/constituencies/[key]/idea-policy">) { return run(req, await ctx.params, { name: "PUT /api/v1/office/constituencies/{key}/idea-policy", auth: "required", limit: { user: 10, ip: 30 }, feature: "idea_threshold" }, setIdeaPolicy); }
