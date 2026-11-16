import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadActor, type Actor } from "../../src/lib/auth";

/** Local Supabase connection details: from the environment (CI) or from `supabase status` (laptop). Never the live project. */
function localEnv() {
  let url = process.env.SUPABASE_API_URL, anon = process.env.SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL;
  if (!url || !anon || !service) {
    const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const get = (k: string) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, "m"))?.[1];
    url = get("API_URL"); anon = get("ANON_KEY"); service = get("SERVICE_ROLE_KEY");
  }
  if (!url || !anon || !service) throw new Error("Local Supabase is not running (npx supabase start)");
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("API tests only run against a local Supabase");
  return { url, anon, service };
}
export const env = localEnv();
export const anonClient: SupabaseClient = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } });
export const admin: SupabaseClient = createClient(env.url, env.service, { auth: { persistSession: false, autoRefreshToken: false } });

export interface TestUser { id: string; email: string; sb: SupabaseClient; actor: Actor | null; role: string }
const created: string[] = [];
const PASSWORD = "T3st-" + Math.random().toString(36).slice(2) + "-Aa1!";
let n = 0;

export async function makeUser(role: "citizen" | "staff" | "moderator" | "admin", membership?: { constituencyId: string; officeRole: string }): Promise<TestUser> {
  const email = `api-${Date.now().toString(36)}-${n++}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const id = data.user.id; created.push(id);
  if (role !== "citizen") await admin.from("profiles").update({ role }).eq("id", id).throwOnError();
  if (membership) await admin.from("office_members").insert({ user_id: id, constituency_id: membership.constituencyId, office_role: membership.officeRole }).throwOnError();
  const sb = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  return { id, email, sb, actor: await loadActor(sb, id), role };
}

export async function makeConstituency(): Promise<{ id: string; key: string }> {
  const key = `t-${Date.now().toString(36)}-${n++}`;
  const { data } = await admin.from("constituencies").insert({ key, name_bn: key, name_en: key, is_demo: true }).select("id,key").single().throwOnError();
  return data!;
}

/** Whoever the next route handler call should run as. Set with `as(user)`. */
let current: TestUser | null = null;
export const as = (u: TestUser | null) => { current = u; };
export const session = () => current;

export async function cleanup(constituencyIds: string[] = []) {
  if (created.length) {
    await admin.from("issues").delete().in("reporter_id", created);
    for (const id of created) await admin.auth.admin.deleteUser(id);
  }
  for (const id of constituencyIds) await admin.from("issues").delete().eq("constituency_id", id);
  if (constituencyIds.length) { await admin.from("office_members").delete().in("constituency_id", constituencyIds); await admin.from("constituencies").delete().in("id", constituencyIds); }
}

/** Call a route handler the way Next would. */
export async function call(handler: (req: Request, ctx: never) => Promise<Response>, method: string, path: string,
  o: { body?: unknown; rawBody?: string; headers?: Record<string, string>; params?: Record<string, string>; ip?: string } = {}) {
  const ip = o.ip ?? `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const init: RequestInit = { method, headers: { "content-type": "application/json", "x-forwarded-for": ip, ...o.headers } };
  if (o.rawBody !== undefined) init.body = o.rawBody; else if (o.body !== undefined) init.body = JSON.stringify(o.body);
  const res = await handler(new Request(`http://localhost${path}`, init), { params: Promise.resolve(o.params ?? {}) } as never);
  // Test responses are inspected loosely on purpose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: Record<string, unknown> & { data?: any; page?: any; code?: string; field_errors?: Record<string, string>; request_id?: string } = {};
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json, headers: res.headers };
}
