import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CheckinsOffice from "@/components/office/ws/CheckinsOffice";
import FollowProject from "@/components/projects/FollowProject";
import ProjectCheckins from "@/components/projects/ProjectCheckins";
import QueryProvider from "@/components/QueryProvider";
import { dhakaDay, noteOk, visitRange } from "@/lib/checkins-api";
import { json, stub } from "./helpers-r11";

afterEach(() => { vi.unstubAllGlobals(); });

const item = { id: "c1", note: "আজ গিয়ে দেখলাম কাজ চলছে", visited_at: "2026-11-10", has_photo: true, photo_url: "https://x.supabase.co/p.jpg", office_response: "ধন্যবাদ, আমরা দেখছি", responded_at: "2026-11-12T05:00:00Z", created_at: "2026-11-10T05:00:00Z", label: "citizen_submitted" };
const wrap = (ui: React.ReactNode) => <QueryProvider>{ui}</QueryProvider>;

describe("check-in helpers (F7.3)", () => {
  it("the visit window is the last 60 days in Dhaka time", () => {
    const now = new Date("2026-11-15T20:30:00Z");   // already 16 Nov in Dhaka
    expect(dhakaDay(now)).toBe("2026-11-16");
    expect(visitRange(now)).toEqual({ min: "2026-09-17", max: "2026-11-16" });
    expect(noteOk("abcd")).toBe(false);
    expect(noteOk("abcde")).toBe(true);
    expect(noteOk("x".repeat(501))).toBe(false);
  });
});

describe("check-ins on a project", () => {
  it("labels each one citizen-submitted, says it does not change the official status, and shows the office reply", async () => {
    stub({ "GET /projects/PR-1/checkins": () => json(200, { data: [item] }) });
    render(wrap(<ProjectCheckins refId="PR-1" signedIn={false} loginHref="/login?next=p" />));
    expect(await screen.findByText("আজ গিয়ে দেখলাম কাজ চলছে")).toBeInTheDocument();
    expect(screen.getByText("নাগরিকের পাঠানো")).toBeInTheDocument();
    expect(screen.getByText(/সরকারি অবস্থা এতে বদলায় না/)).toBeInTheDocument();
    expect(screen.getByText("ধন্যবাদ, আমরা দেখছি")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "নাগরিকের তোলা ছবি" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "খবর পাঠাতে সাইন ইন করুন" })).toHaveAttribute("href", "/login?next=p");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("an unsafe photo address is not rendered; an empty list and a missing route are explained", async () => {
    stub({ "GET /projects/PR-1/checkins": () => json(200, { data: [{ ...item, photo_url: "javascript:alert(1)" }] }) });
    const a = render(wrap(<ProjectCheckins refId="PR-1" signedIn loginHref="/login" />));
    await screen.findByText("আজ গিয়ে দেখলাম কাজ চলছে");
    expect(screen.queryByRole("img", { name: "নাগরিকের তোলা ছবি" })).toBeNull();
    a.unmount();
    stub({ "GET /projects/PR-1/checkins": () => json(200, { data: [] }) });
    const b = render(wrap(<ProjectCheckins refId="PR-1" signedIn loginHref="/login" />));
    expect(await screen.findByText("এখনো কেউ কিছু পাঠাননি।")).toBeInTheDocument();
    b.unmount();
    stub({});
    render(wrap(<ProjectCheckins refId="PR-1" signedIn loginHref="/login" />));
    expect(await screen.findByText("নাগরিকদের খবর পাঠানোর সুবিধা এখনো চালু হয়নি")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("checks the note and the date before sending, then sends the note and date once", async () => {
    const calls = stub({
      "GET /projects/PR-1/checkins": () => json(200, { data: [] }),
      "POST /projects/PR-1/checkins": () => json(201, { data: { id: "n1", status: "pending_review", label: "citizen_submitted" } }),
    });
    const u = userEvent.setup();
    render(wrap(<ProjectCheckins refId="PR-1" signedIn loginHref="/login" />));
    await u.click(await screen.findByRole("button", { name: "পাঠান" }));
    expect(await screen.findByText("কমপক্ষে ৫ অক্ষর লিখুন।")).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith("POST"))).toBe(false);
    await u.type(screen.getByLabelText("আপনার দেখা"), "কাজ বন্ধ আছে");
    await u.click(screen.getByRole("button", { name: "পাঠান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /projects/PR-1/checkins")?.body).toEqual({ note: "কাজ বন্ধ আছে" }));
    expect(calls.some((c) => c.key.includes("/photo"))).toBe(false);
  });
  it("a limit answer is explained in plain words", async () => {
    stub({
      "GET /projects/PR-1/checkins": () => json(200, { data: [] }),
      "POST /projects/PR-1/checkins": () => json(422, { code: "rule_not_met", field_errors: { _: "checkin_limit" } }),
    });
    const u = userEvent.setup();
    render(wrap(<ProjectCheckins refId="PR-1" signedIn loginHref="/login" />));
    await u.type(await screen.findByLabelText("আপনার দেখা"), "কাজ বন্ধ আছে");
    await u.click(screen.getByRole("button", { name: "পাঠান" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("দিনে দুটির বেশি");
  });
});

describe("following a project", () => {
  it("signed-out visitors get a link; signed-in people follow and unfollow with the server's list", async () => {
    stub({});
    const a = render(wrap(<FollowProject refId="PR-1" signedIn={false} loginHref="/login" />));
    expect(screen.getByRole("link", { name: "খবর রাখতে সাইন ইন করুন" })).toBeInTheDocument();
    a.unmount();
    let rows: unknown[] = [];
    const calls = stub({
      "GET /me/follows": () => json(200, { data: rows }),
      "POST /me/follows": () => { rows = [{ id: "f1", type: "project", target: "PR-1", created_at: "2026-11-01" }]; return json(201, { data: rows[0] }); },
      "DELETE /me/follows/f1": () => { rows = []; return json(200, { data: { id: "f1" } }); },
    });
    const u = userEvent.setup();
    render(wrap(<FollowProject refId="PR-1" signedIn loginHref="/login" />));
    await u.click(await screen.findByRole("button", { name: "খবর রাখুন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /me/follows")?.body).toEqual({ type: "project", target: "PR-1" }));
    expect(await screen.findByRole("button", { name: "খবর রাখছেন" })).toHaveAttribute("aria-pressed", "true");
    await u.click(screen.getByRole("button", { name: "খবর রাখছেন" }));
    await waitFor(() => expect(calls.some((c) => c.key === "DELETE /me/follows/f1")).toBe(true));
  });
});

describe("office check-ins", () => {
  it("lists a project's updates, approves one, and asks before a reply goes out", async () => {
    const calls = stub({
      "GET /projects": () => json(200, { data: [{ ref: "PR-1", title: "সেতু", status: "in_progress", updated_at: "2026-11-01T00:00:00Z" }] }),
      "GET /office/projects/PR-1/checkins": () => json(200, { data: [{ id: "c1", note: "কাজ চলছে", visited_at: "2026-11-10", moderation_status: "pending_review", office_response: null, has_photo: false, created_at: "2026-11-10T00:00:00Z" }] }),
      "POST /office/checkins/c1/moderate": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<CheckinsOffice constituency="demo-1" />);
    await u.selectOptions(await screen.findByLabelText("প্রকল্প বাছুন"), "PR-1");
    expect(await screen.findByText("কাজ চলছে")).toBeInTheDocument();
    expect(screen.getByText("দেখা বাকি")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "প্রকাশ করুন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/checkins/c1/moderate")?.body).toEqual({ action: "approve" }));
  });
});
