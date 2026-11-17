import { run } from "@/lib/api";
import { requeueJob } from "@/lib/ops5";

// POST: admin puts a dead or failed job back in the queue. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/jobs/[id]/requeue">) {
  return run(req, await ctx.params, { name: "POST /api/v1/admin/jobs/{id}/requeue", auth: "required", limit: { user: 10, ip: 30 } }, requeueJob);
}
