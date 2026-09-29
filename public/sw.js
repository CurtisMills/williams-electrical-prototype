// Williams Electrical Staff Portal (employee): keeps the Today screen available with no signal.
// Pages are network-first (fresh when online, last copy when offline); build assets are cache-first.
const CACHE = "we-field-v2";
// Registered as /sw.js?dev=1 under `next dev`, where asset names are reused between edits,
// so assets are network-first there too (the cache is only a fallback).
const DEV = new URL(self.location.href).searchParams.has("dev");

const networkFirst = (req, key) =>
  fetch(req)
    .then((res) => {
      if (res.ok && !res.redirected) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(key, copy));
      }
      return res;
    })
    .catch(() => caches.match(key).then((hit) => hit || caches.match("/field")));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("webpack-hmr") || url.pathname.startsWith("/__nextjs")) return;

  const isAsset = url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?|ttf|css|js)$/.test(url.pathname);
  if (isAsset && DEV) {
    event.respondWith(networkFirst(req, req));
    return;
  }
  if (isAsset) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate" && url.pathname.startsWith("/field")) {
    event.respondWith(networkFirst(req, url.pathname));
  }
});
