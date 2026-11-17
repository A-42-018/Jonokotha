import { run } from "@/lib/api";
import { adminBudgetSources } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/budget/sources", auth: "required", limit: { user: 30, ip: 60 }, feature: "budget_transparency" }, adminBudgetSources); }
