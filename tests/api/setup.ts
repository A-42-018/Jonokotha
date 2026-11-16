import { vi } from "vitest";

// The routes read the session through currentUser(); in tests that session is a real signed-in Supabase client
// (local stack) chosen with as(user). Everything else (RLS, functions, triggers) is the real thing.
delete process.env.ANTHROPIC_API_KEY; // keep intake/summary on the offline fallback
vi.mock("@/lib/supabase/server", async () => {
  const h = await import("./harness");
  return {
    supabaseServer: async () => h.session()?.sb ?? h.anonClient,
    currentUser: async () => {
      const u = h.session();
      if (!u) return { sb: h.anonClient, user: null, isStaff: false, actor: null };
      return { sb: u.sb, user: { id: u.id, email: u.email }, isStaff: u.role === "staff" || u.role === "admin", actor: u.actor };
    },
  };
});
