import { run } from "@/lib/api";
import { setReportStatus } from "@/lib/analytics";

// Office manager approval is what makes a report public. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/analytics/reports/[id]/approve">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/analytics/reports/{id}/approve", auth: "required", limit: { user: 20, ip: 60 } }, (c) => setReportStatus(c, "approved"));
}
