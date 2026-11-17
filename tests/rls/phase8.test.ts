import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createUser, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";

/** RLS for the Phase 8 tables (migrations 0080-0083). Reads are scoped (office of the area, the owner, moderators and administrators where stated); no user session writes any of them directly. */
const one = async (c: Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows[0].id as string;
const count = async (c: Client, who: string | null, sql: string, p: unknown[] = []) => { await actAs(c, who); const r = await attempt(c, sql, p); return r.ok ? r.rowCount : 0; };

async function seed(c: Client) {
  const A = await createConstituency(c), B = await createConstituency(c);
  const citizenA = await createUser(c), citizenB = await createUser(c);
  const officeA = await createUser(c, "staff"), officeB = await createUser(c, "staff"), mod = await createUser(c, "moderator"), admin = await createUser(c, "admin");
  await addMember(c, officeA, A, "office_manager"); await addMember(c, officeB, B, "office_manager");
  const src = await one(c, "insert into budget_sources (constituency_id, title, publisher, doc_kind, source_url, fiscal_year, status, created_by, verified_by, verified_at) values ($1,'A budget paper','Publisher','adp','https://example.org/a','2026-27','verified',$2,$3,now()) returning id", [A, officeA, mod]);
  await c.query("insert into budget_entries (source_id, constituency_id, fiscal_year, kind, label, amount, source_page) values ($1,$2,'2026-27','allocated','Road repair',100,'p. 1')", [src, A]);
  const kiosk = await one(c, "insert into kiosks (constituency_id, label) values ($1,'Help desk A') returning id", [A]);
  await c.query("insert into volunteers (user_id, constituency_id, status, conduct_version) values ($1,$2,'active','v1')", [citizenA, A]);
  const issue = await one(c, "insert into issues (reporter_id, title, category, description, constituency_id, source_channel) values ($1,'t','roads','test issue',$2,'assisted') returning id", [citizenA, A]);
  await c.query("insert into assisted_reports (issue_id, volunteer_id, constituency_id, kiosk_id, consent_method, consent_version, agreed_to_file, agreed_to_publish, understands_no_account) values ($1,$2,$3,$4,'signed_paper','v1',true,true,true)", [issue, citizenA, A, kiosk]);
  const unit = await one(c, "insert into admin_units (level, code, name_bn, name_en) values ('division','P8R-DIV','বিভাগ','Division') returning id");
  await c.query("insert into regional_admins (user_id, unit_id) values ($1,$2)", [officeA, unit]);
  const cycle = await one(c, "insert into pb_cycles (constituency_id, budget_source_id, title, fiscal_year, budget_amount, pledge, closes_at, status) values ($1,$2,'A cycle title','2026-27',1000,'We will follow the result of this vote.', now() + interval '3 days','draft') returning id", [A, src]);
  const opt = await one(c, "insert into pb_options (cycle_id, position, title, cost) values ($1,1,'Option one',100) returning id", [cycle]);
  await c.query("insert into pb_ballots (cycle_id, user_id, option_ids) values ($1,$2,$3)", [cycle, citizenA, [opt]]);
  await c.query("insert into rti_drafts (user_id, agency_name, subject, info_requested, draft_text) values ($1,'Agency','A subject here','Please give me the budget for the road in my ward.','text')", [citizenA]);
  const rep = await one(c, "insert into representatives (full_name, verification_status) values ('Member','verified') returning id");
  await c.query("insert into mp_records (representative_id, kind, title, occurred_on, source_name, source_url, source_checked_at) values ($1,'question_asked','A question title','2026-01-01','Official record','https://example.org/h','2026-11-01')", [rep]);
  const agency = await one(c, "insert into agencies (name_bn, name_en, categories, source) values ('সংস্থা','Ag','{roads}','t') returning id");
  const integ = await one(c, "insert into agency_integrations (agency_id, kind) values ($1,'api') returning id", [agency]);
  const ref = await one(c, "insert into issue_agency_referrals (issue_id, agency_id, agency_name) values ($1,$2,'Ag') returning id", [issue, agency]);
  await c.query("insert into agency_receipts (integration_id, referral_id, agency_reference, issued_at, signature_sha256, key_fingerprint) values ($1,$2,'R1',now(),$3,$4)", [integ, ref, "a".repeat(64), "b".repeat(64)]);
  await c.query("insert into country_gates (country_code, gate) values ('ZZ','legal_review')");
  return { A, B, citizenA, citizenB, officeA, officeB, mod, admin };
}

const OFFICE_SCOPED = ["kiosks", "pb_cycles", "pb_options"];
const ADMIN_ONLY = ["agency_receipts", "country_gates"];
const ALL = ["budget_sources", "budget_entries", "volunteers", "kiosks", "assisted_reports", "regional_admins", "pb_cycles", "pb_options", "pb_ballots", "rti_drafts", "mp_records", "agency_receipts", "country_gates", "open_datasets"];

describe("Phase 8 tables: deny by default", () => {
  it("office-scoped tables: the area's office and administrators read them; other areas, citizens and anonymous do not", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of OFFICE_SCOPED) {
      expect(await count(c, w.officeA, `select 1 from ${t}`), `${t} as office A`).toBeGreaterThan(0);
      expect(await count(c, w.admin, `select 1 from ${t}`), `${t} as admin`).toBeGreaterThan(0);
      for (const [name, who] of [["anon", null], ["citizen", w.citizenB], ["office B", w.officeB], ["moderator", w.mod]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
    // budget documents: office, moderator and admin (the verification queue); nobody else
    for (const t of ["budget_sources", "budget_entries"]) {
      for (const [name, who] of [["office A", w.officeA], ["moderator", w.mod], ["admin", w.admin]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBeGreaterThan(0);
      for (const [name, who] of [["anon", null], ["citizen", w.citizenB], ["office B", w.officeB]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
    // volunteers and assisted reports: the volunteer, the area's office, admin
    for (const t of ["volunteers", "assisted_reports"]) {
      for (const [name, who] of [["volunteer", w.citizenA], ["office A", w.officeA], ["admin", w.admin]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBeGreaterThan(0);
      for (const [name, who] of [["anon", null], ["other citizen", w.citizenB], ["office B", w.officeB], ["moderator", w.mod]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
  })));

  it("administrator-only tables (receipts, country gates) and MP records (moderators and administrators) are closed to everyone else", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of ADMIN_ONLY) {
      expect(await count(c, w.admin, `select 1 from ${t}`), `${t} as admin`).toBeGreaterThan(0);
      for (const [name, who] of [["anon", null], ["citizen", w.citizenA], ["office A", w.officeA], ["moderator", w.mod]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
    for (const [name, who] of [["moderator", w.mod], ["admin", w.admin]] as const) expect(await count(c, who, "select 1 from mp_records"), `mp_records as ${name}`).toBeGreaterThan(0);
    for (const [name, who] of [["anon", null], ["citizen", w.citizenA], ["office A", w.officeA]] as const) expect(await count(c, who, "select 1 from mp_records"), `mp_records as ${name}`).toBe(0);
    for (const who of [null, w.citizenA, w.officeA, w.mod, w.admin]) expect(await count(c, who, "select 1 from open_datasets"), "open_datasets base table is closed to everyone").toBe(0);
  })));

  it("rows owned by a person (ballots, RTI drafts) are read by that person only, not even by administrators; a regional scope is read by its holder and administrators", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of ["pb_ballots", "rti_drafts"]) {
      expect(await count(c, w.citizenA, `select 1 from ${t}`), `${t} owner`).toBe(1);
      for (const [name, who] of [["anon", null], ["other citizen", w.citizenB], ["office A", w.officeA], ["moderator", w.mod], ["admin", w.admin]] as const) expect(await count(c, who, `select 1 from ${t}`), `${t} as ${name}`).toBe(0);
    }
    for (const [name, who] of [["holder", w.officeA], ["admin", w.admin]] as const) expect(await count(c, who, "select 1 from regional_admins"), `regional_admins as ${name}`).toBe(1);
    for (const [name, who] of [["anon", null], ["citizen", w.citizenA], ["office B", w.officeB]] as const) expect(await count(c, who, "select 1 from regional_admins"), `regional_admins as ${name}`).toBe(0);
  })));

  it("nobody writes any Phase 8 table directly with a user session (writes go through audited functions)", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    for (const t of ALL) {
      await actAsOwner(c);
      const col = (await c.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position limit 1", [t])).rows[0].column_name;
      for (const who of [w.citizenA, w.officeA, w.mod, w.admin]) {
        await actAs(c, who);
        expect((await attempt(c, `insert into ${t} default values`)).ok, `insert ${t}`).toBe(false);
        expect((await attempt(c, `update ${t} set ${col} = ${col}`)).ok, `update ${t}`).toBe(false);
        expect((await attempt(c, `delete from ${t}`)).ok, `delete ${t}`).toBe(false);
      }
    }
  })));

  it("public views show only what a visitor may see: no drafts, pending sources, private fields or scores", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    await actAsOwner(c);
    expect(await count(c, null, "select 1 from public_budget_entries")).toBe(1);   // verified source
    await actAsOwner(c);
    await c.query("update budget_sources set status = 'pending'");
    for (const v of ["public_budget_sources", "public_budget_entries", "public_pb_cycles", "public_pb_options", "public_mp_records"]) expect(await count(c, null, `select 1 from ${v}`), `${v} (only drafts and pending rows exist)`).toBe(0);
    expect(await count(c, null, "select 1 from public_kiosks")).toBe(1);
    expect(await count(c, null, "select 1 from public_open_datasets")).toBeGreaterThanOrEqual(4);
    await actAsOwner(c);
    for (const v of ["public_budget_sources", "public_budget_entries", "public_kiosks", "public_pb_cycles", "public_pb_options", "public_mp_records", "public_open_datasets"]) {
      const vc = (await c.query("select column_name from information_schema.columns where table_name = $1", [v])).rows.map((r) => r.column_name as string);
      expect(vc.filter((x) => /created_by|verified_by|user_id|approved_by|reviewed_by|excerpt|summary_draft|score|rank/.test(x)), `${v} exposes no person or score`).toEqual([]);
    }
    void w;
  })));

  it("an office manager of another area cannot act on this area's budget, volunteers, kiosks or participatory budgets through the functions", () => withClient((c) => tx(c, async () => {
    const w = await seed(c);
    await actAsOwner(c);
    const vol = (await c.query("select id from volunteers limit 1")).rows[0].id, kiosk = (await c.query("select id from kiosks limit 1")).rows[0].id, cyc = (await c.query("select ref from pb_cycles limit 1")).rows[0].ref;
    const src = (await c.query("select ref from budget_sources limit 1")).rows[0].ref;
    await actAs(c, w.officeB);
    for (const [sql, p] of [["select decide_volunteer($1,'suspend','a long enough reason')", [vol]], ["select retire_kiosk($1)", [kiosk]], ["select request_pb_open($1)", [cyc]], ["select pb_office_view($1)", [cyc]],
      ["select withdraw_budget_source($1,'a long enough reason')", [src]], ["select create_budget_entry($1,'spent','Item here',1,'p. 1')", [src]]] as [string, unknown[]][]) expect((await attempt(c, sql, p)).ok, sql).toBe(false);
  })));
});
