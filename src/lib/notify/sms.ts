/**
 * SMS (B5.9; masterplan §15): ONLY for critical account verification, ONLY where the person consented, ONLY within a budget. Everything else
 * stays in-app, push or email. The provider is an interface, so tests use a fake and a real provider is a configuration step
 * (SMS_PROVIDER / SMS_API_KEY; the integration is "planned" in feature_flags until an account and budget exist).
 */
export interface SmsProvider { send(to: string, text: string): Promise<{ ok: boolean; error?: string }> }
export type SmsDecision = { allowed: true } | { allowed: false; reason: "purpose_not_allowed" | "no_consent" | "budget_exhausted" | "not_configured" };

export function smsDecision(i: { purpose: string; consentGranted: boolean; sentThisMonth: number; monthlyBudget: number; configured: boolean }): SmsDecision {
  if (i.purpose !== "verification") return { allowed: false, reason: "purpose_not_allowed" };
  if (!i.configured) return { allowed: false, reason: "not_configured" };
  if (!i.consentGranted) return { allowed: false, reason: "no_consent" };
  if (i.sentThisMonth >= i.monthlyBudget) return { allowed: false, reason: "budget_exhausted" };
  return { allowed: true };
}

export async function sendVerificationSms(provider: SmsProvider | null, to: string, code: string, gate: Omit<Parameters<typeof smsDecision>[0], "purpose" | "configured">): Promise<SmsDecision & { sent?: boolean }> {
  const d = smsDecision({ ...gate, purpose: "verification", configured: !!provider });
  if (!d.allowed || !provider) return d;
  const r = await provider.send(to, `জনকথা কোড: ${code}। কাউকে বলবেন না। / Jonokotha code: ${code}. Do not share it.`);
  return { allowed: true, sent: r.ok };
}
