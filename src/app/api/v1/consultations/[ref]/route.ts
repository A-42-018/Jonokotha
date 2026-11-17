import { run } from "@/lib/api";
import { getConsultation } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/consultations/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/consultations/{ref}", auth: "optional", limit: { ip: 120 }, feature: "consultations" }, getConsultation); }
