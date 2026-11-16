import { run } from "@/lib/api";
import { revokeInvitation } from "@/lib/admin-service";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/office/invitations/[id]/revoke">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/office/invitations/{id}/revoke", auth: "required", limit: { user: 20, ip: 60 } }, revokeInvitation);
}
