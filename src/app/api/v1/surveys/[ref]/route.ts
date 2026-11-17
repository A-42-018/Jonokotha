import { run } from "@/lib/api";
import { getSurvey } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/surveys/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/surveys/{ref}", auth: "optional", limit: { ip: 120 }, feature: "surveys" }, getSurvey); }
