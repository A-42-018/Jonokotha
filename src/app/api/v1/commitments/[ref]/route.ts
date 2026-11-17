import { run } from "@/lib/api";
import { getCommitment } from "@/lib/release11";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/commitments/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/commitments/{ref}", auth: "optional", limit: { ip: 120 }, feature: "commitments" }, getCommitment); }
