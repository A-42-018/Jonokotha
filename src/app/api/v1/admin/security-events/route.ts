import { run } from "@/lib/api";
import { securityEvents } from "@/lib/admin-config";

// GET ?kind=&hours=24: auth failures, rate-limit hits, permission denials, blocked cross-site requests. Admin; the read is audited. No personal data (IPs are hashed).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/security-events", auth: "required", limit: { user: 20, ip: 60 } }, securityEvents); }
