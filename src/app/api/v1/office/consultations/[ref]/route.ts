import { run } from "@/lib/api";
import { officeConsultation } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/office/consultations/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/office/consultations/{ref}", auth: "required", limit: { user: 60, ip: 120 }, feature: "consultations" }, officeConsultation); }
