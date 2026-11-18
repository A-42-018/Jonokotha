import { afterEach, describe, expect, it } from "vitest";
import { DEMO_EMAILS, DEMO_ROLES, demoEnabled, demoLanding, parseDemoRole } from "@/lib/demo";

const env = process.env as Record<string, string | undefined>;
afterEach(() => { delete env.DEMO_LOGIN; delete env.DEMO_PASSWORD; });

describe("demo login", () => {
  it("is off unless DEMO_LOGIN=true and a password is set", () => {
    expect(demoEnabled()).toBe(false);
    env.DEMO_LOGIN = "true";
    expect(demoEnabled()).toBe(false);
    env.DEMO_PASSWORD = "x";
    expect(demoEnabled()).toBe(true);
    env.DEMO_LOGIN = "1";
    expect(demoEnabled()).toBe(false);
  });
  it("accepts every demo role but never admin or arbitrary roles", () => {
    for (const role of DEMO_ROLES) expect(parseDemoRole(role)).toBe(role);
    expect(DEMO_ROLES).toEqual(["citizen", "staff", "officer", "mp", "liaison", "moderator"]);
    for (const bad of ["admin", "regional_admin", "office_manager", "", null, undefined, "STAFF", "staff ", "toString", "__proto__"]) expect(parseDemoRole(bad)).toBeNull();
  });
  it("gives each role its own demo account, none of them an admin", () => {
    const emails = DEMO_ROLES.map((r) => DEMO_EMAILS[r]);
    expect(new Set(emails).size).toBe(DEMO_ROLES.length);
    for (const e of emails) { expect(e).toMatch(/^demo-[a-z]+@jonokotha\.test$/); expect(e).not.toContain("admin"); }
  });
  it("lands each role on the page it works on", () => {
    expect(demoLanding("citizen")).toBe("/report");
    expect(demoLanding("staff")).toBe("/office");
    expect(demoLanding("officer")).toBe("/office/mine");
    expect(demoLanding("mp")).toBe("/office");
    expect(demoLanding("liaison")).toBe("/office/agency");
    expect(demoLanding("moderator")).toBe("/admin/moderation");
  });
});
