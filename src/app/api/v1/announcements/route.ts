import { run } from "@/lib/api";
import { listAnnouncements } from "@/lib/reps-projects";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/announcements", auth: "optional", limit: { ip: 120 } }, listAnnouncements); }
