import { run } from "@/lib/api";
import { surveyResults } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/surveys/[ref]/results">) { return run(req, await ctx.params, { name: "GET /api/v1/surveys/{ref}/results", auth: "optional", limit: { ip: 120 }, feature: "surveys" }, surveyResults); }
