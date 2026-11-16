import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import ReviewQueue from "@/components/admin/ReviewQueue";
import { ToastProvider } from "@/components/ui/Toast";
import { SAMPLE_REVIEW } from "@/lib/admin";
import { dict } from "@/lib/i18n";

const t = dict.bn;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("ReviewQueue", () => {
  it("refuses a decision without a reason, then logs it and removes the item from the queue", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ReviewQueue kind="moderation" items={SAMPLE_REVIEW} /></ToastProvider>);
    expect(screen.getByText(t.adAiNeverDecides)).toBeInTheDocument();
    const first = screen.getAllByRole("article")[0];
    await user.click(within(first).getByRole("button", { name: t.adActHide }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    await user.click(within(dialog).getByRole("button", { name: t.adConfirm, hidden: true }));
    expect(await within(dialog).findByText(t.adReasonRequired, {}, { timeout: 1000 })).toBeInTheDocument();
    expect(localStorage.getItem("jonokotha:admin-audit:v1")).toBeNull();
    await user.type(within(dialog).getByLabelText(t.adReason), "ফোন নম্বর আছে, তাই লুকানো হলো");
    await user.click(within(dialog).getByRole("button", { name: t.adConfirm, hidden: true }));
    const rows = JSON.parse(localStorage.getItem("jonokotha:admin-audit:v1")!);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("hide");
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("offers only approve and reject on verification items", () => {
    render(<ToastProvider><ReviewQueue kind="verification" items={SAMPLE_REVIEW} /></ToastProvider>);
    expect(screen.queryByRole("button", { name: t.adActHide })).toBeNull();
    expect(screen.getAllByRole("button", { name: t.adActApprove }).length).toBe(2);
  });
});
