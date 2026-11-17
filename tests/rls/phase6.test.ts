import { describe, expect, it } from "vitest";
import { actAs, actAsOwner, addMember, attempt, createConstituency, createIssue, createUser, tx } from "../db/fixtures";
import { withClient } from "../db/helpers";

/** RLS for the Phase 6 tables (migrations 0060-0062): internal registers are administrators only; a citizen sees only their own evaluation offers; offices see only their own KPI baselines. */
const ADMIN_ONLY = ["ingestion_sources", "ingestion_runs", "ingestion_records", "helplines", "retention_policies", "legal_holds", "service_notices", "pentest_findings",
  "pilot_sites", "pilot_budget_lines", "pilot_cost_entries", "ai_thresholds", "stt_test_runs"];

describe("Phase 6 tables: deny by default", () => {
  it("anonymous, citizen, office manager and moderator read zero rows from every administrators-only table; the admin can read; nobody can write directly", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), citizen = await createUser(c), office = await createUser(c, "staff"), mod = await createUser(c, "moderator"), admin = await createUser(c, "admin");
    await addMember(c, office, A, "office_manager");
    // seed one row in each table as the owner
    await c.query("insert into ingestion_sources (key,name,kind,url,license) values ('rls-src','RLS source','osm','https://example.org/','ODbL')");
    await c.query("insert into ingestion_runs (source_id) select id from ingestion_sources where key='rls-src'");
    await c.query("insert into ingestion_records (source_id, run_id, record_key, payload, payload_hash) select s.id, r.id, 'k', '{}', 'h' from ingestion_sources s join ingestion_runs r on r.source_id=s.id where s.key='rls-src'");
    await c.query("insert into helplines (key,number,name_bn,name_en) values ('rls-h','999','জরুরি','Emergency')");
    await c.query("insert into legal_holds (subject_type,subject_id,reason,authority_ref) values ('user','x','A reason long enough','Ref-1')");
    await c.query("insert into service_notices (severity,title_bn,title_en) values ('info','নোটিশ','Notice')");
    await c.query("insert into pentest_findings (title,severity,reported_by) values ('A finding title','low','Tester')");
    await c.query("insert into pilot_sites (constituency_id) values ($1)", [A]);
    await c.query("insert into pilot_budget_lines (line,monthly_budget_usd,basis) values ('support', 5, 'basis text')");
    await c.query("insert into pilot_cost_entries (month,line,amount_usd) values (date_trunc('month', now())::date,'support',1)");
    await c.query("insert into ai_thresholds (key,value,basis) values ('duplicate_min_score',0.8,'{}')");
    await c.query("insert into stt_test_runs (provider,district,age_band,environment,samples,word_error_rate,participants_consented) values ('prov','Dhaka','60+','street',5,0.2,true)");
    for (const t of ADMIN_ONLY) {
      for (const who of [null, citizen, office, mod]) {
        await actAs(c, who);
        const r = await attempt(c, `select 1 from ${t}`);
        expect(r.ok ? r.rowCount : 0, `${t} as ${who ?? "anon"}`).toBe(0);
        const w = await attempt(c, `delete from ${t}`);
        expect(w.ok ? w.rowCount : 0, `delete ${t} as ${who ?? "anon"}`).toBe(0);
        expect((await attempt(c, `insert into ${t} default values`)).ok, `insert ${t}`).toBe(false);
      }
      await actAs(c, admin);
      const r = await attempt(c, `select 1 from ${t}`);
      expect(r.ok && r.rowCount, `${t} as admin`).toBeGreaterThanOrEqual(1);
      expect((await attempt(c, `update ${t} set ${t === "helplines" ? "number" : "1"} = ${t === "helplines" ? "'111'" : "1"}`)).ok, `direct update ${t}`).toBe(false);
    }
  })));

  it("eval candidates: a person sees only their own offers (without the text), the admin sees all", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), u1 = await createUser(c), u2 = await createUser(c), admin = await createUser(c, "admin");
    const i1 = await createIssue(c, A, u1), i2 = await createIssue(c, A, u2);
    await c.query("insert into eval_candidates (user_id, issue_id, text) values ($1,$2,'text number one here'), ($3,$4,'text number two here')", [u1, i1.id, u2, i2.id]);
    await actAs(c, u1);
    expect((await c.query("select id, status from eval_candidates")).rowCount).toBe(1);
    expect((await attempt(c, "select text from eval_candidates")).ok, "the text column is not readable by the owner").toBe(false);
    expect((await attempt(c, "update eval_candidates set status='approved'")).ok).toBe(false);
    await actAs(c, null);
    expect((await attempt(c, "select id from eval_candidates")).ok).toBe(false);
    await actAs(c, admin);
    expect((await c.query("select id from eval_candidates")).rowCount).toBe(2);
  })));

  it("KPI baselines: an office reads its own drafts only; other offices and citizens see none; the public sees only published, never the drafts", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), officeA = await createUser(c, "staff"), officeB = await createUser(c, "staff"), citizen = await createUser(c);
    await addMember(c, officeA, A, "office_manager"); await addMember(c, officeB, B, "office_manager");
    await c.query("insert into kpi_baselines (constituency_id, period_start, period_end, metric_key, value, n, definition, method, source, status) values ($1, current_date-30, current_date, 'received', 9, 9, 'definition text here', 'method text here', 'computed', 'draft'), ($1, current_date-30, current_date, 'forwarding_rate_pct', 50, 9, 'definition text here', 'method text here', 'computed', 'published')", [A]);
    await actAs(c, officeA); expect((await c.query("select id from kpi_baselines")).rowCount).toBe(2);
    await actAs(c, officeB); expect((await c.query("select id from kpi_baselines")).rowCount).toBe(0);
    await actAs(c, citizen); expect((await c.query("select id from kpi_baselines")).rowCount).toBe(0);
    await actAs(c, null);
    expect((await attempt(c, "select id from kpi_baselines")).ok).toBe(false);
    expect((await c.query("select metric_key from public_kpi_baselines")).rows.map((r) => r.metric_key)).toEqual(["forwarding_rate_pct"]);
    await actAsOwner(c);
  })));
});
