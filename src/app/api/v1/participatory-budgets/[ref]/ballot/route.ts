import { run } from "@/lib/api";
import { submitPbBallot } from "@/lib/release2";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/participatory-budgets/[ref]/ballot">) { return run(req, await ctx.params, { name: "PUT /api/v1/participatory-budgets/[ref]/ballot", auth: "required", limit: { user: 20, ip: 60 }, feature: "participatory_budgeting" }, submitPbBallot); }
