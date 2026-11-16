import { run } from "@/lib/api";
import { publicDataSources } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/data-sources", auth: "optional", limit: { ip: 60 } }, publicDataSources); }
