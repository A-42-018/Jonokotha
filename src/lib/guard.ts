import { redirect } from "next/navigation";
import { currentUser, type Role } from "@/lib/supabase/server";

/** Only same-site paths are allowed as a post-login destination (no open redirect). */
export function safeNext(next: unknown, fallback = "/report"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : fallback;
}

export function loginUrl(path: string): string {
  return `/login?need=1&next=${encodeURIComponent(path)}`;
}

/**
 * Route guard for office pages. Signed out: redirect to sign-in that returns here.
 * Signed in without the role: `denied` carries who they are, so the page can render NoAccess.
 */
export async function guardStaff(path: string) {
  const cu = await currentUser();
  if (!cu.user) redirect(loginUrl(path));
  const denied = cu.isStaff ? null : { email: cu.user.email ?? "", role: cu.role as Role };
  return { ...cu, user: cu.user, denied };
}
