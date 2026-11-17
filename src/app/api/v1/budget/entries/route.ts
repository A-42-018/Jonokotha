import { run } from "@/lib/api";
import { listBudgetEntries } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/budget/entries", auth: "optional", limit: { ip: 120 }, feature: "budget_transparency" }, listBudgetEntries); }
