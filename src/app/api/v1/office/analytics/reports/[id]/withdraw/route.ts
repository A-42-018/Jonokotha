import { run } from "@/lib/api";
import { setReportStatus } from "@/lib/analytics";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/analytics/reports/[id]/withdraw">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/analytics/reports/{id}/withdraw", auth: "required", limit: { user: 20, ip: 60 } }, (c) => setReportStatus(c, "withdrawn"));
}
