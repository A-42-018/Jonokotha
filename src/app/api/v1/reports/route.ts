import { run } from "@/lib/api";
import { reportContent } from "@/lib/admin-service";

// POST {type: issue|idea|question|media, ref, reason, details?}: report PUBLIC content for moderation. Verified account; 10 per day; one report per person and item.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/reports", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, reportContent); }
