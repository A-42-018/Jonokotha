import { NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

export const MAX_BODY_BYTES = 16 * 1024;

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Returns a 429 response when the caller is over the limit, otherwise null. Keyed by IP and (if signed in) user. */
export function limited(req: Request, scope: string, userId: string | null, limit: number, windowMs = 60_000) {
  for (const id of [`ip:${clientIp(req)}`, userId && `user:${userId}`]) {
    if (!id) continue;
    const r = rateLimit(`${scope}:${id}`, limit, windowMs);
    if (!r.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });
  }
  return null;
}

/** Reads a JSON body with a hard size cap. Returns { ok:false, res } to send back on failure. */
export async function readJson(req: Request, maxBytes = MAX_BODY_BYTES): Promise<{ ok: true; data: unknown } | { ok: false; res: NextResponse }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, res: NextResponse.json({ error: "too_large" }, { status: 413 }) };
  const text = await req.text().catch(() => "");
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, res: NextResponse.json({ error: "too_large" }, { status: 413 }) };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, res: NextResponse.json({ error: "invalid" }, { status: 400 }) };
  }
}

/** True when there is no Origin header, or it names the same host the request was sent to. */
export function sameOrigin(origin: string | null, host: string): boolean {
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}
