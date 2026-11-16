import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { loadActor, type Actor } from "../auth";

export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(list) {
        try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a Server Component; proxy refreshes the session */ }
      },
    },
  });
}

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { sb, user: null, isStaff: false, actor: null as Actor | null };
  const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const isStaff = p?.role === "staff" || p?.role === "admin";
  // Office scopes and roles come from the database for this session user, never from the request.
  let aal: Actor["aal"] = "aal1";
  if (p?.role && p.role !== "citizen") {
    const { data: lvl } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (lvl?.currentLevel === "aal2") aal = "aal2";
  }
  return { sb, user: data.user, isStaff, actor: await loadActor(sb, data.user.id, aal) };
}
