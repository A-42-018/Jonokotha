import { run } from "@/lib/api";
import { overview } from "@/lib/analytics";

// GET ?constituency=&days=30: privacy-filtered aggregates (groups under 5 hidden). Needs the view_analytics permission (office manager, MP).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/analytics", auth: "required", limit: { user: 30, ip: 60 } }, overview); }
