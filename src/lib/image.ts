export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Largest photo accepted before compression. Phone cameras make 3 to 8 MB; bigger files only risk freezing a low-end phone. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** First bytes of the file decide the real type: the browser-reported type follows the file name and can lie (an SVG renamed .jpg). */
export function sniffImageType(head: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const is = (...b: number[]) => b.every((v, i) => head[i] === v);
  if (is(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (is(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return "image/webp";
  return null;
}

export type PhotoProblem = "type" | "size" | null;

/** Type (by content, not name) and size check, before the file is decoded. */
export async function checkPhoto(file: Pick<File, "size" | "slice">): Promise<PhotoProblem> {
  if (file.size > MAX_PHOTO_BYTES) return "size";
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  return sniffImageType(head) ? null : "type";
}

/**
 * Shrinks a photo on the device before anything leaves the phone:
 * longest edge at most `maxEdge`, re-encoded as JPEG. Re-encoding also drops EXIF (including GPS).
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#fff"; // PNG transparency becomes white instead of black in JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) throw new Error("encode failed");
    return blob;
  } finally {
    bitmap.close();
  }
}
