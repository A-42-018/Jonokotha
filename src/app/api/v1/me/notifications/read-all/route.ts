import { run } from "@/lib/api";
import { markRead } from "@/lib/notifications";

export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/me/notifications/read-all", auth: "required", limit: { user: 20, ip: 60 } }, (c) => markRead(c, true)); }
