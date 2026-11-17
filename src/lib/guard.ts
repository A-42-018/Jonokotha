import { redirect } from "next/navigation";
import { mfaUrl } from "@/lib/mfa";
import { currentUser, type Role } from "@/lib/supabase/server";

/** Only same-site paths are allowed as a post-login destination (no open redirect). */
export function safeNext(next: unknown, fallback = "/report"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

export function loginUrl(path: string): string {
  return `/login?need=1&next=${encodeURIComponent(path)}`;
}

/**
 * Step-up (masterplan sections 5 and 18.1): staff, moderators and admins who still need a TOTP session go to /mfa and come back here.
 * The database decides (`mfa_ok()` is false only when enforcement is on, the account needs MFA and the session is not aal2),
 * so this never disagrees with the API's 403 `mfa_required`.
 */
async function stepUp(cu: Awaited<ReturnType<typeof currentUser>>, path: string) {
  if (!cu.isStaff) return;
  const { data } = await cu.sb.rpc("mfa_ok");
  if (data === false) redirect(mfaUrl(path));
}

/**
 * Route guard for office pages. Signed out: redirect to sign-in that returns here.
 * Signed in without the role: `denied` carries who they are, so the page can render NoAccess.
 */
export async function guardStaff(path: string) {
  const cu = await currentUser();
  if (!cu.user) redirect(loginUrl(path));
  await stepUp(cu, path);
  const denied = cu.isStaff ? null : { email: cu.user.email ?? "", role: cu.role as Role };
  return { ...cu, user: cu.user, denied };
}

/** Route guard for admin pages: signed out goes to sign-in; staff or citizens get `denied` (render NoAccess). */
export async function guardAdmin(path: string) {
  const cu = await currentUser();
  if (!cu.user) redirect(loginUrl(path));
  await stepUp(cu, path);
  const denied = cu.role === "admin" ? null : { email: cu.user.email ?? "", role: cu.role as Role };
  return { ...cu, user: cu.user, denied };
}
