import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReferralStatus from "@/components/issue/ReferralStatus";
import { hasReferralStory, referralStages } from "@/lib/referral";
import { dict } from "@/lib/i18n";

const tl = (...s: ("received" | "acknowledged" | "referred" | "resolved")[]) => s.map((status) => ({ status }));
const row = (stage: string) => document.querySelector(`[data-stage="${stage}"]`) as HTMLElement;

describe("referralStages", () => {
  it("says nothing until the office has the report", () => {
    expect(hasReferralStory(referralStages(tl("received")))).toBe(false);
  });
  it("received is done once acknowledged; forwarded and registered are not", () => {
    expect(referralStages(tl("received", "acknowledged"))).toEqual({ received: "done", forwarded: "not_yet", registered: "not_yet" });
  });
  it("forwarded never implies registered: it says not confirmed", () => {
    expect(referralStages(tl("received", "acknowledged", "referred"))).toEqual({ received: "done", forwarded: "done", registered: "unconfirmed" });
  });
  it("an office-typed reference does not make it registered", () => {
    const s = referralStages(tl("referred", "resolved"), { agency_name: "A", office_reference: "REF-1", forwarded_at: null });
    expect(s.registered).toBe("unconfirmed");
  });
  it("registered is done only with a proof record from the server", () => {
    const s = referralStages(tl("referred"), { agency_name: "A", office_reference: null, forwarded_at: null, registered: { at: null, proof_url: null } });
    expect(s.registered).toBe("done");
  });
  it("a resolved issue that was never forwarded is not shown as forwarded", () => {
    expect(referralStages(tl("received", "acknowledged", "resolved")).forwarded).toBe("not_yet");
  });
});

describe("ReferralStatus", () => {
  it("renders nothing for a report the office has not received", () => {
    const { container } = render(<ReferralStatus timeline={tl("received")} t={dict.bn} lang="bn" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the three steps in Bangla, with registered marked not confirmed after forwarding", () => {
    render(<ReferralStatus timeline={tl("received", "acknowledged", "referred")} t={dict.bn} lang="bn" />);
    expect(screen.getByRole("heading", { name: dict.bn.rfTitle })).toBeInTheDocument();
    expect(within(row("received")).getByText(dict.bn.rfDone)).toBeInTheDocument();
    expect(within(row("forwarded")).getByText(dict.bn.rfDone)).toBeInTheDocument();
    expect(within(row("registered")).getByText(dict.bn.rfUnconfirmed)).toBeInTheDocument();
    expect(screen.getByText(dict.bn.rfRegisteredNone)).toBeInTheDocument();
    expect(screen.getByText(dict.bn.rfNotShown)).toBeInTheDocument();
  });

  it("shows the destination, the date and an office reference labelled as the office's own", () => {
    render(<ReferralStatus timeline={tl("received", "acknowledged", "referred")} t={dict.en} lang="en"
      referral={{ agency_name: "Roads Department", office_reference: "RD-77", forwarded_at: "2026-11-10T05:00:00Z" }} />);
    expect(screen.getByText("Roads Department")).toBeInTheDocument();
    expect(screen.getByText("RD-77")).toBeInTheDocument();
    expect(screen.getByText(dict.en.rfOfficeRefNote)).toBeInTheDocument();
    expect(within(row("registered")).getByText(dict.en.rfUnconfirmed)).toBeInTheDocument();
  });

  it("marks registered done only with proof, and offers the proof link only when it is a safe URL", () => {
    const { rerender } = render(<ReferralStatus timeline={tl("referred")} t={dict.en} lang="en"
      referral={{ agency_name: "A", office_reference: null, forwarded_at: null, registered: { at: null, proof_url: "https://agency.example/ref/1" } }} />);
    expect(within(row("registered")).getByText(dict.en.rfDone)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: dict.en.rfProofLink })).toHaveAttribute("href", "https://agency.example/ref/1");
    rerender(<ReferralStatus timeline={tl("referred")} t={dict.en} lang="en"
      referral={{ agency_name: "A", office_reference: null, forwarded_at: null, registered: { at: null, proof_url: "javascript:alert(1)" } }} />);
    expect(screen.queryByRole("link", { name: dict.en.rfProofLink })).toBeNull();
  });

  it("staff see the reminder not to promise registration", () => {
    render(<ReferralStatus timeline={tl("referred")} t={dict.en} lang="en" staff />);
    expect(screen.getByText(dict.en.rfStaffNote)).toBeInTheDocument();
    expect(screen.queryByText(dict.en.rfRegisteredNone)).toBeNull();
  });
});

describe("IssueView", () => {
  it("shows the referral steps on a forwarded issue and never the word registered as done", async () => {
    const { default: IssueView } = await import("@/components/issue/IssueView");
    const c = { ref: "JK-1", title: "T", category: "roads", description: "D", area: "A", constituencyId: "demo-1", status: "referred", createdAt: "2026-11-01T00:00:00Z",
      timeline: [{ status: "received", at: "2026-11-01T00:00:00Z" }, { status: "referred", at: "2026-11-02T00:00:00Z" }], ai: { summary: "", similarRefs: [], agencyId: "", confidence: 0 } } as unknown as Parameters<typeof IssueView>[0]["c"];
    render(<IssueView c={c} t={dict.en} lang="en" />);
    expect(screen.getByRole("heading", { name: dict.en.rfTitle })).toBeInTheDocument();
    expect(within(row("registered")).getByText(dict.en.rfUnconfirmed)).toBeInTheDocument();
  });
});
