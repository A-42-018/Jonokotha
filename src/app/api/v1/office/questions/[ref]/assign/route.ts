import { run } from "@/lib/api";
import { assignQuestion } from "@/lib/ideas-questions";

// POST {assignee: user id | null}: office manager assigns a question to an active member of the office. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/questions/[ref]/assign">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/questions/{ref}/assign", auth: "required", limit: { user: 60, ip: 120 } }, assignQuestion);
}
