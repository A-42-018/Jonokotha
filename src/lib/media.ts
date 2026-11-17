import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, fromDbError } from "./api";
import { sniffImageType } from "./image";
import { serviceClient } from "./supabase/service";

export const BUCKET = "issue-media";
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;

/**
 * Prepares an uploaded photo for storage: type decided by content, orientation applied, then re-encoded as JPEG at a
 * bounded size. Re-encoding drops all metadata (EXIF, GPS, camera, software), so no stored derivative can reveal where
 * it was taken. Throws 422 for anything that is not a decodable JPEG, PNG or WebP.
 */
export async function prepareImage(input: Uint8Array): Promise<{ bytes: Buffer; width: number; height: number; hash: string }> {
  if (!sniffImageType(input.subarray(0, 12))) throw new ApiError("validation_failed", "Only JPEG, PNG or WebP photos are accepted.", { file: "type" });
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 50_000_000, failOn: "error" })
      .rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return { bytes: data, width: info.width, height: info.height, hash: createHash("sha256").update(data).digest("hex") };
  } catch {
    throw new ApiError("validation_failed", "The photo could not be read.", { file: "unreadable" });
  }
}

/** Optional malware-scan hook. MALWARE_SCAN_URL receives the bytes (POST) and answers {"clean": true|false}. If it is set it fails closed. */
export async function scanForMalware(bytes: Uint8Array): Promise<"clean" | "not_scanned"> {
  const url = process.env.MALWARE_SCAN_URL;
  if (!url) return "not_scanned";
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/octet-stream", ...(process.env.MALWARE_SCAN_TOKEN ? { authorization: `Bearer ${process.env.MALWARE_SCAN_TOKEN}` } : {}) }, body: bytes as BodyInit, signal: AbortSignal.timeout(10_000) });
    const j = (await res.json().catch(() => null)) as { clean?: boolean } | null;
    if (res.ok && j?.clean === true) return "clean";
    throw new ApiError("validation_failed", "The file was rejected by the safety check.", { file: "rejected" });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("unavailable", "The safety check is unavailable. Try again later.");
  }
}

export async function uploadIssuePhoto(sb: SupabaseClient, issue: { id: string }, userId: string, file: Uint8Array, caption: string | null) {
  const svc = serviceClient();
  if (!svc) throw new ApiError("unavailable", "Photo storage is not configured on this server.");
  const img = await prepareImage(file);
  const scan = await scanForMalware(img.bytes);
  const path = `${issue.id}/${randomUUID()}.jpg`;
  const up = await svc.storage.from(BUCKET).upload(path, img.bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new ApiError("internal_error", "The photo could not be stored.");
  // Inserted as the user: RLS requires the owner, private visibility and pending moderation; a trigger caps photos per issue.
  const { data, error } = await sb.from("issue_media").insert({
    issue_id: issue.id, uploader_id: userId, storage_path: path, media_type: "image", caption, mime_type: "image/jpeg",
    bytes: img.bytes.length, width: img.width, height: img.height, content_hash: img.hash, scan_status: scan === "clean" ? "clean" : "not_scanned",
  }).select("id").single();
  if (error) {
    await svc.storage.from(BUCKET).remove([path]);
    if (error.code === "JK003") throw new ApiError("rule_not_met", "This issue already has the maximum number of photos.", { _: "media_limit" });
    throw fromDbError(error);
  }
  return { id: data.id as string, width: img.width, height: img.height, bytes: img.bytes.length, visibility: "private", moderation_status: "pending" };
}

/**
 * Photos of an issue with short-lived signed URLs (5 minutes). The reporter and in-scope office see all; everyone else sees
 * only photos the office approved for public display on a publicly visible issue.
 */
export async function listIssuePhotos(sb: SupabaseClient, ref: string) {
  const svc = serviceClient();
  if (!svc) return [];
  const { data: priv } = await sb.from("issues").select("id").eq("ref", ref).maybeSingle();      // RLS: reporter or office scope only
  const all = !!priv;
  let issueId = priv?.id as string | undefined;
  if (!issueId) {
    const { data: pub } = await svc.from("issues").select("id").eq("ref", ref).eq("public_visibility", true).maybeSingle();
    issueId = pub?.id;
  }
  if (!issueId) return [];
  let q = svc.from("issue_media").select("id,storage_path,caption,width,height,visibility,moderation_status,created_at,media_type,duration_seconds,poster_path").eq("issue_id", issueId).eq("upload_status", "ready").order("created_at");
  if (!all) q = q.eq("visibility", "public").eq("moderation_status", "approved");
  const { data: rows } = await q;
  const ready = (rows ?? []).filter((r) => r.media_type !== "video" || r.moderation_status !== "rejected");
  if (!ready.length) return [];
  const sign = async (bucket: string, paths: string[]) => new Map(((await svc.storage.from(bucket).createSignedUrls(paths, 300)).data ?? []).map((s) => [s.path, s.signedUrl]));
  const photoUrls = await sign(BUCKET, ready.filter((r) => r.media_type !== "video").map((r) => r.storage_path));
  const videos = ready.filter((r) => r.media_type === "video");
  const videoUrls = videos.length ? await sign("issue-video", videos.flatMap((r) => [r.storage_path, ...(r.poster_path ? [r.poster_path] : [])])) : new Map<string, string>();
  return ready.map((r) => ({ id: r.id, type: r.media_type === "video" ? "video" : "image", url: (r.media_type === "video" ? videoUrls : photoUrls).get(r.storage_path) ?? null,
    ...(r.media_type === "video" ? { poster_url: r.poster_path ? videoUrls.get(r.poster_path) ?? null : null, duration_seconds: r.duration_seconds } : {}),
    caption: r.caption, width: r.width, height: r.height, ...(all ? { visibility: r.visibility, moderation_status: r.moderation_status } : {}) }));
}
