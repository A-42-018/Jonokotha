import { run } from "@/lib/api";
import { listOfficePb, createPb } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/participatory-budgets", auth: "required", limit: { user: 30, ip: 60 }, feature: "participatory_budgeting" }, listOfficePb); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/participatory-budgets", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "participatory_budgeting" }, createPb); }
