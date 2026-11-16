import type { SupabaseClient } from "@supabase/supabase-js";

/** Platform roles (profiles.role). Office roles live in office_members.office_role and apply per constituency. */
export type PlatformRole = "citizen" | "staff" | "moderator" | "admin";
export type OfficeRole = "case_officer" | "office_manager" | "mp" | "agency_liaison";
export type OfficeAction = "view" | "acknowledge" | "assign" | "request_information" | "forward" | "update" | "resolve" | "close" | "decide" | "view_analytics" | "publish";

export interface Membership { constituencyId: string; constituencyKey: string; officeRole: OfficeRole }
export interface Actor { id: string; role: PlatformRole; offices: Membership[]; aal: "aal1" | "aal2" }

/**
 * Permission matrix (masterplan §5). `assignedOnly` = only on issues assigned to the actor.
 * Must equal the office_permissions table in migration 0006; tests/db/roles.test.ts compares them.
 */
export const OFFICE_PERMISSIONS: Record<OfficeRole, Partial<Record<OfficeAction, { assignedOnly: boolean }>>> = {
  office_manager: {
    view: { assignedOnly: false }, acknowledge: { assignedOnly: false }, assign: { assignedOnly: false },
    request_information: { assignedOnly: false }, forward: { assignedOnly: false }, update: { assignedOnly: false },
    resolve: { assignedOnly: false }, close: { assignedOnly: false }, decide: { assignedOnly: false }, view_analytics: { assignedOnly: false }, publish: { assignedOnly: false },
  },
  mp: { view: { assignedOnly: false }, view_analytics: { assignedOnly: false }, publish: { assignedOnly: false } },
  case_officer: { view: { assignedOnly: true }, request_information: { assignedOnly: true }, update: { assignedOnly: true } },
  agency_liaison: { view: { assignedOnly: true }, update: { assignedOnly: true } },
};

/** Roles that must use MFA once `enforce_mfa` is on (migration 0006, app_settings). */
export function mfaRequired(a: Actor) {
  return a.role === "moderator" || a.role === "admin" || a.offices.some((o) => o.officeRole === "mp");
}

export function mfaOk(a: Actor, enforce: boolean) {
  return !enforce || !mfaRequired(a) || a.aal === "aal2";
}

/**
 * May this actor perform `action` on an issue of `constituencyId`, currently assigned to `assignedTo`?
 * Mirrors the database function office_can(); the database remains the authority (RLS), this gives clean 403s.
 */
export function can(a: Actor | null, action: OfficeAction, issue: { constituencyId: string | null; assignedTo?: string | null }, enforceMfa = false) {
  if (!a || !mfaOk(a, enforceMfa)) return false;
  if (a.role === "admin") return true;
  if (a.role !== "staff" || !issue.constituencyId) return false;
  return a.offices.some((o) => {
    if (o.constituencyId !== issue.constituencyId) return false;
    const rule = OFFICE_PERMISSIONS[o.officeRole][action];
    return !!rule && (!rule.assignedOnly || issue.assignedTo === a.id);
  });
}

/** Loads the actor from the session user (identity never comes from the request body). */
export async function loadActor(sb: SupabaseClient, userId: string, aal: Actor["aal"] = "aal1"): Promise<Actor | null> {
  const { data: p } = await sb.from("profiles").select("role,account_status").eq("id", userId).maybeSingle();
  if (!p || p.account_status !== "active") return null;
  const { data: m } = await sb.from("office_members").select("constituency_id,office_role,status,constituencies(key)").eq("user_id", userId).eq("status", "active");
  const offices = (m ?? []).map((r) => ({
    constituencyId: r.constituency_id as string,
    constituencyKey: ((r.constituencies as unknown as { key: string } | null)?.key) ?? "",
    officeRole: r.office_role as OfficeRole,
  }));
  return { id: userId, role: p.role as PlatformRole, offices, aal };
}
