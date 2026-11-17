import { run } from "@/lib/api";
import { listMpRecords } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/mp-records", auth: "optional", limit: { ip: 120 }, feature: "mp_records" }, listMpRecords); }
