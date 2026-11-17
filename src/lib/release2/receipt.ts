import { createHash, createPublicKey, verify } from "node:crypto";

/**
 * B8.2: an agency that runs a system accepting our referrals can sign a registration receipt with an Ed25519 private key. We keep only the public key.
 * The signed text is fixed so a receipt for one referral cannot be replayed for another: integration, referral, the agency's own reference and issue time.
 */
export const receiptMessage = (r: { integration_id: string; referral_id: string; agency_reference: string; issued_at: string }) =>
  `jonokotha-receipt-v1\n${r.integration_id}\n${r.referral_id}\n${r.agency_reference}\n${r.issued_at}`;

export function parsePublicKey(pem: string) {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("not an Ed25519 key");
  const fingerprint = createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
  return { key, fingerprint };
}
export function verifyReceipt(pem: string, message: string, signatureB64: string): boolean {
  try {
    const sig = Buffer.from(signatureB64, "base64");
    return sig.length === 64 && verify(null, Buffer.from(message, "utf8"), parsePublicKey(pem).key, sig);
  } catch { return false; }
}
export const signatureHash = (signatureB64: string) => createHash("sha256").update(Buffer.from(signatureB64, "base64")).digest("hex");
