import { run } from "@/lib/api";
import { revokeChannel, setChannelUpdates } from "@/lib/channels-service";

export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/me/channels/[id]">) { return run(req, await ctx.params, { name: "DELETE /api/v1/me/channels/{id}", auth: "required", limit: { user: 20, ip: 60 } }, revokeChannel); }
export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/me/channels/[id]">) { return run(req, await ctx.params, { name: "PATCH /api/v1/me/channels/{id}", auth: "required", limit: { user: 20, ip: 60 } }, setChannelUpdates); }
