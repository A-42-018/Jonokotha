import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import QueryProvider from "@/components/QueryProvider";
import IdeaCard from "@/components/ideas/IdeaCard";
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

describe("ResolutionFeedback", () => {
  it("needs a rating before saving, then shows the saved rating", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ResolutionFeedback refId="JK-1" /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: t.enRateSave }));
    expect(await screen.findByText(t.enRateRequired)).toBeInTheDocument();
    await user.click(screen.getAllByRole("radio")[3]);
    await user.click(screen.getByRole("button", { name: t.enRateSave }));
    expect(await screen.findByRole("status")).toHaveTextContent("৪/৫");
    expect(JSON.parse(localStorage.getItem("jonokotha:feedback:v1")!)["JK-1"].rating).toBe(4);
  });

  it("requires a reason to reopen", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ResolutionFeedback refId="JK-2" /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: t.enReopen }));
    await user.click(screen.getByRole("button", { name: t.enSubmitReopen }));
    expect(await screen.findByText(t.enReasonRequired)).toBeInTheDocument();
    expect(localStorage.getItem("jonokotha:feedback:v1")).toBeNull();
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
