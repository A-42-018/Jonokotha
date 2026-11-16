import { run } from "@/lib/api";
import { verifyHelpline } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/helplines/[key]/verify">) {
  return run(req, await ctx.params, { name: "POST /api/v1/admin/helplines/[key]/verify", auth: "required", limit: { user: 10, ip: 30 } }, verifyHelpline);
}
