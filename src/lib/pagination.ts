import { z } from "zod";
import { ApiError } from "./api";

/** Keyset ("cursor") pagination over (created_at desc, ref desc). Cursors are opaque to clients. */
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1, "min 1").max(50, "max 50").default(20),
  cursor: z.string().max(200).optional(),
});

const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const REF = /^[A-Za-z0-9._-]{1,64}$/;

export const encodeCursor = (createdAt: string, ref: string) => Buffer.from(JSON.stringify([createdAt, ref])).toString("base64url");

export function decodeCursor(cursor: string): { createdAt: string; ref: string } {
  const bad = () => new ApiError("validation_failed", "The cursor is invalid or expired.", { cursor: "invalid" });
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string" && TS.test(v[0]) && REF.test(v[1])) return { createdAt: v[0], ref: v[1] };
  } catch { /* fall through */ }
  throw bad();
}

/** PostgREST `or` filter for "rows after the cursor". Values are validated above, so interpolation is safe. */
export const afterCursor = (c: { createdAt: string; ref: string }) => `created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},ref.lt.${c.ref})`;

/** Turns limit+1 fetched rows into a page and the next cursor. */
export function toPage<T extends { created_at: string; ref: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, page: { next_cursor: rows.length > limit && last ? encodeCursor(last.created_at, last.ref) : null, limit } };
}
