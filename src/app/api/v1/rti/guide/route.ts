import { run } from "@/lib/api";
import { rtiGuide } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/rti/guide", auth: "optional", limit: { ip: 120 }, feature: "rti_helper" }, rtiGuide); }
