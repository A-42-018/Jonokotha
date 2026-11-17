import { run } from "@/lib/api";
import { listSla, saveSla } from "@/lib/admin-config";

// GET: active SLA targets. POST {constituency?, category?, ack_target_hours, update_target_hours, note?}: admin (global) or office manager of that area. Audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/sla-policies", auth: "required", limit: { user: 30, ip: 60 } }, listSla); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/sla-policies", auth: "required", limit: { user: 20, ip: 60 } }, saveSla); }
