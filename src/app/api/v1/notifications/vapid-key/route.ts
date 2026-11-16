import { run } from "@/lib/api";
import { vapidKey } from "@/lib/notifications";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/notifications/vapid-key", auth: "optional", limit: { ip: 60 } }, vapidKey); }
