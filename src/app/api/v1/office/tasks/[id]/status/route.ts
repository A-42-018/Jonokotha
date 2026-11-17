import { run } from "@/lib/api";
import { setTaskStatus } from "@/lib/mp-office";

// POST {status: open|done|cancelled}: the assignee or whoever delegates (only they can cancel).
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/tasks/[id]/status">) {
  return run(req, await ctx.params, { name: "POST /api/v1/office/tasks/{id}/status", auth: "required", limit: { user: 30, ip: 60 } }, setTaskStatus);
}
