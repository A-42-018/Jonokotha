import { run } from "@/lib/api";
import { revokePlatformInvitation } from "@/lib/admin-config";

// DELETE: admin revokes a pending invitation. Audited.
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/admin/platform-invitations/[id]">) {
  return run(req, await ctx.params, { name: "DELETE /api/v1/admin/platform-invitations/{id}", auth: "required", limit: { user: 10, ip: 30 } }, revokePlatformInvitation);
}
