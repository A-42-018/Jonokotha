import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import AskForm from "@/components/ask/AskForm";
import PersonalizationPanel from "@/components/me/PersonalizationPanel";
import PersonalizationApplier from "@/components/ui/PersonalizationApplier";
import SpeakBar from "@/components/ui/SpeakBar";
import { cleanModes, DEFAULT_MODES, PERSONAL_PREFS_KEY } from "@/lib/personalize";
import { dict } from "@/lib/i18n";

const t = dict.bn;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const prefs = (on: boolean) => ({ data: { channels: { in_app: true, push: false, email: false }, muted_types: [], quiet_hours: null, timezone: "Asia/Dhaka", personalization_enabled: on } });
const follow = (id: string, type: string, target: string) => ({ id, type, target, created_at: "2026-11-01T00:00:00Z" });
const setModes = (v: unknown) => { localStorage.setItem(PERSONAL_PREFS_KEY, JSON.stringify(v)); window.dispatchEvent(new Event("jk-local-change")); };
const stored = () => cleanModes(JSON.parse(localStorage.getItem(PERSONAL_PREFS_KEY) ?? "{}"));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
beforeEach(() => { localStorage.clear(); window.dispatchEvent(new Event("jk-local-change")); });
afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.simple; delete document.documentElement.dataset.voice; });

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

describe("modes", () => {
  it("anything that is not two booleans falls back to off", () => {
    expect(cleanModes(null)).toEqual(DEFAULT_MODES);
    expect(cleanModes({ simple: "yes", voiceFirst: 1 })).toEqual(DEFAULT_MODES);
    expect(cleanModes({ simple: true, voiceFirst: true })).toEqual({ simple: true, voiceFirst: true });
  });
  it("the applier puts the chosen modes on the page", async () => {
    setModes({ simple: true, voiceFirst: true });
    render(<PersonalizationApplier />);
    await waitFor(() => expect(document.documentElement.dataset.simple).toBe("true"));
    expect(document.documentElement.dataset.voice).toBe("true");
  });
});

describe("settings panel", () => {
  it("shows what the feed uses, saves the feed switch to the account and turns a mode on", async () => {
    const calls = stub({
      "GET /me/notification-preferences": () => json(200, prefs(true)),
      "PUT /me/notification-preferences": () => json(200, prefs(false)),
      "GET /me/follows": () => json(200, { data: [follow("f1", "category", "road"), follow("f2", "area", "dhaka-1")] }),
    });
    const u = userEvent.setup();
    render(<PersonalizationPanel signedIn />);
    expect(await screen.findByText("dhaka-1")).toBeInTheDocument();
    await u.click(screen.getByRole("checkbox", { name: t.pzFeedOn }));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /me/notification-preferences")?.body).toEqual({ personalization_enabled: false }));
    await u.click(screen.getByRole("checkbox", { name: t.pzSimple }));
    expect(stored()).toEqual({ simple: true, voiceFirst: false });
  });

  it("says plainly when nothing is followed and when the preferences cannot load", async () => {
    stub({ "GET /me/notification-preferences": () => json(200, prefs(true)), "GET /me/follows": () => json(200, { data: [] }) });
    const { unmount } = render(<PersonalizationPanel signedIn />);
    expect(await screen.findByText(t.pzFollowNone)).toBeInTheDocument();
    unmount();
    stub({ "GET /me/notification-preferences": () => json(403, { code: "forbidden" }) });
    render(<PersonalizationPanel signedIn />);
    expect(await screen.findByRole("alert")).toHaveTextContent(t.pzFollowError);
  });

  it("a visitor gets a sign-in link and no feed switch; the device modes still work", () => {
    stub({});
    render(<PersonalizationPanel signedIn={false} />);
    expect(screen.getByRole("link", { name: /সাইন ইন/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: t.pzFeedOn })).toBeNull();
    expect(screen.getByRole("checkbox", { name: t.pzVoice })).toBeInTheDocument();
  });

  it("reset asks first, then removes every follow, turns the feed order back on and switches the modes off", async () => {
    setModes({ simple: true, voiceFirst: true });
    const calls = stub({
      "GET /me/notification-preferences": () => json(200, prefs(false)),
      "PUT /me/notification-preferences": () => json(200, prefs(true)),
      "GET /me/follows": () => json(200, { data: [follow("f1", "category", "road")] }),
      "DELETE /me/follows/f1": () => json(200, { data: { id: "f1" } }),
    });
    const u = userEvent.setup();
    render(<PersonalizationPanel signedIn />);
    await screen.findByRole("checkbox", { name: t.pzFeedOn });
    await u.click(screen.getByRole("button", { name: t.pzReset }));
    expect(calls.some((c) => c.key.startsWith("DELETE"))).toBe(false);
    await u.click(await screen.findByRole("button", { name: t.pzResetYes }));
    await waitFor(() => expect(calls.some((c) => c.key === "DELETE /me/follows/f1")).toBe(true));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /me/notification-preferences")?.body).toEqual({ personalization_enabled: true }));
    await waitFor(() => expect(stored()).toEqual(DEFAULT_MODES));
  });

  it("a follow that cannot be removed keeps the modes and leaves the feed order alone", async () => {
    setModes({ simple: true, voiceFirst: false });
    const calls = stub({
      "GET /me/notification-preferences": () => json(200, prefs(true)),
      "GET /me/follows": () => json(200, { data: [follow("f1", "category", "road")] }),
      "DELETE /me/follows/f1": () => json(403, { code: "forbidden" }),
    });
    const u = userEvent.setup();
    render(<PersonalizationPanel signedIn />);
    await screen.findByRole("checkbox", { name: t.pzFeedOn });
    await u.click(screen.getByRole("button", { name: t.pzReset }));
    await u.click(await screen.findByRole("button", { name: t.pzResetYes }));
    await waitFor(() => expect(calls.some((c) => c.key === "DELETE /me/follows/f1")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: t.pzResetYes })).toBeNull());
    expect(calls.some((c) => c.key === "PUT /me/notification-preferences")).toBe(false);
    expect(stored().simple).toBe(true);
  });
});

describe("speak first", () => {
  it("the speak bar is the large primary button in voice-first mode, an ordinary one otherwise", async () => {
    render(<SpeakBar onText={() => {}} />);
    expect(screen.getByRole("button", { name: new RegExp(t.pzAskSpeak) }).className).not.toMatch(/min-h-12/);
    setModes({ simple: false, voiceFirst: true });
    await waitFor(() => expect(screen.getByRole("button", { name: new RegExp(t.pzAskSpeak) }).className).toMatch(/min-h-12/));
  });

  it("on the ask form the microphone comes before the message box in voice-first mode and after it otherwise", async () => {
    stub({});
    const order = () => {
      const mic = screen.getByRole("button", { name: new RegExp(t.pzAskSpeak) });
      const box = screen.getByRole("textbox", { name: t.askMessage });
      return mic.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING ? "mic-first" : "box-first";
    };
    render(<AskForm signedIn constituency="dhaka-1" />);
    expect(order()).toBe("box-first");
    setModes({ simple: false, voiceFirst: true });
    await waitFor(() => expect(order()).toBe("mic-first"));
  });
});
