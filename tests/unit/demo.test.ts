import { afterEach, describe, expect, it } from "vitest";
import { demoEnabled, demoLanding, parseDemoRole } from "@/lib/demo";

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
  it("accepts only citizen and staff (never admin or arbitrary roles)", () => {
    expect(parseDemoRole("citizen")).toBe("citizen");
    expect(parseDemoRole("staff")).toBe("staff");
    for (const bad of ["admin", "", null, undefined, "STAFF", "staff "]) expect(parseDemoRole(bad)).toBeNull();
  });
  it("lands staff on the office queue and citizens on the report form", () => {
    expect(demoLanding("staff")).toBe("/office");
    expect(demoLanding("citizen")).toBe("/report");
  });
});
