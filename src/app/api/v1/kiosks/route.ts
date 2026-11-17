import { run } from "@/lib/api";
import { publicKiosks } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/kiosks", auth: "optional", limit: { ip: 120 }, feature: "assisted_reporting" }, publicKiosks); }
