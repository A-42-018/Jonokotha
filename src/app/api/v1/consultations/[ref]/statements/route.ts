import { run } from "@/lib/api";
import { addConsultationStatement } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/consultations/[ref]/statements">) { return run(req, await ctx.params, { name: "POST /api/v1/consultations/{ref}/statements", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "consultations" }, addConsultationStatement); }
