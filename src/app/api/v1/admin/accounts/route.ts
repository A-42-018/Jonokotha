import { run } from "@/lib/api";
import { listAccounts } from "@/lib/admin-config";

// GET ?role=&status=&limit=: accounts (id, display name, role, status, office roles; no email). Admin; the read is audited. Role changes: POST /admin/accounts/{id}.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/accounts", auth: "required", limit: { user: 20, ip: 60 } }, listAccounts); }
