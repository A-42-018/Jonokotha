import { run } from "@/lib/api";
import { uploadCheckinPhoto } from "@/lib/release11";

export async function POST(req: Request, ctx: RouteContext<"/api/v1/projects/[ref]/checkins/[id]/photo">) { return run(req, await ctx.params, { name: "POST /api/v1/projects/{ref}/checkins/{id}/photo", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: 8 * 1024 * 1024 + 64 * 1024, rawBody: true, feature: "project_checkins" }, uploadCheckinPhoto); }
