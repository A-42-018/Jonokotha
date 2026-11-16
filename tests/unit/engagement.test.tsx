import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import QueryProvider from "@/components/QueryProvider";
import IdeaCard from "@/components/ideas/IdeaCard";
import IssueActions from "@/components/issue/IssueActions";
import ResolutionFeedback from "@/components/issue/ResolutionFeedback";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { SAMPLE_IDEAS } from "@/lib/sample";

const t = dict.bn;

beforeAll(() => {
  // jsdom has no <dialog> modal support.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe("ResolutionFeedback", () => {
  const wrap = (ref: string) => render(<QueryProvider><ToastProvider><ResolutionFeedback refId={ref} /></ToastProvider></QueryProvider>);
  it("needs a rating before sending; then POSTs the feedback and shows it saved", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async () => json(201, { data: {} }));
    vi.stubGlobal("fetch", f);
    wrap("JK-1");
    await user.click(screen.getByRole("button", { name: t.enRateSave }));
    expect(await screen.findByText(t.enRateRequired)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole("radio")[3]);
    await user.click(screen.getByRole("button", { name: t.enRateSave }));
    expect(await screen.findByRole("status")).toHaveTextContent("৪/৫");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/issues/JK-1/feedback");
    expect(JSON.parse(init.body as string)).toEqual({ rating: 4 });
    vi.unstubAllGlobals();
  });

  it("an already-sent rating (409 conflict) is shown as saved, not as an error", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => json(409, { code: "conflict" })));
    wrap("JK-3");
    await user.click(screen.getAllByRole("radio")[1]);
    await user.click(screen.getByRole("button", { name: t.enRateSave }));
    expect(await screen.findByRole("status")).toHaveTextContent("২/৫");
    vi.unstubAllGlobals();
  });

  it("requires a reason to reopen, then POSTs it; a closed window shows a clear message", async () => {
    const user = userEvent.setup();
    const f = vi.fn().mockResolvedValueOnce(json(409, { code: "rule_not_met" })).mockResolvedValueOnce(json(201, { data: {} }));
    vi.stubGlobal("fetch", f);
    wrap("JK-2");
    await user.click(screen.getByRole("button", { name: t.enReopen }));
    await user.click(screen.getByRole("button", { name: t.enSubmitReopen }));
    expect(await screen.findByText(t.enReasonRequired)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(t.enReasonLabel), "এখনও পানি জমে আছে");
    await user.click(screen.getByRole("button", { name: t.enSubmitReopen }));
    expect(await screen.findByText(t.enReopenWindow)).toBeInTheDocument();
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("/api/v1/issues/JK-2/reopen");
    await user.click(screen.getByRole("button", { name: t.enSubmitReopen }));
    expect((await screen.findAllByRole("status")).some((e) => e.textContent?.includes(t.enReopen))).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("IssueActions", () => {
  const wrap = (signedIn: boolean) => render(<ToastProvider><IssueActions refId="JK-5" title="ড্রেন" signedIn={signedIn} /></ToastProvider>);
  const router = (over: Record<string, () => Response> = {}) => vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    if (over[key]) return over[key]();
    if (key === "GET /api/v1/issues/JK-5") return json(200, { data: { affected_count: 4 } });
    if (key === "GET /api/v1/me/follows") return json(200, { data: [] });
    return json(200, { data: {} });
  });
  it("signed out: me-too and follow ask to sign in and call nothing but the public count", async () => {
    const f = router();
    vi.stubGlobal("fetch", f);
    wrap(false);
    expect(screen.getAllByRole("link", { name: new RegExp(t.enSignIn) }).length).toBe(2);
    expect(await screen.findByText("৪ জন একই সমস্যায় আছেন")).toBeInTheDocument();
    expect(f.mock.calls.some((c) => String((c as unknown[])[0]).includes("/me/follows"))).toBe(false);
    vi.unstubAllGlobals();
  });
  it("me too posts to /affected and shows the server's new count; the reporter gets a clear message", async () => {
    const user = userEvent.setup();
    let n = 4;
    const f = router({ "POST /api/v1/issues/JK-5/affected": () => { n = 5; return json(200, { data: { affected_count: 5 } }); }, "GET /api/v1/issues/JK-5": () => json(200, { data: { affected_count: n } }) });
    vi.stubGlobal("fetch", f);
    wrap(true);
    await user.click(await screen.findByRole("button", { name: t.enMeToo }));
    expect(await screen.findByText("৫ জন একই সমস্যায় আছেন")).toBeInTheDocument();
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", router({ "POST /api/v1/issues/JK-5/affected": () => json(409, { code: "rule_not_met" }) }));
    localStorage.clear();
    document.body.innerHTML = "";
    wrap(true);
    await user.click(await screen.findByRole("button", { name: t.enMeToo }));
    expect(await screen.findByText(t.enMeTooOwn)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("follow posts to /me/follows with the issue ref", async () => {
    const user = userEvent.setup();
    const f = router({ "POST /api/v1/me/follows": () => json(201, { data: { id: "f1", type: "issue", target: "JK-5", created_at: "" } }) });
    vi.stubGlobal("fetch", f);
    wrap(true);
    await user.click(await screen.findByRole("button", { name: t.isFollow }));
    await vi.waitFor(() => expect(f.mock.calls.some((c) => (c as unknown as [string, RequestInit])[1]?.method === "POST" && String((c as unknown as [string])[0]) === "/api/v1/me/follows")).toBe(true));
    const call = f.mock.calls.find((c) => String((c as unknown as [string])[0]) === "/api/v1/me/follows" && (c as unknown as [string, RequestInit])[1]?.method === "POST") as unknown as [string, RequestInit];
    expect(JSON.parse(call[1].body as string)).toEqual({ type: "issue", target: "JK-5" });
    vi.unstubAllGlobals();
  });
});

describe("IdeaCard support", () => {
  const idea = SAMPLE_IDEAS[0];
  const wrap = (signedIn: boolean) => render(<QueryProvider><ToastProvider><IdeaCard idea={idea} signedIn={signedIn} /></ToastProvider></QueryProvider>);
  it("signed out: shows the sign-in prompt instead of a support button", () => {
    wrap(false);
    expect(screen.queryByRole("button", { name: t.idSupport })).toBeNull();
    expect(screen.getByRole("link", { name: t.idSupportNeedsSignIn })).toBeInTheDocument();
  });
  it("signed in: support goes to the API, the server's count is shown, and withdrawing calls DELETE", async () => {
    const user = userEvent.setup();
    let n = idea.supports;
    const f = vi.fn(async (_url: string, init?: RequestInit) => {
      n += init?.method === "DELETE" ? -1 : 1;
      return new Response(JSON.stringify({ data: { ref: idea.id, supported: init?.method !== "DELETE", support_count: n } }), { status: 200 });
    });
    vi.stubGlobal("fetch", f);
    wrap(true);
    await user.click(screen.getByRole("button", { name: t.idSupport }));
    expect(await screen.findByText("৪৯ জন চান")).toBeInTheDocument();
    expect(f.mock.calls[0][0]).toBe(`/api/v1/ideas/${idea.id}/support`);
    expect(f.mock.calls[0][1]?.method).toBe("POST");
    await user.click(await screen.findByRole("button", { name: t.idSupported }));
    expect(await screen.findByRole("button", { name: t.idSupport })).toBeInTheDocument();
    expect(f.mock.calls[1][1]?.method).toBe("DELETE");
    vi.unstubAllGlobals();
  });
  it("shows a clear message when you support your own idea (403)", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: "forbidden" }), { status: 403 })));
    wrap(true);
    await user.click(screen.getByRole("button", { name: t.idSupport }));
    expect(await screen.findByText(t.idSupportOwn)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
