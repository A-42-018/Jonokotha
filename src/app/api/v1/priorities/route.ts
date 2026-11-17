import { run } from "@/lib/api";
import { listPriorityRounds } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/priorities", auth: "optional", limit: { ip: 120 }, feature: "priority_ranking" }, listPriorityRounds); }
