import { run } from "@/lib/api";
import { listPublicReports } from "@/lib/analytics";

// GET ?constituency=: approved reports only.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/analytics/reports", auth: "optional", limit: { ip: 60 } }, listPublicReports); }
