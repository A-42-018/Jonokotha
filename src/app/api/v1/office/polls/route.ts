import { run } from "@/lib/api";
import { createPoll, listOfficePolls } from "@/lib/engagement5";

// GET: polls of your offices (all states). POST {constituency, question, options[2..10], closes_at?, results_visibility?}: MP or office manager; starts as a draft. Audited.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/polls", auth: "required", limit: { user: 30, ip: 60 }, feature: "polls" }, listOfficePolls); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/polls", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "polls" }, createPoll); }
