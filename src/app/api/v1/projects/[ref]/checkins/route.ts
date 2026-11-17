import { run } from "@/lib/api";
import { listCheckins, createCheckin } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/projects/[ref]/checkins">) { return run(req, await ctx.params, { name: "GET /api/v1/projects/{ref}/checkins", auth: "optional", limit: { ip: 60 }, feature: "project_checkins" }, listCheckins); }
export async function POST(req: Request, ctx: RouteContext<"/api/v1/projects/[ref]/checkins">) { return run(req, await ctx.params, { name: "POST /api/v1/projects/{ref}/checkins", auth: "required", limit: { user: 5, ip: 20 }, idempotency: "optional", feature: "project_checkins" }, createCheckin); }
