import { run } from "@/lib/api";
import { createBudgetEntry } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/budget/sources/[ref]/entries">) { return run(req, await ctx.params, { name: "POST /api/v1/office/budget/sources/[ref]/entries", auth: "required", limit: { user: 30, ip: 60 }, idempotency: "optional", feature: "budget_transparency" }, createBudgetEntry); }
