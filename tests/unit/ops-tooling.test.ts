import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintMigrations } from "../../scripts/lib/migration-lint.mjs";
import { checkEnvironment } from "../../scripts/lib/env-policy.mjs";

const f = (name: string, sql: string) => ({ name, sql });

describe("migration lint (reviewed CI/CD flow)", () => {
  it("accepts a clean migration and gaps in numbering", () => {
    expect(lintMigrations([f("0023_a.sql", "select 1;"), f("0060_b.sql", "create table if not exists t (id int);\nalter table t enable row level security;")])).toEqual([]);
  });
  it("flags duplicate numbers, bad names, missing if-not-exists and RLS, destructive statements and anon writes", () => {
    const p = lintMigrations([
      f("0030_a.sql", "select 1;"), f("0030_b.sql", "select 1;"), f("bad.sql", ""),
      f("0031_c.sql", "create table x (id int);"),
      f("0032_d.sql", "alter table y drop column z;"),
      f("0033_e.sql", "-- destructive-approved: column unused since 0010, data archived\nalter table y drop column z;"),
      f("0034_f.sql", "grant insert on t to anon;"),
      f("0035_g.sql", "alter table y alter column a type text;"),
    ]);
    const text = p.join("\n");
    expect(text).toMatch(/0030_b.sql: number 0030 is also used/);
    expect(text).toMatch(/bad.sql: name must look like/);
    expect(text).toMatch(/0031_c.sql: create table x needs "if not exists"/);
    expect(text).toMatch(/0031_c.sql: table x must enable row level security/);
    expect(text).toMatch(/0032_d.sql: destructive/);
    expect(text).not.toMatch(/0033_e/);
    expect(text).toMatch(/0034_f.sql: anon must never/);
    expect(text).toMatch(/0035_g.sql: destructive/);
  });
  it("ignores statements inside comments and does not check old migrations", () => {
    expect(lintMigrations([f("0010_old.sql", "create table old (id int);"), f("0040_x.sql", "-- drop table nothing\nselect 1;")])).toEqual([]);
  });
});

const cfg = JSON.parse(readFileSync("config/environments.json", "utf8"));
describe("environment policy", () => {
  const prod = { NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "s", NEXT_PUBLIC_APP_URL: "https://jonokotha.org", CRON_SECRET: "x".repeat(20),
    ALERT_WEBHOOK_URL: "https://hooks", SENTRY_DSN: "https://s", EMAIL_API_KEY: "k", EMAIL_FROM: "a@b.c", CSP_MODE: "enforce" };
  it("accepts a complete production environment", () => expect(checkEnvironment("production", prod, cfg)).toEqual({ ok: true, problems: [] }));
  it("rejects demo login, report-only CSP, a local database and a shared staging project in production", () => {
    const r = checkEnvironment("production", { ...prod, DEMO_LOGIN: "true", CSP_MODE: "report-only", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_STAGING_URL: "http://127.0.0.1:54321" }, cfg);
    expect(r.ok).toBe(false);
    expect(r.problems.join(" | ")).toMatch(/DEMO_LOGIN[\s\S]*CSP_MODE[\s\S]*local database[\s\S]*same Supabase project/);
  });
  it("lists missing variables, allows a local database only in development, and knows only three environments", () => {
    expect(checkEnvironment("staging", { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }, cfg).problems.length).toBeGreaterThan(3);
    expect(checkEnvironment("development", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" }, cfg).ok).toBe(true);
    expect(checkEnvironment("qa", {}, cfg).ok).toBe(false);
    expect(Object.keys(cfg).filter((k) => !k.startsWith("_"))).toEqual(["development", "staging", "production"]);
  });
});
