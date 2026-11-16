import { describe, expect, it } from "vitest";
import { can, mfaOk, mfaRequired, type Actor } from "@/lib/auth";

const A = "c-a", B = "c-b";
const actor = (over: Partial<Actor> = {}): Actor => ({ id: "u1", role: "staff", aal: "aal1", offices: [{ constituencyId: A, constituencyKey: "a", officeRole: "office_manager" }], ...over });

describe("can()", () => {
  it("denies signed-out users, citizens and moderators", () => {
    expect(can(null, "view", { constituencyId: A })).toBe(false);
    expect(can(actor({ role: "citizen", offices: [] }), "view", { constituencyId: A })).toBe(false);
    expect(can(actor({ role: "moderator", offices: [] }), "view", { constituencyId: A })).toBe(false);
  });
  it("scopes staff to their own constituency", () => {
    expect(can(actor(), "acknowledge", { constituencyId: A })).toBe(true);
    expect(can(actor(), "acknowledge", { constituencyId: B })).toBe(false);
    expect(can(actor(), "acknowledge", { constituencyId: null })).toBe(false);
  });
  it("limits case officers to assigned issues and to their granted actions", () => {
    const co = actor({ offices: [{ constituencyId: A, constituencyKey: "a", officeRole: "case_officer" }] });
    expect(can(co, "update", { constituencyId: A, assignedTo: "u1" })).toBe(true);
    expect(can(co, "update", { constituencyId: A, assignedTo: "someone-else" })).toBe(false);
    expect(can(co, "update", { constituencyId: A })).toBe(false);
    expect(can(co, "resolve", { constituencyId: A, assignedTo: "u1" })).toBe(false);
    expect(can(co, "forward", { constituencyId: A, assignedTo: "u1" })).toBe(false);
  });
  it("lets an MP view and see analytics but not change status", () => {
    const mp = actor({ offices: [{ constituencyId: A, constituencyKey: "a", officeRole: "mp" }] });
    expect(can(mp, "view", { constituencyId: A })).toBe(true);
    expect(can(mp, "resolve", { constituencyId: A })).toBe(false);
  });
  it("lets admin act anywhere", () => {
    expect(can(actor({ role: "admin", offices: [] }), "close", { constituencyId: B })).toBe(true);
  });
  it("applies MFA only to MP, moderator and admin, and only when enforced", () => {
    const mp = actor({ offices: [{ constituencyId: A, constituencyKey: "a", officeRole: "mp" }] });
    expect(mfaRequired(mp)).toBe(true);
    expect(mfaRequired(actor())).toBe(false);
    expect(mfaOk(mp, false)).toBe(true);
    expect(can(mp, "view", { constituencyId: A }, true)).toBe(false);
    expect(can({ ...mp, aal: "aal2" }, "view", { constituencyId: A }, true)).toBe(true);
    expect(can(actor(), "acknowledge", { constituencyId: A }, true)).toBe(true);
  });
});
