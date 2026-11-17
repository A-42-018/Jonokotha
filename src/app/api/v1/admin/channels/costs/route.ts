import { run } from "@/lib/api";
import { channelCosts } from "@/lib/channels-service";

export async function GET(req: Request) { return run(req, {}, { name: "GET /api/v1/admin/channels/costs", auth: "required", limit: { user: 30, ip: 60 } }, channelCosts); }
