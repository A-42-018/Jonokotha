import { run } from "@/lib/api";
import { addFollow, listFollows } from "@/lib/engagement";

// GET lists the caller's follows; POST {type: issue|area|category, target} adds one (idempotent).
export async function GET(req: Request) {
  return run(req, {}, { name: "GET /api/v1/me/follows", auth: "required", limit: { user: 60, ip: 120 } }, listFollows);
}
export async function POST(req: Request) {
  return run(req, {}, { name: "POST /api/v1/me/follows", auth: "required", limit: { user: 30, ip: 60 }, idempotency: "optional" }, addFollow);
}
