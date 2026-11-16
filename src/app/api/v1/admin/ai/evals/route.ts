import { run } from "@/lib/api";
import { listAiEvals, recordAiEval } from "@/lib/admin-service";

// GET: recorded evaluation runs. POST: record one (dataset, size, prompt versions, metrics) after `npm run eval`. Administrators only.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/ai/evals", auth: "required", limit: { user: 30, ip: 60 } }, listAiEvals); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/ai/evals", auth: "required", limit: { user: 10, ip: 30 } }, recordAiEval); }
