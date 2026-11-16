import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

async function world(c: Client) {
  const A = await createConstituency(c);
  const owner = await createUser(c), stranger = await createUser(c), manager = await createUser(c, "staff"), admin = await createUser(c, "admin");
  await addMember(c, manager, A, "office_manager");
  const issue = (await createIssue(c, A, owner)).id;
  return { A, owner, stranger, manager, admin, issue };
}
const stateOf = (c: Client, id: string) => c.query("select * from issue_sla_state($1)", [id]).then((r) => r.rows[0] as Record<string, unknown> | undefined);
const move = (c: Client, id: string, to: string, f: object) => c.query("select transition_issue($1, $2::issue_status, $3::jsonb)", [id, to, JSON.stringify(f)]);

describe("SLA targets and timers (migration 0011)", () => {
  it("sets targets at submission from the most specific active policy", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    const global = await scalar<number>(c, "select ack_target_hours from issue_sla where issue_id=$1", [w.issue]);
    expect(global).toBe(72);
    await c.query("insert into sla_policies (constituency_id, ack_target_hours, update_target_hours) values ($1, 24, 48)", [w.A]);
    const roads = (await createIssue(c, w.A, w.owner)).id;
    const row = (await c.query("select ack_target_hours a, update_target_hours u, ack_due_at - (select submitted_at from issues where id=$1) d from issue_sla where issue_id=$1", [roads])).rows[0];
    expect([row.a, row.u]).toEqual([24, 48]);
    // Category + constituency beats constituency alone.
    await c.query("insert into sla_policies (constituency_id, category_id, ack_target_hours, update_target_hours) select $1, id, 6, 12 from issue_categories where slug='roads'", [w.A]);
    const second = (await createIssue(c, w.A, w.owner)).id;
    expect(await scalar(c, "select ack_target_hours from issue_sla where issue_id=$1", [second])).toBe(6);
  })));

  it("acknowledging records the acknowledgement and moves to the update clock", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    expect((await stateOf(c, w.issue))?.due_kind).toBe("acknowledgement");
    await move(c, w.issue, "acknowledged", {});
    await actAsOwner(c);
    expect(await scalar(c, "select acknowledged_at is not null from issue_sla where issue_id=$1", [w.issue])).toBe(true);
    await actAs(c, w.manager);
    expect(await stateOf(c, w.issue)).toMatchObject({ state: "on_track", due_kind: "update" });
  })));

  it("pauses with a visible reason while waiting for the citizen, then resumes and shifts the due times", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    await move(c, w.issue, "needs_information", { message: "Which road?" });
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from issue_sla_pauses where issue_id=$1 and ended_at is null", [w.issue])).toBe(1);
    // Pretend the wait lasted two days, then the citizen answers.
    await c.query("update issue_sla_pauses set started_at = now() - interval '2 days' where issue_id=$1", [w.issue]);
    const before = await scalar<Date>(c, "select update_due_at from issue_sla where issue_id=$1", [w.issue]);
    await actAs(c, w.manager);
    expect(await stateOf(c, w.issue)).toMatchObject({ state: "paused", pause_kind: "waiting_citizen" });
    await actAs(c, w.owner);
    await move(c, w.issue, "under_review", { message: "The main road" });
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from issue_sla_pauses where issue_id=$1 and ended_at is null", [w.issue])).toBe(0);
    const ack = await scalar<Date>(c, "select ack_due_at from issue_sla where issue_id=$1", [w.issue]);
    const submitted = await scalar<Date>(c, "select submitted_at from issues where id=$1", [w.issue]);
    // 72h target + ~48h paused
    expect((ack.getTime() - submitted.getTime()) / 3_600_000).toBeGreaterThan(118);
    expect(before).toBeInstanceOf(Date);
  })));

  it("reports overdue and due_soon honestly", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await c.query("update issue_sla set ack_due_at = now() - interval '1 hour' where issue_id=$1", [w.issue]);
    await actAs(c, w.manager);
    expect((await stateOf(c, w.issue))?.state).toBe("overdue");
    await actAsOwner(c);
    await c.query("update issue_sla set ack_due_at = now() + interval '1 hour' where issue_id=$1", [w.issue]);
    await actAs(c, w.manager);
    expect((await stateOf(c, w.issue))?.state).toBe("due_soon");
  })));

  it("only people in scope see timers; clients cannot write them", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.owner);
    expect(await scalar(c, "select count(*)::int from issue_sla where issue_id=$1", [w.issue])).toBe(1);
    await actAs(c, w.stranger);
    expect(await scalar(c, "select count(*)::int from issue_sla where issue_id=$1", [w.issue])).toBe(0);
    expect(await stateOf(c, w.issue)).toBeUndefined();
    for (const u of [w.owner, w.manager, w.admin]) {
      await actAs(c, u);
      expect((await attempt(c, "update issue_sla set ack_due_at = now() + interval '99 days' where issue_id=$1", [w.issue])).ok).toBe(false);
      expect((await attempt(c, "insert into issue_sla_pauses (issue_id, kind, reason) values ($1,'waiting_agency','x')", [w.issue])).ok).toBe(false);
    }
  })));

  it("policies: manager edits own constituency, admin edits anywhere, citizens cannot, nothing is deleted; changes are audited", () => withClient((c) => tx(c, async () => {
    const w = await world(c);
    await actAs(c, w.manager);
    expect((await attempt(c, "insert into sla_policies (constituency_id, ack_target_hours, update_target_hours) values ($1, 10, 20)", [w.A])).ok).toBe(true);
    expect((await attempt(c, "insert into sla_policies (ack_target_hours, update_target_hours, is_active) values (1, 1, false)")).ok).toBe(false); // global: admin only
    await actAs(c, w.stranger);
    expect((await attempt(c, "insert into sla_policies (constituency_id, ack_target_hours, update_target_hours) values ($1, 1, 1)", [w.A])).ok).toBe(false);
    await actAs(c, w.admin);
    expect(await attempt(c, "update sla_policies set update_target_hours = 99 where constituency_id=$1", [w.A])).toMatchObject({ ok: true, rowCount: 1 });
    expect((await attempt(c, "delete from sla_policies where constituency_id=$1", [w.A])).ok).toBe(false);
    await actAs(c, null);
    expect((await attempt(c, "select 1 from sla_policies")).ok).toBe(false);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from audit_logs where resource_type='sla_policy' and action in ('sla_policy.insert','sla_policy.update')")).toBeGreaterThanOrEqual(2);
  })));

  it("rejects absurd targets", () => withClient((c) => tx(c, async () => {
    for (const [a, u] of [[0, 5], [5, 0], [100000, 5]]) {
      expect((await attempt(c, "insert into sla_policies (ack_target_hours, update_target_hours, is_active) values ($1,$2,false)", [a, u])).ok).toBe(false);
    }
  })));
});
