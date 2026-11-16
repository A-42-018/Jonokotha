import { run } from "@/lib/api";
import { videoPoster } from "@/lib/video";

// POST (multipart: file <= 1 MB): the poster frame captured on the device. Re-encoded, metadata removed.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/video/[id]/poster">) {
  return run(req, await ctx.params, { name: "POST /api/v1/issues/{ref}/video/{id}/poster", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: 1024 * 1024 + 64 * 1024, rawBody: true, feature: "video_reports" }, videoPoster);
}
