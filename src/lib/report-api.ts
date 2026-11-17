import { api } from "@/lib/api-client";

type PhotoIn = { blob: Blob; caption: string };

/** Adds one photo to the reporter's own issue (multipart; the server checks the type by content and strips location data). */
export function uploadPhoto(ref: string, photo: PhotoIn) {
  const form = new FormData();
  form.append("file", photo.blob, "photo.jpg");
  if (photo.caption.trim()) form.append("caption", photo.caption.trim());
  return api<{ id: string }>(`/issues/${encodeURIComponent(ref)}/media`, { form });
}

/**
 * Uploads photos one by one. Returns the ones that did not go through (so the screen can offer a retry for exactly those)
 * and calls `onProgress(done, total)` after each try, so a slow connection shows movement.
 */
export async function uploadPhotosTracked<P extends PhotoIn>(ref: string, photos: P[], up: typeof uploadPhoto = uploadPhoto, onProgress?: (done: number, total: number) => void): Promise<P[]> {
  const failed: P[] = [];
  let done = 0;
  for (const p of photos) {
    try { await up(ref, p); } catch { failed.push(p); }
    onProgress?.(++done, photos.length);
  }
  return failed;
}

/** Same upload, returning only how many failed. */
export async function uploadPhotos(ref: string, photos: PhotoIn[], up = uploadPhoto): Promise<number> {
  return (await uploadPhotosTracked(ref, photos, up)).length;
}

export interface PublicPhoto { id: string; url: string | null; caption: string | null; width: number | null; height: number | null }

/** Photos the office approved for public display (the reporter and the office also get their private ones from the same route). */
export const fetchIssuePhotos = (ref: string) => api<PublicPhoto[]>(`/issues/${encodeURIComponent(ref)}/media`).then((r) => r.data);

/** The reporter answers a request for more information (allowed only while the issue is waiting for it). */
export const sendMoreInfo = (ref: string, message: string) => api<unknown>(`/issues/${encodeURIComponent(ref)}/additional-information`, { body: { message } });
