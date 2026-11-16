import { run } from "@/lib/api";
import { listAiRuns } from "@/lib/admin-service";

// GET ?agent=&status=&include_output=&cursor=: the AI run log (model, prompt version, tokens, latency, cost, decision). Administrators only; each read is audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/ai/runs", auth: "required", limit: { user: 60, ip: 120 } }, listAiRuns); }
