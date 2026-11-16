import { run } from "@/lib/api";
import { startVideo } from "@/lib/video";

// POST {mime_type: video/mp4|webm|quicktime, bytes <= 20 MB, duration_seconds <= 180, caption?}: the reporter gets a signed upload slot for ONE video on their own issue. The original is stored as sent.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/video">) {
  return run(req, await ctx.params, { name: "POST /api/v1/issues/{ref}/video", auth: "required", limit: { user: 5, ip: 20 }, feature: "video_reports" }, startVideo);
}
