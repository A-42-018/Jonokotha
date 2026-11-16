import { run } from "@/lib/api";
import { addPushSubscription, removePushSubscription } from "@/lib/notifications";

// Web Push opt-in: POST {endpoint, keys?} registers this device (also enable channels.push in preferences); DELETE {endpoint} removes it.
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/me/push-subscriptions", auth: "required", limit: { user: 20, ip: 60 } }, addPushSubscription); }
export async function DELETE(req: Request) { return run(req, {}, { name: "DELETE /api/v1/me/push-subscriptions", auth: "required", limit: { user: 20, ip: 60 } }, removePushSubscription); }
