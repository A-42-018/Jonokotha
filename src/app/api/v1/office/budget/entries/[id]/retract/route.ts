import { run } from "@/lib/api";
import { retractBudgetEntry } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/budget/entries/[id]/retract">) { return run(req, await ctx.params, { name: "POST /api/v1/office/budget/entries/[id]/retract", auth: "required", limit: { user: 20, ip: 60 }, feature: "budget_transparency" }, retractBudgetEntry); }
