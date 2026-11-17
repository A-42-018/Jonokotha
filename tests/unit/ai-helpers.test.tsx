import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ClarityHelper from "@/components/ideas/ClarityHelper";
import InsightBriefs from "@/components/office/ws/InsightBriefs";
import QueryProvider from "@/components/QueryProvider";
import TranslatedText from "@/components/ui/TranslatedText";
import { detectLang, nextActions, otherLang } from "@/lib/ai-helpers-api";
import { dict } from "@/lib/i18n";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
afterEach(() => { vi.unstubAllGlobals(); });

function stub(routes: Record<string, () => Response>) {
  const calls: { key: string; body?: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(url).replace("/api/v1", "").split("?")[0]}`;
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = routes[key];
    return r ? r() : json(404, { code: "not_found" });
  }));
  return calls;
}

describe("helpers", () => {
  it("picks the language from the script and the other one to translate to", () => {
    expect(detectLang("রাস্তা ভাঙা")).toBe("bn");
    expect(detectLang("Road is broken")).toBe("en");
    expect(otherLang("bn")).toBe("en");
  });
  it("only a draft can be shared; a withdrawn brief has no action", () => {
    expect(nextActions("draft")).toEqual(["share", "withdraw"]);
    expect(nextActions("shared")).toEqual(["withdraw"]);
    expect(nextActions("withdrawn")).toEqual([]);
  });
});

describe("translation on public text (F5.14)", () => {
  it("shows the original first, labels the machine translation and brings the original back", async () => {
    const calls = stub({ "POST /ai/translate": () => json(200, { data: { available: true, translation: "রাস্তা ভাঙা", target: "bn", machine_translated: true } }) });
    const u = userEvent.setup();
    render(<TranslatedText text="The road is broken" signedIn />);
    expect(screen.getByText("The road is broken")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: t.trShow }));
    expect(await screen.findByText("রাস্তা ভাঙা")).toBeInTheDocument();
    expect(screen.getByText(t.trLabel)).toBeInTheDocument();
    expect(calls[0].body).toEqual({ text: "The road is broken", to: "bn" });
    await u.click(screen.getByRole("button", { name: t.trOriginal }));
    expect(screen.getByText("The road is broken")).toBeInTheDocument();
    expect(screen.queryByText(t.trLabel)).toBeNull();
    expect(screen.getByRole("button", { name: t.trShowAgain })).toBeInTheDocument();
  });

  it("offers nothing when the text is already in the page language", () => {
    render(<TranslatedText text="রাস্তা ভাঙা" signedIn />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the original and says so when the service is not available, and sends visitors to sign in", async () => {
    stub({ "POST /ai/translate": () => json(200, { data: { available: false, target: "bn", machine_translated: true } }) });
    const u = userEvent.setup();
    const { unmount } = render(<TranslatedText text="Drain blocked" signedIn />);
    await u.click(screen.getByRole("button", { name: t.trShow }));
    expect(await screen.findByText(t.trUnavailable)).toBeInTheDocument();
    expect(screen.getByText("Drain blocked")).toBeInTheDocument();
    unmount();
    render(<TranslatedText text="Drain blocked" signedIn={false} next="/ideas" />);
    expect(screen.getByRole("link", { name: t.trSignIn })).toHaveAttribute("href", expect.stringContaining("/login"));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("an expired session on the call shows the sign-in link", async () => {
    stub({ "POST /ai/translate": () => json(401, { code: "unauthorized" }) });
    const u = userEvent.setup();
    render(<TranslatedText text="Drain blocked" signedIn />);
    await u.click(screen.getByRole("button", { name: t.trShow }));
    expect(await screen.findByRole("link", { name: t.trSignIn })).toBeInTheDocument();
  });
});

describe("idea clarity suggestions (F5.14)", () => {
  it("is text only while the server route is not on", () => {
    render(<QueryProvider><ClarityHelper title="নতুন পার্ক" text="খালি জমি আছে" /></QueryProvider>);
    expect(screen.getByText(t.clNotOnBody)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lists suggestions and changes nothing; a missing route is the same as not available", async () => {
    const calls = stub({ "POST /ai/ideas/clarity": () => json(200, { data: { available: true, suggestions: [{ text: "কোথায় জায়গাটি, লিখুন" }, { text: " " }] } }) });
    const u = userEvent.setup();
    const { unmount } = render(<QueryProvider><ClarityHelper live title="নতুন পার্ক হোক" text="খালি জমি পড়ে আছে, বাচ্চারা খেলে না" /></QueryProvider>);
    await u.click(screen.getByRole("button", { name: t.clAsk }));
    expect(await screen.findByText("কোথায় জায়গাটি, লিখুন")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ title: "নতুন পার্ক হোক" });
    unmount();
    stub({});
    render(<QueryProvider><ClarityHelper live title="নতুন পার্ক হোক" text="খালি জমি পড়ে আছে, বাচ্চারা খেলে না" /></QueryProvider>);
    await u.click(screen.getByRole("button", { name: t.clAsk }));
    expect(await screen.findByText(t.clUnavailable)).toBeInTheDocument();
  });

  it("asks for more text before it calls anything", () => {
    render(<QueryProvider><ClarityHelper live title="" text="" /></QueryProvider>);
    expect(screen.getByRole("button", { name: t.clAsk })).toBeDisabled();
    expect(screen.getByText(t.clNeedText)).toBeInTheDocument();
  });
});

describe("insight briefs for the office (F5.14)", () => {
  const brief = { id: "i1", period_days: 7, status: "draft", narrative: "ড্রেনের সমস্যা বেড়েছে।", case_refs: ["JK-1"], created_at: "2026-11-10T00:00:00Z" };

  it("is text only while the server route is not on", () => {
    render(<QueryProvider><InsightBriefs /></QueryProvider>);
    expect(screen.getByText(t.inNotOnBody)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a draft with its cases and shares it only on a press", async () => {
    const calls = stub({
      "GET /office/insights": () => json(200, { data: [brief] }),
      "POST /office/insights/i1/review": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<QueryProvider><InsightBriefs live /></QueryProvider>);
    expect(await screen.findByText("ড্রেনের সমস্যা বেড়েছে।")).toBeInTheDocument();
    expect(screen.getByText(t.inStatus_draft)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "JK-1" })).toHaveAttribute("href", "/office/JK-1");
    expect(calls.some((c) => c.key.startsWith("POST"))).toBe(false);
    await u.click(screen.getByRole("button", { name: t.inShare }));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ action: "share" });
  });

  it("empty list and a missing route", async () => {
    stub({ "GET /office/insights": () => json(200, { data: [] }) });
    const { unmount } = render(<QueryProvider><InsightBriefs live /></QueryProvider>);
    expect(await screen.findByText(t.inEmpty)).toBeInTheDocument();
    unmount();
    stub({});
    render(<QueryProvider><InsightBriefs live /></QueryProvider>);
    expect(await screen.findByText(t.inNotOnBody)).toBeInTheDocument();
  });
});
