import { run } from "@/lib/api";
import { officePb } from "@/lib/release2";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/office/participatory-budgets/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/office/participatory-budgets/[ref]", auth: "required", limit: { user: 30, ip: 60 }, feature: "participatory_budgeting" }, officePb); }
