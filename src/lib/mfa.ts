/** Two-factor helpers shared by the guard, the API client and the /mfa screen. Pure: no I/O. */

export const MFA_PATH = "/mfa";

/** Where to send someone who needs a code, returning to `next` afterwards (same-site paths only). */
export function mfaUrl(next: string): string {
  const safe = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.startsWith(MFA_PATH) ? next : "/";
  return `${MFA_PATH}?next=${encodeURIComponent(safe)}`;
}

/** True for the API's stable "needs a TOTP session" error (docs/api-v1.md: 403 forbidden, field_errors._ = mfa_required). */
export function isMfaRequired(e: { code?: string; status?: number; fieldErrors?: Record<string, string> }): boolean {
  return e.status === 403 && e.code === "forbidden" && e.fieldErrors?._ === "mfa_required";
}

export type MfaFailure = "wrong" | "tooMany" | "unavailable" | "other";

/** Maps a Supabase auth error to one of our messages. Supabase texts are for developers and are never shown. */
export function classifyMfaError(e: { message?: string; status?: number; code?: string } | null | undefined): MfaFailure {
  const m = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (e?.status === 429 || m.includes("rate") || m.includes("too many")) return "tooMany";
  if (m.includes("disabled") || m.includes("not_enabled")) return "unavailable";
  if (m.includes("invalid") || m.includes("mfa_verification_failed") || m.includes("incorrect") || e?.status === 400) return "wrong";
  return "other";
}
