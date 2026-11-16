import { run } from "@/lib/api";
import { createReport, listOfficeReports } from "@/lib/analytics";

// POST {constituency, days?, narrative?, generate_narrative?}: freeze a snapshot as a DRAFT. GET: drafts and approved reports in your scope.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/analytics/reports", auth: "required", limit: { user: 30, ip: 60 } }, listOfficeReports); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/analytics/reports", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, createReport); }
