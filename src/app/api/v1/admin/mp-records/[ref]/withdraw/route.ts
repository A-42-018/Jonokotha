import { run } from "@/lib/api";
import { withdrawMpRecord } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/mp-records/[ref]/withdraw">) { return run(req, await ctx.params, { name: "POST /api/v1/admin/mp-records/[ref]/withdraw", auth: "required", limit: { user: 10, ip: 30 }, feature: "mp_records" }, withdrawMpRecord); }
