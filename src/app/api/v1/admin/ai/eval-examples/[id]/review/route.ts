import { run } from "@/lib/api";
import { reviewEvalExample } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/ai/eval-examples/[id]/review">) {
  return run(req, await ctx.params, { name: "POST /api/v1/admin/ai/eval-examples/[id]/review", auth: "required", limit: { user: 30, ip: 60 } }, reviewEvalExample);
}
