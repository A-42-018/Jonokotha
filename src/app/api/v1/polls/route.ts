import { run } from "@/lib/api";
import { listPolls } from "@/lib/engagement5";

// GET ?constituency=&status=: open and closed polls (public).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/polls", auth: "optional", limit: { ip: 120 }, feature: "polls" }, listPolls); }
