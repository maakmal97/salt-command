/* Salt Command service worker.
   Caches the app shell so the desk opens with no signal. It never caches the queue
   API: /queue, /vault, /bio and /bye must always hit the Worker, or a stale ping
   would strand the desk in read-only mode and a cached POST is meaningless. */

const CACHE = "salt-shell-v1";

/* "./index.html" is deliberately absent: the host serves "./" and a navigation
   cannot be answered from a redirected response. The manifest starts at "./" too. */
const SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

/* The desk's own HTTP contract. These are answered by the Worker, never the cache.
   /rev and its manifest are here for the same reason and it is the sharpest case: a
   cached freshness check would report the build it was cached with for ever, so the
   poll would prove the phone current at the exact moment it went stale. */
const API = /^\/(queue|vault|bio|bye|menu|qr|rev|rev\.json)(\/|$)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                  // POSTs (the queue push) pass straight through
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch third-party requests
  if (API.test(url.pathname)) return;                // the queue API is live, never cached

  /* The shell is network first, so a fresh build reaches the phone without a CACHE
     bump. Falls back to the cached shell with no signal, which is the whole point. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic" && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./", copy));
          }
          return res;
        })
        .catch(() => caches.match("./", { ignoreSearch: true }))
    );
    return;
  }

  /* Everything else (icons, manifest) is cache first: those files are immutable. */
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic" && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("./"));
    })
  );
});
