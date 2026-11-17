import { run } from "@/lib/api";
import { publishMpRecord } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/mp-records/[ref]/publish">) { return run(req, await ctx.params, { name: "POST /api/v1/admin/mp-records/[ref]/publish", auth: "required", limit: { user: 20, ip: 60 }, feature: "mp_records" }, publishMpRecord); }
