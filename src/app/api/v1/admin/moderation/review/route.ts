import { run } from "@/lib/api";
import { reviewPending } from "@/lib/admin-service";

// POST {type: idea|question, ref, action: publish|reject, reason?}: publication review. Rejecting needs a reason. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/moderation/review", auth: "required", limit: { user: 60, ip: 120 } }, reviewPending); }
