import { run } from "@/lib/api";
import { revokeRegionalAdmin } from "@/lib/release2";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/regional-admins/[id]/revoke">) { return run(req, await ctx.params, { name: "POST /api/v1/admin/regional-admins/[id]/revoke", auth: "required", limit: { user: 10, ip: 30 }, feature: "regional_admin" }, revokeRegionalAdmin); }
