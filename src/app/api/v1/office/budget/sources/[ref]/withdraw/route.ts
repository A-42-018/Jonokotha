import { run } from "@/lib/api";
import { withdrawBudgetSource } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/budget/sources/[ref]/withdraw">) { return run(req, await ctx.params, { name: "POST /api/v1/office/budget/sources/[ref]/withdraw", auth: "required", limit: { user: 10, ip: 30 }, feature: "budget_transparency" }, withdrawBudgetSource); }
