import { ApiError } from "./api";

const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
export const encodeFeedCursor = (tier: number, ts: string, ref: string) => Buffer.from(JSON.stringify([tier, ts, ref])).toString("base64url");
export function decodeFeedCursor(cursor: string): { tier: number; ts: string; ref: string } {
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(v) && (v[0] === 0 || v[0] === 1) && typeof v[1] === "string" && TS.test(v[1]) && typeof v[2] === "string" && /^[A-Za-z0-9._-]{1,64}$/.test(v[2])) return { tier: v[0], ts: v[1], ref: v[2] };
  } catch { /* fall through */ }
  throw new ApiError("validation_failed", "The cursor is invalid or expired.", { cursor: "invalid" });
}
