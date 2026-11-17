import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PollsPanel from "@/components/citizen/PollsPanel";
import NoticeTypePrefs from "@/components/me/NoticeTypePrefs";
import NotificationBell from "@/components/ui/NotificationBell";
import { fetchUnreadCount, listenOwnNotices, realtimeOn } from "@/lib/live";
import { safeStatusUrl, toggleMuted } from "@/lib/notifications-api";
import { normalizePoll, percent } from "@/lib/polls-api";

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
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

const poll = { id: "p1", question: "রাস্তা আগে কোনটা?", status: "open", closes_at: null, results_visible: false, my_vote: null, options: [{ id: "a", label: "উত্তর" }, { id: "b", label: "দক্ষিণ" }] };

describe("live count", () => {
  it("reads the own unread count from the header, null when not signed in", async () => {
    expect(await fetchUnreadCount((async () => json(200, { data: [] }, { "x-unread-count": "4" })) as unknown as typeof fetch)).toBe(4);
    expect(await fetchUnreadCount((async () => json(401, {})) as unknown as typeof fetch)).toBeNull();
    expect(await fetchUnreadCount((async () => { throw new Error("x"); }) as unknown as typeof fetch)).toBeNull();
  });
  it("realtime is off until B5.8, and the listener filters to the person's own rows", () => {
    expect(realtimeOn()).toBe(false);
    const filters: Record<string, string>[] = [];
    const removed = vi.fn();
    const ch = { on: (_t: "postgres_changes", f: Record<string, string>) => { filters.push(f); return ch; }, subscribe: (cb?: (s: string) => void) => { cb?.("SUBSCRIBED"); return ch; } };
    const status = vi.fn();
    const off = listenOwnNotices({ channel: () => ch, removeChannel: removed }, "u-1", () => {}, status);
    expect(filters[0]).toMatchObject({ table: "notifications", filter: "user_id=eq.u-1" });
    expect(status).toHaveBeenCalledWith(true);
    off();
    expect(removed).toHaveBeenCalled();
  });
  it("the bell shows the count with a text label, and nothing when signed out", async () => {
    const calls = stub({ "GET /me/notifications": () => json(200, { data: [] }, { "x-unread-count": "3" }) });
    const { unmount } = render(<NotificationBell userId="u-1" />);
    expect(await screen.findByRole("link", { name: /না-পড়া/ })).toBeInTheDocument();
    unmount();
    calls.length = 0;
    render(<NotificationBell userId={null} />);
    expect(calls).toHaveLength(0);
  });
});

describe("polls (F5.11)", () => {
  it("helpers", () => {
    expect(normalizePoll({ id: "x", question: "q", options: [{ id: "a", label: "A" }] })).toBeNull();
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
    expect(toggleMuted(["issue_status"], "issue_status", true)).toEqual([]);
    expect(toggleMuted([], "announcement", false)).toEqual(["announcement"]);
    expect(safeStatusUrl("http://x.test")).toBeNull();
    expect(safeStatusUrl("https://status.example.org")).toBe("https://status.example.org/");
  });
  it("a server without polls shows the not-switched-on panel and no button", async () => {
    stub({});
    render(<PollsPanel signedIn loginHref="/login" />);
    expect(await screen.findByText(/চালু হয়নি/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("votes once with an idempotency-safe single call, then shows no vote button", async () => {
    let voted = false;
    const calls = stub({
      "GET /polls": () => json(200, { data: [{ ...poll, my_vote: voted ? "a" : null }] }),
      "POST /polls/p1/vote": () => { voted = true; return json(200, { data: {} }); },
    });
    const u = userEvent.setup();
    render(<PollsPanel signedIn loginHref="/login" />);
    expect(await screen.findByRole("button", { name: "ভোট দিন" })).toBeDisabled();
    await u.click(screen.getByRole("radio", { name: "উত্তর" }));
    await u.click(screen.getByRole("button", { name: "ভোট দিন" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "ভোট দিন" })).toBeNull());
    expect(calls.filter((c) => c.key === "POST /polls/p1/vote")).toEqual([{ key: "POST /polls/p1/vote", body: { option_id: "a" } }]);
    expect(screen.getByText(/ফল দেখা যাবে/)).toBeInTheDocument();
  });
  it("shows results only when the server allows them, and an error with retry", async () => {
    stub({ "GET /polls": () => json(200, { data: [{ ...poll, status: "closed", results_visible: true, my_vote: "a", options: [{ id: "a", label: "উত্তর", votes: 3 }, { id: "b", label: "দক্ষিণ", votes: 1 }] }] }) });
    const { unmount } = render(<PollsPanel signedIn={false} loginHref="/login" />);
    expect(await screen.findByText(/৭৫ শতাংশ/)).toBeInTheDocument();
    unmount();
    stub({ "GET /polls": () => json(500, { code: "internal_error" }) });
    render(<PollsPanel signedIn={false} loginHref="/login" />);
    expect(await screen.findByRole("alert", {}, { timeout: 9000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "আবার চেষ্টা করুন" })).toBeInTheDocument();
  });
  it("signed-out visitors are asked to sign in instead of voting", async () => {
    stub({ "GET /polls": () => json(200, { data: [poll] }) });
    render(<PollsPanel signedIn={false} loginHref="/login?next=/polls" />);
    expect(await screen.findByRole("link", { name: /সাইন ইন/ })).toHaveAttribute("href", "/login?next=/polls");
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("notification kinds", () => {
  it("unticking a kind saves muted_types", async () => {
    const calls = stub({
      "GET /me/notification-preferences": () => json(200, { data: { channels: { in_app: true, push: false, email: false }, muted_types: [], quiet_hours: null, timezone: "Asia/Dhaka", personalization_enabled: true } }),
      "PUT /me/notification-preferences": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<NoticeTypePrefs signedIn />);
    await u.click(await screen.findByRole("checkbox", { name: "অফিসের ঘোষণা এলে" }));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /me/notification-preferences")?.body).toEqual({ muted_types: ["announcement"] }));
  });
});
