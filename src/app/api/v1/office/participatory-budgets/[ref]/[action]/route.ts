import { run } from "@/lib/api";
import { pbAction } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/participatory-budgets/[ref]/[action]">) { return run(req, await ctx.params, { name: "POST /api/v1/office/participatory-budgets/[ref]/[action]", auth: "required", limit: { user: 20, ip: 60 }, feature: "participatory_budgeting" }, pbAction); }
