import { run } from "@/lib/api";
import { consultationSummary } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/consultations/[ref]/summary">) { return run(req, await ctx.params, { name: "POST /api/v1/office/consultations/{ref}/summary", auth: "required", limit: { user: 5, ip: 20 }, feature: "consultations" }, consultationSummary); }
