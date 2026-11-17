import { run } from "@/lib/api";
import { officeCheckins } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/office/projects/[ref]/checkins">) { return run(req, await ctx.params, { name: "GET /api/v1/office/projects/{ref}/checkins", auth: "required", limit: { user: 30, ip: 60 }, feature: "project_checkins" }, officeCheckins); }
