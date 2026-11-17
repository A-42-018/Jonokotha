import { run } from "@/lib/api";
import { setChannelBudget } from "@/lib/channels-service";

export async function PUT(req: Request) { return run(req, {}, { name: "PUT /api/v1/admin/channels/budget", auth: "required", limit: { user: 10, ip: 30 } }, setChannelBudget); }
