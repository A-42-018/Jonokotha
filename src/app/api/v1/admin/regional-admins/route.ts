import { run } from "@/lib/api";
import { listRegionalAdmins, grantRegionalAdmin } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/regional-admins", auth: "required", limit: { user: 30, ip: 60 }, feature: "regional_admin" }, listRegionalAdmins); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/regional-admins", auth: "required", limit: { user: 10, ip: 30 }, feature: "regional_admin" }, grantRegionalAdmin); }
