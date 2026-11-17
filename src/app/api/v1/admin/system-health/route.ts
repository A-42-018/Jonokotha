import { run } from "@/lib/api";
import { systemHealth } from "@/lib/admin-config";

// GET: database, storage, queues, jobs, AI provider and notification delivery. Admin; the read is audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/system-health", auth: "required", limit: { user: 20, ip: 60 } }, systemHealth); }
