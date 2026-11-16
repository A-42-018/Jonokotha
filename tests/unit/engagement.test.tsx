import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import IdeaCard, { SUPPORT_KEY } from "@/components/ideas/IdeaCard";
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
  it("signed out: shows the sign-in prompt instead of a support button", () => {
    render(<ToastProvider><IdeaCard idea={idea} signedIn={false} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: t.idSupport })).toBeNull();
    expect(screen.getByRole("link", { name: t.idSupportNeedsSignIn })).toBeInTheDocument();
  });
  it("signed in: one support per idea, toggling adds then removes it", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><IdeaCard idea={idea} signedIn /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: t.idSupport }));
    expect(JSON.parse(localStorage.getItem(SUPPORT_KEY)!)).toEqual([idea.id]);
    expect(screen.getByText("৪৯ জন চান")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.idSupported }));
    expect(JSON.parse(localStorage.getItem(SUPPORT_KEY)!)).toEqual([]);
  });
});
