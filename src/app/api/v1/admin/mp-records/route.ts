import { run } from "@/lib/api";
import { adminMpRecords, createMpRecord } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/mp-records", auth: "required", limit: { user: 30, ip: 60 }, feature: "mp_records" }, adminMpRecords); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/admin/mp-records", auth: "required", limit: { user: 20, ip: 60 }, idempotency: "optional", feature: "mp_records" }, createMpRecord); }
