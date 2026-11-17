import { run } from "@/lib/api";
import { publicConsultationReport } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/consultations/[ref]/report">) { return run(req, await ctx.params, { name: "GET /api/v1/consultations/{ref}/report", auth: "optional", limit: { ip: 120 }, feature: "consultations" }, publicConsultationReport); }
