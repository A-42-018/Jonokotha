import { run } from "@/lib/api";
import { askQuestion, listPublicQuestions } from "@/lib/ideas-questions";

// GET: public questions. POST: ask (private to the office, or public after moderation). 3 per hour, 10 per day.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/questions", auth: "optional", limit: { ip: 120 } }, listPublicQuestions); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/questions", auth: "required", limit: { user: 5, ip: 20 }, idempotency: "optional" }, askQuestion); }
