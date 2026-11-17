import { run } from "@/lib/api";
import { listNotifications } from "@/lib/notifications";

// GET ?unread=true&limit=&cursor=: your notifications, newest first. Header x-unread-count has the unread total.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/notifications", auth: "required", limit: { user: 120, ip: 240 } }, listNotifications); }
