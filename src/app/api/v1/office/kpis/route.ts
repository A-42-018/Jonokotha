import { z } from "zod";
import { parse, rpc, run } from "@/lib/api";

const Q = z.object({ constituency: z.string().max(60).regex(/^[a-z0-9-]+$/), days: z.coerce.number().int().min(1).max(365).default(30) });
// GET ?constituency=&days=30: office KPIs, each with its definition. Needs view_analytics (office manager, MP). Groups under 5 are hidden.
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/office/kpis", auth: "required", limit: { user: 20, ip: 40 } }, async (c) => {
    const q = parse(Q, Object.fromEntries(c.url.searchParams));
    return { data: await rpc(c.sb, "office_kpis", { p_constituency: q.constituency, p_days: q.days }) };
  });
}
