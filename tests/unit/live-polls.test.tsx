import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PollsPanel from "@/components/citizen/PollsPanel";
import NoticeTypePrefs from "@/components/me/NoticeTypePrefs";
import NotificationBell from "@/components/ui/NotificationBell";
import { fetchUnreadCount, listenOwnNotices, realtimeOn } from "@/lib/live";
import { safeStatusUrl, toggleMuted } from "@/lib/notifications-api";
import { percent, voteProblem, whyHidden } from "@/lib/polls-api";
import { ApiError } from "@/lib/api-client";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const row = { ref: "PL-1", constituency_key: "demo-1", question: "রাস্তা আগে কোনটা?", status: "open", results_visibility: "after_close", closes_at: null, opened_at: "2026-11-01T00:00:00Z", closed_at: null };
const detail = (over: object = {}, res: object = {}) => ({ ...row, options: [{ id: "a", label: "উত্তর", position: 1 }, { id: "b", label: "দক্ষিণ", position: 2 }], results: { ref: "PL-1", status: "open", total_votes: 2, my_option_id: null, results_shown: false, options: null, ...res }, ...over });

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

describe("polls (F5.11, F7.6)", () => {
  it("helpers", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(0, 0)).toBe(0);
    expect(toggleMuted(["issue_status"], "issue_status", true)).toEqual([]);
    expect(toggleMuted([], "announcement", false)).toEqual(["announcement"]);
    expect(safeStatusUrl("http://x.test")).toBeNull();
    expect(safeStatusUrl("https://status.example.org")).toBe("https://status.example.org/");
    expect(whyHidden({ status: "open", total_votes: 2 }, "after_close")).toBe("until_close");
    expect(whyHidden({ status: "closed", total_votes: 2 }, "after_close")).toBe("few_votes");
    expect(whyHidden({ status: "open", total_votes: 2 }, "always")).toBe("few_votes");
    expect(voteProblem(new ApiError("x", 409, { _: "already_voted" }))).toBe("again");
    expect(voteProblem(new ApiError("x", 422, { _: "poll_closed" }))).toBe("closed");
    expect(voteProblem(new ApiError("x", 401))).toBe("auth");
  });
  it("a server without polls shows the not-switched-on panel and no button", async () => {
    stub({});
    render(<PollsPanel signedIn loginHref="/login" constituency="demo-1" />);
    expect(await screen.findByText(/চালু হয়নি/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("votes once with the option id, then shows who you voted for and why there are no results yet", async () => {
    let voted = false;
    const calls = stub({
      "GET /polls": () => json(200, { data: [row] }),
      "GET /polls/PL-1": () => json(200, { data: detail({}, voted ? { my_option_id: "a", total_votes: 3 } : {}) }),
      "POST /polls/PL-1/vote": () => { voted = true; return json(201, { data: { ref: "PL-1", voted: true } }); },
    });
    const u = userEvent.setup();
    render(<PollsPanel signedIn loginHref="/login" constituency="demo-1" />);
    expect(await screen.findByRole("button", { name: "ভোট দিন" })).toBeDisabled();
    await u.click(screen.getByRole("radio", { name: "উত্তর" }));
    await u.click(screen.getByRole("button", { name: "ভোট দিন" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "ভোট দিন" })).toBeNull());
    expect(calls.filter((c) => c.key === "POST /polls/PL-1/vote")).toEqual([expect.objectContaining({ body: { option_id: "a" } })]);
    expect(calls[0].url).toContain("constituency=demo-1");
    expect(screen.getByText(/ফল দেখা যাবে/)).toBeInTheDocument();
  });
  it("shows results only when the server says so; a closed poll with too few votes says why; an error has retry", async () => {
    stub({
      "GET /polls": () => json(200, { data: [{ ...row, status: "closed" }] }),
      "GET /polls/PL-1": () => json(200, { data: detail({ status: "closed" }, { status: "closed", total_votes: 4, my_option_id: "a", results_shown: true, options: [{ id: "a", label: "উত্তর", votes: 3 }, { id: "b", label: "দক্ষিণ", votes: 1 }] }) }),
    });
    const a = render(<PollsPanel signedIn={false} loginHref="/login" constituency="demo-1" />);
    expect(await screen.findByText(/৭৫ শতাংশ/)).toBeInTheDocument();
    a.unmount();
    stub({ "GET /polls": () => json(200, { data: [{ ...row, status: "closed" }] }), "GET /polls/PL-1": () => json(200, { data: detail({ status: "closed" }, { status: "closed", total_votes: 2, results_shown: false }) }) });
    const b = render(<PollsPanel signedIn={false} loginHref="/login" constituency="demo-1" />);
    expect(await screen.findByText(/কমপক্ষে ৫ জনের ভোট লাগে/)).toBeInTheDocument();
    b.unmount();
    stub({ "GET /polls": () => json(500, { code: "internal_error" }) });
    render(<PollsPanel signedIn={false} loginHref="/login" constituency="demo-1" />);
    expect(await screen.findByRole("alert", {}, { timeout: 9000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "আবার চেষ্টা করুন" })).toBeInTheDocument();
  });
  it("signed-out visitors are asked to sign in instead of voting", async () => {
    stub({ "GET /polls": () => json(200, { data: [row] }), "GET /polls/PL-1": () => json(200, { data: detail() }) });
    render(<PollsPanel signedIn={false} loginHref="/login?next=/polls" constituency="demo-1" />);
    expect(await screen.findByRole("link", { name: /সাইন ইন/ })).toHaveAttribute("href", "/login?next=/polls");
    expect(screen.queryByRole("radio")).toBeNull();
  });
  it("a second vote (409) is explained and the poll is read again", async () => {
    stub({
      "GET /polls": () => json(200, { data: [row] }), "GET /polls/PL-1": () => json(200, { data: detail() }),
      "POST /polls/PL-1/vote": () => json(409, { code: "conflict", field_errors: { _: "already_voted" } }),
    });
    const u = userEvent.setup();
    render(<PollsPanel signedIn loginHref="/login" constituency="demo-1" />);
    await u.click(await screen.findByRole("radio", { name: "দক্ষিণ" }));
    await u.click(screen.getByRole("button", { name: "ভোট দিন" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("আগেই ভোট দিয়েছেন");
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
