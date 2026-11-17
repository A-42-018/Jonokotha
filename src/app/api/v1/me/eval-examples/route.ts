import { run } from "@/lib/api";
import { myEvalExamples, submitEvalExample } from "@/lib/pilot-service";

// Phase 6 (docs/api-v1.md, "Phase 6"). Permission is decided by the database; the shared pipeline validates, rate-limits and audits.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/eval-examples", auth: "required", limit: { user: 30, ip: 60 } }, myEvalExamples); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/me/eval-examples", auth: "required", limit: { user: 5, ip: 20 } }, submitEvalExample); }
