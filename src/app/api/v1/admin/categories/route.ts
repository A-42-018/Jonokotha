import { run } from "@/lib/api";
import { saveCategory } from "@/lib/admin-config";

// POST {slug, name_bn, name_en, parent?, default_priority?, is_active?}: admin creates or updates a category (never deleted, only deactivated; service_code never changes). Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/categories", auth: "required", limit: { user: 20, ip: 60 } }, saveCategory); }
