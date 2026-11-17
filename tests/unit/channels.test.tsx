import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AreaAlerts from "@/components/channels/AreaAlerts";
import AreaAlertComposer from "@/components/channels/AreaAlertComposer";
import ChannelsPanel from "@/components/channels/ChannelsPanel";
import NoticeTypePrefs from "@/components/me/NoticeTypePrefs";
import { cleanPhone, phoneOk, showNumber, toE164, waLink } from "@/lib/channels-api";
import { kindOf, noticeHref } from "@/lib/notifications-api";
import { dict } from "@/lib/i18n";
import { json, stub } from "./helpers-r11";

let flagOn = true;
vi.mock("@/lib/flags-more", () => ({ FLAGS: { consultations: false, commitments: false, priorities: false, surveys: false, officeRelease11: false, readAloud: false, darkMode: false, get channels() { return flagOn; } } }));
vi.mock("@/lib/i18n", async (orig) => ({ ...(await orig<typeof import("@/lib/i18n")>()), getLang: async () => "bn" }));

beforeEach(() => { flagOn = true; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("phone numbers (F7.2)", () => {
  it("accepts either digit set and common Bangladesh forms", () => {
    expect(cleanPhone("০১৭১২-৩৪৫ ৬৭৮")).toBe("01712345678");
    expect(toE164("01712345678")).toBe("+8801712345678");
    expect(toE164("০১৭১২৩৪৫৬৭৮")).toBe("+8801712345678");
    expect(toE164("8801712345678")).toBe("+8801712345678");
    expect(toE164("+88 017 1234 5678")).toBe("+8801712345678");
    expect(phoneOk("0171")).toBe(false);
    expect(phoneOk("01712345678")).toBe(true);
  });
  it("numbers and links are made only from real digits", () => {
    expect(waLink("+880 1712-345678", "ab12")).toBe("https://wa.me/8801712345678?text=ab12");
    expect(waLink("javascript:alert(1)")).toBeNull();
    expect(waLink("")).toBeNull();
    expect(showNumber("+880 1712 345678")).toBe("+880 1712 345678");
    expect(showNumber("<b>x</b>")).toBe("");
  });
  it("notifications of a newer kind do not break the list and lead somewhere sensible", () => {
    expect(kindOf("something_new")).toBe("area");
    expect(noticeHref({ type: "consultation_report", ref: "CN-1" })).toBe("/consultations/CN-1/report");
    expect(noticeHref({ type: "consultation_opened", ref: "CN-1" })).toBe("/consultations/CN-1");
    expect(noticeHref({ type: "area_alert", ref: null })).toBe("/area");
  });
});

describe("linking a number", () => {
  const link = { id: "l1", channel: "whatsapp", address_hint: "678", status: "active", code_expires_at: null, updates_enabled: false, created_at: "2026-11-01T00:00:00Z", verified_at: "2026-11-01T00:10:00Z" };
  it("signed-out visitors get a sign-in link only; a server without the routes shows no form", async () => {
    stub({});
    const a = render(<ChannelsPanel signedIn={false} />);
    expect(screen.getByRole("link", { name: "সাইন ইন" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    a.unmount();
    render(<ChannelsPanel signedIn />);
    expect(await screen.findByText(/চালু করা হয়নি/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("consent is required, the number is sent in international form, and the code is shown with where to send it", async () => {
    const calls = stub({
      "GET /me/channels": () => json(200, { data: [] }),
      "POST /me/channels": () => json(201, { data: { code: "K7X92QF", send_to: "+880 1700 000000", instructions: "x" } }),
    });
    const u = userEvent.setup();
    render(<ChannelsPanel signedIn />);
    await u.type(await screen.findByLabelText("ফোন নম্বর"), "০১৭১২৩৪৫৬৭৮");
    await u.click(screen.getByRole("button", { name: "কোড নিন" }));
    expect(await screen.findByText("নম্বর জুড়তে রাজি হতে হবে।")).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /me/channels")).toBe(false);
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "কোড নিন" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /me/channels")?.body).toEqual({ channel: "whatsapp", address: "+8801712345678", accept_privacy: true }));
    expect(await screen.findByTestId("link-code")).toHaveTextContent("K7X92QF");
    expect(screen.getByText(/\+880 1700 000000/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp-এ জানান" })).toHaveAttribute("href", expect.stringContaining("wa.me/8801700000000?text=K7X92QF"));
  });
  it("an address already in use is explained", async () => {
    stub({ "GET /me/channels": () => json(200, { data: [] }), "POST /me/channels": () => json(409, { code: "conflict", field_errors: { _: "address_in_use" } }) });
    const u = userEvent.setup();
    render(<ChannelsPanel signedIn />);
    await u.type(await screen.findByLabelText("ফোন নম্বর"), "01712345678");
    await u.click(screen.getByRole("checkbox"));
    await u.click(screen.getByRole("button", { name: "কোড নিন" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("আগেই অন্য একটি অ্যাকাউন্টে");
  });
  it("updates need both switches: the link's and the notification preference, then removing asks first", async () => {
    const calls = stub({
      "GET /me/channels": () => json(200, { data: [link] }),
      "PATCH /me/channels/l1": () => json(200, { data: {} }),
      "PUT /me/notification-preferences": () => json(200, { data: {} }),
      "DELETE /me/channels/l1": () => json(200, { data: {} }),
    });
    const u = userEvent.setup();
    render(<ChannelsPanel signedIn />);
    await u.click(await screen.findByRole("checkbox", { name: /সমস্যার খবর পাঠান/ }));
    await waitFor(() => expect(calls.find((c) => c.key === "PATCH /me/channels/l1")?.body).toEqual({ updates_enabled: true }));
    await waitFor(() => expect(calls.find((c) => c.key === "PUT /me/notification-preferences")?.body).toEqual({ channels: { whatsapp: true } }));
    await u.click(screen.getByRole("button", { name: "নম্বর সরান" }));
    expect(calls.some((c) => c.key.startsWith("DELETE"))).toBe(false);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "নম্বর সরান" }));
    await waitFor(() => expect(calls.some((c) => c.key === "DELETE /me/channels/l1")).toBe(true));
  });
});

describe("area alerts", () => {
  it("shows the newest alerts, and nothing at all when there are none or the server lacks them", async () => {
    stub({ "GET /area-alerts": () => json(200, { data: [{ title_bn: "বন্যার সতর্কতা", body: "নিচু এলাকা", created_at: "2026-11-10T00:00:00Z" }] }) });
    const a = render(<AreaAlerts constituency="demo-1" />);
    expect(await screen.findByText("বন্যার সতর্কতা")).toBeInTheDocument();
    a.unmount();
    stub({ "GET /area-alerts": () => json(200, { data: [] }) });
    const b = render(<AreaAlerts constituency="demo-1" />);
    await waitFor(() => expect(b.container.querySelector("section")).toBeNull());
    b.unmount();
    stub({});
    const c = render(<AreaAlerts constituency="demo-1" />);
    await waitFor(() => expect(c.container.querySelector("section")).toBeNull());
  });
  it("the office composer needs a title, asks before sending, and sends the area", async () => {
    const calls = stub({ "POST /office/area-alerts": () => json(201, { data: {} }) });
    const u = userEvent.setup();
    render(<AreaAlertComposer constituency="demo-1" />);
    expect(screen.getByRole("button", { name: "পাঠান" })).toBeDisabled();
    await u.type(screen.getByLabelText("শিরোনাম (বাংলা)"), "বন্যার সতর্কতা");
    await u.click(screen.getByRole("button", { name: "পাঠান" }));
    expect(calls).toHaveLength(0);
    await u.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "পাঠান" }));
    await waitFor(() => expect(calls.find((c) => c.key === "POST /office/area-alerts")?.body).toEqual({ constituency: "demo-1", title_bn: "বন্যার সতর্কতা" }));
  });
});

describe("notification kinds in Settings", () => {
  const prefs = { channels: { in_app: true, push: false, email: false }, muted_types: [], quiet_hours: null, timezone: "Asia/Dhaka", personalization_enabled: true };
  it("offers the Release 1.1 types only when the server has Phase 7 on", async () => {
    stub({ "GET /me/notification-preferences": () => json(200, { data: prefs }), "GET /features": () => json(200, { data: [{ key: "consultations", enabled: false }] }) });
    const a = render(<NoticeTypePrefs signedIn />);
    await screen.findByRole("checkbox", { name: dict.bn.ntp_announcement });
    expect(screen.queryByRole("checkbox", { name: dict.bn.ntp_area_alert })).toBeNull();
    a.unmount();
    stub({ "GET /me/notification-preferences": () => json(200, { data: prefs }), "GET /features": () => json(200, { data: [{ key: "consultations", enabled: true }] }) });
    render(<NoticeTypePrefs signedIn />);
    expect(await screen.findByRole("checkbox", { name: dict.bn.ntp_area_alert })).toBeInTheDocument();
  });
});

describe("the message entry page", () => {
  it("is a 404 with the flag off, shows no invented number, and with numbers set shows them and a WhatsApp link", async () => {
    const { default: Channels } = await import("@/app/help/channels/page");
    flagOn = false;
    await expect(Channels()).rejects.toThrow();
    flagOn = true;
    const a = render(await Channels());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("WhatsApp বা এসএমএসে জানান");
    expect(screen.getAllByText("নম্বর এখনো প্রকাশ করা হয়নি।")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "WhatsApp-এ জানান" })).toBeNull();
    a.unmount();
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_NUMBER", "+880 1700 000000");
    render(await Channels());
    expect(screen.getByRole("link", { name: "WhatsApp-এ জানান" })).toHaveAttribute("href", "https://wa.me/8801700000000");
  });
});

