import { run } from "@/lib/api";
import { withdrawEvalExample } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/me/eval-examples/[id]">) {
  return run(req, await ctx.params, { name: "DELETE /api/v1/me/eval-examples/[id]", auth: "required", limit: { user: 10, ip: 30 } }, withdrawEvalExample);
}
