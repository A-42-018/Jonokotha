import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReportForm from "@/components/ReportForm";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { DRAFT_KEY } from "@/lib/report";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/report" }));

const t = dict.bn;
const setup = () => render(<ToastProvider><ReportForm t={t} lang="bn" constituencyId="sample" /></ToastProvider>);

describe("ReportForm", () => {
  it("starts on step 1 and shows the category error when Next is pressed empty", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByRole("heading", { level: 2, name: t.stCategory })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.wizNext }));
    expect(await screen.findByText(t.errCategory)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: t.stCategory })).toBeInTheDocument();
  });

  it("moves on once a category is chosen, then validates the description step", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("radio", { name: new RegExp(t.cats.drainage) }));
    await user.click(screen.getByRole("button", { name: t.wizNext }));
    expect(await screen.findByRole("heading", { level: 2, name: t.stDescribe })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.wizNext }));
    expect(await screen.findByText(t.errTitleMin)).toBeInTheDocument();
    expect(screen.getByText(t.errDescMin)).toBeInTheDocument();
  });

  it("warns when the quick-start text contains a phone number", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText(t.quickTitle), "call 01712345678");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("recovers an interrupted draft and offers to discard it", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ quick: "", values: { category: "drainage", title: "নর্দমা বন্ধ", description: "", area: "" }, ai: [], edited: [], step: 1 }));
    setup();
    expect(await screen.findByText(t.draftRestored)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(new RegExp(t.fTitle))).toHaveValue("নর্দমা বন্ধ"));
  });
});
