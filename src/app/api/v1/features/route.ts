import { run } from "@/lib/api";
import { publicFlags } from "@/lib/admin-config";

// GET: feature flags with their capability label (live | sample | demo | planned). Public, cacheable.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/features", auth: "optional", limit: { ip: 120 } }, publicFlags); }
