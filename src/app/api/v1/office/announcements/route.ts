import { run } from "@/lib/api";
import { saveAnnouncement } from "@/lib/reps-projects";

// POST {constituency, title, body, publish?}: MP or office manager of that area. Audited.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/announcements", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional" }, saveAnnouncement); }
