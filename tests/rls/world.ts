import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser } from "../db/fixtures";

/** The six accounts the masterplan (§14) requires, plus data in two constituencies. Built inside a rolled-back transaction. */
export interface World {
  A: string; B: string;
  citizenA: string; citizenB: string; officeA: string; officeB: string; moderator: string; admin: string;
  issueA: { id: string; ref: string }; issueB: { id: string; ref: string };
  mediaA: string; assignmentA: string; refOffice: string; refPublic: string;
  notifA: string; notifB: string; consentA: string; consentB: string;
  runA: string; runB: string; runNone: string; sugA: string; sugB: string;
  chunk: string; edge: string; embedding: string; repVerified: string; repHidden: string; audit: string;
}
export type Who = keyof Pick<World, "citizenA" | "citizenB" | "officeA" | "officeB" | "moderator" | "admin"> | "anon";
export const WHO: Who[] = ["anon", "citizenA", "citizenB", "officeA", "officeB", "moderator", "admin"];

const id = async (c: Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0].id as string;

export async function buildWorld(c: Client): Promise<World> {
  const A = await createConstituency(c), B = await createConstituency(c);
  const citizenA = await createUser(c), citizenB = await createUser(c);
  const officeA = await createUser(c, "staff"), officeB = await createUser(c, "staff");
  const moderator = await createUser(c, "moderator"), admin = await createUser(c, "admin");
  await addMember(c, officeA, A, "office_manager");
  await addMember(c, officeB, B, "office_manager");
  const issueA = await createIssue(c, A, citizenA), issueB = await createIssue(c, B, citizenB);
  const mediaA = await id(c, "insert into issue_media (issue_id, uploader_id, storage_path, media_type) values ($1,$2,'p/a.jpg','image') returning id", [issueA.id, citizenA]);
  const assignmentA = await id(c, "insert into issue_assignments (issue_id, assigned_to, assigned_by) values ($1,$2,$2) returning id", [issueA.id, officeA]);
  const refOffice = await id(c, "insert into issue_agency_referrals (issue_id, agency_name, visibility) values ($1,'office-only','office') returning id", [issueA.id]);
  const refPublic = await id(c, "insert into issue_agency_referrals (issue_id, agency_name, visibility) values ($1,'public-one','public') returning id", [issueA.id]);
  const notifA = await id(c, "insert into notifications (user_id, type, title) values ($1,'t','a') returning id", [citizenA]);
  const notifB = await id(c, "insert into notifications (user_id, type, title) values ($1,'t','b') returning id", [citizenB]);
  const consentA = await id(c, "insert into consents (user_id, consent_type, policy_version) values ($1,'privacy','v1') returning id", [citizenA]);
  const consentB = await id(c, "insert into consents (user_id, consent_type, policy_version) values ($1,'privacy','v1') returning id", [citizenB]);
  await c.query("insert into user_preferences (user_id) values ($1), ($2)", [citizenA, citizenB]);
  const runA = await id(c, "insert into ai_runs (agent, status, issue_id) values ('duplicate','ok',$1) returning id", [issueA.id]);
  const runB = await id(c, "insert into ai_runs (agent, status, issue_id) values ('duplicate','ok',$1) returning id", [issueB.id]);
  const runNone = await id(c, "insert into ai_runs (agent, status) values ('intake','ok') returning id");
  const sugA = await id(c, "insert into ai_suggestions (target_type, target_id, suggestion_type, payload) values ('issue',$1,'duplicate','{}') returning id", [issueA.id]);
  const sugB = await id(c, "insert into ai_suggestions (target_type, target_id, suggestion_type, payload) values ('issue',$1,'duplicate','{}') returning id", [issueB.id]);
  const src = await id(c, "insert into knowledge_sources (name, is_demo) values ('test-source', true) returning id");
  const chunk = await id(c, "insert into knowledge_chunks (source_id, content) values ($1,'x') returning id", [src]);
  const edge = await id(c, "insert into graph_edges (from_type, from_id, relation, to_type, to_id) values ('issue',$1,'located_in','area',$2) returning id", [issueA.id, A]);
  await c.query("insert into issue_embeddings (issue_id, model) values ($1,'test')", [issueA.id]);
  const embedding = issueA.id;
  const repVerified = await id(c, "insert into representatives (full_name, verification_status, is_demo) values ('v','verified',true) returning id");
  const repHidden = await id(c, "insert into representatives (full_name, verification_status, is_demo) values ('u','unverified',true) returning id");
  const audit = await id(c, "insert into audit_logs (action, resource_type) values ('test','x') returning id");
  return { A, B, citizenA, citizenB, officeA, officeB, moderator, admin, issueA, issueB, mediaA, assignmentA, refOffice, refPublic, notifA, notifB, consentA, consentB, runA, runB, runNone, sugA, sugB, chunk, edge, embedding, repVerified, repHidden, audit };
}

export const userOf = (w: World, who: Who) => (who === "anon" ? null : w[who]);

/** Ids from `table.col` (restricted to `ids`) that `who` can read. A refused query counts as "nothing visible". */
export async function visible(c: Client, w: World, who: Who, table: string, col: string, ids: string[]) {
  await actAs(c, userOf(w, who));
  const r = await attempt(c, `select ${col} as v from ${table} where ${col}::text = any($1::text[])`, [ids]);
  await actAsOwner(c);
  return r.ok ? r.rows.map((x) => String(x.v)).sort() : [];
}
