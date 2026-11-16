import { run } from "@/lib/api";
import { moderationQueue } from "@/lib/admin-service";

// GET: the moderation queue (moderators and admins): reported public items and ideas/questions waiting for review. Excerpts of public content only.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/moderation", auth: "required", limit: { user: 60, ip: 120 } }, moderationQueue); }
