import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import KpiPanel from "@/components/admin/KpiPanel";
import ModerationQueue from "@/components/admin/ModerationQueue";
import VerifyForm from "@/components/admin/VerifyForm";
import { ToastProvider } from "@/components/ui/Toast";
import { actionsFor, kpiValue, UUID_RE, type QueueItem } from "@/lib/admin-api";
import { dict } from "@/lib/i18n";

const t = dict.bn;
type Call = [string, RequestInit | undefined];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const calls = (f: ReturnType<typeof vi.fn>) => f.mock.calls as unknown as Call[];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

const report: QueueItem = { kind: "report", target_type: "idea", target_ref: "ID-1", excerpt: "আপত্তিকর লেখা", reasons: ["abuse", "spam"], report_count: 3, oldest: "2026-11-10T06:00:00Z" };
const review: QueueItem = { kind: "review", target_type: "question", target_ref: "Q-7", excerpt: "জনসমক্ষে প্রশ্ন", reasons: [], report_count: 0, oldest: "2026-11-11T06:00:00Z" };

describe("admin helpers", () => {
  it("offers hide or dismiss for reports and publish or reject for waiting items", () => {
    expect(actionsFor("report")).toEqual(["dismiss", "hide"]);
    expect(actionsFor("review")).toEqual(["publish", "reject"]);
  });
  it("hides a KPI whose group is too small instead of showing zero; delivery uses its share", () => {
    expect(kpiValue({ value: 0, suppressed: true, definition: "d" })).toBeNull();
    expect(kpiValue({ value: 4, definition: "d" })).toBe(4);
    expect(kpiValue({ sent_pct: 97.5, definition: "d" })).toBe(97.5);
    expect(UUID_RE.test("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(UUID_RE.test("rep-demo-1")).toBe(false);
  });
});

describe("ModerationQueue", () => {
  it("lists the server queue, refuses a decision without a reason, then sends the reason to the right endpoint", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (_u: string, init?: RequestInit) => (init?.method === "POST" ? json(200, { data: {} }) : json(200, { data: [report, review] })));
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><ModerationQueue /></ToastProvider>);
    expect(await screen.findByText("আপত্তিকর লেখা")).toBeInTheDocument();
    expect(screen.getByText(t.adRC_abuse)).toBeInTheDocument();
    expect(screen.getByText(t.adAiNeverDecides)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: t.adActHide }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    await user.click(within(dialog).getByRole("button", { name: t.adConfirm, hidden: true }));
    expect(within(dialog).getByText(/অন্তত ১০ অক্ষর/)).toBeInTheDocument();
    expect(calls(f).some((x) => x[1]?.method === "POST")).toBe(false);
    await user.type(within(dialog).getByLabelText(t.adReason), "এতে অন্যের ব্যক্তিগত তথ্য আছে");
    await user.click(within(dialog).getByRole("button", { name: t.adConfirm, hidden: true }));
    await vi.waitFor(() => expect(calls(f).some((x) => x[1]?.method === "POST")).toBe(true));
    const post = calls(f).find((x) => x[1]?.method === "POST")!;
    expect(post[0]).toBe("/api/v1/admin/moderation/items");
    expect(JSON.parse(post[1]!.body as string)).toEqual({ type: "idea", ref: "ID-1", action: "hide", reason: "এতে অন্যের ব্যক্তিগত তথ্য আছে" });
    vi.unstubAllGlobals();
  });

  it("a waiting question goes to the review endpoint", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (_u: string, init?: RequestInit) => (init?.method === "POST" ? json(200, { data: {} }) : json(200, { data: [review] })));
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><ModerationQueue /></ToastProvider>);
    await user.click(await screen.findByRole("button", { name: t.adActPublish }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    await user.type(within(dialog).getByLabelText(t.adReason), "ভদ্র ও প্রাসঙ্গিক প্রশ্ন");
    await user.click(within(dialog).getByRole("button", { name: t.adConfirm, hidden: true }));
    await vi.waitFor(() => expect(calls(f).some((x) => x[0] === "/api/v1/admin/moderation/review")).toBe(true));
    expect(JSON.parse(calls(f).find((x) => x[0].endsWith("/review"))![1]!.body as string)).toMatchObject({ type: "question", ref: "Q-7", action: "publish" });
    vi.unstubAllGlobals();
  });

  it("shows a clear message when the account is not allowed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { code: "forbidden" })));
    render(<ToastProvider><ModerationQueue /></ToastProvider>);
    expect(await screen.findByText(t.ofToastForbidden)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe("VerifyForm", () => {
  it("needs a real id and, to verify, a source link; then posts to the representative's verify route", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async () => json(200, { data: {} }));
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><VerifyForm /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: t.adVfSubmit }));
    expect(screen.getByText(t.adVfBadId)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(t.adVfId), "123e4567-e89b-42d3-a456-426614174000");
    await user.click(screen.getByRole("button", { name: t.adVfSubmit }));
    expect(screen.getByText(t.adVfNeedSource)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.adVfSource), "https://example.gov.bd/mp/1");
    await user.click(screen.getByRole("button", { name: t.adVfSubmit }));
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    const [url, init] = (f.mock.calls as unknown as Call[])[0];
    expect(url).toBe("/api/v1/admin/representatives/123e4567-e89b-42d3-a456-426614174000/verify");
    expect(JSON.parse(init!.body as string)).toEqual({ status: "verified", source_url: "https://example.gov.bd/mp/1" });
    vi.unstubAllGlobals();
  });
});

describe("KpiPanel", () => {
  it("shows each metric with its definition, and hides a suppressed one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: { period_days: 30, generated_at: "2026-11-16T00:00:00Z", min_group_size: 5, metrics: {
      new_accounts: { value: 12, definition: "Active accounts created in the period" },
      abuse_report_rate_pct: { value: null, suppressed: true, definition: "Reports per 100 issues" },
    } } })));
    render(<ToastProvider><KpiPanel /></ToastProvider>);
    expect(await screen.findByText("Active accounts created in the period")).toBeInTheDocument();
    expect(screen.getByText("১২")).toBeInTheDocument();
    expect(screen.getByText(t.adKpiHidden)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
