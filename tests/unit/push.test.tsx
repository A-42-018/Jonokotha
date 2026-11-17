import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import PushSettings from "@/components/me/PushSettings";
import { ToastProvider } from "@/components/ui/Toast";
import { dict } from "@/lib/i18n";
import { keyToBytes, quietError } from "@/lib/push";

const t = dict.bn;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const PREFS = { channels: { in_app: true, push: false, email: false }, muted_types: [], quiet_hours: null, timezone: "Asia/Dhaka", personalization_enabled: true };

type Ev = Record<string, unknown>;

/** Runs public/sw.js against a fake scope, as sw.test.ts does, to test the push and click handlers. */
function bootSw(fetchImpl: () => Promise<Response>) {
  const handlers: Record<string, (e: Ev) => void> = {};
  const shown: { title: string; opts: Record<string, unknown> }[] = [];
  const openWindow = vi.fn(async () => undefined);
  const fetchMock = vi.fn(fetchImpl);
  const self = {
    location: { href: "https://jonokotha.test/sw.js?v=x", origin: "https://jonokotha.test" },
    addEventListener: (n: string, h: (e: Ev) => void) => { handlers[n] = h; },
    registration: { showNotification: vi.fn(async (title: string, opts: Record<string, unknown>) => { shown.push({ title, opts }); }) },
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []), openWindow },
    skipWaiting: vi.fn(),
  };
  const src = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  new Function("self", "caches", "URL", "fetch", src)(self, {}, URL, fetchMock);
  const run = async (type: string, e: Ev = {}) => {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...e, waitUntil: (x: Promise<unknown>) => { p = x; } });
    await p;
  };
  return { shown, run, openWindow, fetchMock };
}

describe("service worker push", () => {
  it("fetches the unread count after a payload-less push and shows one generic alert", async () => {
    const sw = bootSw(async () => json(200, { data: [{ title: "JK-2026-0042 secret title" }] }, { "x-unread-count": "3" }));
    await sw.run("push");
    expect(sw.fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/me/notifications"), expect.anything());
    expect(sw.shown).toHaveLength(1);
    const { title, opts } = sw.shown[0];
    expect(title).toContain("জনকথা");
    expect(opts.body).toContain("(3)");
    expect(opts.tag).toBe("jk-news");
    // Nothing from the API response can reach the lock screen.
    expect(JSON.stringify(sw.shown)).not.toMatch(/JK-2026|secret/);
  });

  it("still shows the generic alert when signed out or offline (browsers require one)", async () => {
    for (const impl of [async () => json(401, { code: "unauthorized" }), async () => { throw new TypeError("offline"); }]) {
      const sw = bootSw(impl);
      await sw.run("push");
      expect(sw.shown).toHaveLength(1);
      expect(sw.shown[0].opts.body).toBe("নতুন খবর আছে · There is news");
    }
  });

  it("opens the notification list on click, never a page tied to a report", async () => {
    const sw = bootSw(async () => json(200, {}));
    const close = vi.fn();
    await sw.run("notificationclick", { notification: { close } });
    expect(close).toHaveBeenCalled();
    expect(sw.openWindow).toHaveBeenCalledWith("https://jonokotha.test/notifications");
  });
});

describe("push helpers", () => {
  it("turns the URL-safe VAPID key into bytes", () => {
    expect(Array.from(keyToBytes("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(keyToBytes("-_8"))).toEqual([251, 255]);
  });
  it("accepts quiet hours that cross midnight and refuses equal or malformed times", () => {
    expect(quietError("22:00", "07:00")).toBeNull();
    expect(quietError("08:00", "08:00")).toBe("pushQuietBad");
    expect(quietError("25:00", "07:00")).toBe("pushQuietBad");
    expect(quietError("", "07:00")).toBe("pushQuietBad");
  });
});

describe("PushSettings", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const wrap = (signedIn = true) => render(<ToastProvider><PushSettings signedIn={signedIn} /></ToastProvider>);

  /** A browser that can do push: fake service worker registration, PushManager and Notification. */
  function pushBrowser(opts: { permission?: NotificationPermission; request?: NotificationPermission; subscribed?: boolean } = {}) {
    type Sub = { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> };
    let sub: Sub | null = null;
    const mkSub = (): Sub => ({ endpoint: "https://push.example/abc", toJSON: () => ({ keys: { p256dh: "pk", auth: "ak" } }), unsubscribe: vi.fn(async () => { sub = null; return true; }) });
    if (opts.subscribed) sub = mkSub();
    const reg = { pushManager: { getSubscription: vi.fn(async () => sub), subscribe: vi.fn(async () => (sub = mkSub())) } };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: vi.fn(async () => reg), ready: Promise.resolve(reg) } });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", Object.assign(class {}, { permission: opts.permission ?? "default", requestPermission: vi.fn(async () => opts.request ?? "granted") }));
    return reg;
  }

  it("asks signed-out visitors to sign in and calls nothing", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    wrap(false);
    expect(screen.getByText(t.pushSignIn)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });

  it("subscribes on the button, tells the server, and turns the channel on", async () => {
    const reg = pushBrowser();
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("vapid-key")) return json(200, { data: { available: true, public_key: "AQID" } });
      if (url.includes("push-subscriptions")) return json(201, { data: { subscribed: true } });
      if (init?.method === "PUT") return json(200, { data: { ...PREFS, channels: { ...PREFS.channels, push: true } } });
      return json(200, { data: PREFS });
    }));
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: t.pushEnable }));
    await waitFor(() => expect(screen.getByText(t.pushOn)).toBeInTheDocument());
    expect(reg.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(calls).toContain("POST /api/v1/me/push-subscriptions");
    expect(calls).toContain("PUT /api/v1/me/notification-preferences");
  });

  it("explains a blocked permission and does not subscribe", async () => {
    const reg = pushBrowser({ request: "denied" });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("vapid-key") ? json(200, { data: { available: true, public_key: "AQID" } }) : json(200, { data: PREFS }))));
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: t.pushEnable }));
    expect(await screen.findByText(t.pushDenied)).toBeInTheDocument();
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("says so when the server has no push keys", async () => {
    pushBrowser();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("vapid-key") ? json(200, { data: { available: false } }) : json(200, { data: PREFS }))));
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: t.pushEnable }));
    expect(await screen.findByText(t.pushUnavailable)).toBeInTheDocument();
  });

  it("says push is not supported where the browser cannot do it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { data: PREFS })));
    wrap(); // jsdom has no PushManager
    expect(await screen.findByText(t.pushUnsupported)).toBeInTheDocument();
  });

  it("turns push off: removes the subscription and the channel", async () => {
    pushBrowser({ subscribed: true, permission: "granted" });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      return json(200, { data: init?.method === "PUT" ? PREFS : { ...PREFS, channels: { ...PREFS.channels, push: true } } });
    }));
    wrap();
    await userEvent.click(await screen.findByRole("button", { name: t.pushDisable }));
    await waitFor(() => expect(screen.getByText(t.pushOff)).toBeInTheDocument());
    expect(calls).toContain("DELETE /api/v1/me/push-subscriptions");
  });

  it("saves quiet hours, and refuses equal start and end without calling the server", async () => {
    pushBrowser();
    const puts: unknown[] = [];
    let server = PREFS; // the server keeps what was saved
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "PUT") { const body = JSON.parse(String(init.body)); puts.push(body); server = { ...server, ...body }; }
      return json(200, { data: server });
    }));
    wrap();
    await userEvent.click(await screen.findByLabelText(t.pushQuietOn));
    await userEvent.click(screen.getByRole("button", { name: t.pushQuietSave }));
    await waitFor(() => expect(puts).toEqual([{ quiet_hours: { start: "22:00", end: "07:00" } }]));
    const to = screen.getByLabelText(t.pushQuietTo);
    await userEvent.clear(to);
    await userEvent.type(to, "22:00");
    await userEvent.click(screen.getByRole("button", { name: t.pushQuietSave }));
    expect(await screen.findByText(t.pushQuietBad)).toBeInTheDocument();
    expect(puts).toHaveLength(1);
  });

  it("shows an error with a retry when the preferences cannot be loaded", async () => {
    pushBrowser();
    vi.stubGlobal("fetch", vi.fn(async () => json(403, { code: "forbidden" })));
    wrap();
    expect(await screen.findByText(t.pushLoadError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.pushRetry })).toBeInTheDocument();
  });
});
