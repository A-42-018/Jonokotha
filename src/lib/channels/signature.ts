import { createHmac, timingSafeEqual } from "node:crypto";

/** Webhook signature check (B7.2). The signature is an HMAC-SHA256 of the RAW request body with a shared secret, compared in constant time. */
export function hmacHex(secret: string, raw: string): string { return createHmac("sha256", secret).update(raw).digest("hex"); }

/** Accepts "sha256=<hex>" (WhatsApp Cloud API, X-Hub-Signature-256) or bare "<hex>". Missing secret, missing header or a wrong value all fail. */
export function verifySignature(secret: string | undefined, raw: string, header: string | null): boolean {
  if (!secret || !header) return false;
  const given = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return false;
  const want = hmacHex(secret, raw);
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(want, "hex"));
}
