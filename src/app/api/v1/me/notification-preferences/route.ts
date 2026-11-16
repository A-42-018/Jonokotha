import { run } from "@/lib/api";
import { getPreferences, putPreferences } from "@/lib/notifications";

// GET / PUT: channels (push, email), muted types, quiet hours {start,end} in your time zone, personalisation on/off. Only what you send changes.
export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/me/notification-preferences", auth: "required", limit: { user: 60, ip: 120 } }, getPreferences); }
export async function PUT(req: Request) { return run(req, {}, { name: "PUT /api/v1/me/notification-preferences", auth: "required", limit: { user: 30, ip: 60 } }, putPreferences); }
