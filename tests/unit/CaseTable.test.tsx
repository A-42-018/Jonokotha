import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import CaseTable, { ASSIGN_KEY } from "@/components/office/CaseTable";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";

const t = dict.bn;
const mk = (ref: string, title: string): CaseRecord => ({ ref, title, category: "roads", description: "d", area: "ক", constituencyId: "demo-1", status: "received", createdAt: "2026-11-01T00:00:00Z", timeline: [], ai: { summary: "", similarRefs: [], agencyId: "a", confidence: 0.5 } });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

describe("CaseTable", () => {
  it("search narrows rows; bulk assign needs a pick and a confirmation", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><CaseTable cases={[mk("JK-1", "গর্ত"), mk("JK-2", "ড্রেন")]} /></ToastProvider>);
    await user.type(screen.getByLabelText(t.odSearch), "ড্রেন");
    expect(screen.queryByText("গর্ত")).toBeNull();
    await user.clear(screen.getByLabelText(t.odSearch));
    await user.click(screen.getByLabelText(t.odSelectAll));
    await user.click(screen.getByRole("button", { name: t.odBulkAssign }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getByRole("button", { name: t.odBulkConfirm, hidden: true })).toBeDisabled();
    expect(localStorage.getItem(ASSIGN_KEY)).toBeNull();
    await user.selectOptions(within(dialog).getByRole("combobox", { hidden: true }), "st-2");
    await user.click(within(dialog).getByRole("button", { name: t.odBulkConfirm, hidden: true }));
    expect(JSON.parse(localStorage.getItem(ASSIGN_KEY)!)).toEqual({ "JK-1": "st-2", "JK-2": "st-2" });
  });
});
