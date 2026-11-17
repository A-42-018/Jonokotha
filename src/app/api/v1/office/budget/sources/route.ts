import { run } from "@/lib/api";
import { officeBudgetSources, createBudgetSource } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/budget/sources", auth: "required", limit: { user: 30, ip: 60 }, feature: "budget_transparency" }, officeBudgetSources); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/budget/sources", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "budget_transparency" }, createBudgetSource); }
