import { run } from "@/lib/api";
import { verifyRepresentative } from "@/lib/admin-service";

// POST {status: pending|verified|revoked, source_url (required to verify), note?}: administrators only. Audited.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/representatives/[id]/verify">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/admin/representatives/{id}/verify", auth: "required", limit: { user: 30, ip: 60 } }, verifyRepresentative);
}
