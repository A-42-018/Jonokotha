import { run } from "@/lib/api";
import { listIntegrations, saveIntegration } from "@/lib/admin-config";

// GET: providers with enabled and key_present (keys are never returned). POST {provider, enabled, note?}: admin. Audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/integrations", auth: "required", limit: { user: 30, ip: 60 } }, listIntegrations); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/integrations", auth: "required", limit: { user: 20, ip: 60 } }, saveIntegration); }
