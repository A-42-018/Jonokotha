import { run } from "@/lib/api";
import { commitmentStatus } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/commitments/[ref]/status">) { return run(req, await ctx.params, { name: "POST /api/v1/office/commitments/{ref}/status", auth: "required", limit: { user: 20, ip: 60 }, feature: "commitments" }, commitmentStatus); }
