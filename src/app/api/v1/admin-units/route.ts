import { run } from "@/lib/api";
import { listAdminUnits } from "@/lib/hierarchy";

// GET ?level=&parent=<code>&country=BD: the administrative hierarchy (public reference data, sourced and dated).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin-units", auth: "optional", limit: { ip: 120 } }, listAdminUnits); }
