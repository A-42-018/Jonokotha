import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
  if (!data.user) return { sb, user: null, isStaff: false };
  const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { sb, user: data.user, isStaff: p?.role === "staff" || p?.role === "admin" };
}
