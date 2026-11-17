import { run } from "@/lib/api";
import { saveAgency } from "@/lib/admin-config";

// POST {key, name_bn, name_en, categories, source, url?, checked_at, jurisdiction_level?, contact_channel?}: admin. A source and check date are required. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/agencies", auth: "required", limit: { user: 20, ip: 60 } }, saveAgency); }
