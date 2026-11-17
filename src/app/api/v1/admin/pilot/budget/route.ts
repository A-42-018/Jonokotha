import { run } from "@/lib/api";
import { setPilotBudget } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function PUT(req: Request) { return run(req, {}, { name: "PUT /api/v1/admin/pilot/budget", auth: "required", limit: { user: 10, ip: 30 } }, setPilotBudget); }
