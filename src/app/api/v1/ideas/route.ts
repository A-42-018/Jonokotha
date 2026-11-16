import { run } from "@/lib/api";
import { createIdea, listIdeas } from "@/lib/ideas-questions";

// GET: public ideas (cursor pagination; sort=supported for the most supported). POST: share an idea (verified account; a moderator publishes it).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/ideas", auth: "optional", limit: { ip: 120 } }, listIdeas); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/ideas", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional" }, createIdea); }
