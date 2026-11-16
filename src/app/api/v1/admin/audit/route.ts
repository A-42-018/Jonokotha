import { run } from "@/lib/api";
import { listAudit } from "@/lib/admin-service";

// GET ?resource_type=&action=&actor=&resource_id=&from=&to=&cursor=: the audit trail, newest first. Administrators only; reading it is itself audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/audit", auth: "required", limit: { user: 60, ip: 120 } }, listAudit); }
