import { ApiError, fromDbError, run } from "@/lib/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE stops following. Someone else's follow id looks like "not found".
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/me/follows/[id]">) {
  const params = await ctx.params;
  return run(req, params, { name: "DELETE /api/v1/me/follows/{id}", auth: "required", limit: { user: 30, ip: 60 } }, async (c) => {
    if (!UUID.test(params.id)) throw new ApiError("not_found", "Follow not found.");
    const { error } = await c.sb.rpc("remove_follow", { p_id: params.id });
    if (error) throw fromDbError(error);
    return { data: { id: params.id, removed: true } };
  });
}
