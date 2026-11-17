import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import IdeaDiscussion from "@/components/ideas/IdeaDiscussion";
import IdeaThreshold from "@/components/ideas/IdeaThreshold";
import IdeaPolicyForm from "@/components/office/ws/IdeaPolicyForm";
import QueryProvider from "@/components/QueryProvider";
import { thresholdOf, toIdea, type ApiIdea } from "@/lib/ideas-api";
import { policyErrors, progress } from "@/lib/ideas-r11-api";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const api = (over: Partial<ApiIdea> = {}): ApiIdea => ({ ref: "ID-1", constituency_key: "demo-1", category: "roads", title: "বাতি", body: "রাস্তায় বাতি", status: "published", decision_note: null, created_at: "2026-11-01T00:00:00Z", support_count: 30, ...over });

describe("support threshold (F7.5)", () => {
  it("reads the threshold only when the office set one", () => {
    expect(thresholdOf(api())).toBeUndefined();
    expect(toIdea(api()).threshold).toBeUndefined();
    const th = toIdea(api({ support_threshold: 50, response_state: "awaiting_response", threshold_reached_at: "2026-11-05T00:00:00Z", response_due_at: "2026-11-20T00:00:00Z" })).threshold;
    expect(th).toMatchObject({ target: 50, state: "awaiting_response" });
    expect(thresholdOf(api({ support_threshold: 50, response_state: "weird" as never }))?.state).toBeNull();
    expect(progress(30, 50)).toBe(60);
    expect(progress(80, 50)).toBe(100);
  });
  it("shows progress before the threshold with the area-follower note and no answer state", () => {
    render(<IdeaThreshold supports={30} threshold={{ target: 50, reachedAt: null, dueAt: null, respondedAt: null, state: null }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText(/এলাকার খবর রাখেন/)).toBeInTheDocument();
    expect(screen.queryByText("উত্তরের অপেক্ষায়")).toBeNull();
  });
  it.each([
    ["awaiting_response", "উত্তরের অপেক্ষায়", /শেষ দিন: ২০ নভেম্বর ২০২৬/],
    ["overdue", "অফিস উত্তর দিতে দেরি করেছে", /শেষ দিন ছিল ২০ নভেম্বর ২০২৬/],
    ["answered", "অফিস উত্তর দিয়েছে", /উত্তরের তারিখ/],
    ["answered_late", "অফিস দেরিতে উত্তর দিয়েছে", /উত্তরের তারিখ/],
  ] as const)("state %s is written out, with dates", (state, label, date) => {
    render(<IdeaThreshold supports={60} threshold={{ target: 50, reachedAt: "2026-11-05T00:00:00Z", dueAt: "2026-11-20T00:00:00Z", respondedAt: state.startsWith("answered") ? "2026-11-21T00:00:00Z" : null, state }} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(date)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("for and against (F7.4)", () => {
  const points = { for: [{ id: "p1", side: "for", body: "বাতি দরকার", created_at: "2026-11-02T00:00:00Z", helpful_count: 3 }], against: [] };
  it("keeps the comments toggle when the server has not switched points on", async () => {
    stub({ "GET /features": () => json(200, { data: [{ key: "idea_arguments", enabled: false }] }) });
    render(<QueryProvider><IdeaDiscussion refId="ID-1" signedIn /></QueryProvider>);
    expect(await screen.findByRole("button", { name: "মন্তব্য দেখুন" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "পক্ষে-বিপক্ষের কথা দেখুন" })).toBeNull();
  });
  it("replaces comments with two lists, a helpful mark and an add form; a point cannot be replied to", async () => {
    const calls = stub({
      "GET /features": () => json(200, { data: [{ key: "idea_arguments", enabled: true }] }),
      "GET /ideas/ID-1/arguments": () => json(200, { data: points }),
      "PUT /ideas/ID-1/arguments/p1/helpful": () => json(200, { data: {} }),
      "POST /ideas/ID-1/arguments": () => json(201, { data: {} }),
    });
    const u = userEvent.setup();
    render(<QueryProvider><IdeaDiscussion refId="ID-1" signedIn /></QueryProvider>);
    await u.click(await screen.findByRole("button", { name: "পক্ষে-বিপক্ষের কথা দেখুন" }));
    expect(await screen.findByText("বাতি দরকার")).toBeInTheDocument();
    expect(screen.getByText("বিপক্ষে এখনো কেউ লেখেননি।")).toBeInTheDocument();
    expect(screen.getByText("৩ জন কাজের বলেছেন")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /উত্তর|reply/i })).toBeNull();
    await u.click(screen.getByRole("button", { name: "কাজের কথা" }));
    await waitFor(() => expect(calls.find((c) => c.key.startsWith("PUT"))?.body).toEqual({ on: true }));
    expect(await screen.findByRole("button", { name: "কাজের কথা বলেছেন" })).toHaveAttribute("aria-pressed", "true");
    const form = screen.getByRole("heading", { name: "একটি কথা যোগ করুন" }).closest("form") as HTMLElement;
    await u.click(within(form).getByRole("radio", { name: "বিপক্ষে" }));
    await u.type(within(form).getByLabelText("আপনার কথা"), "খরচ বেশি");
    await u.click(within(form).getByRole("button", { name: "যোগ করুন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /ideas/ID-1/arguments")?.body).toEqual({ side: "against", body: "খরচ বেশি" }));
  });
  it("signed-out visitors read the points and get a sign-in link; a limit is explained; no route shows the notice", async () => {
    stub({
      "GET /features": () => json(200, { data: [{ key: "idea_arguments", enabled: true }] }),
      "GET /ideas/ID-1/arguments": () => json(200, { data: points }),
    });
    const u = userEvent.setup();
    const a = render(<QueryProvider><IdeaDiscussion refId="ID-1" signedIn={false} /></QueryProvider>);
    await u.click(await screen.findByRole("button", { name: "পক্ষে-বিপক্ষের কথা দেখুন" }));
    expect(await screen.findByRole("link", { name: "কথা যোগ করতে সাইন ইন করুন" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "কাজের কথা" })).toBeNull();
    a.unmount();
    stub({ "GET /features": () => json(200, { data: [{ key: "idea_arguments", enabled: true }] }) });
    render(<QueryProvider><IdeaDiscussion refId="ID-1" signedIn /></QueryProvider>);
    await u.click(await screen.findByRole("button", { name: "পক্ষে-বিপক্ষের কথা দেখুন" }));
    expect(await screen.findByText(/এখনো চালু হয়নি/)).toBeInTheDocument();
  });
});

describe("office idea policy (F7.5)", () => {
  it("checks the ranges, asks before saving and sends both numbers", () => {
    expect(policyErrors("2", "10")).toEqual({ threshold: true });
    expect(policyErrors("50", "91")).toEqual({ days: true });
    expect(policyErrors("50.5", "x")).toEqual({ threshold: true, days: true });
    expect(policyErrors("50", "14")).toEqual({});
  });
  it("saves after a confirm", async () => {
    const calls = stub({
      "GET /office/constituencies/demo-1/idea-policy": () => json(200, { data: { support_threshold: null, response_days: null } }),
      "PUT /office/constituencies/demo-1/idea-policy": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<IdeaPolicyForm constituency="demo-1" />);
    const save = await screen.findByRole("button", { name: "রাখুন" });
    expect(save).toBeDisabled();
    await u.type(screen.getByLabelText(/সমর্থনের সীমা/), "2");
    expect(screen.getByText("সংখ্যাটি সীমার মধ্যে নেই।")).toBeInTheDocument();
    await u.clear(screen.getByLabelText(/সমর্থনের সীমা/));
    await u.type(screen.getByLabelText(/সমর্থনের সীমা/), "50");
    await u.type(screen.getByLabelText(/উত্তরের সময়/), "14");
    await u.click(save);
    expect(calls.some((c) => c.key.startsWith("PUT"))).toBe(false);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "রাখুন" }));
    await waitFor(() => expect(calls.find((c) => c.key.startsWith("PUT"))?.body).toEqual({ support_threshold: 50, response_days: 14 }));
  });
  it("a server without the route shows the panel only", async () => {
    stub({});
    render(<IdeaPolicyForm constituency="demo-1" />);
    expect(await screen.findByText(/চালু করা হয়নি/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
