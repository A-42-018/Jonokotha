import { describe, expect, it } from "vitest";
import { withClient } from "../db/helpers";

/**
 * Every base table in `public` must be listed here AND covered in tests/rls/read.test.ts or write.test.ts
 * (or be reference data covered by "reference data and the permission matrix are public").
 * Adding a table without adding RLS tests fails this test, which is the point (masterplan §14, definition of done).
 */
const COVERED = [
  "agencies", "ai_runs", "ai_suggestions", "app_settings", "audit_logs", "consents", "constituencies", "graph_edges", "idempotency_keys", "issue_feedback", "issue_affected", "follows", "analytics_reports", "office_invitations", "moderation_reports", "ai_eval_runs", "notification_deliveries", "push_subscriptions", "announcements", "projects", "project_milestones", "representative_fields", "ideas", "idea_supports", "questions", "question_messages", "rate_limits",
  "issue_agency_referrals", "issue_assignments", "issue_categories", "issue_embeddings", "issue_events", "issue_media", "issue_transitions", "issues",
  "knowledge_chunks", "knowledge_sources", "notifications", "office_members", "office_permissions", "profiles",
  "representative_constituencies", "representatives", "user_preferences", "sla_policies", "issue_sla", "issue_sla_pauses", "deletion_requests",
];
// Phase 6 (migrations 0060-0062); kept on their own lines so merges with other phases stay trivial.
const PHASE6_TABLES = ["ingestion_sources", "ingestion_runs", "ingestion_records", "helplines", "retention_policies", "legal_holds", "service_notices", "pentest_findings", "pilot_sites", "pilot_budget_lines", "pilot_cost_entries", "eval_candidates", "ai_thresholds", "stt_test_runs", "kpi_baselines"];
const PHASE6_VIEWS = ["public_data_sources", "public_helplines", "public_retention_policies", "public_service_notices", "public_kpi_baselines"];
const PUBLIC_VIEWS = ["public_analytics_reports", "public_announcements", "public_case_events", "public_cases", "public_ideas", "public_project_milestones", "public_projects", "public_question_messages", "public_questions"];
const ANON_READABLE = ["agencies", "constituencies", "issue_categories", "issue_transitions", "knowledge_sources", "office_permissions", "representative_constituencies", "representative_fields", "representatives"];

// Phase 5 (migrations 0030-0036). Each table has RLS tests in tests/rls/phase5.test.ts.
COVERED.push("admin_units", "agency_integrations", "approval_requests", "background_jobs", "constituency_units", "country_adapters", "feature_flags", "idea_comments", "integration_settings", "location_change_requests",
  "office_inbox_counts", "office_tasks", "platform_invitations", "poll_options", "poll_votes", "polls", "product_events", "project_feedback", "security_events");
PUBLIC_VIEWS.push("public_case_referrals", "public_idea_comments", "public_open311_requests", "public_open311_services", "public_poll_options", "public_polls", "public_project_feedback");
ANON_READABLE.push("admin_units", "constituency_units", "country_adapters");

describe("RLS coverage guard", () => {
  it("every public table has RLS enabled and RLS tests", () => withClient(async (c) => {
    const { rows } = await c.query("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'");
    expect(rows.map((r) => r.relname).sort()).toEqual([...COVERED, ...PHASE6_TABLES].sort());
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  }));

  it("anonymous visitors hold no privileges except on reference tables and the two public views", () => withClient(async (c) => {
    const { rows } = await c.query(
      `select table_name from information_schema.role_table_grants where grantee='anon' and table_schema='public' group by table_name order by 1`);
    expect(rows.map((r) => r.table_name)).toEqual([...ANON_READABLE, ...PUBLIC_VIEWS, ...PHASE6_VIEWS].sort());
    const { rows: w } = await c.query("select 1 from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type <> 'SELECT'");
    expect(w).toEqual([]);
  }));

  it("signed-in users hold no delete or truncate privilege anywhere in public", () => withClient(async (c) => {
    const { rows } = await c.query("select table_name, privilege_type from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and privilege_type in ('DELETE','TRUNCATE')");
    expect(rows).toEqual([]);
  }));

  it("workflow and bookkeeping functions are not callable by anonymous visitors, but are by signed-in users", () => withClient(async (c) => {
    const fns = ["transition_issue(uuid,issue_status,jsonb,text)", "assign_issue(uuid,uuid,text,text)", "add_issue_note(uuid,text,boolean,text)",
      "idempotency_begin(text,text,text)", "idempotency_finish(text,text,integer,jsonb)", "idempotency_release(text,text)", "consume_rate_limit(text,integer,integer)"];
    for (const f of fns) {
      const { rows } = await c.query("select has_function_privilege('anon', $1, 'execute') as anon, has_function_privilege('authenticated', $1, 'execute') as authed", [`public.${f}`]);
      expect(rows[0], f).toEqual({ anon: false, authed: true });
    }
  }));

  it("no SECURITY DEFINER view or table leaks: public views list only safe columns", () => withClient(async (c) => {
    const { rows } = await c.query("select table_name, column_name from information_schema.columns where table_schema='public' and table_name in ('public_cases','public_case_events')");
    expect(rows.filter((r) => /reporter|actor|internal|assigned|private|email|phone/.test(r.column_name))).toEqual([]);
  }));
});
