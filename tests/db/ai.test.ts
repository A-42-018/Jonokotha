import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

async function world(c: Client) {
  const A = await createConstituency(c), B = await createConstituency(c);
  const owner = await createUser(c), manager = await createUser(c, "staff"), other = await createUser(c, "staff"), admin = await createUser(c, "admin");
  await addMember(c, manager, A, "office_manager"); await addMember(c, other, B, "office_manager");
  const issue = (await createIssue(c, A, owner)).id;
  const run = await scalar<string>(c, "insert into ai_runs (agent, status) values ('copilot','ok') returning id");
  const sug = await scalar<string>(c, "insert into ai_suggestions (ai_run_id, target_type, target_id, suggestion_type, payload) values ($1,'issue',$2,'reply_draft','{\"text\":\"hello\"}') returning id", [run, issue]);
  return { A, owner, manager, other, admin, issue, run, sug };
}
const decide = (c: Client, id: string, d: string, f: object | null = null) => attempt(c, "select decide_ai_suggestion($1,$2,$3::jsonb) as s", [id, d, f ? JSON.stringify(f) : null]);

describe("AI runs and suggestions (migration 0012)", () => {
  it("log_ai_run is callable by the service role only", () => withClient((c) => tx(c, async () => {
    const call = "select log_ai_run('intake','ok','m','intake','v1','h','{}'::jsonb,5,null,null) as id";
    for (const role of ["anon", "authenticated"]) { await c.query(`set local role ${role}`); expect((await attempt(c, call)).ok, role).toBe(false); await c.query("reset role"); }
    await c.query("set local role service_role");
    const r = await attempt(c, call);
    expect(r.ok).toBe(true);
    await c.query("reset role");
    expect(await scalar(c, "select count(*)::int from ai_runs where input_hash='h' and prompt_id='intake' and decision='pending' and retention_until is not null")).toBe(1);
  })));

  it("failed runs are stored as not_applicable, and clients cannot insert runs directly", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await c.query("set local role service_role");
    await c.query("select log_ai_run('intake','timeout','m','intake','v1','h2',null,20000,null,null)");
    await c.query("reset role");
    expect(await scalar(c, "select decision from ai_runs where input_hash='h2'")).toBe("not_applicable");
    await actAs(c, w.manager);
    expect((await attempt(c, "insert into ai_runs (agent,status) values ('intake','ok')")).ok).toBe(false);
    expect((await attempt(c, "insert into ai_suggestions (target_type,target_id,suggestion_type,payload) values ('issue','x','y','{}')")).ok).toBe(false);
  })));

  it("staff in scope accept, edit or dismiss; the decision is recorded, mirrored on the run, and audited", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    expect(await decide(c, w.sug, "edited", { text: "my version" })).toMatchObject({ ok: true });
    await actAsOwner(c);
    const s = (await c.query("select decision, decided_by, final_value from ai_suggestions where id=$1", [w.sug])).rows[0];
    expect(s).toMatchObject({ decision: "edited", decided_by: w.manager, final_value: { text: "my version" } });
    expect(await scalar(c, "select decision from ai_runs where id=$1", [w.run])).toBe("edited");
    expect(await scalar(c, "select count(*)::int from audit_logs where action='ai_suggestion.edited' and resource_id=$1", [w.sug])).toBe(1);
  })));

  it("accept keeps the AI payload as the final value; dismiss keeps none", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    const s2 = await scalar<string>(c, "insert into ai_suggestions (target_type,target_id,suggestion_type,payload) values ('issue',$1,'summary','{\"a\":1}') returning id", [w.issue]);
    await actAs(c, w.manager);
    await decide(c, w.sug, "accepted"); await decide(c, s2, "dismissed");
    await actAsOwner(c);
    expect((await c.query("select final_value from ai_suggestions where id=$1", [w.sug])).rows[0].final_value).toEqual({ text: "hello" });
    expect((await c.query("select final_value from ai_suggestions where id=$1", [s2])).rows[0].final_value).toBeNull();
  })));

  it("refuses: edit without a value, a second decision, an unknown decision", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    expect(await decide(c, w.sug, "edited")).toMatchObject({ ok: false, code: "JK002" });
    expect(await decide(c, w.sug, "maybe")).toMatchObject({ ok: false, code: "JK002" });
    expect(await decide(c, w.sug, "accepted")).toMatchObject({ ok: true });
    expect(await decide(c, w.sug, "dismissed")).toMatchObject({ ok: false, code: "JK003" });
  })));

  it("citizens, staff of another office and anonymous visitors cannot decide; admin can", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    for (const who of [w.owner, w.other]) { await actAs(c, who); expect(await decide(c, w.sug, "accepted"), who).toMatchObject({ ok: false, code: "42501" }); }
    await actAs(c, null);
    expect((await decide(c, w.sug, "accepted")).ok).toBe(false);
    await actAs(c, w.admin);
    expect(await decide(c, w.sug, "accepted")).toMatchObject({ ok: true });
    await actAsOwner(c);
    expect(await scalar(c, "select decision from ai_suggestions where id=$1", [w.sug])).toBe("accepted");
  })));

  it("citizens never see runs or suggestions, even for their own issue", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await c.query("update ai_runs set issue_id=$2 where id=$1", [w.run, w.issue]);
    await actAs(c, w.owner);
    expect(await scalar(c, "select count(*)::int from ai_runs")).toBe(0);
    expect(await scalar(c, "select count(*)::int from ai_suggestions")).toBe(0);
    await actAs(c, w.manager);
    expect(await scalar(c, "select count(*)::int from ai_runs where id=$1", [w.run])).toBe(1);
    await actAs(c, w.other);
    expect(await scalar(c, "select count(*)::int from ai_runs where id=$1", [w.run])).toBe(0);
  })));
});
