import { run } from "@/lib/api";
import { commitmentDecision } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/commitments/[ref]/decision">) { return run(req, await ctx.params, { name: "POST /api/v1/office/commitments/{ref}/decision", auth: "required", limit: { user: 20, ip: 60 }, feature: "commitments" }, commitmentDecision); }
