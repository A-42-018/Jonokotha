import { run } from "@/lib/api";
import { setAccount } from "@/lib/admin-service";

// POST {role, status?, reason}: change a platform role or suspend an account. Administrators only; not on yourself. Audited with the reason.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/accounts/[id]">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/admin/accounts/{id}", auth: "required", limit: { user: 20, ip: 60 } }, setAccount);
}
