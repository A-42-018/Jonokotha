import { run } from "@/lib/api";
import { smsWebhook } from "@/lib/channels-service";

export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/webhooks/sms", auth: "optional", limit: { ip: 1200 }, maxBytes: 16 * 1024, rawBody: true, feature: "sms_intake" }, smsWebhook); }
