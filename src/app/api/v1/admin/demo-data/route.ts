import { run } from "@/lib/api";
import { demoData } from "@/lib/admin-config";

// POST {action: load|reset}: admin. Refused (403) when APP_ENV or VERCEL_ENV is production, and again by the database when app_settings.environment is production. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/demo-data", auth: "required", limit: { user: 5, ip: 20 } }, demoData); }
