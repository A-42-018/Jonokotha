import { run } from "@/lib/api";
import { whatsappVerify, whatsappWebhook } from "@/lib/channels-service";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/webhooks/whatsapp", auth: "optional", limit: { ip: 60 }, feature: "whatsapp_intake" }, whatsappVerify); }
export async function POST(req: Request) { return run(req, {}, { name: "POST /api/v1/webhooks/whatsapp", auth: "optional", limit: { ip: 1200 }, maxBytes: 256 * 1024, rawBody: true, feature: "whatsapp_intake" }, whatsappWebhook); }
