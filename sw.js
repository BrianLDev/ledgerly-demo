// Ledgerly service worker (TODO 7.1): an app shell that opens offline.
// - Hashed build assets and icons: cache-first (their names change when they do).
// - Pages: network-first, falling back to the cached shell when offline.
// - The API (/api/) is never cached: financial data stays out of the browser cache.
// - demo-data.json (static demo only, fictional): network-first so the demo works offline.
const CACHE = "ledgerly-v1";
const scope = new URL(self.registration.scope);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(scope.href, { cache: "reload" }))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (fallback && (await cache.match(fallback))) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== scope.origin || url.pathname.includes("/api/")) return;
  if (req.mode === "navigate") return e.respondWith(networkFirst(req, scope.href));
  if (url.pathname.endsWith("/demo-data.json")) return e.respondWith(networkFirst(req));
  if (url.pathname.includes("/assets/") || url.pathname.includes("/icons/")) return e.respondWith(cacheFirst(req));
});
