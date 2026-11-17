import { Client } from "pg";

const URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(URL)) throw new Error("DB tests only run against a local database");

export async function withClient<T>(fn: (c: Client) => Promise<T>) {
  const c = new Client({ connectionString: URL });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

/** Run fn as a Supabase role (anon / authenticated) with a given user id, inside a rolled-back transaction. */
export async function asUser<T>(c: Client, userId: string | null, fn: () => Promise<T>) {
  await c.query("begin");
  try {
    await c.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" })]);
    return await fn();
  } finally { await c.query("rollback"); }
}
