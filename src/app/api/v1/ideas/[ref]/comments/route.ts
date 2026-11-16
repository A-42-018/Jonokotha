import { run } from "@/lib/api";
import { createIdeaComment, listIdeaComments } from "@/lib/engagement5";

// GET: published comments on a public idea (no author), oldest first. POST {body}: a verified account; 10 a day; personal data removed. Report with POST /reports {type: "idea_comment", ref: <comment id>}.
export async function GET(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/comments">) {
  return run(req, await ctx.params, { name: "GET /api/v1/ideas/{ref}/comments", auth: "optional", limit: { ip: 120 }, feature: "idea_comments" }, listIdeaComments);
}
export async function POST(req: Request, ctx: RouteContext<"/api/v1/ideas/[ref]/comments">) {
  return run(req, await ctx.params, { name: "POST /api/v1/ideas/{ref}/comments", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "idea_comments" }, createIdeaComment);
}
