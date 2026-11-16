import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { OFFICE_PERMISSIONS, type OfficeRole } from "../../src/lib/auth";
import { TRANSITIONS, isAllowedTransition, type Transition } from "../../src/lib/transitions";
import { ISSUE_STATUSES, type IssueStatus } from "../../src/lib/types";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

type Kit = {
  A: string; B: string; owner: string; stranger: string; manager: string; managerB: string; officer: string; mp: string; liaison: string; outsider: string;
  master: string; agency: string;
};

async function kit(c: Client): Promise<Kit> {
  const A = await createConstituency(c), B = await createConstituency(c);
  const owner = await createUser(c), stranger = await createUser(c);
  const manager = await createUser(c, "staff"), managerB = await createUser(c, "staff"), officer = await createUser(c, "staff");
  const mp = await createUser(c, "staff"), liaison = await createUser(c, "staff"), outsider = await createUser(c, "staff");
  await addMember(c, manager, A, "office_manager"); await addMember(c, managerB, B, "office_manager");
  await addMember(c, officer, A, "case_officer"); await addMember(c, mp, A, "mp"); await addMember(c, liaison, A, "agency_liaison");
  await addMember(c, outsider, B, "case_officer");
  const master = (await createIssue(c, A, owner)).id;
  let agency = await scalar<string | undefined>(c, "select id from agencies limit 1");
  if (!agency) agency = await scalar<string>(c, "insert into agencies (name_bn, name_en, categories, source, key) values ('t','t','{other}','t','t-ag') returning id");
  return { A, B, owner, stranger, manager, managerB, officer, mp, liaison, outsider, master, agency };
}

/** An issue of constituency A reported by `owner`, forced into `status` as the trusted server would (flag on). */
async function issueIn(c: Client, k: Kit, status: IssueStatus, o: { assignedTo?: string | null; resolvedDaysAgo?: number; closedDaysAgo?: number } = {}) {
  const { id } = await createIssue(c, k.A, k.owner, o.assignedTo ?? null);
  if (status !== "submitted") {
    await c.query("select set_config('app.in_transition','on',true)");
    await c.query(
      `update issues set status=$2,
         resolved_at = case when $3::int is null then null else now() - make_interval(days => $3::int) end,
         closed_at = case when $4::int is null then null else now() - make_interval(days => $4::int) end where id=$1`,
      [id, status, o.resolvedDaysAgo ?? (["resolved", "closed"].includes(status) ? 10 : null), o.closedDaysAgo ?? (status === "closed" ? 1 : null)]);
    await c.query("select set_config('app.in_transition','',true)");
  }
  return id;
}

const fullFields = (k: Kit): Record<string, string> => ({
  message: "message for the citizen", reason: "a clear reason", resolution_note: "what was done", appeal_route: "write to the office",
  assignee: k.officer, master_issue: k.master, agency_id: k.agency, contact_channel: "https://example.test", external_reference: "REF-1", internal_note: "internal",
});
const OMIT: Record<string, string[]> = {
  destination: ["agency_id", "agency_name"], forwarding_details: ["contact_channel", "external_reference"],
  responsible_party: ["assignee", "agency_id", "agency_name"],
};
const without = (f: Record<string, string>, token: string) => Object.fromEntries(Object.entries(f).filter(([key]) => !(OMIT[token] ?? [token]).includes(key)));

type UserWho = "manager" | "owner" | "stranger" | "managerB" | "officer" | "mp" | "liaison" | "outsider";
type Who = UserWho | "system";
async function call(c: Client, k: Kit, who: Who, id: string, to: IssueStatus, fields: Record<string, unknown>) {
  if (who === "system") await actAsOwner(c); else await actAs(c, k[who]);
  try { return await attempt(c, "select transition_issue($1, $2::issue_status, $3::jsonb) as r", [id, to, JSON.stringify(fields)]); }
  finally { await actAsOwner(c); }
}
const statusOf = (c: Client, id: string) => scalar<string>(c, "select status::text from issues where id=$1", [id]);
const actorFor = (t: Transition): Who => (t.actor === "office" ? "manager" : t.actor === "owner" ? "owner" : "system");
const ok = (r: Awaited<ReturnType<typeof attempt>>) => r.ok;
const code = (r: Awaited<ReturnType<typeof attempt>>) => (r.ok ? "ok" : r.code);

describe("state machine in the database (migration 0008)", () => {
  it("the database transition table equals src/lib/transitions.ts", () => withClient(async (c) => {
    const { rows } = await c.query("select from_status::text f, to_status::text t, actor_kind a, office_action x, required r from issue_transitions");
    const db = rows.map((r) => `${r.f}|${r.t}|${r.a}|${r.x ?? ""}|${[...r.r].sort().join(",")}`).sort();
    const ts = TRANSITIONS.map((t) => `${t.from}|${t.to}|${t.actor}|${t.action ?? ""}|${[...t.required].sort().join(",")}`).sort();
    expect(db).toEqual(ts);
  }));

  it("allows exactly the allowed transitions and refuses all other pairs (13 x 13)", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    for (const from of ISSUE_STATUSES) {
      for (const to of ISSUE_STATUSES) {
        if (isAllowedTransition(from, to)) {
          for (const row of TRANSITIONS.filter((t) => t.from === from && t.to === to)) {
            const id = await issueIn(c, k, from);
            const r = await call(c, k, actorFor(row), id, to, fullFields(k));
            expect(code(r), `${from} -> ${to} as ${row.actor}`).toBe("ok");
            expect(await statusOf(c, id), `${from} -> ${to}`).toBe(to);
          }
        } else {
          for (const who of ["manager", "system"] as Who[]) {
            const id = await issueIn(c, k, from);
            const r = await call(c, k, who, id, to, fullFields(k));
            expect(r, `${from} -> ${to} as ${who} must be refused`).toMatchObject({ ok: false, code: "JK001" });
            expect(await statusOf(c, id)).toBe(from);
          }
        }
      }
    }
  })));

  it("refuses each transition when any single required field is missing or blank", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    for (const t of TRANSITIONS) {
      for (const token of t.required) {
        const id = await issueIn(c, k, t.from);
        const r = await call(c, k, actorFor(t), id, t.to, without(fullFields(k), token));
        expect(r, `${t.from} -> ${t.to} without ${token}`).toMatchObject({ ok: false, code: "JK002" });
        expect(await statusOf(c, id)).toBe(t.from);
      }
    }
    // Whitespace-only text counts as missing.
    const id = await issueIn(c, k, "acknowledged");
    expect(await call(c, k, "manager", id, "rejected", { ...fullFields(k), reason: "   " })).toMatchObject({ ok: false, code: "JK002" });
  })));

  it("applies the permission matrix to every office transition, for every office role", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    const roleOf: Partial<Record<Who, OfficeRole>> = { manager: "office_manager", officer: "case_officer", mp: "mp", liaison: "agency_liaison" };
    for (const t of TRANSITIONS.filter((x) => x.actor === "office")) {
      for (const who of ["manager", "officer", "mp", "liaison"] as UserWho[]) {
        for (const assigned of [true, false]) {
          const id = await issueIn(c, k, t.from, { assignedTo: assigned ? k[who] : null });
          const rule = OFFICE_PERMISSIONS[roleOf[who]!][t.action!];
          const allowed = !!rule && (!rule.assignedOnly || assigned);
          const r = await call(c, k, who, id, t.to, fullFields(k));
          const label = `${who} ${assigned ? "assigned" : "unassigned"} ${t.from} -> ${t.to} (${t.action})`;
          if (allowed) expect(code(r), label).toBe("ok");
          else { expect(ok(r), label).toBe(false); expect(["42501", "JK404"], label).toContain(code(r)); expect(await statusOf(c, id)).toBe(t.from); }
        }
      }
    }
  })));

  it("keeps offices apart and lets only the reporter use owner transitions", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    for (const who of ["managerB", "outsider", "stranger"] as Who[]) {
      const id = await issueIn(c, k, "submitted");
      expect(await call(c, k, who, id, "acknowledged", {}), who).toMatchObject({ ok: false, code: "JK404" });
    }
    const asked = await issueIn(c, k, "needs_information");
    expect(await call(c, k, "stranger", asked, "under_review", { message: "info" })).toMatchObject({ ok: false, code: "JK404" });
    expect(await call(c, k, "owner", asked, "under_review", { message: "here is the information" })).toMatchObject({ ok: true });
    const fresh = await issueIn(c, k, "submitted");
    expect(await call(c, k, "owner", fresh, "acknowledged", {})).toMatchObject({ ok: false, code: "42501" }); // the owner cannot acknowledge
    const anon = await issueIn(c, k, "resolved");
    await actAs(c, null);
    expect(await attempt(c, "select transition_issue($1, 'reopened', '{\"reason\":\"x\"}')", [anon])).toMatchObject({ ok: false });
    await actAsOwner(c);
  })));

  it("enforces the citizen review period and the reopen window (configurable, not hard-coded)", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    const fresh = await issueIn(c, k, "resolved", { resolvedDaysAgo: 0 });
    expect(await call(c, k, "manager", fresh, "closed", {})).toMatchObject({ ok: false, code: "JK002" }); // early close needs a reason
    expect(await call(c, k, "system", fresh, "closed", {})).toMatchObject({ ok: false, code: "JK003" });  // automatic close waits
    expect(await call(c, k, "manager", fresh, "closed", { reason: "reporter confirmed it is fixed" })).toMatchObject({ ok: true });
    const old = await issueIn(c, k, "resolved", { resolvedDaysAgo: 10 });
    expect(await call(c, k, "system", old, "closed", {})).toMatchObject({ ok: true });
    // Reopen window: reporter blocked after 30 days, office may still reopen, appeals of rejections are not time-boxed.
    const stale = await issueIn(c, k, "closed", { resolvedDaysAgo: 60, closedDaysAgo: 40 });
    expect(await call(c, k, "owner", stale, "reopened", { reason: "still broken" })).toMatchObject({ ok: false, code: "JK003" });
    expect(await call(c, k, "manager", stale, "reopened", { reason: "agency confirmed it is not fixed" })).toMatchObject({ ok: true });
    const recent = await issueIn(c, k, "closed", { resolvedDaysAgo: 5, closedDaysAgo: 1 });
    expect(await call(c, k, "owner", recent, "reopened", { reason: "still broken" })).toMatchObject({ ok: true });
    const rejected = await issueIn(c, k, "rejected");
    expect(await call(c, k, "owner", rejected, "reopened", { reason: "appeal" })).toMatchObject({ ok: true });
    // The window is a setting: shrink it and the same reopen is refused.
    await c.query("update app_settings set value='0' where key='reopen_window_days'");
    const again = await issueIn(c, k, "resolved", { resolvedDaysAgo: 2 });
    expect(await call(c, k, "owner", again, "reopened", { reason: "x" })).toMatchObject({ ok: false, code: "JK003" });
  })));

  it("validates duplicate links and assignees", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    const id = await issueIn(c, k, "acknowledged");
    const base = fullFields(k);
    expect(await call(c, k, "manager", id, "duplicate", { ...base, master_issue: id })).toMatchObject({ ok: false, code: "JK002" });
    expect(await call(c, k, "manager", id, "duplicate", { ...base, master_issue: "not-a-uuid" })).toMatchObject({ ok: false, code: "JK002" });
    const otherOffice = (await createIssue(c, k.B, k.owner)).id;
    expect(await call(c, k, "manager", id, "duplicate", { ...base, master_issue: otherOffice })).toMatchObject({ ok: false, code: "JK002" });
    const dupe = await issueIn(c, k, "duplicate");
    expect(await call(c, k, "manager", id, "duplicate", { ...base, master_issue: dupe })).toMatchObject({ ok: false, code: "JK002" });
    expect(await call(c, k, "manager", id, "duplicate", base)).toMatchObject({ ok: true });
    expect(await scalar(c, "select master_issue_id from issues where id=$1", [id])).toBe(k.master);
    // The master cannot itself become a duplicate while others point at it (no chains).
    expect(await call(c, k, "manager", k.master, "duplicate", { ...base, master_issue: await issueIn(c, k, "acknowledged") })).toMatchObject({ ok: false, code: "JK002" });
    // Assignees must be active assignable members of the same office.
    for (const bad of [k.mp, k.outsider, k.owner, "nope"]) {
      const i2 = await issueIn(c, k, "acknowledged");
      expect(await call(c, k, "manager", i2, "assigned", { assignee: bad }), `assignee ${bad}`).toMatchObject({ ok: false, code: "JK002" });
    }
  })));

  it("records effects: assignment, referral, resolution, appeal, reopen history, and one event per transition", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    const id = await issueIn(c, k, "acknowledged");
    await call(c, k, "manager", id, "assigned", { assignee: k.officer, reason: "nearest officer" });
    expect(await scalar(c, "select assigned_to from issues where id=$1", [id])).toBe(k.officer);
    expect(await scalar<number>(c, "select count(*)::int from issue_assignments where issue_id=$1 and unassigned_at is null", [id])).toBe(1);
    await call(c, k, "manager", id, "referred_to_authority", { agency_id: k.agency, contact_channel: "official site", external_reference: "AGY-7", internal_note: "phoned" });
    const ref = (await c.query("select agency_id, agency_contact_or_channel, external_reference, forwarded_by, notes from issue_agency_referrals where issue_id=$1", [id])).rows[0];
    expect(ref).toMatchObject({ agency_id: k.agency, agency_contact_or_channel: "official site", external_reference: "AGY-7", forwarded_by: k.manager, notes: "phoned" });
    expect(await call(c, k, "manager", id, "resolved", { resolution_note: "road patched" })).toMatchObject({ ok: true });
    const done = (await c.query("select resolution_note, resolved_at from issues where id=$1", [id])).rows[0];
    expect(done.resolution_note).toBe("road patched"); expect(done.resolved_at).not.toBeNull();
    // closed -> reopened: clears timestamps, remembers the previous closure
    await c.query("select set_config('app.in_transition','on',true)");
    await c.query("update issues set status='closed', closed_at=now()-interval '1 day' where id=$1", [id]);
    await c.query("select set_config('app.in_transition','',true)");
    await call(c, k, "owner", id, "reopened", { reason: "it broke again" });
    const reopened = (await c.query("select resolved_at, closed_at, status_reason from issues where id=$1", [id])).rows[0];
    expect(reopened).toMatchObject({ resolved_at: null, closed_at: null, status_reason: "it broke again" });
    const last = (await c.query("select metadata, actor_id, is_public from issue_events where issue_id=$1 and to_status='reopened'", [id])).rows[0];
    expect(last.metadata.previous_closed_at).toBeTruthy(); expect(last.actor_id).toBe(k.owner);
    // rejection stores the appeal route and shows the reason publicly (citizen-facing by rule)
    const rej = await issueIn(c, k, "submitted");
    await call(c, k, "manager", rej, "rejected", { reason: "outside this office's remit", appeal_route: "write to the admin", internal_note: "caller was abusive" });
    expect(await scalar(c, "select appeal_route from issues where id=$1", [rej])).toBe("write to the admin");
    // exactly one event per transition (no duplicate from the generic trigger)
    const n = await scalar<number>(c, "select count(*)::int from issue_events where issue_id=$1 and event_type='status_change'", [rej]);
    expect(n).toBe(1);
    // internal notes never reach the public timeline; the citizen-facing reason does
    const rejRef = await scalar<string>(c, "select ref from issues where id=$1", [rej]);
    await actAs(c, null);
    const pub = (await attempt(c, "select status, note from public_case_events where case_ref=$1", [rejRef]));
    await actAsOwner(c);
    expect(JSON.stringify(pub.ok ? pub.rows : [])).toContain("outside this office");
    expect(JSON.stringify(pub.ok ? pub.rows : [])).not.toContain("abusive");
  })));

  it("requires evidence before resolving when the policy says so", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    await c.query("update app_settings set value='true' where key='resolution_evidence_required'");
    const id = await issueIn(c, k, "in_progress");
    expect(await call(c, k, "manager", id, "resolved", { resolution_note: "done" })).toMatchObject({ ok: false, code: "JK002" });
    await c.query("insert into issue_media (issue_id, uploader_id, storage_path, media_type) values ($1,$2,'p','image')", [id, k.manager]);
    expect(await call(c, k, "manager", id, "resolved", { resolution_note: "done" })).toMatchObject({ ok: true });
  })));

  it("assign_issue changes the assignee without changing status, for managers only", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    const id = await issueIn(c, k, "in_progress");
    const run = async (who: UserWho, to: string) => { await actAs(c, k[who]); try { return await attempt(c, "select assign_issue($1,$2)", [id, to]); } finally { await actAsOwner(c); } };
    expect(await run("manager", k.officer)).toMatchObject({ ok: true });
    expect(await statusOf(c, id)).toBe("in_progress");
    expect(await scalar(c, "select assigned_to from issues where id=$1", [id])).toBe(k.officer);
    expect(await run("officer", k.officer)).toMatchObject({ ok: false });
    expect(await run("mp", k.officer)).toMatchObject({ ok: false, code: "42501" });
    expect(await run("managerB", k.officer)).toMatchObject({ ok: false, code: "JK404" });
    expect(await run("manager", k.mp)).toMatchObject({ ok: false, code: "JK002" });
    const closed = await issueIn(c, k, "closed");
    await actAs(c, k.manager);
    expect(await attempt(c, "select assign_issue($1,$2)", [closed, k.officer])).toMatchObject({ ok: false, code: "JK001" });
    await actAsOwner(c);
    const events = await scalar<number>(c, "select count(*)::int from issue_events where issue_id=$1 and event_type='assigned' and is_public=false", [id]);
    expect(events).toBe(1);
  })));

  it("the legacy compatibility view routes status writes through the state machine", () => withClient((c) => tx(c, async () => {
    const k = await kit(c);
    const id = await issueIn(c, k, "submitted");
    const ref = await scalar<string>(c, "select ref from issues where id=$1", [id]);
    await c.query("update issues set agency_id=$2 where id=$1", [id, k.agency]);
    await actAs(c, k.manager);
    expect(await attempt(c, "update cases set status='acknowledged' where ref=$1", [ref])).toMatchObject({ ok: true, rowCount: 1 });
    expect(await attempt(c, "update cases set status='referred' where ref=$1", [ref])).toMatchObject({ ok: true, rowCount: 1 });
    expect(await attempt(c, "update cases set status='received' where ref=$1", [ref])).toMatchObject({ ok: false, code: "JK001" });
    await actAsOwner(c);
    expect(await statusOf(c, id)).toBe("referred_to_authority");
    expect(await scalar<number>(c, "select count(*)::int from issue_agency_referrals where issue_id=$1 and agency_id=$2", [id, k.agency])).toBe(1);
  })));
});
