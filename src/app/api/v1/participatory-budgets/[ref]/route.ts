import { run } from "@/lib/api";
import { getPbCycle } from "@/lib/release2";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/participatory-budgets/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/participatory-budgets/[ref]", auth: "optional", limit: { ip: 120 }, feature: "participatory_budgeting" }, getPbCycle); }
