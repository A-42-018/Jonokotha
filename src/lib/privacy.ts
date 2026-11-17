import { z } from "zod";
import { parse, rpc, type Ctx, type Result } from "./api";

/** Privacy endpoints (backend plan 3.7): export, correction, deletion request, consent records. All act on the signed-in person only. */
const Profile = z.strictObject({ display_name: z.string().trim().min(1).max(80).optional(), preferred_language: z.enum(["bn", "en"]).optional() })
  .refine((v) => v.display_name !== undefined || v.preferred_language !== undefined, { message: "Nothing to change." });
const Consent = z.strictObject({ consent_type: z.string().regex(/^[a-z_]{3,40}$/), policy_version: z.string().regex(/^[A-Za-z0-9._-]{1,20}$/), granted: z.boolean() });

export async function exportMine(c: Ctx): Promise<Result> {
  return { data: await rpc(c.sb, "export_my_data"), headers: { "Content-Disposition": 'attachment; filename="jonokotha-my-data.json"', "Cache-Control": "no-store" } };
}
export async function requestDeletion(c: Ctx): Promise<Result> { return { status: 202, data: await rpc(c.sb, "request_account_deletion") }; }
export async function cancelDeletion(c: Ctx): Promise<Result> { return { data: await rpc(c.sb, "cancel_account_deletion") }; }
export async function getProfile(c: Ctx): Promise<Result> {
  const { data } = await c.sb.from("profiles").select("id,display_name,preferred_language,account_status,created_at").eq("id", c.user!.id).maybeSingle();
  const { data: del } = await c.sb.from("deletion_requests").select("status,requested_at").eq("user_id", c.user!.id).eq("status", "requested").maybeSingle();
  return { data: { ...data, deletion_requested_at: del?.requested_at ?? null } };
}
export async function patchProfile(c: Ctx): Promise<Result> {
  const b = parse(Profile, c.body);
  return { data: await rpc(c.sb, "update_my_profile", { p_display_name: b.display_name ?? null, p_language: b.preferred_language ?? null }) };
}
export async function listConsents(c: Ctx): Promise<Result> {
  const { data } = await c.sb.from("consents").select("consent_type,policy_version,granted_at,withdrawn_at").eq("user_id", c.user!.id).order("granted_at", { ascending: false }).limit(100);
  return { data: data ?? [] };
}
export async function setConsent(c: Ctx): Promise<Result> {
  const b = parse(Consent, c.body);
  return { data: await rpc(c.sb, "record_consent", { p_type: b.consent_type, p_version: b.policy_version, p_granted: b.granted }) };
}
