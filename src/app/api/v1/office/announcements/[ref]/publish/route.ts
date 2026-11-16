import { run } from "@/lib/api";
import { publishAnnouncement } from "@/lib/reps-projects";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/announcements/[ref]/publish">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/announcements/{ref}/publish", auth: "required", limit: { user: 20, ip: 60 } }, publishAnnouncement);
}
