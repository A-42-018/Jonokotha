import { z } from "zod";
import { parse, rpc, run } from "@/lib/api";

// GET ?days=30: platform KPIs for administrators (adoption, abuse, delivery, AI errors and cost), each with its definition.
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/admin/kpis", auth: "required", limit: { user: 20, ip: 40 } }, async (c) => {
    const q = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), Object.fromEntries(c.url.searchParams));
    return { data: await rpc(c.sb, "admin_kpis", { p_days: q.days }) };
  });
}
