import { run } from "@/lib/api";
import { projectFeedback, projectFeedbackSummary } from "@/lib/engagement5";

// POST {rating 1-5, comment?}: a verified account, once, only when the project is completed. GET: how many sent feedback (average shown from 5).
export async function GET(req: Request, ctx: RouteContext<"/api/v1/projects/[ref]/feedback">) {
  return run(req, await ctx.params, { name: "GET /api/v1/projects/{ref}/feedback", auth: "optional", limit: { ip: 120 } }, projectFeedbackSummary);
}
export async function POST(req: Request, ctx: RouteContext<"/api/v1/projects/[ref]/feedback">) {
  return run(req, await ctx.params, { name: "POST /api/v1/projects/{ref}/feedback", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, projectFeedback);
}
