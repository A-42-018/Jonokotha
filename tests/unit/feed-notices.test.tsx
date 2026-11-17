import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FollowedFeed from "@/components/citizen/FollowedFeed";
import NotificationList from "@/components/citizen/NotificationList";
import { ToastProvider } from "@/components/ui/Toast";
import { toFeedRow, type FeedItem } from "@/lib/feed-api";
import { dict } from "@/lib/i18n";
import { noticeHref, noticeText, type ApiNotice } from "@/lib/notifications-api";

const t = dict.bn;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

const item: FeedItem = { ref: "JK-1", title: "ড্রেন বন্ধ", category: "drainage", area: "ওয়ার্ড ২", status: "in_progress", created_at: "2026-11-10T06:00:00Z", is_sample: false, why: "category" };

describe("feed", () => {
  it("maps the 13-state status to the label set the chip knows", () => {
    expect(toFeedRow(item).status).toBe("acknowledged");
    expect(toFeedRow({ ...item, status: "resolved" }).status).toBe("resolved");
  });
  it("signed out: asks to sign in and calls nothing", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><FollowedFeed signedIn={false} /></ToastProvider>);
    expect(screen.getByText(t.fdNeedsSignIn)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("signed in: loads /me/feed, shows why each item is here, and the ordering can be switched off", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (url: string) => (url.startsWith("/api/v1/me/feed") ? json(200, { data: [item] }) : json(200, { data: [] })));
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><FollowedFeed signedIn /></ToastProvider>);
    expect(await screen.findByText("ড্রেন বন্ধ")).toBeInTheDocument();
    expect(screen.getByText(t.fdWhy_category)).toBeInTheDocument();
    expect(f.mock.calls.some((c) => String((c as unknown as [string])[0]).includes("personalized=true"))).toBe(true);
    await user.click(screen.getByRole("button", { name: t.fdPersonalOff }));
    await vi.waitFor(() => expect(f.mock.calls.some((c) => String((c as unknown as [string])[0]).includes("personalized=false"))).toBe(true));
    vi.unstubAllGlobals();
  });
});

const n = (over: Partial<ApiNotice> = {}): ApiNotice => ({ id: "11111111-1111-4111-8111-111111111111", type: "issue_status", title: "অবস্থা বদলেছে", body: "নম্বর JK-1", ref: "JK-1", read_at: null, created_at: "2026-11-10T06:00:00Z", en: { title: "Status changed", body: "Reference JK-1" }, ...over });

describe("notifications", () => {
  it("links by type and picks the language, falling back to Bangla", () => {
    expect(noticeHref(n())).toBe("/issue/JK-1");
    expect(noticeHref(n({ type: "question_reply" }))).toBe("/ask/inbox");
    expect(noticeHref(n({ type: "idea_decision" }))).toBe("/ideas");
    expect(noticeText(n(), "en").title).toBe("Status changed");
    expect(noticeText(n({ en: null }), "en").title).toBe("অবস্থা বদলেছে");
  });
  it("lists the server's notices, marks one read, and marks all read", async () => {
    const user = userEvent.setup();
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json(200, { data: { marked: 1 } });
      return json(200, { data: [n(), n({ id: "22222222-2222-4222-8222-222222222222", read_at: "2026-11-11T00:00:00Z" })], page: { next_cursor: null, limit: 20 } });
    });
    vi.stubGlobal("fetch", f);
    render(<ToastProvider><NotificationList /></ToastProvider>);
    expect(await screen.findAllByText("অবস্থা বদলেছে")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: t.ntMarkRead }));
    await vi.waitFor(() => expect(f.mock.calls.some((c) => String((c as unknown as [string])[0]).endsWith("/11111111-1111-4111-8111-111111111111/read"))).toBe(true));
    await user.click(screen.getByRole("button", { name: t.ntMarkAll }));
    await vi.waitFor(() => expect(f.mock.calls.some((c) => String((c as unknown as [string])[0]).endsWith("/read-all"))).toBe(true));
    vi.unstubAllGlobals();
  });
  it("shows an empty state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: [], page: { next_cursor: null, limit: 20 } })));
    render(<ToastProvider><NotificationList /></ToastProvider>);
    expect(await screen.findByText(t.ntEmptyTitle)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
