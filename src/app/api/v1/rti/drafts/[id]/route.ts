import { run } from "@/lib/api";
import { getRtiDraft, patchRtiDraft, deleteRtiDraft } from "@/lib/release2";

export async function GET(req: Request, ctx: RouteContext<"/api/v1/rti/drafts/[id]">) { return run(req, await ctx.params, { name: "GET /api/v1/rti/drafts/[id]", auth: "required", limit: { user: 30, ip: 60 }, feature: "rti_helper" }, getRtiDraft); }
export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/rti/drafts/[id]">) { return run(req, await ctx.params, { name: "PATCH /api/v1/rti/drafts/[id]", auth: "required", limit: { user: 20, ip: 60 }, feature: "rti_helper" }, patchRtiDraft); }
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/rti/drafts/[id]">) { return run(req, await ctx.params, { name: "DELETE /api/v1/rti/drafts/[id]", auth: "required", limit: { user: 20, ip: 60 }, feature: "rti_helper" }, deleteRtiDraft); }
