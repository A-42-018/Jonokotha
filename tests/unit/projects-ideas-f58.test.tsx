import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IdeaDetail from "@/components/ideas/IdeaDetail";
import ProjectDetail from "@/components/projects/ProjectDetail";
import ProjectsList from "@/components/projects/ProjectsList";
import { dict } from "@/lib/i18n";
import { milestoneSummary, type Milestone } from "@/lib/projects-api";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

const proj = (over: Record<string, unknown> = {}) => ({
  ref: "PR-1", constituency_key: "demo-1", title: "সেতু", description: "নদীর ওপর সেতু", status: "in_progress", budget_text: "৫ কোটি টাকা",
  start_date: "2026-01-01", expected_end_date: "2027-01-01", source_url: "https://lged.example/p1", source_checked_at: "2026-10-01", updated_at: "2026-10-10T00:00:00Z",
  milestones: [
    { id: "b", title: "ভিত", due_date: "2026-08-01", status: "delayed", note: "বৃষ্টির কারণে", completed_at: null },
    { id: "a", title: "জমি", due_date: "2026-03-01", status: "done", note: null, completed_at: "2026-03-05T00:00:00Z" },
    { id: "c", title: "ঢালাই", due_date: null, status: "pending", note: null, completed_at: null },
  ], ...over,
});

describe("project detail (F5.10)", () => {
  it("shows milestones in date order, progress, delay reason, budget as the office's wording with source and date", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: proj() })));
    render(<ProjectDetail refId="PR-1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "সেতু" })).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => within(li).getByRole("heading").textContent)).toEqual(["জমি", "ভিত", "ঢালাই"]);
    expect(screen.getByText(t.pdDelayReason)).toBeInTheDocument();
    expect(screen.getByText("বৃষ্টির কারণে")).toBeInTheDocument();
    expect(screen.getByText("৫ কোটি টাকা")).toBeInTheDocument();
    expect(screen.getByText(t.pdBudgetNote)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.pdSourceOpen })).toHaveAttribute("href", "https://lged.example/p1");
    expect(screen.getByText(/যাচাইয়ের তারিখ/)).toBeInTheDocument();
    // follow is not on the server: text only, no button
    expect(screen.getByText(t.pdFollowTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.pdFeedbackTitle)).toBeNull();
  });
  it("a delayed step without a note says the office has not explained; unsafe or missing source is not a link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: proj({ source_url: "javascript:x", source_checked_at: null, budget_text: null, milestones: [{ id: "z", title: "ধাপ", due_date: null, status: "delayed", note: null, completed_at: null }] }) })));
    render(<ProjectDetail refId="PR-1" />);
    expect(await screen.findByText(t.pdDelayNoNote)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.pdSourceOpen })).toBeNull();
    expect(screen.getByText(t.pdNoBudget)).toBeInTheDocument();
    expect(screen.getByText(t.pdUnchecked)).toBeInTheDocument();
  });
  it("a completed project shows the evidence and feedback gaps as text, not controls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: proj({ status: "completed", milestones: [] }) })));
    render(<ProjectDetail refId="PR-1" />);
    expect(await screen.findByText(t.pdEvidenceTitle)).toBeInTheDocument();
    expect(screen.getByText(t.pdFeedbackTitle)).toBeInTheDocument();
    expect(screen.getByText(t.pdMsEmpty)).toBeInTheDocument();
  });
  it("404 is not-found, other errors are an alert with retry, offline says so", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { code: "not_found" })));
    const { unmount } = render(<ProjectDetail refId="X" />);
    expect(await screen.findByText(t.pdNotFoundTitle)).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(<ProjectDetail refId="Y" />);
    expect(await screen.findByRole("alert", {}, { timeout: 8000 })).toHaveTextContent(t.pdOffline);
    expect(screen.getByRole("button", { name: t.pdRetry })).toBeInTheDocument();
  }, 20000);
  it("milestoneSummary counts only what the office marked", () => {
    const ms = [{ id: "1", status: "done" }, { id: "2", status: "delayed" }, { id: "3", status: "pending" }] as Milestone[];
    expect(milestoneSummary(ms)).toMatchObject({ total: 3, done: 1, delayed: 1 });
    expect(milestoneSummary([])).toMatchObject({ total: 0, done: 0 });
  });
  it("the list links each project to its detail page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: [proj({ milestones: undefined })] })));
    render(<ProjectsList constituency="demo-1" />);
    expect(await screen.findByRole("link", { name: t.pjOpen })).toHaveAttribute("href", "/projects/PR-1");
  });
});

describe("idea page (F5.8)", () => {
  it("opens one idea with its status explanation and the public reason; 404 is not-found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, { data: { ref: "ID-9", constituency_key: "demo-1", category: "roads", title: "গতিরোধক", body: "সমস্যা: ঝুঁকি", status: "declined", decision_note: "বাজেট নেই", created_at: "2026-11-10T06:00:00Z", support_count: 4 } })));
    const { unmount } = render(<IdeaDetail refId="ID-9" signedIn={false} />);
    expect(await screen.findByText("বাজেট নেই")).toBeInTheDocument();
    expect(screen.getByText(t.idHelp_not_planned)).toBeInTheDocument();
    expect(screen.getByText(t.idSub_not_planned)).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(404, { code: "not_found" })));
    render(<IdeaDetail refId="NOPE" signedIn={false} />);
    expect(await screen.findByText(t.idNotFoundTitle)).toBeInTheDocument();
  });
});
