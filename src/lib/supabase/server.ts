import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { actorFromRows, fetchActorRows, type Actor } from "../auth";

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

export type SessionUser = { id: string; email?: string };
type Sb = Awaited<ReturnType<typeof supabaseServer>>;

/**
 * Who is signed in, for pages and the layout. `proxy.ts` already ran `getUser()` (server-verified, refreshes the cookie) for this very request,
 * so the render reads the verified token's claims instead of asking the auth server a second time. With asymmetric signing keys that check is local;
 * otherwise the client falls back to `getUser()` itself. API handlers (a request id given) keep the full `getUser()`.
 */
async function claimsUser(sb: Sb): Promise<SessionUser | null> {
  const { data } = await sb.auth.getClaims();
  if (data?.claims?.sub) return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : undefined };
  return null;
}

async function build<U extends SessionUser>(sb: Sb, user: U | null) {
  if (!user) return { sb, user: null, role: null, isStaff: false, actor: null as Actor | null };
  // One read of the profile and the memberships (in parallel) serves both the role and the actor.
  const rows = await fetchActorRows(sb, user.id);
  const r = rows.profile?.role;
  const role: Role = r === "admin" ? "admin" : r === "staff" ? "staff" : "citizen";
  const isStaff = role !== "citizen";
  // Office scopes and roles come from the database for this session user, never from the request.
  let aal: Actor["aal"] = "aal1";
  if (isStaff) {
    const { data: lvl } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (lvl?.currentLevel === "aal2") aal = "aal2";
  }
  return { sb, user, role, isStaff, actor: actorFromRows(user.id, aal, rows) };
}

// The root layout and the page (through its guard) both ask who is signed in. cache() makes that one lookup per server render
// instead of two; outside a render (route handlers) it simply calls through.
const currentUserOnce = cache(async () => { const sb = await supabaseServer(); return build(sb, await claimsUser(sb)); });

export type CurrentUser = Awaited<ReturnType<typeof currentUserOnce>>;
export function currentUser(): Promise<CurrentUser>;
export function currentUser(requestId: string): ReturnType<typeof build<User>>;
export async function currentUser(requestId?: string) {
  if (!requestId) return currentUserOnce();
  const sb = await supabaseServer(requestId);
  return build(sb, (await sb.auth.getUser()).data.user);
}
