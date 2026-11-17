import { run } from "@/lib/api";
import { satisfaction } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/analytics/satisfaction", auth: "optional", limit: { ip: 120 }, feature: "surveys" }, satisfaction); }
