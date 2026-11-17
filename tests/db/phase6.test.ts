import { describe, expect, it } from "vitest";
import type { Client } from "pg";
import { actAs, actAsOwner, attempt, createConstituency as mkConstituency, createIssue as mkIssue, createUser as mkUser, scalar, tx } from "./fixtures";
import { withClient } from "./helpers";

const asService = async (c: Client) => { await c.query("reset role"); await c.query("set local role service_role"); await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]); };
// Fixtures need the owner role; tests switch roles freely, so each fixture first switches back.
const createUser: typeof mkUser = async (c, ...a) => { await actAsOwner(c); return mkUser(c, ...a); };
const createConstituency: typeof mkConstituency = async (c) => { await actAsOwner(c); return mkConstituency(c); };
const createIssue: typeof mkIssue = async (c, ...a) => { await actAsOwner(c); return mkIssue(c, ...a); };
const sha = "a".repeat(64);
const mkSource = async (c: Client, key: string, opts: { demo?: boolean } = {}) => {
  await actAsOwner(c);
  const { rows } = await c.query("insert into ingestion_sources (key,name,kind,url,license,is_demo) values ($1,'Test source','osm','https://example.org/data.json','ODbL 1.0',$2) returning id", [key, !!opts.demo]);
  return rows[0].id as string;
};

describe("ingestion (migration 0060)", () => {
  it("robots and personal-data rules are constraints, and a source cannot be enabled before its licence is checked", () => withClient((c) => tx(c, async () => {
    expect((await attempt(c, "insert into ingestion_sources (key,name,kind,url,license,respect_robots) values ('t-norobots','x y z','osm','https://e.org/','ODbL',false)")).ok).toBe(false);
    expect((await attempt(c, "insert into ingestion_sources (key,name,kind,url,license,personal_data) values ('t-pd','x y z','osm','https://e.org/','ODbL',true)")).ok).toBe(false);
    expect((await attempt(c, "insert into ingestion_sources (key,name,kind,url,license) values ('t-http','x y z','osm','http://e.org/','ODbL')")).ok).toBe(false);
    expect((await attempt(c, "insert into ingestion_sources (key,name,kind,url,license,enabled) values ('t-en','x y z','osm','https://e.org/','ODbL',true)")).ok).toBe(false);
    expect((await attempt(c, "insert into ingestion_sources (key,name,kind,url,license,enabled,license_ok,license_checked_at) values ('t-en2','x y z','osm','https://e.org/','ODbL',true,true,current_date)")).ok).toBe(true);
  })));

  it("register, review licence, run lifecycle: lineage row with checksum, unchanged refresh, retirement of the old lineage", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin");
    await actAs(c, admin);
    await c.query("select register_ingestion_source('t-life','Test life','osm','https://example.org/x.json','ODbL 1.0','© OpenStreetMap contributors',24,1000)");
    expect((await attempt(c, "select set_ingestion_enabled('t-life', true)")).ok, "enable before licence check").toBe(false);
    await c.query("select review_ingestion_licence('t-life', true, current_date, true)");
    await asService(c);
    expect((await c.query("select count(*)::int n from ingest_due_sources() where key='t-life'")).rows[0].n).toBe(1);
    const run1 = (await c.query("select ingest_begin_run((select id from ingestion_sources where key='t-life')) r")).rows[0].r;
    const f1 = (await c.query("select ingest_finish_run($1,'ok',200,1234,$2,true,null) r", [run1, sha])).rows[0].r;
    expect(f1.status).toBe("ok");
    await actAsOwner(c);
    const ks = (await c.query("select * from knowledge_sources where checksum=$1 and name='Test life'", [sha])).rows;
    expect(ks).toHaveLength(1);
    expect(ks[0].license_or_terms).toBe("ODbL 1.0");
    expect(ks[0].fetched_at).not.toBeNull();
    expect(ks[0].is_demo).toBe(false);
    // not due right after a run
    await asService(c);
    expect((await c.query("select count(*)::int n from ingest_due_sources() where key='t-life'")).rows[0].n).toBe(0);
    // same checksum again -> unchanged, no new lineage row
    await actAsOwner(c); await c.query("update ingestion_sources set last_run_at = now() - interval '2 days' where key='t-life'");
    await asService(c);
    const run2 = (await c.query("select ingest_begin_run((select id from ingestion_sources where key='t-life')) r")).rows[0].r;
    expect((await c.query("select ingest_finish_run($1,'ok',200,1234,$2,true,null) r", [run2, sha])).rows[0].r.status).toBe("unchanged");
    // changed checksum -> new lineage row, old one retired
    await actAsOwner(c); await c.query("update ingestion_sources set last_run_at = now() - interval '2 days' where key='t-life'");
    await asService(c);
    const run3 = (await c.query("select ingest_begin_run((select id from ingestion_sources where key='t-life')) r")).rows[0].r;
    await c.query("select ingest_finish_run($1,'ok',200,99,$2,true,null)", [run3, "b".repeat(64)]);
    await actAsOwner(c);
    expect((await c.query("select status from knowledge_sources where checksum=$1", [sha])).rows[0].status).toBe("retired");
    expect(await scalar(c, "select count(*)::int from ingestion_runs where source_id=(select id from ingestion_sources where key='t-life')")).toBe(3);
    expect(await scalar(c, "select count(*)::int from audit_logs where action='ingestion.run' and metadata->>'key'='t-life'")).toBe(3);
  })));

  it("a disabled source cannot be run; only the service role runs ingestion", () => withClient((c) => tx(c, async () => {
    const id = await mkSource(c, "t-off");
    await asService(c);
    const run = (await c.query("select ingest_begin_run($1) r", [id])).rows[0].r;
    expect((await attempt(c, "select ingest_finish_run($1,'ok',200,1,$2,true,null)", [run, sha])).ok, "a blocked run is already closed").toBe(false);
    expect(await scalar(c, "select status from ingestion_runs where id=$1", [run])).toBe("blocked_licence");
    const user = await createUser(c, "admin");
    await actAs(c, user);
    for (const q of ["select ingest_begin_run($1)", "select ingest_stage_records(gen_random_uuid(), '[]')"]) expect((await attempt(c, q, q.includes("$1") ? [id] : [])).ok, q).toBe(false);
  })));

  it("staged records that look like personal data are stored rejected and without their payload", () => withClient((c) => tx(c, async () => {
    const id = await mkSource(c, "t-pii");
    await c.query("update ingestion_sources set license_ok=true, license_checked_at=current_date, enabled=true where id=$1", [id]);
    await asService(c);
    const run = (await c.query("select ingest_begin_run($1) r", [id])).rows[0].r;
    const out = (await c.query("select ingest_stage_records($1, $2::jsonb) r", [run, JSON.stringify([
      { key: "ok-1", payload: { name: "Upazila Parishad office", number: "333" } },
      { key: "mail", payload: { contact: "someone@example.com" } },
      { key: "mobile", payload: { contact: "০১৭১২৩৪৫৬৭৮" } },
      { key: "mobile2", payload: { contact: "+8801712345678" } },
    ])])).rows[0].r;
    expect(out).toEqual({ staged: 1, rejected_personal_data: 3 });
    await actAsOwner(c);
    const { rows } = await c.query("select record_key, status, payload, pii_flags from ingestion_records where source_id=$1 order by record_key", [id]);
    expect(rows.find((r) => r.record_key === "mail")).toMatchObject({ status: "rejected", payload: {}, pii_flags: ["email"] });
    expect(rows.find((r) => r.record_key === "mobile")).toMatchObject({ status: "rejected", payload: {} });
    expect(rows.find((r) => r.record_key === "ok-1")).toMatchObject({ status: "staged" });
    // the same staged record is not stored twice
    await asService(c);
    expect((await c.query("select ingest_stage_records($1, $2::jsonb) r", [run, JSON.stringify([{ key: "ok-1", payload: { name: "Upazila Parishad office", number: "333" } }])])).rows[0].r.staged).toBe(0);
  })));

  it("changing a source's address or licence voids the earlier licence check", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"); await actAs(c, admin);
    await c.query("select register_ingestion_source('t-void','Void test','osm','https://example.org/a','CC-BY 4.0')");
    await c.query("select review_ingestion_licence('t-void', true, current_date, true)");
    await c.query("select register_ingestion_source('t-void','Void test','osm','https://example.org/b','CC-BY 4.0')");
    await actAsOwner(c);
    expect((await c.query("select license_ok, enabled from ingestion_sources where key='t-void'")).rows[0]).toEqual({ license_ok: false, enabled: false });
  })));

  it("demo and real knowledge stay separate: the index summary groups by is_demo and the public source list hides unchecked sources", () => withClient((c) => tx(c, async () => {
    const real = await mkSource(c, "t-real"), demo = await mkSource(c, "t-demo", { demo: true });
    expect(real).not.toBe(demo);
    await c.query("update ingestion_sources set license_ok=true, license_checked_at=current_date, enabled=true where key='t-real'");
    await c.query("set local role anon");
    const keys = (await c.query("select key from public_data_sources")).rows.map((r) => r.key);
    expect(keys).toContain("t-real"); expect(keys).not.toContain("t-demo");
    expect((await attempt(c, "select * from ingestion_sources")).ok).toBe(false);
    expect((await attempt(c, "select * from knowledge_index_summary")).ok).toBe(false);
  })));
});

describe("helplines are shown only after verification by a second person (0060)", () => {
  it("pending is hidden; verification needs a different person, a method and a source; the public view shows only current verified rows", () => withClient((c) => tx(c, async () => {
    const proposer = await createUser(c, "admin"), verifier = await createUser(c, "admin");
    await actAs(c, proposer);
    await c.query("select propose_helpline('t-999','999','জাতীয় জরুরি সেবা','National emergency service','জরুরি সাহায্য','Emergency help','https://example.org/999')");
    await c.query("set local role anon");
    expect((await c.query("select * from public_helplines where key='t-999'")).rowCount).toBe(0);
    await actAs(c, proposer);
    expect((await attempt(c, "select verify_helpline('t-999','verified','Read the official page and called the number')")).ok, "self-verification").toBe(false);
    await actAs(c, verifier);
    expect((await attempt(c, "select verify_helpline('t-999','verified','short')")).ok, "method too short").toBe(false);
    const ok = await attempt(c, "select verify_helpline('t-999','verified','Read the official page and called the number', $1, 90) r", [sha]);
    expect(ok.ok).toBe(true);
    await c.query("set local role anon");
    const pub = (await c.query("select * from public_helplines where key='t-999'")).rows;
    expect(pub).toHaveLength(1);
    expect(pub[0].number).toBe("999");
    expect(Object.keys(pub[0])).not.toContain("verified_by");
    // a changed number goes back to pending and disappears
    await actAs(c, proposer);
    await c.query("select propose_helpline('t-999','9999','জাতীয় জরুরি সেবা','National emergency service',null,null,'https://example.org/999')");
    await c.query("set local role anon");
    expect((await c.query("select * from public_helplines where key='t-999'")).rowCount).toBe(0);
  })));

  it("a verified helpline whose review date has passed is no longer shown and is marked stale by maintenance", () => withClient((c) => tx(c, async () => {
    await actAsOwner(c);
    await c.query("insert into helplines (key,number,name_bn,name_en,source_url,verification_status,verified_at,verification_method,review_due_at) values ('t-old','333','তথ্য সেবা','Info helpline','https://example.org/333','verified',now()-interval '100 days','Verified by phone call and page',now()-interval '1 day')");
    await c.query("set local role anon");
    expect((await c.query("select * from public_helplines where key='t-old'")).rowCount).toBe(0);
    await asService(c);
    expect((await c.query("select ops_pilot_maintenance() r")).rows[0].r.helplines_marked_stale).toBeGreaterThanOrEqual(1);
    await actAsOwner(c);
    expect(await scalar(c, "select verification_status from helplines where key='t-old'")).toBe("stale");
  })));

  it("rows cannot be marked verified without evidence, and non-admins cannot propose or verify", () => withClient((c) => tx(c, async () => {
    expect((await attempt(c, "insert into helplines (key,number,name_bn,name_en,verification_status) values ('t-bad','109','ক','Kk','verified')")).ok).toBe(false);
    expect((await attempt(c, "insert into helplines (key,number,name_bn,name_en) values ('t-bad2','abcd','ক','Kk')")).ok).toBe(false);
    const citizen = await createUser(c); await actAs(c, citizen);
    expect((await attempt(c, "select propose_helpline('t-x','999','ক','Kk')")).ok).toBe(false);
    expect((await attempt(c, "select verify_helpline('t-x','verified','some long method text')")).ok).toBe(false);
  })));
});

describe("legal holds and retention (0061)", () => {
  it("a legal hold blocks erasure of the account (direct call and sweep); releasing it lets erasure run", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), user = await createUser(c);
    await actAs(c, user); await c.query("select request_account_deletion()");
    await actAs(c, admin);
    const hold = (await c.query("select place_legal_hold('user',$1,'Court order requires records to be preserved','Case 12/2026') r", [user])).rows[0].r;
    expect((await attempt(c, "select place_legal_hold('user',$1,'Second hold on the same person','Case 13/2026')", [user])).ok, "one open hold per subject").toBe(false);
    await actAsOwner(c);
    await c.query("update deletion_requests set requested_at = now() - interval '20 days' where user_id=$1", [user]);
    await asService(c);
    expect((await c.query("select erase_user_data($1) r", [user])).rows[0].r).toEqual({ erased: false, held: true });
    const sweep = (await c.query("select run_retention() r")).rows[0].r;
    expect(sweep.accounts_held).toBeGreaterThanOrEqual(1);
    await actAsOwner(c);
    expect(await scalar(c, "select account_status from profiles where id=$1", [user])).toBe("active");
    expect(await scalar(c, "select count(*)::int from audit_logs where action='privacy.erasure_blocked_by_hold' and resource_id=$1", [user])).toBeGreaterThanOrEqual(1);
    await actAs(c, admin);
    await c.query("select release_legal_hold($1,'Order lifted')", [hold.id]);
    await asService(c);
    expect((await c.query("select erase_user_data($1) r", [user])).rows[0].r.erased).toBe(true);
  })));

  it("a hold on a person's report also blocks erasing that person; holds are admin only and audited", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), user = await createUser(c), A = await createConstituency(c);
    const issue = await createIssue(c, A, user);
    await actAs(c, admin);
    await c.query("select place_legal_hold('issue',$1,'Preserve the report for an inquiry','Inquiry 7')", [issue.ref]);
    await asService(c);
    expect((await c.query("select erase_user_data($1) r", [user])).rows[0].r.held).toBe(true);
    await actAs(c, user);
    expect((await attempt(c, "select place_legal_hold('user',$1,'A citizen tries to hold this','X-1')", [user])).ok).toBe(false);
    { const r = await attempt(c, "select * from legal_holds"); expect(r.ok ? r.rowCount : 0).toBe(0); };
    await actAsOwner(c);
    expect(await scalar(c, "select count(*)::int from audit_logs where action='legal_hold.placed'")).toBeGreaterThanOrEqual(1);
  })));

  it("the retention register is public in its safe form and enforced classes match the sweep", () => withClient((c) => tx(c, async () => {
    await c.query("set local role anon");
    const rows = (await c.query("select * from public_retention_policies")).rows;
    expect(rows.find((r) => r.data_class === "account_after_deletion_request")).toMatchObject({ retain_days: 14, status: "enforced" });
    expect(Object.keys(rows[0])).not.toContain("owner_role");
    expect((await attempt(c, "select * from retention_policies")).ok).toBe(false);
  })));
});

describe("service notices (0061)", () => {
  it("only active, current notices are public; admin posts and resolves; others cannot", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), citizen = await createUser(c);
    await actAs(c, citizen);
    expect((await attempt(c, "select post_service_notice('info','সাময়িক','Maintenance tonight')")).ok).toBe(false);
    await actAs(c, admin);
    const n = (await c.query("select post_service_notice('degraded','ধীর গতি','Slow notifications','বিস্তারিত','Details') r")).rows[0].r;
    await c.query("select post_service_notice('maintenance','ভবিষ্যৎ','Planned later', null, null, now() + interval '2 days')");
    await c.query("set local role anon");
    expect((await c.query("select title_en from public_service_notices")).rows.map((r) => r.title_en)).toEqual(["Slow notifications"]);
    await actAs(c, admin);
    await c.query("select resolve_service_notice($1)", [n.id]);
    await c.query("set local role anon");
    expect((await c.query("select * from public_service_notices")).rowCount).toBe(0);
  })));
});

describe("penetration-test findings (0061)", () => {
  it("enforces the fix and retest rules; critical and high cannot be accepted; the summary counts launch blockers", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"); await actAs(c, admin);
    const crit = (await c.query("select record_pentest_finding('IDOR on issue media','critical','Outside Tester Ltd','ASVS 4.2.1','/api/v1/issues/{ref}/media','Reproduced with two accounts') r")).rows[0].r;
    const low = (await c.query("select record_pentest_finding('Verbose error header','low','Outside Tester Ltd') r")).rows[0].r;
    expect(crit.ref).toMatch(/^PT-\d{3}$/);
    const before = (await c.query("select pentest_summary() r")).rows[0].r.blocking_launch;
    expect((await attempt(c, "select update_pentest_finding($1,'retest_passed',null,'Tester','Tried again and it is closed')", [crit.ref])).ok, "cannot jump to retest_passed").toBe(false);
    expect((await attempt(c, "select update_pentest_finding($1,'accepted_risk',null,null,null,'We accept this one for now')", [crit.ref])).ok, "critical cannot be accepted").toBe(false);
    expect((await attempt(c, "select update_pentest_finding($1,'fixed_pending_retest')", [crit.ref])).ok, "fix needs a reference").toBe(false);
    expect((await attempt(c, "select update_pentest_finding($1,'fixed_pending_retest','PR #123')", [crit.ref])).ok).toBe(true);
    expect((await attempt(c, "select update_pentest_finding($1,'retest_passed',null,'Tester','ok')", [crit.ref])).ok, "retest note too short").toBe(false);
    expect((await attempt(c, "select update_pentest_finding($1,'retest_failed',null,'Outside Tester','Still reproducible with a second account')", [crit.ref])).ok).toBe(true);
    expect((await c.query("select pentest_summary() r")).rows[0].r.blocking_launch).toBe(before);
    await c.query("select update_pentest_finding($1,'fixed_pending_retest','PR #124')", [crit.ref]);
    await c.query("select update_pentest_finding($1,'retest_passed',null,'Outside Tester','Retested with two accounts: access is now denied')", [crit.ref]);
    expect((await c.query("select pentest_summary() r")).rows[0].r.blocking_launch).toBe(before - 1);
    expect((await attempt(c, "select update_pentest_finding($1,'accepted_risk',null,null,null,'Cosmetic header, low impact, accepted by the owner')", [low.ref])).ok).toBe(true);
    const citizen = await createUser(c); await actAs(c, citizen);
    expect((await attempt(c, "select pentest_summary()")).ok).toBe(false);
    { const r = await attempt(c, "select * from pentest_findings"); expect(r.ok ? r.rowCount : 0).toBe(0); };
  })));
});

describe("pilot sites and costs (0061)", () => {
  it("a live pilot needs a verified office, categories and contacts; the cost report compares budget to actual and AI cost comes from ai_runs", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), A = await createConstituency(c);
    const key = (await c.query("select key from constituencies where id=$1", [A])).rows[0].key;
    await actAs(c, admin);
    expect((await attempt(c, "select upsert_pilot_site($1,'live',array['roads'])", [key])).ok, "live without office/contacts").toBe(false);
    expect((await attempt(c, "select upsert_pilot_site($1,'planning',array['no-such-category'])", [key])).ok).toBe(false);
    const cat = (await c.query("select slug from issue_categories limit 1")).rows[0].slug;
    expect((await attempt(c, "select upsert_pilot_site($1,'live',array[$2],'help@example.org','lead@example.org',current_date)", [key, cat])).ok).toBe(true);
    await c.query("select set_pilot_budget_line('hosting_app', 25, 'Hobby to Pro upgrade estimate')");
    await c.query("select set_pilot_budget_line('ai_inference', 10, 'Estimated 2000 calls at the measured average cost')");
    await c.query("select record_pilot_cost(current_date,'hosting_app',20,'Vercel','INV-1')");
    await actAsOwner(c);
    await c.query("insert into ai_runs (agent, model, status, cost_usd) values ('intake','m','ok',12.5)");
    await actAs(c, admin);
    const r = (await c.query("select pilot_cost_report() r")).rows[0].r;
    expect(r.active_pilot_sites).toBe(1);
    const ai = r.lines.find((l: { line: string }) => l.line === "ai_inference");
    expect(Number(ai.actual_usd)).toBeGreaterThanOrEqual(12.5);
    expect(ai.over_budget).toBe(true);
    expect(r.lines.find((l: { line: string }) => l.line === "hosting_app")).toMatchObject({ actual_usd: 20, over_budget: false });
    const citizen = await createUser(c); await actAs(c, citizen);
    expect((await attempt(c, "select pilot_cost_report()")).ok).toBe(false);
  })));
});

describe("evaluation on real use (0062)", () => {
  it("consent first; review needs a category and a no-personal-data confirmation; withdrawal and consent withdrawal remove the text; export contains only approved", () => withClient((c) => tx(c, async () => {
    const user = await createUser(c), admin = await createUser(c, "admin"), A = await createConstituency(c);
    const issue = await createIssue(c, A, user);
    await c.query("update issues set is_demo=false where id=$1", [issue.id]);
    await actAs(c, user);
    expect((await attempt(c, "select submit_eval_example($1,'রাস্তায় বড় গর্ত, রিকশা চলছে না','bn')", [issue.ref])).ok, "no consent yet").toBe(false);
    await c.query("select record_consent('ai_eval_example','v1',true)");
    const sub = await attempt(c, "select submit_eval_example($1,'রাস্তায় বড় গর্ত, রিকশা চলছে না','bn') r", [issue.ref]);
    expect(sub.ok).toBe(true);
    expect((await attempt(c, "select submit_eval_example($1,'রাস্তায় বড় গর্ত, রিকশা চলছে না','bn')", [issue.ref])).ok, "only once").toBe(false);
    const id = (sub.ok && (sub.rows[0] as { r: { id: string } }).r.id) as string;
    const other = await createUser(c); await actAs(c, other);
    expect((await attempt(c, "select submit_eval_example($1,'রাস্তায় বড় গর্ত, রিকশা চলছে না','bn')", [issue.ref])).ok, "not their issue").toBe(false);
    expect((await attempt(c, "select withdraw_eval_example($1)", [id])).ok).toBe(false);
    await actAs(c, admin);
    expect((await attempt(c, "select review_eval_example($1,'approve','roads')", [id])).ok, "needs pii confirmation").toBe(false);
    expect((await attempt(c, "select review_eval_example($1,'approve','not-a-category',null,null,null,true)", [id])).ok).toBe(false);
    const cat = (await c.query("select slug from issue_categories limit 1")).rows[0].slug;
    expect((await attempt(c, "select review_eval_example($1,'approve',$2,null,null,'checked',true)", [id, cat])).ok).toBe(true);
    const exp = (await c.query("select eval_set_export() r")).rows[0].r.examples;
    expect(exp.find((e: { category: string }) => e.category === cat)).toMatchObject({ source: "consented_real", language: "bn" });
    // the person withdraws consent: the text is gone and the example leaves the export
    await actAs(c, user);
    await c.query("select record_consent('ai_eval_example','v1',false)");
    await actAsOwner(c);
    expect((await c.query("select status, text from eval_candidates where id=$1", [id])).rows[0]).toEqual({ status: "withdrawn", text: null });
    await actAs(c, admin);
    expect((await c.query("select eval_set_export() r")).rows[0].r.examples.some((e: { id: string }) => e.id.includes(id.replace(/-/g, "").slice(0, 10)))).toBe(false);
  })));

  it("deleting an account removes the offered text; demo issues are refused; candidates are not visible to others", () => withClient((c) => tx(c, async () => {
    const user = await createUser(c), A = await createConstituency(c);
    const demoIssue = await createIssue(c, A, user); await c.query("update issues set is_demo=true where id=$1", [demoIssue.id]);
    const real = await createIssue(c, A, user); await c.query("update issues set is_demo=false where id=$1", [real.id]);
    await actAs(c, user); await c.query("select record_consent('ai_eval_example','v1',true)");
    expect((await attempt(c, "select submit_eval_example($1,'Some text that is long enough','en')", [demoIssue.ref])).ok).toBe(false);
    await c.query("select submit_eval_example($1,'Some text that is long enough','en')", [real.ref]);
    const other = await createUser(c); await actAs(c, other);
    { const r = await attempt(c, "select id from eval_candidates"); expect(r.ok ? r.rowCount : 0).toBe(0); };
    await actAsOwner(c);
    await c.query("update profiles set account_status='deleted' where id=$1", [user]);
    expect((await c.query("select status, text, user_id from eval_candidates where issue_id=$1", [real.id])).rows[0]).toEqual({ status: "withdrawn", text: null, user_id: null });
  })));

  it("routing accuracy compares the AI suggestion with the office's first referral and hides small groups", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), user = await createUser(c), A = await createConstituency(c);
    const ag = (await c.query("select id from agencies limit 2")).rows.map((r) => r.id as string);
    for (let i = 0; i < 6; i++) {
      const iss = await createIssue(c, A, user); await c.query("update issues set is_demo=false where id=$1", [iss.id]);
      await c.query("insert into ai_suggestions (target_type,target_id,suggestion_type,payload,confidence) values ('issue',$1,'routing',$2::jsonb,0.9)", [iss.id, JSON.stringify({ agency_id: ag[0] })]);
      await c.query("insert into issue_agency_referrals (issue_id, agency_id, agency_name) values ($1,$2,'x')", [iss.id, i < 4 ? ag[0] : ag[1]]);
    }
    await actAs(c, admin);
    const r = (await c.query("select routing_accuracy(30) r")).rows[0].r;
    expect(r.compared).toBeGreaterThanOrEqual(6);
    expect(Number(r.accuracy_pct)).toBeGreaterThan(0);
    expect(r.by_confidence.find((b: { confidence_from: number }) => b.confidence_from === 0.85).accuracy_pct).not.toBeNull();
    await actAs(c, user);
    expect((await attempt(c, "select routing_accuracy(30)")).ok).toBe(false);
  })));

  it("a threshold needs evidence (30+ cases, metric, method, date) and is audited with before and after", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"); await actAs(c, admin);
    const basis = (n: number) => JSON.stringify({ n, metric: "precision >= 0.9", method: "labelled pairs", measured_on: "2026-12-01" });
    expect((await attempt(c, "select set_ai_threshold('duplicate_min_score',0.82,$1::jsonb)", [basis(12)])).ok, "too few cases").toBe(false);
    expect((await attempt(c, "select set_ai_threshold('duplicate_min_score',0.82,'{}'::jsonb)")).ok).toBe(false);
    expect((await attempt(c, "select set_ai_threshold('made_up_key',0.5,$1::jsonb)", [basis(40)])).ok).toBe(false);
    expect((await attempt(c, "select set_ai_threshold('duplicate_min_score',1.5,$1::jsonb)", [basis(40)])).ok).toBe(false);
    expect((await attempt(c, "select set_ai_threshold('duplicate_min_score',0.82,$1::jsonb)", [basis(40)])).ok).toBe(true);
    expect((await attempt(c, "select set_ai_threshold('duplicate_min_score',0.85,$1::jsonb)", [basis(60)])).ok).toBe(true);
    await actAsOwner(c);
    const a = (await c.query("select before_data, after_data from audit_logs where action='ai.threshold_set' and resource_id='duplicate_min_score' order by created_at desc limit 1")).rows[0];
    expect(Number(a.before_data.value)).toBe(0.82); expect(Number(a.after_data.value)).toBe(0.85);
  })));

  it("speech test results need participant consent and summarise by environment, age band and district", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"); await actAs(c, admin);
    expect((await attempt(c, "select record_stt_test('provider-x','Rajshahi','60+','market',20,0.31,false)")).ok).toBe(false);
    await c.query("select record_stt_test('provider-x','Rajshahi','60+','market',20,0.30,true)");
    await c.query("select record_stt_test('provider-x','Rajshahi','60+','market',20,0.40,true)");
    const s = (await c.query("select stt_summary() r")).rows[0].r;
    expect(s.by_environment.find((e: { environment: string }) => e.environment === "market")).toMatchObject({ samples: 40, wer: 0.35 });
  })));
});

describe("KPI baselines (0062)", () => {
  it("snapshot computes drafts with definitions and method; nothing is public until published; small groups are suppressed; manual metrics carry their method", () => withClient((c) => tx(c, async () => {
    const admin = await createUser(c, "admin"), A = await createConstituency(c), user = await createUser(c);
    const key = (await c.query("select key from constituencies where id=$1", [A])).rows[0].key;
    await createIssue(c, A, user);
    await actAs(c, admin);
    const snap = (await c.query("select snapshot_kpi_baseline($1,30) r", [key])).rows[0].r;
    expect(snap.status).toBe("draft");
    await c.query("set local role anon");
    expect((await c.query("select * from public_kpi_baselines where constituency=$1", [key])).rowCount).toBe(0);
    await actAs(c, admin);
    const drafts = (await c.query("select metric_key, value, suppressed, method from kpi_baselines where constituency_id=$1", [A])).rows;
    expect(drafts.find((d) => d.metric_key === "north_star_outcomes_per_month")).toMatchObject({ value: null, suppressed: true });
    expect(drafts.every((d) => d.method.length >= 10)).toBe(true);
    const m = (await c.query("select record_manual_kpi($1,'accessibility_task_completion_pct',83.3,12,'Moderated task test with 12 participants on a mid-range phone, Bangla UI','Share who completed the report task unaided',current_date - 30, current_date) r", [key])).rows[0].r;
    expect(m.suppressed).toBe(false);
    expect((await attempt(c, "select record_manual_kpi($1,'made_up',1,1,'a long enough method text','long enough definition',current_date - 30, current_date)", [key])).ok).toBe(false);
    await c.query("select record_manual_kpi($1,'citizen_satisfaction_pct',90,3,'Three responses only, too few to show','Satisfaction after closure', current_date - 30, current_date)", [key]);
    expect((await c.query("select publish_kpi_baselines($1, current_date) r", [key])).rows[0].r.published).toBeGreaterThan(5);
    await c.query("set local role anon");
    const pub = (await c.query("select * from public_kpi_baselines where constituency=$1", [key])).rows;
    expect(pub.find((p) => p.metric_key === "accessibility_task_completion_pct")).toMatchObject({ n: 12, suppressed: false });
    expect(pub.find((p) => p.metric_key === "citizen_satisfaction_pct")).toMatchObject({ value: null, n: null, suppressed: true });
    expect(pub.every((p) => p.method && p.definition && p.published_at)).toBe(true);
    await actAs(c, admin);
    await c.query("select withdraw_kpi_baselines($1, current_date, 'Method error found')", [key]);
    await c.query("set local role anon");
    expect((await c.query("select * from public_kpi_baselines where constituency=$1", [key])).rowCount).toBe(0);
  })));

  it("snapshots need analytics permission in that office; publishing is administrators only", () => withClient((c) => tx(c, async () => {
    const A = await createConstituency(c), B = await createConstituency(c), mgr = await createUser(c, "staff"), citizen = await createUser(c);
    const keyA = (await c.query("select key from constituencies where id=$1", [A])).rows[0].key, keyB = (await c.query("select key from constituencies where id=$1", [B])).rows[0].key;
    await c.query("insert into office_members (user_id, constituency_id, office_role) values ($1,$2,'office_manager')", [mgr, A]);
    await actAs(c, mgr);
    expect((await attempt(c, "select snapshot_kpi_baseline($1,30)", [keyA])).ok).toBe(true);
    expect((await attempt(c, "select snapshot_kpi_baseline($1,30)", [keyB])).ok, "another office").toBe(false);
    expect((await attempt(c, "select publish_kpi_baselines($1, current_date)", [keyA])).ok).toBe(false);
    await actAs(c, citizen);
    expect((await attempt(c, "select snapshot_kpi_baseline($1,30)", [keyA])).ok).toBe(false);
  })));
});
