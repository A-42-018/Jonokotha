import { run } from "@/lib/api";
import { setIntegration } from "@/lib/liaison";

// POST {agency_id, kind, status: planned|confirmed|retired, note?}: administrators record whether an agency integration is real. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/agency-integrations", auth: "required", limit: { user: 10, ip: 30 } }, setIntegration); }
