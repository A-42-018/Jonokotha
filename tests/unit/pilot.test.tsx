import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SupportForm from "@/components/SupportForm";
import { OfficeTourDialog } from "@/components/office/OfficeTour";
import { dict, type Lang } from "@/lib/i18n";
import { looksPersonal, supportText, validateSupport } from "@/lib/pilot";

vi.mock("next/navigation", () => ({ usePathname: () => "/help/contact", useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
const wrap = (lang: Lang, ui: React.ReactNode) => { document.documentElement.lang = lang; return ui; };

describe("support text and validation", () => {
  it("needs ten characters, and a clarity answer only for pilot feedback", () => {
    expect(validateSupport({ kind: "question", where: "", clarity: "", what: "short" })).toEqual({ what: "spWhatShort" });
    expect(validateSupport({ kind: "problem", where: "", clarity: "", what: "The button does nothing" })).toEqual({});
    expect(validateSupport({ kind: "tester", where: "", clarity: "", what: "The button does nothing" })).toEqual({ clarity: "spClarityMissing" });
    expect(validateSupport({ kind: "tester", where: "", clarity: "6", what: "x".repeat(10) })).toEqual({ clarity: "spClarityMissing" });
    expect(validateSupport({ kind: "question", where: "", clarity: "", what: "x".repeat(1501) })).toEqual({ what: "spWhatLong" });
  });
  it("spots phone numbers, emails and IDs in Bangla and English digits", () => {
    expect(looksPersonal("call me on 01712345678")).toBe(true);
    expect(looksPersonal("আমার নম্বর ০১৭১২৩৪৫৬৭৮")).toBe(true);
    expect(looksPersonal("mail a@b.com")).toBe(true);
    expect(looksPersonal("the report page is confusing")).toBe(false);
  });
  it("builds the plain-text message", () => {
    const text = supportText({ kind: "tester", where: "report", clarity: "2", what: " hard " }, { kind: "Type", where: "Page", clarity: "Clear", what: "Details", kindName: "Pilot" });
    expect(text).toBe("Type: Pilot\nPage: report\nClear: 2\nDetails:\nhard\n");
  });
});

describe.each(["bn", "en"] as const)("support form in %s", (l) => {
  const t = dict[l];
  it("prepares a message, warns about personal data, and offers no email link without an address", () => {
    render(wrap(l, <SupportForm supportEmail="" />));
    fireEvent.change(screen.getByLabelText(new RegExp(t.spWhat)), { target: { value: "Call me 01712345678 please" } });
    fireEvent.click(screen.getByRole("button", { name: t.spPrepare }));
    expect(screen.getByRole("status")).toHaveTextContent(t.spReady);
    expect(screen.getByRole("alert")).toHaveTextContent(t.spPiiWarn);
    expect(screen.getByText(t.spNoContact)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: t.spSend })).toBeNull();
  });
  it("shows the mail link when an address is set", () => {
    render(wrap(l, <SupportForm supportEmail="help@example.org" />));
    fireEvent.change(screen.getByLabelText(new RegExp(t.spWhat)), { target: { value: "The map does not load for me" } });
    fireEvent.click(screen.getByRole("button", { name: t.spPrepare }));
    expect(screen.getByRole("link", { name: t.spSend }).getAttribute("href")).toMatch(/^mailto:help@example\.org\?subject=/);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("asks for the clarity answer on pilot feedback and shows an error without it", () => {
    render(wrap(l, <SupportForm supportEmail="" />));
    fireEvent.change(screen.getByLabelText(new RegExp(t.spKind)), { target: { value: "tester" } });
    fireEvent.change(screen.getByLabelText(new RegExp(t.spWhat)), { target: { value: "The report page was hard to read" } });
    fireEvent.click(screen.getByRole("button", { name: t.spPrepare }));
    expect(screen.getByText(t.spClarityMissing)).toBeInTheDocument();
  });
});

describe("office tour", () => {
  it.each(["bn", "en"] as const)("walks five steps and finishes in %s", (l) => {
    const t = dict[l];
    const onClose = vi.fn();
    render(wrap(l, <OfficeTourDialog open onClose={onClose} />));
    const d = screen.getByRole("dialog", { hidden: true });
    for (const k of ["otT1", "otT2", "otT3", "otT4"] as const) {
      expect(within(d).getByRole("heading", { name: t[k], hidden: true })).toBeInTheDocument();
      fireEvent.click(within(d).getByRole("button", { name: t.otNext, hidden: true }));
    }
    expect(within(d).getByRole("heading", { name: t.otT5, hidden: true })).toBeInTheDocument();
    expect(within(d).queryByRole("button", { name: t.otNext, hidden: true })).toBeNull();
    fireEvent.click(within(d).getByRole("button", { name: t.otDone, hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("can be skipped from an early step", () => {
    const onClose = vi.fn();
    render(wrap("en", <OfficeTourDialog open onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: dict.en.otSkip, hidden: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
