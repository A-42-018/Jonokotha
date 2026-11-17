import { run } from "@/lib/api";
import { setIntegrationKey } from "@/lib/release2";

export async function PUT(req: Request, ctx: RouteContext<"/api/v1/admin/agency-integrations/[id]/key">) { return run(req, await ctx.params, { name: "PUT /api/v1/admin/agency-integrations/[id]/key", auth: "required", limit: { user: 10, ip: 30 } }, setIntegrationKey); }
