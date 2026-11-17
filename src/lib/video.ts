import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, fromDbError, parse, type Ctx, type Result } from "./api";
import { checkRef } from "./ideas-questions";
import { prepareImage, scanForMalware } from "./media";
import { serviceClient } from "./supabase/service";

// Phase 5 / B5.6: video evidence on a report. Originals are kept exactly as sent (no transcoding: a private original is never rewritten),
// in a private bucket, with a size and type limit, a malware scan hook that fails closed, and a poster frame the device captures.
// Serverless functions cap request bodies at a few MB, so the video itself goes straight to storage on a signed upload URL;
// the server checks the stored object afterwards ("complete") and only then marks it ready.
export const VIDEO_BUCKET = "issue-video";
export const MAX_VIDEO_BYTES = 20_000_000;
export const MAX_VIDEO_SECONDS = 180;
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

/** Container type from the first bytes (the declared type follows the file name and can lie). */
export function sniffVideoType(head: Uint8Array): (typeof VIDEO_TYPES)[number] | null {
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {            // "ftyp"
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video/webm"; // EBML
  return null;
}

const Start = z.strictObject({
  mime_type: z.enum(VIDEO_TYPES), bytes: z.number().int().min(1000).max(MAX_VIDEO_BYTES, `at most ${MAX_VIDEO_BYTES} bytes`),
  duration_seconds: z.number().int().min(1).max(MAX_VIDEO_SECONDS), caption: z.string().trim().max(200).optional(),
});

/** Step 1: the reporter asks for an upload slot on their own issue. The row stays "awaiting_upload", private and pending review. */
export async function startVideo(c: Ctx): Promise<Result> {
  const b = parse(Start, c.body);
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Video storage is not configured on this server.");
  const { data: issue } = await c.sb.from("issues").select("id").eq("ref", checkRef(c.params.ref)).eq("reporter_id", c.user!.id).maybeSingle();
  if (!issue) throw new ApiError("not_found", "Issue not found.");
  const path = `${issue.id}/${randomUUID()}.${EXT[b.mime_type]}`;
  const { data, error } = await c.sb.from("issue_media").insert({ issue_id: issue.id, uploader_id: c.user!.id, storage_path: path, media_type: "video", caption: b.caption || null,
    mime_type: b.mime_type, bytes: b.bytes, duration_seconds: b.duration_seconds, upload_status: "awaiting_upload" }).select("id").single();
  if (error) {
    if (error.code === "JK003") throw new ApiError("rule_not_met", "This issue already has a video.", { _: "video_limit" });
    throw fromDbError(error);
  }
  const up = await svc.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path);
  if (up.error || !up.data) { await svc.from("issue_media").update({ upload_status: "rejected" }).eq("id", data.id); throw new ApiError("internal_error", "The upload could not be prepared."); }
  return { status: 201, data: { id: data.id, upload: { path, token: up.data.token, signed_url: up.data.signedUrl, method: "PUT", max_bytes: MAX_VIDEO_BYTES }, next: "POST .../video/{id}/complete after uploading" } };
}

/** Step 2: the server inspects the stored object (size, real container type, optional malware scan) and marks it ready or rejects it. */
export async function completeVideo(c: Ctx): Promise<Result> {
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Video storage is not configured on this server.");
  const id = z.uuid().safeParse(c.params.id);
  if (!id.success) throw new ApiError("not_found", "Not found.");
  const { data: issue } = await c.sb.from("issues").select("id").eq("ref", checkRef(c.params.ref)).eq("reporter_id", c.user!.id).maybeSingle();
  const { data: m } = issue ? await c.sb.from("issue_media").select("id,storage_path,mime_type,bytes,upload_status").eq("id", id.data).eq("issue_id", issue.id).eq("media_type", "video").maybeSingle() : { data: null };
  if (!m) throw new ApiError("not_found", "Video not found.");
  if (m.upload_status === "ready") return { data: { id: m.id, status: "ready" } };
  const reject = async (field: string, msg: string): Promise<never> => {
    await svc.storage.from(VIDEO_BUCKET).remove([m.storage_path]);
    await svc.from("issue_media").update({ upload_status: "rejected" }).eq("id", m.id);
    throw new ApiError("validation_failed", msg, { video: field });
  };
  const dl = await svc.storage.from(VIDEO_BUCKET).download(m.storage_path);
  if (dl.error || !dl.data) throw new ApiError("conflict", "The video has not been uploaded yet.", { video: "not_uploaded" });
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  if (bytes.length > MAX_VIDEO_BYTES || bytes.length < 1000) return reject("size", "The video must be between 1 KB and 20 MB.");
  const real = sniffVideoType(bytes.subarray(0, 12));
  if (!real) return reject("type", "Only MP4, WebM or QuickTime videos are accepted.");
  let scan: "clean" | "not_scanned";
  try { scan = await scanForMalware(bytes); } catch (e) { await reject("rejected", "The file was rejected by the safety check."); throw e; }
  await svc.from("issue_media").update({ upload_status: "ready", mime_type: real, bytes: bytes.length, scan_status: scan, content_hash: null }).eq("id", m.id);
  return { data: { id: m.id, status: "ready", mime_type: real, bytes: bytes.length } };
}

/** Optional step 3: the poster frame, a small image captured on the device. Processed like a photo (EXIF removed, re-encoded). */
export async function videoPoster(c: Ctx): Promise<Result> {
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Video storage is not configured on this server.");
  const id = z.uuid().safeParse(c.params.id);
  if (!id.success) throw new ApiError("not_found", "Not found.");
  const { data: issue } = await c.sb.from("issues").select("id").eq("ref", checkRef(c.params.ref)).eq("reporter_id", c.user!.id).maybeSingle();
  const { data: m } = issue ? await c.sb.from("issue_media").select("id,storage_path,upload_status").eq("id", id.data).eq("issue_id", issue.id).eq("media_type", "video").maybeSingle() : { data: null };
  if (!m || m.upload_status !== "ready") throw new ApiError("not_found", "Video not found.");
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 100 || file.size > 1024 * 1024) throw new ApiError("validation_failed", "Send a poster image of at most 1 MB as the multipart field 'file'.", { file: "size" });
  const img = await prepareImage(new Uint8Array(await file.arrayBuffer()));
  const path = m.storage_path.replace(/\.[a-z0-9]+$/, "-poster.jpg");
  const up = await svc.storage.from(VIDEO_BUCKET).upload(path, img.bytes, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw new ApiError("internal_error", "The poster could not be stored.");
  await svc.from("issue_media").update({ poster_path: path, width: img.width, height: img.height }).eq("id", m.id);
  return { data: { id: m.id, poster: true } };
}
