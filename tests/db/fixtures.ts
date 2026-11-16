import type { Client } from "pg";

/** Runs fn in a transaction that is always rolled back, so tests never leave data behind. */
export async function tx<T>(c: Client, fn: () => Promise<T>) {
  await c.query("begin");
  try { return await fn(); } finally { await c.query("rollback"); }
}

let n = 0;
const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${n++}`;

export async function createUser(c: Client, role: "citizen" | "staff" | "moderator" | "admin" = "citizen", status = "active") {
  const email = `${uniq("t")}@example.test`;
  const { rows } = await c.query(
    `insert into auth.users (id, email, instance_id, aud, role) values (gen_random_uuid(), $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated') returning id`, [email]);
  const id = rows[0].id as string;
  await c.query("update profiles set role = $2, account_status = $3 where id = $1", [id, role, status]);
  return id;
}

export async function createConstituency(c: Client) {
  const key = uniq("c");
  const { rows } = await c.query("insert into constituencies (key, name_bn, name_en, is_demo) values ($1, $1, $1, true) returning id", [key]);
  return rows[0].id as string;
}

export async function addMember(c: Client, userId: string, constituencyId: string, officeRole: string, status = "active") {
  await c.query("insert into office_members (user_id, constituency_id, office_role, status) values ($1,$2,$3,$4)", [userId, constituencyId, officeRole, status]);
}

export async function createIssue(c: Client, constituencyId: string, reporterId: string, assignedTo: string | null = null) {
  const { rows } = await c.query(
    `insert into issues (reporter_id, title, category, description, constituency_id, assigned_to) values ($1, 'test', 'roads', 'test issue', $2, $3) returning id, ref`,
    [reporterId, constituencyId, assignedTo]);
  return rows[0] as { id: string; ref: string };
}

/** Switch the session to a Supabase role. userId null = anon. aal sets the session assurance level claim. */
export async function actAs(c: Client, userId: string | null, aal: "aal1" | "aal2" = "aal1") {
  await c.query("reset role");
  await c.query(`set local role ${userId ? "authenticated" : "anon"}`);
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role: "authenticated", aal } : { role: "anon" })]);
}
export const actAsOwner = async (c: Client) => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true)"); };

export async function scalar<T = unknown>(c: Client, sql: string, params: unknown[] = []) {
  const { rows } = await c.query(sql, params);
  return Object.values(rows[0] ?? {})[0] as T;
}
