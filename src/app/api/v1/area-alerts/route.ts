import { run } from "@/lib/api";
import { listAreaAlerts } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/area-alerts", auth: "optional", limit: { ip: 120 } }, listAreaAlerts); }
