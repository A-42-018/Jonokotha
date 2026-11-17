import { run } from "@/lib/api";
import { release11Kpis } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/kpis/release-1-1", auth: "required", limit: { user: 30, ip: 60 } }, release11Kpis); }
