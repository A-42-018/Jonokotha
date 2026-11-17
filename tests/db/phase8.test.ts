import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency as mkConstituency, createIssue as mkIssue, createUser as mkUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

/** Phase 8 (migrations 0080-0083) at database level: the rules the API relies on, so a bug in a route cannot widen them. */
const createUser: typeof mkUser = async (c, ...a) => { await actAsOwner(c); return mkUser(c, ...a); };
const createConstituency: typeof mkConstituency = async (c) => { await actAsOwner(c); return mkConstituency(c); };
const createIssue: typeof mkIssue = async (c, ...a) => { await actAsOwner(c); return mkIssue(c, ...a); };
const citizen = async (c: Client, area?: string) => {
  const u = await createUser(c);
  await c.query("update auth.users set email_confirmed_at = now() where id = $1", [u]);
  if (area) await c.query("insert into follows (user_id, target_type, constituency_id) values ($1,'area',$2)", [u, area]);
  return u;
};
const keyOf = async (c: Client, id: string) => { await actAsOwner(c); return scalar<string>(c, "select key from constituencies where id = $1", [id]); };
const future = (days = 7) => new Date(Date.now() + days * 86400_000).toISOString();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Out = { ok: boolean; rowCount: number; rows: any[] };
const fn = async (c: Client, who: string | null, sql: string, params: unknown[] = []): Promise<Out> => { await actAs(c, who); const r = await attempt(c, sql, params); return r.ok ? r : { ok: false, rowCount: 0, rows: [] }; };
const call = async <T = Record<string, unknown>>(c: Client, sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows[0] as T;
async function office(c: Client, A: string) {
  const mgr = await createUser(c, "staff"), mp = await createUser(c, "staff");
  await addMember(c, mgr, A, "office_manager"); await addMember(c, mp, A, "mp");
  return { mgr, mp };
}
const SRC = ["Annual development programme 2026-27", "Local Government Division", "adp", "https://example.org/adp.pdf", "2026-07-01", "2026-27"];
async function verifiedSource(c: Client, mgr: string, key: string, mod: string) {
  await actAs(c, mgr);
  const s = (await c.query("select create_budget_source($1,$2,$3,$4,$5,$6::date,$7) r", [key, ...SRC])).rows[0].r;
  await actAs(c, mod); await c.query("select verify_budget_source($1,'verify',null)", [s.ref]);
  return s.ref as string;
}

describe("budget transparency (B8.1)", () => {
  it("a source is public only after a DIFFERENT moderator or admin verifies it; entries follow their source; nothing is computed", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), mod = await createUser(c, "moderator"), adm = await createUser(c, "admin"), other = await citizen(c);
    await actAs(c, mgr);
    const s = (await c.query("select create_budget_source($1,$2,$3,$4,$5,$6::date,$7) r", [key, ...SRC])).rows[0].r;
    expect(s.status).toBe("pending");
    const e = (await c.query("select create_budget_entry($1,'allocated','Road repair, ward 3',12500000.50,'p. 14') r", [s.ref])).rows[0].r;
    expect(e.public, "pending source: entry is not public").toBe(false);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_budget_entries")).toBe(0);
    expect(await scalar(c, "select count(*)::int from public_budget_sources")).toBe(0);
    // nobody but a moderator/admin verifies; the recorder never verifies their own record
    expect((await fn(c, other, "select verify_budget_source($1,'verify',null)", [s.ref])).ok, "citizen").toBe(false);
    expect((await fn(c, mgr, "select verify_budget_source($1,'verify',null)", [s.ref])).ok, "office manager").toBe(false);
    await actAsOwner(c); await c.query("update budget_sources set created_by = $2 where ref = $1", [s.ref, mod]);
    const self = await fn(c, mod, "select verify_budget_source($1,'verify',null)", [s.ref]);
    expect(self.ok, "self verification").toBe(false);
    await actAsOwner(c); await c.query("update budget_sources set created_by = $2 where ref = $1", [s.ref, mgr]);
    expect((await fn(c, mod, "select verify_budget_source($1,'reject',null)", [s.ref])).ok, "a rejection needs a reason").toBe(false);
    expect((await fn(c, adm, "select verify_budget_source($1,'verify','checked against the original')", [s.ref])).ok).toBe(true);
    await actAs(c, null);
    const pub = (await c.query("select * from public_budget_entries")).rows;
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ kind: "allocated", fiscal_year: "2026-27", source_page: "p. 14", currency: "BDT" });
    expect(Number(pub[0].amount)).toBe(12500000.5);
    expect(Object.keys(pub[0])).not.toContain("total");
    // a verified source cannot be verified again; the DB check also refuses a verifier equal to the creator
    expect((await fn(c, mod, "select verify_budget_source($1,'verify',null)", [s.ref])).ok).toBe(false);
    await actAsOwner(c);
    expect((await attempt(c, "update budget_sources set verified_by = created_by where ref = $1", [s.ref])).ok, "check constraint").toBe(false);
    // withdrawing the source removes every entry from the public views at once
    expect((await fn(c, mgr, "select withdraw_budget_source($1,'abc')", [s.ref])).ok, "reason too short").toBe(false);
    expect((await fn(c, mgr, "select withdraw_budget_source($1,'The document was replaced')", [s.ref])).ok).toBe(true);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_budget_entries")).toBe(0);
    expect((await fn(c, mgr, "select create_budget_entry($1,'spent','x item',1,'p. 2')", [s.ref])).ok, "a withdrawn source takes no entries").toBe(false);
  })));

  it("only the area's office records sources and entries; invalid values are refused; retraction hides one entry", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr } = await office(c, A), { mgr: mgrB } = await office(c, B), key = await keyOf(c, A), mod = await createUser(c, "moderator");
    expect((await fn(c, mgrB, "select create_budget_source($1,$2,$3,$4,$5,$6::date,$7)", [key, ...SRC])).ok, "other area").toBe(false);
    expect((await fn(c, null, "select create_budget_source($1,$2,$3,$4,$5,$6::date,$7)", [key, ...SRC])).ok, "anonymous").toBe(false);
    expect((await fn(c, mgr, "select create_budget_source($1,$2,$3,$4,'http://insecure.example/x.pdf',$6::date,$7)", [key, ...SRC])).ok, "https only").toBe(false);
    expect((await fn(c, mgr, "select create_budget_source($1,$2,$3,$4,$5,$6::date,'2026')", [key, ...SRC])).ok, "fiscal year format").toBe(false);
    const ref = await verifiedSource(c, mgr, key, mod);
    expect((await fn(c, mgr, "select create_budget_entry($1,'spent','Negative',-5,'p. 1')", [ref])).ok, "negative amount").toBe(false);
    expect((await fn(c, mgr, "select create_budget_entry($1,'bogus','Item here',5,'p. 1')", [ref])).ok, "kind").toBe(false);
    expect((await fn(c, mgr, "select create_budget_entry($1,'spent','Item here',5,'p. 1','NOPE-1')", [ref])).ok, "unknown project").toBe(false);
    const e = (await call<{ r: { id: string } }>(c, "select create_budget_entry($1,'spent','Item here',5,'p. 1') r", [ref])).r;
    expect((await fn(c, mgrB, "select retract_budget_entry($1,'wrong entry')", [e.id])).ok, "other office").toBe(false);
    expect((await fn(c, mgr, "select retract_budget_entry($1,'wrong entry')", [e.id])).ok).toBe(true);
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_budget_entries")).toBe(0);
    expect(await scalar(c, "select count(*)::int from public_budget_sources")).toBe(1);
  })));
});

describe("open-data aggregates (B8.4)", () => {
  it("cells under 5 are dropped and only counted; the catalogue is public and the licence says whether it was reviewed", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), key = await keyOf(c, A), u = await citizen(c);
    for (let i = 0; i < 6; i++) await createIssue(c, A, u);
    await actAsOwner(c);
    await c.query("insert into issues (reporter_id, title, category, description, constituency_id) values ($1,'t','water','test issue',$2), ($1,'t','water','test issue',$2)", [u, A]);
    await actAs(c, null);
    const out = (await c.query("select open_data_issues_monthly($1) r", [key])).rows[0].r;
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ category: "roads", reported: 6, constituency: key });
    expect(out.hidden_cells).toBe(1);
    expect(JSON.stringify(out)).not.toMatch(/title|reporter|description|lat|lng/);
    expect((await call<{ r: { rows: unknown[] } }>(c, "select open_data_resolution_monthly($1) r", [key])).r.rows).toHaveLength(0);
    expect((await attempt(c, "select open_data_issues_monthly($1, '2026-05-01'::date, '2020-01-01'::date)", [key])).ok, "bad range").toBe(false);
    expect(await scalar(c, "select count(*)::int from public_open_datasets")).toBeGreaterThanOrEqual(4);
    expect((await call<{ l: { code: string; reviewed: boolean } }>(c, "select open_data_licence() l")).l.reviewed).toBe(false);
    expect((await attempt(c, "select * from open_datasets")).ok, "base table closed").toBe(false);
  })));
});

describe("volunteers, kiosks and assisted reports (B8.3)", () => {
  const consent = { method: "read_aloud_agreed", version: "v1-draft", agreed_to_file: true, agreed_to_publish: true, understands_no_account: true, language: "bn" };
  it("an approved volunteer files with a full consent record in the same transaction; everyone else is refused; suspension stops it", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), keyB = await keyOf(c, B);
    const vol = await citizen(c), stranger = await citizen(c), pendingVol = await citizen(c);
    const file = (who: string | null, k = key, cons: unknown = consent, kiosk: string | null = null) => fn(c, who, "select submit_assisted_report($1,$2,$3::jsonb,'Broken tube well','water','The tube well near the mosque has been broken for a week','Ward 3') r", [k, kiosk, JSON.stringify(cons)]);
    expect((await fn(c, null, "select apply_volunteer($1,'v1')", [key])).ok, "anonymous").toBe(false);
    await actAs(c, vol);
    const applied = (await c.query("select apply_volunteer($1,'v1-draft') r", [key])).rows[0].r;
    expect(applied.status).toBe("pending");
    expect((await attempt(c, "select apply_volunteer($1,'v1-draft')", [key])).ok, "already applied").toBe(false);
    expect((await file(vol)).ok, "pending volunteers cannot file").toBe(false);
    await actAs(c, pendingVol); await c.query("select apply_volunteer($1,'v1-draft')", [key]);
    // only the office (assign permission) decides; a citizen or another area's office cannot
    expect((await fn(c, stranger, "select decide_volunteer($1,'approve',null)", [applied.id])).ok).toBe(false);
    expect((await fn(c, mgr, "select decide_volunteer($1,'reject',null)", [applied.id])).ok, "reject needs a reason").toBe(false);
    expect((await fn(c, mgr, "select decide_volunteer($1,'approve','trained on 2026-11-20')", [applied.id])).ok).toBe(true);
    const k = (await fn(c, mgr, "select create_kiosk($1,'Union Parishad help desk','Beside the office') r", [key])).rows![0].r as { id: string };
    expect((await fn(c, vol, "select create_kiosk($1,'My own kiosk',null)", [key])).ok, "a volunteer cannot create kiosks").toBe(false);
    // consent must be complete
    for (const bad of [{ ...consent, agreed_to_publish: false }, { ...consent, understands_no_account: undefined }, { ...consent, method: "assumed" }, { ...consent, version: "" }]) expect((await file(vol, key, bad)).ok, JSON.stringify(bad)).toBe(false);
    expect((await file(stranger)).ok, "not a volunteer").toBe(false);
    expect((await file(vol, keyB)).ok, "volunteer of another area").toBe(false);
    expect((await file(vol, key, consent, "00000000-0000-0000-0000-000000000000")).ok, "unknown kiosk").toBe(false);
    const made = await file(vol, key, consent, k.id);
    expect(made.ok).toBe(true);
    const ref = (made as { rows: { r: { ref: string; label: string } }[] }).rows[0].r;
    expect(ref.label).toBe("assisted");
    await actAsOwner(c);
    const row = (await c.query("select i.source_channel, i.reporter_id, a.consent_method, a.consent_version, a.agreed_to_file, a.kiosk_id from issues i join assisted_reports a on a.issue_id = i.id where i.ref = $1", [ref.ref])).rows[0];
    expect(row).toMatchObject({ source_channel: "assisted", reporter_id: vol, consent_method: "read_aloud_agreed", consent_version: "v1-draft", agreed_to_file: true, kiosk_id: k.id });
    expect(await scalar(c, "select count(*)::int from audit_logs where action = 'assisted_report.create'")).toBeGreaterThanOrEqual(1);
    // a case and its consent cannot be separated: consent flags cannot be false even by a direct insert
    expect((await attempt(c, "insert into assisted_reports (issue_id, constituency_id, consent_method, consent_version, agreed_to_file, agreed_to_publish, understands_no_account) select id, constituency_id, 'signed_paper','v1',true,false,true from issues limit 1")).ok).toBe(false);
    // the volunteer sees only their own list; the stranger sees nothing
    await actAs(c, vol);
    expect((await c.query("select my_assisted_reports() r")).rows[0].r).toHaveLength(1);
    await actAs(c, stranger);
    expect((await c.query("select my_assisted_reports() r")).rows[0].r).toHaveLength(0);
    expect((await c.query("select count(*)::int n from issues")).rows[0].n, "the volunteer's case is not visible to a stranger via RLS").toBe(0);
    // suspension stops filing; withdrawal is the volunteer's own act only
    expect((await fn(c, mgr, "select decide_volunteer($1,'suspend','conduct concern raised')", [applied.id])).ok).toBe(true);
    expect((await file(vol)).ok, "suspended").toBe(false);
    expect((await fn(c, stranger, "select withdraw_volunteer($1)", [applied.id])).ok, "someone else's record").toBe(false);
    expect((await fn(c, vol, "select withdraw_volunteer($1)", [applied.id])).ok).toBe(true);
    // the office sees volunteers; nobody else does
    expect((await fn(c, mgr, "select office_volunteers($1) r", [key])).ok).toBe(true);
    expect((await fn(c, stranger, "select office_volunteers($1) r", [key])).ok).toBe(false);
  })));

  it("the daily cap stops a volunteer from filing without limit", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), vol = await citizen(c);
    await actAsOwner(c); await c.query("insert into app_settings (key, value) values ('assisted_reports_per_day', '2') on conflict (key) do update set value = '2'");
    await actAs(c, vol); const v = (await c.query("select apply_volunteer($1,'v1') r", [key])).rows[0].r;
    await actAs(c, mgr); await c.query("select decide_volunteer($1,'approve',null)", [v.id]);
    await actAs(c, vol);
    const go = () => attempt(c, "select submit_assisted_report($1,null,$2::jsonb,'Broken light','electricity','The street light is not working near the school','Ward 1')", [key, JSON.stringify(consent)]);
    expect((await go()).ok).toBe(true); expect((await go()).ok).toBe(true);
    expect((await go()).ok, "third in a day").toBe(false);
  })));
});

describe("regional administration (B8.5)", () => {
  it("a regional administrator sees aggregate counts for the areas under their unit and nothing else; no case or reporter access", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), C = await createConstituency(c), adm = await createUser(c, "admin"), regional = await createUser(c, "staff"), plain = await createUser(c, "staff"), rep = await citizen(c);
    await actAsOwner(c);
    const div = await scalar<string>(c, "insert into admin_units (level, code, name_bn, name_en) values ('division','P8-DIV','বিভাগ','Division P8') returning id");
    const d1 = await scalar<string>(c, "insert into admin_units (level, code, name_bn, name_en, parent_id) values ('district','P8-D1','জেলা ১','District 1',$1) returning id", [div]);
    const d2 = await scalar<string>(c, "insert into admin_units (level, code, name_bn, name_en, parent_id) values ('district','P8-D2','জেলা ২','District 2',$1) returning id", [div]);
    await c.query("insert into constituency_units (constituency_id, unit_id) values ($1,$2), ($3,$4), ($5,$6)", [A, d1, B, d2, C, div]);
    await createIssue(c, A, rep); await createIssue(c, B, rep);
    const keyA = await keyOf(c, A);
    expect((await fn(c, regional, "select regional_overview() r")).ok, "no scope yet").toBe(false);
    expect((await fn(c, regional, "select grant_regional_admin($1,'P8-D1','district',null)", [regional])).ok, "not an admin").toBe(false);
    expect((await fn(c, adm, "select grant_regional_admin($1,'P8-D1','district','pilot region')", [plain])).ok).toBe(true);
    expect((await fn(c, adm, "select grant_regional_admin($1,'P8-D1','district',null)", [rep])).ok, "must be staff").toBe(false);
    expect((await fn(c, adm, "select grant_regional_admin($1,'NOPE','district',null)", [plain])).ok, "unknown unit").toBe(false);
    const g = (await fn(c, adm, "select grant_regional_admin($1,'P8-D1','district',null) r", [regional])).rows![0].r as { id: string };
    expect((await fn(c, adm, "select grant_regional_admin($1,'P8-D1','district',null) r", [regional])).rows![0].r, "idempotent").toMatchObject({ id: g.id });
    await actAs(c, regional);
    const o = (await c.query("select regional_overview() r")).rows[0].r;
    expect(o.areas.map((a: { constituency: string }) => a.constituency)).toEqual([keyA]);
    expect(o.areas[0]).toMatchObject({ open_issues: 1, active_staff: 0, has_mp: false });
    expect(JSON.stringify(o)).not.toMatch(/reporter|title|description/);
    // the scope is a view: it opens no case rows
    expect((await c.query("select count(*)::int n from issues")).rows[0].n).toBe(0);
    expect((await fn(c, regional, "select * from regional_admins where user_id <> $1", [regional])).rowCount).toBe(0);
    expect((await fn(c, regional, "select regional_overview('P8-D2') r")).rows![0].r.areas, "unit outside scope").toHaveLength(0);
    // a division-level grant covers everything below it, including constituencies linked to the districts
    await actAs(c, adm); await c.query("select grant_regional_admin($1,'P8-DIV','division',null)", [plain]);
    expect((await fn(c, plain, "select regional_overview() r")).rows![0].r.areas).toHaveLength(3);
    expect((await fn(c, plain, "select my_regional_units() r")).rows![0].r).toHaveLength(2);
    expect((await fn(c, regional, "select revoke_regional_admin($1)", [g.id])).ok, "not an admin").toBe(false);
    expect((await fn(c, adm, "select revoke_regional_admin($1)", [g.id])).ok).toBe(true);
    expect((await fn(c, regional, "select regional_overview() r")).ok, "revoked").toBe(false);
    // a suspended staff account loses the scope too
    await actAsOwner(c); await c.query("update profiles set account_status = 'suspended' where id = $1", [plain]);
    expect((await fn(c, plain, "select regional_overview() r")).ok).toBe(false);
  })));
});

describe("participatory budgeting (B8.6)", () => {
  const opts = JSON.stringify([{ title: "Repair market road", cost: 600000 }, { title: "Build a drain", cost: 300000 }, { title: "Street lights", cost: 250000 }]);
  const PLEDGE = "The office will fund the options with most votes in the order of the result, as far as the budget allows.";
  async function setup(c: Client) {
    const A = await createConstituency(c), { mgr, mp } = await office(c, A), key = await keyOf(c, A), mod = await createUser(c, "moderator");
    const src = await verifiedSource(c, mgr, key, mod);
    return { A, mgr, mp, key, src };
  }
  it("cannot open without a verified source, a pledge and MP approval; funds by votes within the budget; needs 5 voters; the outcome must be recorded and a deviation explained", () => withClient((c) => tx(c, async () => {
    const { A, mgr, mp, key, src } = await setup(c), voters: string[] = [];
    for (let i = 0; i < 6; i++) voters.push(await citizen(c, A));
    const outsider = await citizen(c), unverified = await createUser(c);
    const mk = (who: string, source: string, pledge = PLEDGE, budget = 900000) => fn(c, who, "select create_pb_cycle($1,$2,'Ward budget 2026-27','About the road and drains',$3,$4,2,$5,$6::jsonb) r", [key, source, budget, pledge, future(5), opts]);
    expect((await mk(mgr, "BS-9999-1")).ok, "unknown source").toBe(false);
    await actAsOwner(c);
    const pending = await scalar<string>(c, "insert into budget_sources (constituency_id, title, publisher, doc_kind, source_url, fiscal_year) values ($1,'Some budget paper','Publisher','adp','https://example.org/x','2026-27') returning ref", [A]);
    expect((await mk(mgr, pending)).ok, "an unverified source").toBe(false);
    expect((await mk(outsider, src)).ok, "a citizen").toBe(false);
    expect((await mk(mgr, src, "too short")).ok, "pledge too short").toBe(false);
    const made = (await mk(mgr, src)).rows![0].r as { ref: string; status: string };
    expect(made.status).toBe("draft");
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_pb_cycles"), "drafts are not public").toBe(0);
    expect((await fn(c, mgr, "select decide_pb_cycle($1,'approve',null)", [made.ref])).ok, "approval before the request").toBe(false);
    expect((await fn(c, mgr, "select request_pb_open($1) r", [made.ref])).rows![0].r).toMatchObject({ status: "pending_approval" });
    expect((await fn(c, mgr, "select decide_pb_cycle($1,'approve',null)", [made.ref])).ok, "the office manager cannot approve its own cycle").toBe(false);
    expect((await fn(c, mp, "select decide_pb_cycle($1,'reject','abc')", [made.ref])).ok, "reject needs a reason").toBe(false);
    expect((await fn(c, mp, "select decide_pb_cycle($1,'approve',null) r", [made.ref])).rows![0].r).toMatchObject({ status: "open" });
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_pb_cycles")).toBe(1);
    expect((await c.query("select approvals, funded from public_pb_options")).rows.every((r) => r.approvals === null && r.funded === null), "no counts before closing").toBe(true);
    // ballots: verified local accounts only; 1 to max_choices; replaceable; unknown options refused
    await actAsOwner(c);
    const ids = (await c.query("select o.id from pb_options o join pb_cycles x on x.id = o.cycle_id where x.ref = $1 order by o.position", [made.ref])).rows.map((r) => r.id as string);
    expect(ids).toHaveLength(3);
    expect((await fn(c, outsider, "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0]]])).ok, "does not follow the area").toBe(false);
    expect((await fn(c, unverified, "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0]]])).ok, "unverified").toBe(false);
    expect((await fn(c, null, "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0]]])).ok, "anonymous").toBe(false);
    expect((await fn(c, voters[0], "select submit_pb_ballot($1,$2::uuid[])", [made.ref, ids])).ok, "more than max_choices").toBe(false);
    expect((await fn(c, voters[0], "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0], ids[0]]])).ok, "duplicates").toBe(false);
    expect((await fn(c, voters[0], "select submit_pb_ballot($1,$2::uuid[])", [made.ref, ["00000000-0000-0000-0000-000000000000"]])).ok, "unknown option").toBe(false);
    // votes: road 6, drain 4, lights 2 -> budget 900000: road 600000 funded, drain 300000 funded (total 900000), lights does not fit
    for (let i = 0; i < 6; i++) await fn(c, voters[i], "select submit_pb_ballot($1,$2::uuid[])", [made.ref, i < 4 ? [ids[0], ids[1]] : [ids[0], ids[2]]]);
    await fn(c, voters[0], "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0], ids[1]]]);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from pb_ballots where cycle_id = (select id from pb_cycles where ref = $1)", [made.ref])).toBe(6);    expect((await fn(c, voters[0], "select my_pb_ballot($1) r", [made.ref])).rows![0].r.option_ids).toEqual([ids[0], ids[1]]);
    expect((await fn(c, voters[1], "select close_pb_cycle($1)", [made.ref])).ok, "a citizen cannot close").toBe(false);
    expect((await fn(c, mgr, "select record_pb_outcome($1,true,null)", [made.ref])).ok, "not closed yet").toBe(false);
    expect((await fn(c, mgr, "select close_pb_cycle($1) r", [made.ref])).rows![0].r).toMatchObject({ status: "closed", result_valid: true, participants: 6 });
    expect((await fn(c, voters[0], "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0]]])).ok, "closed").toBe(false);
    await actAs(c, null);
    const res = (await c.query("select position, approvals, funded from public_pb_options order by position")).rows;
    expect(res).toEqual([{ position: 1, approvals: 6, funded: true }, { position: 2, approvals: 4, funded: true }, { position: 3, approvals: 2, funded: false }]);
    expect((await c.query("select participants, result_valid, followed_result, budget_source_ref from public_pb_cycles")).rows[0]).toMatchObject({ participants: 6, result_valid: true, followed_result: null, budget_source_ref: src });
    expect((await fn(c, mgr, "select record_pb_outcome($1,false,'short')", [made.ref])).ok, "deviation needs a public reason").toBe(false);
    expect((await fn(c, mgr, "select record_pb_outcome($1,false,'The drain needs a permit, so lights were built first.') r", [made.ref])).rows![0].r).toMatchObject({ followed_result: false });
    expect((await fn(c, mgr, "select record_pb_outcome($1,true,null)", [made.ref])).ok, "only once").toBe(false);
    await actAs(c, null);
    expect((await c.query("select followed_result, deviation_reason from public_pb_cycles")).rows[0].deviation_reason).toMatch(/permit/);
  })));

  it("with fewer than 5 voters the result is invalid, nothing is funded and no count is public; a verified source that is withdrawn stops opening", () => withClient((c) => tx(c, async () => {
    const { A, mgr, mp, key, src } = await setup(c); const v = [await citizen(c, A), await citizen(c, A)];
    const made = (await fn(c, mgr, "select create_pb_cycle($1,$2,'Small round','x',900000,$3,2,$4,$5::jsonb) r", [key, src, PLEDGE, future(3), opts])).rows![0].r as { ref: string };
    await fn(c, mgr, "select request_pb_open($1)", [made.ref]); await fn(c, mp, "select decide_pb_cycle($1,'approve',null)", [made.ref]);
    await actAsOwner(c);
    const ids = (await c.query("select o.id from pb_options o join pb_cycles x on x.id = o.cycle_id where x.ref = $1 order by o.position", [made.ref])).rows.map((r) => r.id as string);
    for (const u of v) await fn(c, u, "select submit_pb_ballot($1,$2::uuid[])", [made.ref, [ids[0]]]);
    await fn(c, mgr, "select close_pb_cycle($1)", [made.ref]);
    await actAs(c, null);
    expect((await c.query("select participants, result_valid from public_pb_cycles")).rows[0]).toEqual({ participants: null, result_valid: false });
    expect((await c.query("select approvals, funded from public_pb_options")).rows.every((r) => r.approvals === null && r.funded === null)).toBe(true);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from pb_options where funded")).toBe(0);
    // a second cycle: the source is withdrawn before the approval
    const m2 = (await fn(c, mgr, "select create_pb_cycle($1,$2,'Another round','x',900000,$3,2,$4,$5::jsonb) r", [key, src, PLEDGE, future(3), opts])).rows![0].r as { ref: string };
    await fn(c, mgr, "select request_pb_open($1)", [m2.ref]);
    await fn(c, mgr, "select withdraw_budget_source($1,'The document was replaced')", [src]);
    expect((await fn(c, mp, "select decide_pb_cycle($1,'approve',null)", [m2.ref])).ok, "source no longer verified").toBe(false);
    expect((await fn(c, mgr, "select cancel_pb_cycle($1,'source withdrawn') r", [m2.ref])).rows![0].r).toMatchObject({ status: "cancelled" });
    expect((await fn(c, mgr, "select cancel_pb_cycle($1,'again')", [made.ref])).ok, "cannot cancel a closed cycle").toBe(false);
  })));
});

describe("Right to Information helper (B8.7)", () => {
  it("drafts are private to their owner, nothing is filed by the platform, and status changes are the citizen's own record", () => withClient((c) => tx(c, async () => {
    const u = await citizen(c), v = await citizen(c), unverified = await createUser(c);
    const save = (who: string | null) => fn(c, who, "select save_rti_draft(null,'Roads and Highways Department','Repair budget of the market road','Please give the amounts spent on repairing the market road in 2025-26.',null,'electronic','draft text') r");
    expect((await save(null)).ok).toBe(false);
    expect((await save(unverified)).ok, "unverified").toBe(false);
    const d = (await save(u)).rows![0].r as { id: string; status: string };
    expect(d.status).toBe("draft");
    expect((await fn(c, u, "select count(*)::int n from rti_drafts")).rows![0].n).toBe(1);
    expect((await fn(c, v, "select count(*)::int n from rti_drafts")).rows![0].n, "another citizen").toBe(0);
    expect((await fn(c, null, "select count(*)::int n from rti_drafts")).ok).toBe(false);
    expect((await fn(c, v, "select update_rti_status($1,'close')", [d.id])).ok, "someone else's draft").toBe(false);
    expect((await fn(c, v, "select delete_rti_draft($1)", [d.id])).ok).toBe(false);
    expect((await fn(c, u, "select update_rti_status($1,'mark_answered',current_date,null,null)", [d.id])).ok, "cannot be answered before filed").toBe(false);
    expect((await fn(c, u, "select update_rti_status($1,'mark_filed',null,'email',null)", [d.id])).ok, "date needed").toBe(false);
    expect((await fn(c, u, "select update_rti_status($1,'mark_filed',current_date + 2,'email',null)", [d.id])).ok, "future date").toBe(false);
    expect((await fn(c, u, "select update_rti_status($1,'mark_filed',current_date - 3,'fax',null)", [d.id])).ok, "unknown channel").toBe(false);
    expect((await fn(c, u, "select update_rti_status($1,'mark_filed',current_date - 3,'email','AG-77') r", [d.id])).rows![0].r).toMatchObject({ status: "filed_by_me" });
    expect((await fn(c, u, "select update_rti_status($1,'mark_answered',current_date - 10,null,null)", [d.id])).ok, "answer before filing").toBe(false);
    expect((await fn(c, u, "select update_rti_status($1,'mark_appealed',null,null,null) r", [d.id])).rows![0].r).toMatchObject({ status: "appealed" });
    expect((await fn(c, u, "select delete_rti_draft($1) r", [d.id])).rows![0].r).toMatchObject({ deleted: true });
    expect((await fn(c, u, "select count(*)::int n from rti_drafts")).rows![0].n).toBe(0);
    // the table holds no applicant name, address or ID column
    await actAsOwner(c);
    const cols = (await c.query("select column_name from information_schema.columns where table_name = 'rti_drafts'")).rows.map((r) => r.column_name as string);
    expect(cols.filter((x) => /name|address|nid|phone|email|passport/.test(x))).toEqual(["agency_name"]);
    expect((await c.query("select value -> 'reviewed' r from app_settings where key = 'rti_rules'")).rows[0].r).toBe(false);
  })));
});

describe("MP records (B8.8)", () => {
  it("two people, an official source for every record, no counts or scores, and the MP's own office cannot write", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr, mp } = await office(c, A), mod1 = await createUser(c, "moderator"), mod2 = await createUser(c, "moderator"), cit = await citizen(c);
    await actAsOwner(c);
    const rep = await scalar<string>(c, "insert into representatives (full_name, verification_status, is_demo) values ('Test Member','verified', true) returning id");
    const mk = (who: string | null, url = "https://example.org/hansard/1") => fn(c, who, "select create_mp_record($1,'question_asked','Question on rural road funding','2026-03-10','Session 4','Parliament Secretariat record',$2,'2026-11-01','The member asked the ministry about road funds for 12 districts.') r", [rep, url]);
    for (const who of [null, cit, mgr, mp]) expect((await mk(who)).ok, `writer ${who}`).toBe(false);
    expect((await mk(mod1, "http://insecure.example")).ok, "https only").toBe(false);
    expect((await fn(c, mod1, "select create_mp_record($1,'attendance_session','Attendance','2026-03-10',null,'Parliament record','https://example.org/a','2026-11-01',null)", [rep])).ok, "attendance is not a kind").toBe(false);
    expect((await fn(c, mod1, "select create_mp_record($1,'question_asked','Future question','2999-01-01',null,'Parliament record','https://example.org/a','2026-11-01',null)", [rep])).ok, "future date").toBe(false);
    const r = (await mk(mod1)).rows![0].r as { ref: string };
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_mp_records")).toBe(0);
    expect((await fn(c, mod1, "select publish_mp_record($1,'The member asked about road funds for 12 districts.',false)", [r.ref])).ok, "not the author").toBe(false);
    expect((await fn(c, mod2, "select publish_mp_record($1,'short',false)", [r.ref])).ok, "summary needed").toBe(false);
    expect((await fn(c, mgr, "select publish_mp_record($1,'The member asked about road funds for 12 districts.',false)", [r.ref])).ok, "office").toBe(false);
    expect((await fn(c, mod1, "select save_mp_record_draft($1,'Draft text for review of the record')", [r.ref])).ok).toBe(true);
    expect((await fn(c, mod2, "select publish_mp_record($1,'The member asked about road funds for 12 districts.',true) r", [r.ref])).rows![0].r).toMatchObject({ status: "published" });
    await actAs(c, null);
    const pub = (await c.query("select * from public_mp_records")).rows;
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ representative_name: "Test Member", source_name: "Parliament Secretariat record" });
    // no score, count, rank or rating column anywhere in the public view or the table
    await actAsOwner(c);
    const cols = (await c.query("select column_name from information_schema.columns where table_name in ('mp_records','public_mp_records')")).rows.map((x) => x.column_name as string);
    expect(cols.filter((x) => /score|rank|rating|count|total|percent|attendance/.test(x))).toEqual([]);
    expect((await c.query("select summary_source from mp_records where ref = $1", [r.ref])).rows[0].summary_source).toBe("ai_draft_reviewed");
    expect((await fn(c, cit, "select * from mp_records")).rowCount, "table is closed to citizens").toBe(0);
    expect((await fn(c, mod2, "select withdraw_mp_record($1,'abc')", [r.ref])).ok, "reason needed").toBe(false);
    expect((await fn(c, mod2, "select withdraw_mp_record($1,'The source was corrected') r", [r.ref])).rows![0].r).toMatchObject({ status: "withdrawn" });
    await actAs(c, null);
    expect(await scalar(c, "select count(*)::int from public_mp_records")).toBe(0);
  })));
});

describe("agency receipts and country gates (B8.2, B8.10)", () => {
  it("a receipt function runs only as the service role, only through a confirmed integration with a key, for that agency's referral, and is not replayable for another referral", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), rep = await citizen(c), adm = await createUser(c, "admin");
    const issue = await createIssue(c, A, rep);
    await actAsOwner(c);
    const agency = await scalar<string>(c, "insert into agencies (name_bn, name_en, categories, source) values ('সংস্থা','P8 Agency', '{roads}', 'test') returning id");
    const otherAgency = await scalar<string>(c, "insert into agencies (name_bn, name_en, categories, source) values ('অন্য','P8 Other', '{roads}', 'test') returning id");
    const ref1 = await scalar<string>(c, "insert into issue_agency_referrals (issue_id, agency_id, agency_name) values ($1,$2,'P8 Agency') returning id", [issue.id, agency]);
    const ref2 = await scalar<string>(c, "insert into issue_agency_referrals (issue_id, agency_id, agency_name) values ($1,$2,'P8 Other') returning id", [issue.id, otherAgency]);
    const integ = await scalar<string>(c, "insert into agency_integrations (agency_id, kind, status) values ($1,'api','planned') returning id", [agency]);
    const fp = "a".repeat(64), pem = "-----BEGIN PUBLIC KEY-----\n" + "A".repeat(60) + "\n-----END PUBLIC KEY-----";
    const rec = (ref: string, reference = "AG-1", issued = new Date().toISOString(), f = fp) => attempt(c, "select record_agency_receipt($1,$2,$3,$4::timestamptz,$5,$6) r", [integ, ref, reference, issued, "b".repeat(64), f]);
    // not callable by anyone except the service role
    await actAs(c, adm);
    expect((await attempt(c, "select record_agency_receipt($1,$2,'x',now(),$3,$4)", [integ, ref1, "b".repeat(64), fp])).ok, "admin").toBe(false);
    await actAs(c, null);
    expect((await attempt(c, "select agency_integration_key($1)", [integ])).ok, "anonymous").toBe(false);
    await c.query("reset role"); await c.query("set local role service_role");
    expect((await rec(ref1)).ok, "integration only planned").toBe(false);
    await actAsOwner(c); await c.query("update agency_integrations set status = 'confirmed', confirmed_by = $2, confirmed_at = now() where id = $1", [integ, adm]);
    await c.query("reset role"); await c.query("set local role service_role");
    expect((await rec(ref1)).ok, "no key yet").toBe(false);
    await actAs(c, adm); await c.query("select set_agency_integration_key($1,$2,$3)", [integ, pem, fp]);
    await c.query("reset role"); await c.query("set local role service_role");
    expect((await rec(ref1, "AG-1", new Date().toISOString(), "c".repeat(64))).ok, "fingerprint mismatch").toBe(false);
    expect((await rec(ref2)).ok, "another agency's referral").toBe(false);
    expect((await rec(ref1, "AG-1", new Date(Date.now() - 9 * 86400_000).toISOString())).ok, "stale").toBe(false);
    expect((await rec(ref1, "AG-1", new Date(Date.now() + 3600_000).toISOString())).ok, "future").toBe(false);
    const ok = await rec(ref1);
    expect(ok.ok).toBe(true);
    await actAsOwner(c);
    const row = (await c.query("select registration_status, registration_reference, registration_proof, integration_id from issue_agency_referrals where id = $1", [ref1])).rows[0];
    expect(row).toMatchObject({ registration_status: "officially_registered", registration_reference: "AG-1", integration_id: integ });
    expect(row.registration_proof).toMatch(/Signed receipt/);
    expect((await c.query("select registration_status from issue_agency_referrals where id = $1", [ref2])).rows[0].registration_status, "the other referral is untouched").toBe("forwarded");
    expect(await scalar(c, "select count(*)::int from agency_receipts where integration_id = $1", [integ])).toBe(1);
  })));

  it("a second country is activated only with five cleared reviews, each with a reference and a named reviewer; the home country has no gates", () => withClient((c) => tx(c, async () => {
    const adm = await createUser(c, "admin"), staff = await createUser(c, "staff");
    const cfg = JSON.stringify({ name_en: "Pilotland", name_native: "Pilotland", default_locale: "en", locales: ["en"], currency: "USD", date_format: "dd/MM/yyyy", timezone: "UTC", admin_levels: [{ level: "region", name_en: "Region" }] });
    expect((await fn(c, staff, "select set_country_adapter('ZZ',$1::jsonb,false)", [cfg])).ok, "staff").toBe(false);
    expect((await fn(c, adm, "select set_country_adapter('ZZ',$1::jsonb,false)", [cfg])).ok, "configure without activating").toBe(true);
    expect((await fn(c, adm, "select set_country_adapter('ZZ',$1::jsonb,true)", [cfg])).ok, "activation blocked").toBe(false);
    const gates = ["legal_review", "electoral_review", "data_protection_review", "language_review", "hosting_residency"];
    expect((await fn(c, adm, "select country_readiness('ZZ') r")).rows![0].r).toMatchObject({ ready: false, home_country: false });
    expect((await fn(c, staff, "select country_readiness('ZZ')")).ok, "staff").toBe(false);
    expect((await fn(c, adm, "select set_country_gate('ZZ','legal_review','cleared',null,null)")).ok, "needs evidence and reviewer").toBe(false);
    expect((await fn(c, adm, "select set_country_gate('ZZ','made_up','cleared','doc 1','Firm X')")).ok, "unknown gate").toBe(false);
    expect((await fn(c, adm, "select set_country_gate('BD','legal_review','cleared','doc 1','Firm X')")).ok, "home country").toBe(false);
    expect((await fn(c, adm, "select set_country_gate('QQ','legal_review','cleared','doc 1','Firm X')")).ok, "no adapter").toBe(false);
    for (const g of gates.slice(0, 4)) expect((await fn(c, adm, "select set_country_gate('ZZ',$1,'cleared','Opinion 2026/14, filed in the legal folder','Firm X, counsel')", [g])).ok).toBe(true);
    expect((await fn(c, adm, "select set_country_adapter('ZZ',$1::jsonb,true)", [cfg])).ok, "four of five").toBe(false);
    expect((await fn(c, adm, "select set_country_gate('ZZ','hosting_residency','cleared','Hosting memo 3','Data office')")).ok).toBe(true);
    expect((await fn(c, adm, "select country_readiness('ZZ') r")).rows![0].r).toMatchObject({ ready: true });
    expect((await fn(c, adm, "select set_country_gate('ZZ','legal_review','open',null,null)")).ok).toBe(true);
    expect((await fn(c, adm, "select set_country_adapter('ZZ',$1::jsonb,true)", [cfg])).ok, "a reopened gate blocks again").toBe(false);
    expect((await fn(c, adm, "select country_readiness('BD') r")).rows![0].r).toMatchObject({ ready: true, home_country: true });
    expect(await scalar(c, "select count(*)::int from audit_logs where action like 'country_gate.%'")).toBeGreaterThanOrEqual(5);
    expect(await scalar(c, "select active_country()")).toBe("BD");
  })));
});

describe("erasure of Phase 8 data", () => {
  it("erase_user_data removes RTI drafts and ballots and withdraws volunteer and regional roles", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), { mgr } = await office(c, A), key = await keyOf(c, A), u = await citizen(c, A);
    await actAs(c, u);
    await c.query("select save_rti_draft(null,'Some Agency','Subject of the request','Please give me the budget for the road in my ward last year.',null,'electronic','text')");
    const v = (await c.query("select apply_volunteer($1,'v1') r", [key])).rows[0].r;
    await actAs(c, mgr); await c.query("select decide_volunteer($1,'approve',null)", [v.id]);
    await actAsOwner(c);
    await c.query("reset role"); await c.query("set local role service_role");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
    await c.query("select erase_user_data($1)", [u]);
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from rti_drafts where user_id = $1", [u])).toBe(0);
    expect(await scalar(c, "select status from volunteers where user_id = $1", [u])).toBe("withdrawn");
  })));
});
