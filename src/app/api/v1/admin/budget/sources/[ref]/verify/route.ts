import { run } from "@/lib/api";
import { verifyBudgetSource } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/budget/sources/[ref]/verify">) { return run(req, await ctx.params, { name: "POST /api/v1/admin/budget/sources/[ref]/verify", auth: "required", limit: { user: 20, ip: 60 }, feature: "budget_transparency" }, verifyBudgetSource); }
