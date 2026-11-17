import { run } from "@/lib/api";
import { listCommitments } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/commitments", auth: "optional", limit: { ip: 120 }, feature: "commitments" }, listCommitments); }
