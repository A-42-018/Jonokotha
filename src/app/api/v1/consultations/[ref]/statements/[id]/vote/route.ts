import { run } from "@/lib/api";
import { voteConsultationStatement } from "@/lib/release11";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/consultations/[ref]/statements/[id]/vote">) { return run(req, await ctx.params, { name: "PUT /api/v1/consultations/{ref}/statements/{id}/vote", auth: "required", limit: { user: 120, ip: 240 }, feature: "consultations" }, voteConsultationStatement); }
