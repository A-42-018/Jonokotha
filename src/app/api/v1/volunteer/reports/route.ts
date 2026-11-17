import { run } from "@/lib/api";
import { myAssistedReports, submitAssistedReport } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/volunteer/reports", auth: "required", limit: { user: 30, ip: 60 }, feature: "assisted_reporting" }, myAssistedReports); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/volunteer/reports", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "required", feature: "assisted_reporting" }, submitAssistedReport); }
