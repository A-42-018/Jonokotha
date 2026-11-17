import { run } from "@/lib/api";
import { runIngestionNow } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/admin/ingestion/sources/[key]/run">) {
  return run(req, await ctx.params, { name: "POST /api/v1/admin/ingestion/sources/[key]/run", auth: "required", limit: { user: 3, ip: 10 } }, runIngestionNow);
}
