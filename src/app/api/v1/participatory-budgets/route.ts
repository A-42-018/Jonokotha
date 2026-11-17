import { run } from "@/lib/api";
import { listPbCycles } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/participatory-budgets", auth: "optional", limit: { ip: 120 }, feature: "participatory_budgeting" }, listPbCycles); }
