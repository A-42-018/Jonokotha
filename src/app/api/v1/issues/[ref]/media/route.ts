import { ApiError, run } from "@/lib/api";
import { listIssuePhotos, MAX_UPLOAD_BYTES, uploadIssuePhoto } from "@/lib/media";

const REF = /^[A-Za-z0-9-]{3,40}$/;

// GET: photos with signed URLs (reporter and office: all; others: only those approved for public display).
export async function GET(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/media">) {
  const params = await ctx.params;
  return run(req, params, { name: "GET /api/v1/issues/{ref}/media", auth: "optional", limit: { ip: 60 } }, async (c) => {
    if (!REF.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    return { data: await listIssuePhotos(c.sb, params.ref) };
  });
}

// POST (multipart: file, caption?): the reporter adds a photo to their own issue. Private and pending until the office reviews it.
export async function POST(req: Request, ctx: RouteContext<"/api/v1/issues/[ref]/media">) {
  const params = await ctx.params;
  return run(req, params, { name: "POST /api/v1/issues/{ref}/media", auth: "required", limit: { user: 10, ip: 30 }, maxBytes: MAX_UPLOAD_BYTES + 64 * 1024, rawBody: true }, async (c) => {
    if (!REF.test(params.ref)) throw new ApiError("not_found", "Issue not found.");
    const { data: issue } = await c.sb.from("issues").select("id").eq("ref", params.ref).eq("reporter_id", c.user!.id).maybeSingle();
    if (!issue) throw new ApiError("not_found", "Issue not found.");
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    const caption = String(form?.get("caption") ?? "").trim().slice(0, 200) || null;
    if (!(file instanceof File)) throw new ApiError("validation_failed", "Send the photo as the multipart field 'file'.", { file: "required" });
    if (file.size < 100 || file.size > MAX_UPLOAD_BYTES) throw new ApiError("validation_failed", "A photo must be between 100 bytes and 8 MB.", { file: "size" });
    return { status: 201, data: await uploadIssuePhoto(c.sb, issue, c.user!.id, new Uint8Array(await file.arrayBuffer()), caption) };
  });
}
