import { run } from "@/lib/api";
import { markRead } from "@/lib/notifications";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/me/notifications/[id]/read">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/me/notifications/{id}/read", auth: "required", limit: { user: 120, ip: 240 } }, (c) => markRead(c, false));
}
