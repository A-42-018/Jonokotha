import { run } from "@/lib/api";
import { consultationReport } from "@/lib/release11";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/office/consultations/[ref]/report">) { return run(req, await ctx.params, { name: "PUT /api/v1/office/consultations/{ref}/report", auth: "required", limit: { user: 20, ip: 60 }, feature: "consultations" }, consultationReport); }
