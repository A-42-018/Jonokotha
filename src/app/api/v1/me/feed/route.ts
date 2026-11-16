import { run } from "@/lib/api";
import { feed } from "@/lib/feed";

// GET ?personalized=true|false&limit=&cursor=: public issues, followed things first (when on), then newest. Each item says why (issue|area|category).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/feed", auth: "required", limit: { user: 60, ip: 120 } }, feed); }
