import { describe, expect, it } from "vitest";
import { FROM_LEGACY, TO_LEGACY, TRANSITIONS, isAllowedTransition, requiredFields } from "@/lib/transitions";
import { ISSUE_STATUSES, type IssueStatus } from "@/lib/types";

/** The state machine written out independently of the table (masterplan §9), so a typo in the table is caught. */
const SPEC: Record<IssueStatus, IssueStatus[]> = {
  submitted: ["under_review", "acknowledged", "assigned", "needs_information", "referred_to_authority", "rejected", "duplicate", "out_of_jurisdiction"],
  under_review: ["acknowledged", "assigned", "needs_information", "referred_to_authority", "in_progress", "resolved", "rejected", "duplicate", "out_of_jurisdiction"],
  needs_information: ["under_review", "acknowledged", "assigned", "referred_to_authority", "closed", "rejected", "duplicate", "out_of_jurisdiction"],
  acknowledged: ["assigned", "needs_information", "referred_to_authority", "in_progress", "resolved", "rejected", "duplicate", "out_of_jurisdiction"],
  assigned: ["needs_information", "referred_to_authority", "in_progress", "resolved", "rejected", "duplicate", "out_of_jurisdiction"],
  referred_to_authority: ["assigned", "needs_information", "in_progress", "resolved"],
  in_progress: ["needs_information", "referred_to_authority", "resolved"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  rejected: ["reopened"],
  duplicate: ["reopened"],
  out_of_jurisdiction: ["referred_to_authority", "reopened"],
  reopened: ["under_review", "acknowledged", "assigned", "needs_information", "referred_to_authority", "in_progress", "resolved", "rejected", "duplicate", "out_of_jurisdiction"],
};

describe("issue state machine table", () => {
  it("has the 13 statuses of masterplan §9", () => {
    expect([...ISSUE_STATUSES].sort()).toEqual(["acknowledged", "assigned", "closed", "duplicate", "in_progress", "needs_information", "out_of_jurisdiction",
      "referred_to_authority", "reopened", "rejected", "resolved", "submitted", "under_review"].sort());
  });

  // Every one of the 13 x 13 = 169 pairs is either allowed or forbidden exactly as the spec says.
  for (const from of ISSUE_STATUSES) {
    for (const to of ISSUE_STATUSES) {
      const allowed = SPEC[from].includes(to);
      it(`${from} -> ${to} is ${allowed ? "allowed" : "forbidden"}`, () => {
        expect(isAllowedTransition(from, to)).toBe(allowed);
      });
    }
  }

  it("never enters 'submitted' (system generated) and never loops to itself", () => {
    expect(TRANSITIONS.some((t) => t.to === "submitted")).toBe(false);
    expect(TRANSITIONS.some((t) => t.from === t.to)).toBe(false);
  });

  it("every status is reachable from 'submitted'", () => {
    const seen = new Set<IssueStatus>(["submitted"]);
    for (let grew = true; grew;) {
      grew = false;
      for (const t of TRANSITIONS) if (seen.has(t.from) && !seen.has(t.to)) { seen.add(t.to); grew = true; }
    }
    expect([...seen].sort()).toEqual([...ISSUE_STATUSES].sort());
  });

  it("has no duplicate rows and office rows always name an action", () => {
    const keys = TRANSITIONS.map((t) => `${t.from}|${t.to}|${t.actor}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TRANSITIONS) expect(t.actor === "office").toBe(!!t.action);
  });

  it("applies the §9 rules for required fields", () => {
    const req = (f: IssueStatus, t: IssueStatus, a: "office" | "owner" | "system" = "office") => requiredFields(f, t, a);
    expect(req("acknowledged", "referred_to_authority")).toEqual(["destination", "forwarding_details"]);
    expect(req("acknowledged", "in_progress")).toEqual(["responsible_party"]);
    expect(req("in_progress", "resolved")).toEqual(["resolution_note"]);
    expect(req("acknowledged", "rejected")).toEqual(["reason", "appeal_route"]);
    expect(req("acknowledged", "duplicate")).toEqual(["master_issue"]);
    expect(req("acknowledged", "out_of_jurisdiction")).toEqual(["reason"]);
    expect(req("closed", "reopened")).toEqual(["reason"]);
    expect(req("closed", "reopened", "owner")).toEqual(["reason"]);
    expect(req("needs_information", "under_review", "owner")).toEqual(["message"]);
    expect(req("acknowledged", "assigned")).toEqual(["assignee"]);
    expect(req("submitted", "closed")).toBeNull();
  });

  it("only the reporter or the office can reopen, and an appeal needs a reason", () => {
    const owners = TRANSITIONS.filter((t) => t.actor === "owner").map((t) => `${t.from}>${t.to}`).sort();
    expect(owners).toEqual(["closed>reopened", "needs_information>under_review", "rejected>reopened", "resolved>reopened"]);
  });

  it("maps every status onto the legacy 4-label set and back for the legacy ones", () => {
    for (const s of ISSUE_STATUSES) expect(["received", "acknowledged", "referred", "resolved"]).toContain(TO_LEGACY[s]);
    for (const [legacy, detail] of Object.entries(FROM_LEGACY)) expect(TO_LEGACY[detail]).toBe(legacy);
  });
});
