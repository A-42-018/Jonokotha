// Jonokotha service worker. Registered as /sw.js?v=<build id> (RegisterSW), so every deploy installs a fresh worker
// with its own cache, and activate deletes the caches of earlier versions. Bump nothing by hand.
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PREFIX = "jk-";
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = ["/offline", "/illustrations/state-offline.svg", "/illustrations/logo-mark.svg"];
// Only public, versioned or rarely changing files are cached. Pages (they can hold personal data) and /api are never stored.
const STATIC = /^\/(_next\/static\/|illustrations\/|icons\/|vendor\/)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    // Network first; with no connection show the offline page instead of the browser's error.
    e.respondWith(fetch(req).catch(() => caches.match("/offline")));
  } else if (STATIC.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
