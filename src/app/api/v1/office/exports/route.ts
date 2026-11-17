import { run } from "@/lib/api";
import { officeExport } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/exports", auth: "required", limit: { user: 10, ip: 30 }, feature: "exports" }, officeExport); }
