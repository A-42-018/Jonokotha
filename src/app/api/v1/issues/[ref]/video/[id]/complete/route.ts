import { run } from "@/lib/api";
import { completeVideo } from "@/lib/video";

// POST: after uploading, the server checks size, real container type and (if configured) the malware scan; rejects and deletes on failure.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/video/[id]/complete">) {
  return run(req, await ctx.params, { name: "POST /api/v1/issues/{ref}/video/{id}/complete", auth: "required", limit: { user: 10, ip: 30 }, feature: "video_reports" }, completeVideo);
}
