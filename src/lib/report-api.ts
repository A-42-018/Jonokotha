import { api } from "@/lib/api-client";

/** Adds one photo to the reporter's own issue (multipart; the server checks the type by content and strips location data). */
export function uploadPhoto(ref: string, photo: { blob: Blob; caption: string }) {
  const form = new FormData();
  form.append("file", photo.blob, "photo.jpg");
  if (photo.caption.trim()) form.append("caption", photo.caption.trim());
  return api<{ id: string }>(`/issues/${encodeURIComponent(ref)}/media`, { form });
}

/** Uploads photos one by one and returns how many did not go through, so the success screen can say so. */
export async function uploadPhotos(ref: string, photos: { blob: Blob; caption: string }[], up = uploadPhoto): Promise<number> {
  let failed = 0;
  for (const p of photos) {
    try { await up(ref, p); } catch { failed++; }
  }
  return failed;
}
