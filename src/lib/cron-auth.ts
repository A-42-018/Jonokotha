import { timingSafeEqual } from "node:crypto";

/** True when the request carries `Authorization: Bearer $CRON_SECRET` (secret of 16+ characters). Constant-time compare. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET, given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  return !!secret && secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}
