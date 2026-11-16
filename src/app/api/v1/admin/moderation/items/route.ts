import { run } from "@/lib/api";
import { moderateItem } from "@/lib/admin-service";

// POST {type, ref, action: hide|restore|dismiss, reason}: a reason is always required. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/moderation/items", auth: "required", limit: { user: 60, ip: 120 } }, moderateItem); }
