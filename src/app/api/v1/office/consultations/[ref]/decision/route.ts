import { run } from "@/lib/api";
import { consultationDecision } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/consultations/[ref]/decision">) { return run(req, await ctx.params, { name: "POST /api/v1/office/consultations/{ref}/decision", auth: "required", limit: { user: 20, ip: 60 }, feature: "consultations" }, consultationDecision); }
