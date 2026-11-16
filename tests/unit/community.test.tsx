import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import PublicQuestions from "@/components/ask/PublicQuestions";
import IdeaComments from "@/components/ideas/IdeaComments";
import ReportContent from "@/components/ReportContent";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { validComment } from "@/lib/comments-api";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const wrap = (ui: React.ReactNode) => render(<ToastProvider>{ui}</ToastProvider>);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("ReportContent", () => {
  it("sends signed-out visitors to sign in and calls nothing", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    wrap(<ReportContent type="idea" refId="ID-1" signedIn={false} next="/ideas" />);
    expect(screen.getByRole("link", { name: t.rcSignIn })).toHaveAttribute("href", "/login?need=1&next=%2Fideas");
    expect(f).not.toHaveBeenCalled();
  });

  it("needs a reason, then reports the right type and reference to moderation", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return json(201, { data: {} }); }));
    wrap(<ReportContent type="idea" refId="ID-1" signedIn next="/ideas" />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(t.rcIdea) }));
    await userEvent.click(screen.getByRole("button", { name: t.isReportSend }));
    expect(await screen.findByText(t.isReasonRequired)).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
    await userEvent.click(screen.getByLabelText(t.isReasonAbuse));
    await userEvent.type(screen.getByLabelText(new RegExp(t.isReasonNote)), "অপমানজনক");
    await userEvent.click(screen.getByRole("button", { name: t.isReportSend }));
    await waitFor(() => expect(bodies).toEqual([{ type: "idea", ref: "ID-1", reason: "abuse", details: "অপমানজনক" }]));
    expect(await screen.findByText(t.rcThanks)).toBeInTheDocument();
  });

  it("says so when the person already reported it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(409, { code: "conflict" })));
    wrap(<ReportContent type="question" refId="Q-1" signedIn next="/ask" />);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(t.rcQuestion) }));
    await userEvent.click(screen.getByLabelText(t.isReasonSpam));
    await userEvent.click(screen.getByRole("button", { name: t.isReportSend }));
    expect(await screen.findByText(t.rcAlready)).toBeInTheDocument();
  });
});

describe("IdeaComments", () => {
  const C = (over: object) => ({ id: "c1", body: "ভালো প্রস্তাব", status: "published", created_at: "2026-11-10T06:00:00Z", mine: false, ...over });

  it("loads nothing until opened", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    wrap(<IdeaComments refId="ID-1" signedIn />);
    expect(f).not.toHaveBeenCalled();
  });

  it("shows an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [], page: { next_cursor: null, limit: 20 } })));
    wrap(<IdeaComments refId="ID-1" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: t.cmShow }));
    expect(await screen.findByText(t.cmEmptyTitle)).toBeInTheDocument();
  });

  it("shows published, waiting-for-review and removed comments differently", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [
      C({ id: "a" }),
      C({ id: "b", body: "আমার নতুন মন্তব্য", status: "pending_review", mine: true }),
      C({ id: "c", body: "গোপন লেখা", status: "hidden" }),
    ], page: { next_cursor: null, limit: 20 } })));
    wrap(<IdeaComments refId="ID-1" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: t.cmShow }));
    expect(await screen.findByText("ভালো প্রস্তাব")).toBeInTheDocument();
    expect(screen.getByText(t.cmPending)).toBeInTheDocument();
    expect(within(screen.getByText(t.cmPending).closest("article")!).getByText(t.cmMine)).toBeInTheDocument();
    expect(screen.getByText(t.cmHidden)).toBeInTheDocument();
    expect(screen.queryByText("গোপন লেখা")).not.toBeInTheDocument(); // a removed comment's text is never shown
  });

  it("explains when the server has no comments route, instead of showing an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>not found</html>", { status: 404 })));
    wrap(<IdeaComments refId="ID-1" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: t.cmShow }));
    expect(await screen.findByText(t.cmUnavailable)).toBeInTheDocument();
  });

  it("shows an error with retry for other failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { code: "forbidden" })));
    wrap(<IdeaComments refId="ID-1" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: t.cmShow }));
    expect(await screen.findByText(t.cmLoadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.cmRetry })).toBeInTheDocument();
  });

  it("refuses a very short comment, then posts one and says it waits for a moderator", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") { posts.push(JSON.parse(String(init.body))); return json(201, { data: C({ id: "n", status: "pending_review", mine: true }) }); }
      return json(200, { data: [], page: { next_cursor: null, limit: 20 } });
    }));
    wrap(<IdeaComments refId="ID-1" signedIn />);
    await userEvent.click(screen.getByRole("button", { name: t.cmShow }));
    const box = await screen.findByLabelText(t.cmLabel);
    await userEvent.type(box, "ক");
    await userEvent.click(screen.getByRole("button", { name: t.cmSend }));
    expect(await screen.findByText(t.cmTooShort)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
    await userEvent.type(box, "ভালো একটি প্রস্তাব");
    await userEvent.click(screen.getByRole("button", { name: t.cmSend }));
    await waitFor(() => expect(posts).toEqual([{ body: "কভালো একটি প্রস্তাব" }]));
    expect(await screen.findByText(t.cmSent)).toBeInTheDocument();
  });

  it("asks signed-out visitors to sign in instead of showing the form", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [], page: { next_cursor: null, limit: 20 } })));
    wrap(<IdeaComments refId="ID-1" signedIn={false} />);
    await userEvent.click(screen.getByRole("button", { name: t.cmShow }));
    expect(await screen.findByRole("link", { name: t.cmSignIn })).toBeInTheDocument();
    expect(screen.queryByLabelText(t.cmLabel)).not.toBeInTheDocument();
  });

  it("validates length", () => {
    expect(validComment("  ab ")).toBe(false);
    expect(validComment("abc")).toBe(true);
    expect(validComment("x".repeat(1001))).toBe(false);
  });
});

describe("PublicQuestions", () => {
  const Q = (over: object) => ({ ref: "Q-1", constituency_key: "demo-1", title: "রাস্তা কবে হবে?", body: "বাজারের রাস্তা নিয়ে", status: "open", created_at: "2026-11-10T06:00:00Z", last_message_at: "2026-11-10T06:00:00Z", message_count: 0, ...over });

  it("lists public questions, each with its own report button", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [Q({}), Q({ ref: "Q-2", title: "বাতি কবে?", status: "answered" })], page: { next_cursor: null, limit: 10 } })));
    wrap(<PublicQuestions constituency="demo-1" signedIn />);
    const first = (await screen.findByText("রাস্তা কবে হবে?")).closest("article")!;
    expect(within(first).getByText(t.pqWaiting)).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: new RegExp(t.rcButton) })).toBeInTheDocument();
    expect(screen.getByText(t.pqAnswered)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: new RegExp(t.rcButton) })).toHaveLength(2);
  });

  it("shows an empty state and an error state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [], page: { next_cursor: null, limit: 10 } })));
    const { unmount } = wrap(<PublicQuestions constituency="demo-1" signedIn={false} />);
    expect(await screen.findByText(t.pqEmptyTitle)).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { code: "forbidden" })));
    wrap(<PublicQuestions constituency="demo-1" signedIn={false} />);
    expect(await screen.findByText(t.pqLoadError)).toBeInTheDocument();
  });
});
