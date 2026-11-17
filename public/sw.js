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

// Web Push (F.10). The server sends no payload, so the push event only says "something is waiting".
// We ask the API how many unread items there are, then show ONE fixed alert: never report text, names or references,
// so nothing sensitive can appear on a lock screen. The wording is in both languages because a worker cannot read the page's language.
const NOTICE_TITLE = "জনকথা · Jonokotha";
const NOTICE_BODY = "নতুন খবর আছে · There is news";
const NOTICE_TAG = "jk-news"; // one alert at a time: a new push replaces the old one

async function unreadCount() {
  try {
    const res = await fetch("/api/v1/me/notifications?unread=true&limit=1", { credentials: "same-origin", headers: { accept: "application/json" } });
    if (!res.ok) return null; // signed out or error: still show the generic alert (browsers require one)
    const n = Number(res.headers.get("x-unread-count"));
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

self.addEventListener("push", (e) => {
  e.waitUntil(unreadCount().then((n) => self.registration.showNotification(NOTICE_TITLE, {
    body: n && n > 1 ? `${NOTICE_BODY} (${n})` : NOTICE_BODY,
    tag: NOTICE_TAG,
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: "/notifications" },
  })));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL("/notifications", self.location.origin).href; // always the list: the alert holds nothing to deep-link
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin));
      if (open && "focus" in open) return open.navigate(target).then((c) => (c || open).focus()).catch(() => open.focus());
      return self.clients.openWindow(target);
    }),
  );
});
