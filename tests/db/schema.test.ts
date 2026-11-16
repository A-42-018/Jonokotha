import { describe, expect, it } from "vitest";
import { asUser, withClient } from "./helpers";

const NEW_TABLES = ["representatives","representative_constituencies","office_members","issue_categories","issue_media","issue_assignments",
  "issue_agency_referrals","notifications","audit_logs","consents","user_preferences","knowledge_sources","knowledge_chunks",
  "issue_embeddings","graph_edges","ai_runs","ai_suggestions","issues","issue_events"];

describe("schema (migrations 0001-0005)", () => {
  it("has every masterplan §12 table in scope for Phase 1", () => withClient(async (c) => {
    const { rows } = await c.query("select table_name from information_schema.tables where table_schema='public'");
    const have = new Set(rows.map((r) => r.table_name));
    for (const t of NEW_TABLES) expect(have.has(t), t).toBe(true);
  }));

  it("enables RLS on every base table in public (deny by default)", () => withClient(async (c) => {
    const { rows } = await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
    expect(rows.map((r) => r.relname)).toEqual([]);
  }));

  it("public views never expose reporter, actor or internal columns", () => withClient(async (c) => {
    const { rows } = await c.query("select table_name, column_name from information_schema.columns where table_schema='public' and table_name in ('public_cases','public_case_events')");
    const bad = rows.filter((r) => /reporter|actor|internal|assigned|private/.test(r.column_name));
    expect(bad).toEqual([]);
  }));

  it("anonymous users cannot read private tables or the compat view", () => withClient(async (c) => {
    for (const t of ["issues","issue_events","audit_logs","ai_runs","ai_suggestions","notifications","consents","office_members","issue_embeddings","graph_edges"]) {
      const n = await asUser(c, null, async () => { try { return (await c.query(`select 1 from ${t}`)).rowCount; } catch { return 0; } });
      expect(n, t).toBe(0);
    }
    await asUser(c, null, async () => { await expect(c.query("select 1 from cases")).rejects.toThrow(); });
  }));

  it("keeps the legacy status mapping total and the 13-state enum complete", () => withClient(async (c) => {
    const { rows } = await c.query("select unnest(enum_range(null::issue_status))::text as s, issue_to_legacy_status(unnest(enum_range(null::issue_status)))::text as l");
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => ["received","acknowledged","referred","resolved"].includes(r.l))).toBe(true);
    for (const l of ["received","acknowledged","referred","resolved"]) {
      const { rows: r } = await c.query("select issue_to_legacy_status(legacy_to_issue_status($1::case_status))::text as l", [l]);
      expect(r[0].l).toBe(l); // round trip
    }
  }));
});
