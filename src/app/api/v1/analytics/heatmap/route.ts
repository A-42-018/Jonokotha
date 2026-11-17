import { run } from "@/lib/api";
import { publicHeatmap } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/analytics/heatmap", auth: "optional", limit: { ip: 60 } }, publicHeatmap); }
