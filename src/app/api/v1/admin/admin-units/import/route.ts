import { run } from "@/lib/api";
import { importAdminUnits } from "@/lib/hierarchy";

// POST {source: {name, url, license, fetched_at, country?}, units: [{level, code, name_bn, name_en, parent_code?}]} parent-first, max 500: admin imports division, district, upazila or city, union or ward from a sourced file. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/admin-units/import", auth: "required", limit: { user: 5, ip: 20 }, maxBytes: 512 * 1024 }, importAdminUnits); }
