import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { loadActor, type Actor } from "../auth";

/**
 * Server-side client for the signed-in user. When a request id is given it is sent to the database as
 * x-jk-request-id, so audit_logs rows written by triggers carry the same id as the API log line.
 */
export async function supabaseServer(requestId?: string) {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    ...(requestId ? { global: { headers: { "x-jk-request-id": requestId } } } : {}),
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a Server Component; proxy refreshes the session */ }
      },
    },
  });
}

/** Platform role as the frontend sees it (profiles.role; the finer office roles live in `actor`). */
export type Role = "citizen" | "staff" | "admin";

export async function currentUser(requestId?: string) {
  const sb = await supabaseServer(requestId);
  const { data } = await sb.auth.getUser();
  if (!data.user) return { sb, user: null, role: null, isStaff: false, actor: null as Actor | null };
  const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const role: Role = p?.role === "admin" ? "admin" : p?.role === "staff" ? "staff" : "citizen";
  const isStaff = role !== "citizen";
  // Office scopes and roles come from the database for this session user, never from the request.
  let aal: Actor["aal"] = "aal1";
  if (isStaff) {
    const { data: lvl } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (lvl?.currentLevel === "aal2") aal = "aal2";
  }
  return { sb, user: data.user, role, isStaff, actor: await loadActor(sb, data.user.id, aal) };
}
