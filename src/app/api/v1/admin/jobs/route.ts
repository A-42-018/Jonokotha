import { run } from "@/lib/api";
import { listJobs } from "@/lib/ops5";

// GET ?status=: background jobs (queued, running, done, failed, dead). Admin. Dead jobs can be requeued.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/jobs", auth: "required", limit: { user: 30, ip: 60 } }, listJobs); }
