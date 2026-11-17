import { run } from "@/lib/api";
import { listFlags, saveFlag } from "@/lib/admin-config";

// GET: all flags. POST {key, enabled, data_status?, description?, create?}: admin. Audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/feature-flags", auth: "required", limit: { user: 30, ip: 60 } }, listFlags); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/feature-flags", auth: "required", limit: { user: 20, ip: 60 } }, saveFlag); }
