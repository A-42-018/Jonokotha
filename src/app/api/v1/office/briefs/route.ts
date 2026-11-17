import { run } from "@/lib/api";
import { listBriefs } from "@/lib/release11";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/office/briefs", auth: "required", limit: { user: 30, ip: 60 }, feature: "weekly_briefs" }, listBriefs); }
