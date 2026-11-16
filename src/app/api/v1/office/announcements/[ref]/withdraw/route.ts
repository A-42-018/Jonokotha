import { run } from "@/lib/api";
import { withdrawAnnouncement } from "@/lib/reps-projects";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/announcements/[ref]/withdraw">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/announcements/{ref}/withdraw", auth: "required", limit: { user: 20, ip: 60 } }, withdrawAnnouncement);
}
