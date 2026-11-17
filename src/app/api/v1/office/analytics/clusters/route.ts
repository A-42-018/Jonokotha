import { run } from "@/lib/api";
import { officeClusters } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/analytics/clusters", auth: "required", limit: { user: 30, ip: 60 } }, officeClusters); }
