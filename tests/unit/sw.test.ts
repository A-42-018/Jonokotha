import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

type Handler = (e: Record<string, unknown>) => void;

/** Runs public/sw.js against a fake service-worker scope, so cache versioning is tested without a browser. */
function boot(version: string, existing: string[]) {
  const handlers: Record<string, Handler> = {};
  const deleted: string[] = [];
  const opened: string[] = [];
  const caches = {
    open: vi.fn(async (name: string) => { opened.push(name); return { addAll: vi.fn(async () => {}), put: vi.fn() }; }),
    keys: vi.fn(async () => existing),
    delete: vi.fn(async (k: string) => { deleted.push(k); return true; }),
    match: vi.fn(async () => undefined),
  };
  const self = { location: { href: `https://jonokotha.test/sw.js?v=${version}`, origin: "https://jonokotha.test" }, addEventListener: (n: string, h: Handler) => { handlers[n] = h; }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } };
  const src = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  new Function("self", "caches", "URL", "fetch", src)(self, caches, URL, vi.fn(() => Promise.resolve(new Response("ok"))));
  const wait = async (type: string) => { let p: Promise<unknown> = Promise.resolve(); handlers[type]({ waitUntil: (x: Promise<unknown>) => { p = x; } }); await p; };
  return { handlers, deleted, opened, self, wait };
}

describe("service worker versioning", () => {
  it("names its cache after the build id and deletes every other cache on activate", async () => {
    const sw = boot("abc123", ["jk-v1", "jk-abc123", "jk-old999"]);
    await sw.wait("install");
    expect(sw.opened).toEqual(["jk-abc123"]);
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    await sw.wait("activate");
    expect(sw.deleted.sort()).toEqual(["jk-old999", "jk-v1"]);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });
  it("does not intercept API calls or non-GET requests", () => {
    const sw = boot("x", []);
    const respondWith = vi.fn();
    sw.handlers.fetch({ request: { method: "GET", url: "https://jonokotha.test/api/cases", mode: "cors" }, respondWith });
    sw.handlers.fetch({ request: { method: "POST", url: "https://jonokotha.test/api/cases", mode: "cors" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
  it("answers navigations (offline fallback) and static files, but not other pages' data", () => {
    const sw = boot("x", []);
    const respondWith = vi.fn();
    sw.handlers.fetch({ request: { method: "GET", url: "https://jonokotha.test/me", mode: "navigate" }, respondWith });
    sw.handlers.fetch({ request: { method: "GET", url: "https://jonokotha.test/_next/static/chunks/a.js", mode: "no-cors" }, respondWith });
    sw.handlers.fetch({ request: { method: "GET", url: "https://jonokotha.test/me?_rsc=1", mode: "cors" }, respondWith });
    expect(respondWith).toHaveBeenCalledTimes(2);
  });
});
