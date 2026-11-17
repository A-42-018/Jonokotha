import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CommitmentsOffice from "@/components/office/ws/CommitmentsOffice";
import ProjectFeedback from "@/components/projects/ProjectFeedback";
import CommitmentDetail from "@/components/tracker/CommitmentDetail";
import CommitmentsList from "@/components/tracker/CommitmentsList";
import QueryProvider from "@/components/QueryProvider";
import { isLate, statusProblem, summary } from "@/lib/commitments-api";
import { moreNav } from "@/lib/nav-items";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const c = (over: object = {}) => ({ ref: "CM-1", constituency_key: "demo-1", title: "সেতু মেরামত", description: "ভাঙা সেতু", status: "in_progress", due_date: "2026-12-31", published_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-10T00:00:00Z", announcement_ref: "AN-1", project_ref: "PR-1", idea_ref: null, label: "office_commitment", ...over });

describe("tracker helpers (F7.7)", () => {
  it("late means still open after the due day (Dhaka); delivered or dropped never are", () => {
    const after = Date.parse("2027-01-01T00:00:00Z");
    expect(isLate({ status: "in_progress", due_date: "2026-12-31" }, after)).toBe(true);
    expect(isLate({ status: "planned", due_date: "2026-12-31" }, Date.parse("2026-12-31T10:00:00Z"))).toBe(false);
    expect(isLate({ status: "delivered", due_date: "2026-12-31" }, after)).toBe(false);
    expect(isLate({ status: "in_progress", due_date: null }, after)).toBe(false);
    expect(summary([{ status: "delivered" }, { status: "delayed" }, { status: "delivered" }])).toMatchObject({ delivered: 2, delayed: 1, dropped: 0 });
  });
  it("status rules match the server's", () => {
    expect(statusProblem("delayed", "short", "", "")).toBe("note");
    expect(statusProblem("dropped", "বাজেট নেই বলে বাদ", "", "")).toBeNull();
    expect(statusProblem("delivered", "", "", "")).toBe("evidence");
    expect(statusProblem("delivered", "", "http://x.test", "")).toBe("url");
    expect(statusProblem("delivered", "", "https://x.test/p", "")).toBeNull();
    expect(statusProblem("delivered", "", "", "ছবি তুলে রাখা হয়েছে")).toBeNull();
    expect(statusProblem("in_progress", "", "", "")).toBeNull();
  });
  it("the nav links appear only with their flags", () => {
    expect(moreNav({ commitments: false, priorities: false }).map((i) => i.href)).toEqual(["/polls", "/help", "/about", "/terms"]);
    expect(moreNav({ commitments: true, priorities: true }).map((i) => i.href)).toEqual(["/polls", "/commitments", "/priorities", "/help", "/about", "/terms"]);
  });
});

describe("commitments for citizens", () => {
  it("labels every commitment as the office's own, counts by status, filters, and marks a late one in words", async () => {
    stub({ "GET /commitments": () => json(200, { data: [c(), c({ ref: "CM-2", title: "বাতি", status: "delivered" })] }) });
    const u = userEvent.setup();
    render(<CommitmentsList constituency="demo-1" />);
    expect(await screen.findByText("সেতু মেরামত")).toBeInTheDocument();
    expect(screen.getAllByText("অফিসের প্রতিশ্রুতি")).toHaveLength(2);
    expect(screen.getByText(/নিজে যাচাই করে না/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /পূরণ হয়েছে/ }));
    expect(screen.queryByText("সেতু মেরামত")).toBeNull();
    expect(screen.getByText("বাতি")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "বিস্তারিত দেখুন" })[0]).toHaveAttribute("href", "/commitments/CM-2");
  });
  it("a server without the route, an empty list and an error each say so", async () => {
    stub({});
    const a = render(<CommitmentsList constituency="demo-1" />);
    expect(await screen.findByRole("heading", { name: "প্রতিশ্রুতির পাতা এখনো চালু হয়নি" })).toBeInTheDocument();
    a.unmount();
    stub({ "GET /commitments": () => json(200, { data: [] }) });
    const b = render(<CommitmentsList constituency="demo-1" />);
    expect(await screen.findByText("এখনো কোনো প্রতিশ্রুতি প্রকাশ হয়নি")).toBeInTheDocument();
    b.unmount();
    stub({ "GET /commitments": () => json(500, { code: "internal_error" }) });
    render(<CommitmentsList constituency="demo-1" />);
    expect(await screen.findByRole("alert", {}, { timeout: 9000 })).toBeInTheDocument();
  });
  it("detail shows links, the append-only history with reasons and a safe proof link; an unsafe link is dropped", async () => {
    stub({ "GET /commitments/CM-1": () => json(200, { data: c({ status: "delivered", history: [
      { from_status: null, to_status: "planned", note: null, evidence_url: null, evidence_text: null, created_at: "2026-11-01T00:00:00Z" },
      { from_status: "planned", to_status: "delayed", note: "বৃষ্টিতে কাজ বন্ধ ছিল", evidence_url: null, evidence_text: null, created_at: "2026-11-05T00:00:00Z" },
      { from_status: "delayed", to_status: "delivered", note: null, evidence_url: "https://x.example/p.pdf", evidence_text: "ছবি আছে", created_at: "2026-12-01T00:00:00Z" },
      { from_status: "delivered", to_status: "delivered", note: null, evidence_url: "javascript:alert(1)", evidence_text: null, created_at: "2026-12-02T00:00:00Z" },
    ] }) }) });
    render(<CommitmentDetail refId="CM-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "সেতু মেরামত" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "প্রকল্প: PR-1" })).toHaveAttribute("href", "/projects/PR-1");
    expect(screen.getByText("বৃষ্টিতে কাজ বন্ধ ছিল")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "প্রমাণের লিংক খুলুন" })).toHaveLength(1);
    expect(screen.getByText("প্রমাণ দেওয়া হয়নি।")).toBeInTheDocument();
  });
  it("a missing commitment is a not-found page", async () => {
    stub({});
    render(<CommitmentDetail refId="CM-9" />);
    expect(await screen.findByText("এই প্রতিশ্রুতি পাওয়া যায়নি")).toBeInTheDocument();
  });
});

describe("feedback after a project is finished", () => {
  const wrap = (ui: React.ReactNode) => <QueryProvider>{ui}</QueryProvider>;
  it("shows no average under 5 answers, needs a score, sends once", async () => {
    const calls = stub({
      "GET /projects/PR-1/feedback": () => json(200, { data: { feedback_count: 2, average_rating: null } }),
      "POST /projects/PR-1/feedback": () => json(201, { data: {} }),
    });
    const u = userEvent.setup();
    render(wrap(<ProjectFeedback refId="PR-1" signedIn loginHref="/login" />));
    expect(await screen.findByText(/কমপক্ষে ৫ জনের মতামত এলে/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "মতামত পাঠান" }));
    expect(await screen.findByText("একটি নম্বর বেছে নিন।")).toBeInTheDocument();
    await u.click(screen.getByRole("radio", { name: "৪ নম্বর" }));
    await u.click(screen.getByRole("button", { name: "মতামত পাঠান" }));
    await waitFor(() => expect(calls.find((x) => x.key === "POST /projects/PR-1/feedback")?.body).toEqual({ rating: 4 }));
    expect(await screen.findByText("ধন্যবাদ, মতামত পাঠানো হয়েছে।", { selector: "p[role=status]" })).toBeInTheDocument();
  });
  it("signed-out visitors get a link; a server without the route shows nothing", async () => {
    stub({ "GET /projects/PR-1/feedback": () => json(200, { data: { feedback_count: 9, average_rating: 4.26 } }) });
    const a = render(wrap(<ProjectFeedback refId="PR-1" signedIn={false} loginHref="/login?next=p" />));
    expect(await screen.findByText("গড় নম্বর: ৪.৩ (৯ জনের মতে)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "মতামত দিতে সাইন ইন করুন" })).toHaveAttribute("href", "/login?next=p");
    a.unmount();
    stub({});
    const b = render(wrap(<ProjectFeedback refId="PR-1" signedIn loginHref="/login" />));
    await waitFor(() => expect(b.container.querySelector("section")).toBeNull());
  });
});

describe("office commitments", () => {
  it("proof is needed to mark delivered, a reason to mark delayed, and each change asks first", async () => {
    const calls = stub({
      "GET /office/commitments": () => json(200, { data: [{ ref: "CM-1", title: "সেতু মেরামত", status: "in_progress", due_date: null, published_at: "2026-11-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z" }] }),
      "POST /office/commitments/CM-1/status": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<CommitmentsOffice constituency="demo-1" />);
    await u.click(await screen.findByRole("button", { name: "অবস্থা বদলান" }));
    const form = screen.getByLabelText("নতুন অবস্থা").closest("div")!.parentElement as HTMLElement;
    await u.selectOptions(screen.getByLabelText("নতুন অবস্থা"), "delivered");
    const go = within(form).getAllByRole("button", { name: "অবস্থা বদলান" }).at(-1) as HTMLElement;
    expect(go).toBeDisabled();
    await u.type(screen.getByLabelText(/প্রমাণের লিংক/), "https://x.example/p.pdf");
    expect(go).toBeEnabled();
    await u.click(go);
    expect(calls.some((x) => x.key.endsWith("/status"))).toBe(false);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "অবস্থা বদলান" }));
    await waitFor(() => expect(calls.find((x) => x.key === "POST /office/commitments/CM-1/status")?.body).toEqual({ status: "delivered", evidence_url: "https://x.example/p.pdf" }));
  });
  it("a commitment waiting for the MP shows the decision and creation sends the area", async () => {
    const calls = stub({
      "GET /office/commitments": () => json(200, { data: [{ ref: "CM-2", title: "বাতি", status: "pending_approval", due_date: null, published_at: null, created_at: "2026-11-01T00:00:00Z" }] }),
      "POST /office/commitments": () => json(201, { data: { ref: "CM-3", status: "draft" } }),
      "POST /office/commitments/CM-2/decision": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<CommitmentsOffice constituency="demo-1" />);
    await u.click(await screen.findByRole("button", { name: "প্রকাশের অনুমতি দিন" }));
    await waitFor(() => expect(calls.find((x) => x.key.endsWith("/decision"))?.body).toEqual({ decision: "approve" }));
    await u.type(screen.getByLabelText(/কী করা হবে/), "রাস্তায় বাতি বসানো");
    await u.click(screen.getByRole("button", { name: "রাখুন" }));
    await waitFor(() => expect(calls.find((x) => x.key === "POST /office/commitments")?.body).toEqual({ constituency: "demo-1", title: "রাস্তায় বাতি বসানো", publish: false }));
  });
});
