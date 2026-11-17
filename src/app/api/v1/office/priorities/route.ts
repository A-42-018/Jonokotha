import { run } from "@/lib/api";
import { listOfficePriorityRounds, createPriorityRound } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/priorities", auth: "required", limit: { user: 30, ip: 60 }, feature: "priority_ranking" }, listOfficePriorityRounds); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/priorities", auth: "required", limit: { user: 10, ip: 30 }, idempotency: "optional", feature: "priority_ranking" }, createPriorityRound); }
