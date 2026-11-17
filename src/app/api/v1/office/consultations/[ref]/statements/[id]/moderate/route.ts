import { run } from "@/lib/api";
import { moderateConsultationStatement } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/consultations/[ref]/statements/[id]/moderate">) { return run(req, await ctx.params, { name: "POST /api/v1/office/consultations/{ref}/statements/{id}/moderate", auth: "required", limit: { user: 60, ip: 120 }, feature: "consultations" }, moderateConsultationStatement); }
