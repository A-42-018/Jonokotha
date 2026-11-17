import { run } from "@/lib/api";
import { getMpRecord } from "@/lib/release2";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/mp-records/[ref]">) { return run(req, await ctx.params, { name: "GET /api/v1/mp-records/[ref]", auth: "optional", limit: { ip: 120 }, feature: "mp_records" }, getMpRecord); }
