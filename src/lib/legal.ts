import { api, ApiError } from "@/lib/api-client";

/** Version of the privacy notice and terms shown in the app. Bump it when the text changes; consent is recorded against it. */
export const POLICY_VERSION = "0.1";
export const POLICY_DATE = "2026-11-16";
export const CONSENT_TYPE = "privacy_notice";
/** Where challenges and takedown requests go. Empty until the operator decides; pages then say so instead of showing a placeholder. */
export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim();

export interface Profile { id: string; display_name: string | null; preferred_language: string | null; account_status: string | null; created_at: string; deletion_requested_at: string | null }
export interface Consent { consent_type: string; policy_version: string; granted_at: string; withdrawn_at: string | null }

export const fetchProfile = () => api<Profile>("/me/profile").then((r) => r.data);
export const fetchConsents = () => api<Consent[]>("/me/consents").then((r) => r.data);
export const setConsent = (granted: boolean) => api<unknown>("/me/consents", { body: { consent_type: CONSENT_TYPE, policy_version: POLICY_VERSION, granted } });
export const requestDeletion = () => api<unknown>("/me/deletion-request", { method: "POST", body: {} });
export const cancelDeletion = () => api<{ cancelled: boolean }>("/me/deletion-request", { method: "DELETE" }).then((r) => r.data);

/** The newest consent row for the privacy notice, or undefined. Open means not withdrawn. */
export function currentConsent(rows: Consent[]): Consent | undefined {
  return rows.filter((r) => r.consent_type === CONSENT_TYPE).sort((a, b) => b.granted_at.localeCompare(a.granted_at))[0];
}
export const consentOpen = (c: Consent | undefined) => !!c && !c.withdrawn_at;

/** Downloads the export as a file. Throws ApiError (status 0 for no network, 429 for the rate limit). */
export async function downloadExport(doFetch: typeof fetch = fetch): Promise<void> {
  let res: Response;
  try { res = await doFetch("/api/v1/me/export"); } catch { throw new ApiError("network", 0); }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new ApiError(j?.code ?? "internal_error", res.status);
  }
  const blob = new Blob([await res.text()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jonokotha-my-data.json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ChallengeType = "issue" | "idea" | "question";
export interface ChallengeInput { type: ChallengeType; ref: string; why: string }
export function validateChallenge(v: ChallengeInput): { ref?: "chRefMissing"; why?: "chWhyShort" } {
  const e: { ref?: "chRefMissing"; why?: "chWhyShort" } = {};
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,40}$/.test(v.ref.trim())) e.ref = "chRefMissing";
  if (v.why.trim().length < 20 || v.why.trim().length > 1500) e.why = "chWhyShort";
  return e;
}
/** Plain-text challenge (the app has no endpoint for it yet): copied or sent by email. */
export function challengeText(v: ChallengeInput, labels: { type: string; ref: string; why: string; typeName: string }) {
  return `${labels.type}: ${labels.typeName}\n${labels.ref}: ${v.ref.trim()}\n${labels.why}:\n${v.why.trim()}\n`;
}
export const mailtoUrl = (to: string, subject: string, body: string) => `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
