import { run } from "@/lib/api";
import { regionOverview } from "@/lib/release2";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/regions/overview", auth: "required", limit: { user: 30, ip: 60 }, feature: "regional_admin" }, regionOverview); }
