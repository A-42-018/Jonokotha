import { vi } from "vitest";

// The routes read the session through currentUser(); in tests that session is a real signed-in Supabase client
// (local stack) chosen with as(user). Everything else (RLS, functions, triggers) is the real thing.
// Like the real server client, each request's client forwards the request id to the database (x-jk-request-id).
delete process.env.ANTHROPIC_API_KEY; // keep intake/summary on the offline fallback
vi.mock("@/lib/supabase/server", async () => {
  const h = await import("./harness");
  const { createClient } = await import("@supabase/supabase-js");
  const forUser = async (u: NonNullable<ReturnType<typeof h.session>>, requestId?: string) => {
    const { data } = await u.sb.auth.getSession();
    return createClient(h.env.url, h.env.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.session!.access_token}`, ...(requestId ? { "x-jk-request-id": requestId } : {}) } },
    });
  };
  return {
    supabaseServer: async (requestId?: string) => { const u = h.session(); return u ? forUser(u, requestId) : h.anonClient; },
    currentUser: async (requestId?: string) => {
      const u = h.session();
      if (!u) return { sb: h.anonClient, user: null, isStaff: false, actor: null };
      return { sb: await forUser(u, requestId), user: { id: u.id, email: u.email }, isStaff: u.role === "staff" || u.role === "admin", actor: u.actor };
    },
  };
});
