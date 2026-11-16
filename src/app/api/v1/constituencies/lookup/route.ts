import { run } from "@/lib/api";
import { lookupCandidates } from "@/lib/hierarchy";

// GET ?lat=&lng=: every area that could contain the point, with `certain` (exact match on a verified boundary) and `uncertain` (ask the person to choose).
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/constituencies/lookup", auth: "optional", limit: { ip: 120 } }, lookupCandidates); }
