import { describe, expect, it } from "vitest";
import { actAs, actAsOwner, addMember, attempt, createIssue, createUser, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";
import { buildWorld, userOf, visible, WHO, type Who, type World } from "./world";

/** Each row: table, id column, and for each account the fixture ids it may read. Everything not listed must be invisible. */
type Row = { table: string; col: string; all: (w: World) => string[]; expect: (w: World) => Partial<Record<Who, string[]>> };
const MATRIX: Row[] = [
  { table: "issues", col: "id", all: (w) => [w.issueA.id, w.issueB.id],
    expect: (w) => ({ citizenA: [w.issueA.id], citizenB: [w.issueB.id], officeA: [w.issueA.id], officeB: [w.issueB.id], admin: [w.issueA.id, w.issueB.id] }) },
  // Citizens read their timeline only through public_case_events: issue_events also holds internal notes.
  { table: "issue_events", col: "issue_id", all: (w) => [w.issueA.id, w.issueB.id],
    expect: (w) => ({ officeA: [w.issueA.id], officeB: [w.issueB.id], admin: [w.issueA.id, w.issueB.id] }) },
  { table: "issue_media", col: "id", all: (w) => [w.mediaA],
    expect: (w) => ({ citizenA: [w.mediaA], officeA: [w.mediaA], admin: [w.mediaA] }) },
  { table: "issue_assignments", col: "id", all: (w) => [w.assignmentA],
    expect: (w) => ({ officeA: [w.assignmentA], admin: [w.assignmentA] }) },
  { table: "issue_agency_referrals", col: "id", all: (w) => [w.refOffice, w.refPublic],
    expect: (w) => ({ citizenA: [w.refPublic], officeA: [w.refOffice, w.refPublic], admin: [w.refOffice, w.refPublic] }) },
  { table: "notifications", col: "id", all: (w) => [w.notifA, w.notifB], expect: (w) => ({ citizenA: [w.notifA], citizenB: [w.notifB] }) },
  { table: "consents", col: "id", all: (w) => [w.consentA, w.consentB], expect: (w) => ({ citizenA: [w.consentA], citizenB: [w.consentB] }) },
  { table: "user_preferences", col: "user_id", all: (w) => [w.citizenA, w.citizenB], expect: (w) => ({ citizenA: [w.citizenA], citizenB: [w.citizenB] }) },
  { table: "profiles", col: "id", all: (w) => [w.citizenA, w.citizenB, w.officeA, w.officeB, w.moderator, w.admin],
    expect: (w) => ({
      citizenA: [w.citizenA], citizenB: [w.citizenB], moderator: [w.moderator],
      officeA: [w.citizenA, w.officeA], officeB: [w.citizenB, w.officeB],
      admin: [w.citizenA, w.citizenB, w.officeA, w.officeB, w.moderator, w.admin],
    }) },
  { table: "audit_logs", col: "id", all: (w) => [w.audit], expect: (w) => ({ admin: [w.audit] }) },
  { table: "ai_runs", col: "id", all: (w) => [w.runA, w.runB, w.runNone],
    expect: (w) => ({ officeA: [w.runA], officeB: [w.runB], admin: [w.runA, w.runB, w.runNone] }) },
  { table: "ai_suggestions", col: "id", all: (w) => [w.sugA, w.sugB], expect: (w) => ({ officeA: [w.sugA], officeB: [w.sugB], admin: [w.sugA, w.sugB] }) },
  { table: "knowledge_chunks", col: "id", all: (w) => [w.chunk], expect: (w) => ({ officeA: [w.chunk], officeB: [w.chunk], admin: [w.chunk] }) },
  { table: "graph_edges", col: "id", all: (w) => [w.edge], expect: (w) => ({ admin: [w.edge] }) },
  // Server-only tables: nobody reads them through a user session, not even admin.
  { table: "issue_embeddings", col: "issue_id", all: (w) => [w.embedding], expect: () => ({}) },
  { table: "office_members", col: "user_id", all: (w) => [w.officeA, w.officeB],
    expect: (w) => ({ officeA: [w.officeA], officeB: [w.officeB], admin: [w.officeA, w.officeB] }) },
  { table: "representatives", col: "id", all: (w) => [w.repVerified, w.repHidden],
    expect: (w) => ({ anon: [w.repVerified], citizenA: [w.repVerified], citizenB: [w.repVerified], officeA: [w.repVerified], officeB: [w.repVerified], moderator: [w.repVerified], admin: [w.repVerified, w.repHidden] }) },
];

describe("RLS read matrix: citizen A/B, office A/B, moderator, admin, anonymous", () => {
  for (const row of MATRIX) {
    it(`${row.table}`, () => withClient((c) => tx(c, async () => {
      const w = await buildWorld(c);
      const want = row.expect(w);
      for (const who of WHO) {
        const got = await visible(c, w, who, row.table, row.col, row.all(w));
        expect(got, `${who} reading ${row.table}`).toEqual([...(want[who] ?? [])].sort());
      }
    })));
  }

  it("app_settings is invisible to every user session", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of WHO) expect(await visible(c, w, who, "app_settings", "key", ["enforce_mfa"]), who).toEqual([]);
  })));

  it("reference data and the permission matrix are public", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of WHO) {
      for (const t of ["constituencies", "agencies", "issue_categories", "office_permissions", "issue_transitions", "knowledge_sources", "representative_constituencies"]) {
        await actAs(c, userOf(w, who));
        const r = await attempt(c, `select 1 from ${t} limit 1`);
        await actAsOwner(c);
        expect(r.ok, `${who} reading ${t}`).toBe(true);
      }
    }
  })));

  it("public views show every issue to everyone without private columns", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    for (const who of WHO) {
      expect(await visible(c, w, who, "public_cases", "ref", [w.issueA.ref, w.issueB.ref]), who).toEqual([w.issueA.ref, w.issueB.ref].sort());
      expect(await visible(c, w, who, "public_case_events", "case_ref", [w.issueA.ref, w.issueB.ref]), who).toEqual([w.issueA.ref, w.issueB.ref].sort());
      await actAs(c, userOf(w, who));
      for (const col of ["reporter_id", "assigned_to", "actor_id", "internal_note"]) {
        expect((await attempt(c, `select ${col} from public_cases limit 1`)).ok, `${who} ${col} in public_cases`).toBe(false);
      }
      expect((await attempt(c, "select internal_note from public_case_events limit 1")).ok).toBe(false);
      await actAsOwner(c);
    }
  })));

  it("internal events never reach the public timeline", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    await c.query("insert into issue_events (issue_id, event_type, is_public, internal_note, to_status) values ($1,'note',false,'secret',$2)", [w.issueA.id, "acknowledged"]);
    await c.query("insert into issue_events (issue_id, event_type, is_public, public_message, to_status) values ($1,'note',true,'visible','acknowledged')", [w.issueA.id]);
    await actAs(c, null);
    const r = await attempt(c, "select note from public_case_events where case_ref = $1", [w.issueA.ref]);
    await actAsOwner(c);
    const notes = (r.ok ? r.rows : []).map((x) => x.note);
    expect(notes).toContain("visible");
    expect(JSON.stringify(notes)).not.toContain("secret");
  })));

  it("a case officer sees only issues assigned to them; an MP sees the whole office", () => withClient((c) => tx(c, async () => {
    const w = await buildWorld(c);
    const officer = await createUser(c, "staff"), mp = await createUser(c, "staff");
    await addMember(c, officer, w.A, "case_officer"); await addMember(c, mp, w.A, "mp");
    const mine = await createIssue(c, w.A, w.citizenA, officer), other = await createIssue(c, w.A, w.citizenA);
    const ids = [w.issueA.id, mine.id, other.id];
    const read = async (uid: string) => { await actAs(c, uid); const r = await attempt(c, "select id from issues where id = any($1::uuid[])", [ids]); await actAsOwner(c); return r.ok ? r.rows.map((x) => String(x.id)).sort() : []; };
    expect(await read(officer)).toEqual([mine.id]);
    expect(await read(mp)).toEqual([...ids].sort());
  })));
});
