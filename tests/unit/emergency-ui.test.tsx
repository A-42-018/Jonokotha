import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EmergencyGuidance from "@/components/EmergencyGuidance";
import EmergencyNote from "@/components/EmergencyNote";
import IssueView from "@/components/issue/IssueView";
import I18nProvider from "@/components/ui/I18nProvider";
import { dict } from "@/lib/i18n";
import type { CaseRecord, Emergency } from "@/lib/types";

const EM: Emergency = { kind: "child_in_danger", guidance: { bn: "শিশু বিপদে থাকলে এখনই ৯৯৯-এ ফোন করুন।", en: "If a child is in danger, call 999 now." }, numbers: ["999", "1098"] };

describe("EmergencyGuidance", () => {
  it.each(["bn", "en"] as const)("shows the server's guidance as given, a call link per number and the honest note (%s)", (lang) => {
    render(<I18nProvider lang={lang} dicts={{ [lang]: dict[lang] }}><EmergencyGuidance emergency={EM} lang={lang} refId="JK-1" /></I18nProvider>);
    const t = dict[lang];
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(EM.guidance[lang])).toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp("999") })).toHaveAttribute("href", "tel:999");
    expect(screen.getByRole("link", { name: new RegExp("1098") })).toHaveAttribute("href", "tel:1098");
    expect(screen.getByText(t.emSaved)).toBeInTheDocument();
    expect(screen.getByText("JK-1")).toBeInTheDocument();
  });
});

describe("EmergencyNote", () => {
  it("is a short line with a tap-to-call 999 link and a way to the help page", () => {
    render(<EmergencyNote t={dict.bn} />);
    expect(screen.getByRole("link", { name: dict.bn.emNote })).toHaveAttribute("href", "tel:999");
    expect(screen.getByRole("link", { name: dict.bn.emNoteMore })).toHaveAttribute("href", "/help#emergency");
  });
});

const base: CaseRecord = { ref: "JK-1", title: "নালা বন্ধ", category: "drainage", description: "বর্ণনা", area: "ওয়ার্ড ১", status: "acknowledged", createdAt: "2026-11-10T06:00:00Z", timeline: [{ status: "received", at: "2026-11-10T06:00:00Z" }] } as unknown as CaseRecord;

describe("issue page official-channel wording", () => {
  it("always says Jonokotha is not an official channel and that 'sent' is not registration", () => {
    render(<I18nProvider lang="en" dicts={{ en: dict.en }}><IssueView c={base} t={dict.en} lang="en" /></I18nProvider>);
    expect(screen.getByText(dict.en.isOfficialNote)).toBeInTheDocument();
    expect(screen.queryByText(dict.en.isReferredNote)).toBeNull();
  });
  it("a referred issue gets the extra line: not a registered complaint until the authority gives a reference", () => {
    render(<I18nProvider lang="en" dicts={{ en: dict.en }}><IssueView c={{ ...base, status: "referred" }} t={dict.en} lang="en" /></I18nProvider>);
    expect(screen.getByText(dict.en.isReferredNote)).toBeInTheDocument();
  });
});
