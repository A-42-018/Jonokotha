import { run } from "@/lib/api";
import { mpRecordSummary } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/mp-records/[ref]/summary">) { return run(req, await ctx.params, { name: "POST /api/v1/admin/mp-records/[ref]/summary", auth: "required", limit: { user: 5, ip: 20 }, feature: "mp_records" }, mpRecordSummary); }
