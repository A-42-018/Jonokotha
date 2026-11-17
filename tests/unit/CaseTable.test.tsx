import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import CaseTable from "@/components/office/CaseTable";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import type { CaseRecord } from "@/lib/types";

const t = dict.bn;
const mk = (ref: string, title: string): CaseRecord => ({ ref, title, category: "roads", description: "d", area: "ক", constituencyId: "demo-1", status: "received", createdAt: "2026-11-01T00:00:00Z", timeline: [], ai: { summary: "", similarRefs: [], agencyId: "a", confidence: 0.5 } });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("CaseTable", () => {
  it("search narrows rows; bulk assign asks for confirmation, then assigns each selected case to me through the API", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (url: string) => new Response(JSON.stringify({ data: url.endsWith("/me/profile") ? { id: "me-1" } : {} }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><CaseTable cases={[mk("JK-1", "গর্ত"), mk("JK-2", "ড্রেন")]} /></ToastProvider>);
    await user.type(screen.getByLabelText(t.odSearch), "ড্রেন");
    expect(screen.queryByText("গর্ত")).toBeNull();
    await user.clear(screen.getByLabelText(t.odSearch));
    await user.click(screen.getByLabelText(t.odSelectAll));
    await user.click(screen.getByRole("button", { name: t.odBulkAssign }));
    expect(f).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { hidden: true });
    await user.click(within(dialog).getByRole("button", { name: t.odBulkConfirm, hidden: true }));
    await vi.waitFor(() => expect(f.mock.calls.filter((c) => String((c as unknown as [string])[0]).endsWith("/assign")).length).toBe(2));
    const calls = f.mock.calls as unknown as [string, RequestInit][];
    const assign = calls.find((c) => c[0] === "/api/v1/office/issues/JK-1/assign")!;
    expect(JSON.parse(assign[1].body as string)).toEqual({ assignee: "me-1" });
    vi.unstubAllGlobals();
  });
});
