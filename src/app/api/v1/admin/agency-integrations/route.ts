import { run } from "@/lib/api";
import { setIntegration } from "@/lib/liaison";
import { listAgencyIntegrations } from "@/lib/release2";

// GET: integrations with key fingerprints and receipt counts (admin). POST {agency_id, kind, status: planned|confirmed|retired, note?}: administrators record whether an agency integration is real. Audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/agency-integrations", auth: "required", limit: { user: 30, ip: 60 } }, listAgencyIntegrations); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/agency-integrations", auth: "required", limit: { user: 10, ip: 30 } }, setIntegration); }
