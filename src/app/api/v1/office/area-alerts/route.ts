import { run } from "@/lib/api";
import { sendAreaAlert } from "@/lib/release11";

export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/office/area-alerts", auth: "required", limit: { user: 5, ip: 20 } }, sendAreaAlert); }
