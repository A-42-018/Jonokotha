import { run } from "@/lib/api";
import { postServiceNotice } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/service-notices", auth: "required", limit: { user: 10, ip: 30 } }, postServiceNotice); }
