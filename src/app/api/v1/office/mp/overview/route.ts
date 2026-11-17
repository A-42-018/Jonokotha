import { run } from "@/lib/api";
import { mpOverview } from "@/lib/mp-office";

// GET ?constituency=&days=30: area analytics (groups under 5 hidden) plus pending approvals and open tasks. view_analytics permission.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/mp/overview", auth: "required", limit: { user: 30, ip: 60 } }, mpOverview); }
