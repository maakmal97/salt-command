/* Salt Command service worker.
   Caches the app shell so the desk opens with no signal. It never caches the queue
   API: /queue, /vault, /bio and /bye must always hit the Worker, or a stale ping
   would strand the desk in read-only mode and a cached POST is meaningless. */

const CACHE = "salt-shell-v5";   /* bumped 08 Sep 2026: /orders and /stmt-users leave the cache */

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
/* /drafts joins at v302 and it is the sharpest case yet. A cached draft list would show a
   row that has already been approved, and tapping it again would be refused as a 409 with
   no way for the phone to know why; worse, an approved row would keep asking to be approved
   while the one actually waiting stayed invisible. It was left out of this list at first and
   the self-test caught it: a deleted draft was still on screen after a reload. */
/* /orders, /stmt-users and /draft-now join 08 Sep 2026: the desk fetches the first two by GET,
   and the page's own cache:'no-store' never reaches a service worker, whose "everything else"
   branch stored any 200 for ever. The phone's order list froze at first load. */
const API = /^\/(queue|vault|bio|bye|menu|qr|rev|rev\.json|drafts|push|orders|stmt-users|draft-now)(\/|$)/;

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
    /* ONLY THE ROOT IS THE SHELL (v290). It used to cache EVERY navigation under "./", which
       was harmless while the root was the only page there was, and became a hazard at v290
       when a visit to /desk could overwrite the app as the offline shell. From v387 there is
       one surface again and the desk IS the root, so the two can no longer disagree; the
       check stays narrow because /desk is still a live route to the same page. */
    const isRoot = url.pathname === "/";
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (isRoot && res && res.status === 200 && res.type === "basic" && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./", copy));
          }
          return res;
        })
        .catch(() => caches.match(isRoot ? "./" : req, { ignoreSearch: true })
          .then((hit) => hit || caches.match("./", { ignoreSearch: true })))
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


/* ============================================================================
   WEB PUSH (v321)

   THE PUSH CARRIES NO PAYLOAD, ON PURPOSE. Encrypting one per RFC 8291 is a lot of fiddly
   crypto to get exactly right in a Worker, and the text would go stale between being sent
   and being read. So the push is a WAKE: this worker comes to life, reads the live state,
   and writes the banner from what is true now.

   THE KEY LIVES IN IndexedDB, not localStorage, because a service worker cannot see
   localStorage at all. The app writes it there when you turn alerts on. Without it the
   summary read is refused, and rather than lie about the count we show a banner that says
   only that something needs a look.
   ============================================================================ */
const KEYDB = "salt-push", KEYSTORE = "kv";

function idb(mode, fn) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(KEYDB, 1); } catch { return resolve(null); }
    req.onupgradeneeded = () => { try { req.result.createObjectStore(KEYSTORE); } catch {} };
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      try {
        const tx = req.result.transaction(KEYSTORE, mode);
        const r = fn(tx.objectStore(KEYSTORE));
        r.onsuccess = () => resolve(r.result === undefined ? true : r.result);
        r.onerror = () => resolve(null);
      } catch { resolve(null); }
    };
  });
}
const getKey = () => idb("readonly", (st) => st.get("writeKey"));

/* ONE BANNER, NOT A PILE. Every notification shares a tag so a second wake REPLACES the first
   rather than stacking behind it. Four a day that each replace the last is a glance; four that
   queue up is a chore, and a chore gets swiped away unread. */
async function banner() {
  const key = await getKey();
  let s = null;
  try {
    const r = await fetch("push/summary", { cache: "no-store", headers: key ? { "X-Salt-Key": key } : {} });
    if (r.ok) s = await r.json();
  } catch { /* offline, or the desk is down: fall through to the generic banner */ }

  if (!s) {
    return { title: "Salt Command", body: "Something needs a look. Open the desk.", tag: "salt" };
  }
  const bits = [];
  /* v759: THE REFUND FIRST. It is money he is holding that is somebody else's, which is the one
     thing on this list the desk calls Now from the day it is raised (v708). */
  if (s.refunds) bits.push(s.refunds === 1 ? "1 refund to pay back" : s.refunds + " refunds to pay back");
  if (s.pending) bits.push(s.pending === 1 ? "1 row waiting for approval" : s.pending + " rows waiting for approval");
  if (s.countDue && s.countDue.length) {
    bits.push(s.countDue.length === 1 ? s.countDue[0] + " not counted today" : "neither shelf counted today");
  }
  if (s.refused) bits.push(s.refused === 1 ? "1 entry the drafter refused" : s.refused + " entries the drafter refused");

  /* A CUSTOMER ORDER LEADS (16 Sep 2026): it is the one thing here a customer is waiting on, so it
     is the title, and a tap opens the Orders card where it is acknowledged. IT NO LONGER HIDES THE
     REST (v759): this returned before the list was built, so while any order was waiting the wake
     said nothing about a row owed a decision, a refund, or a shelf not counted. */
  if (s.orders) {
    return {
      title: s.orders === 1 ? "New customer order" : s.orders + " customer orders waiting",
      body: "Open the desk to acknowledge it." + (bits.length ? " Also " + bits.join(" \u00b7 ") + "." : ""),
      tag: "salt",
      url: "./desk#orders",
    };
  }

  return {
    title: bits.length ? "Salt Command" : "Salt Command is square",
    body: bits.length ? bits.join(" \u00b7 ") : "Nothing waiting. Nothing owed a decision.",
    tag: "salt",
  };
}

self.addEventListener("push", (e) => {
  e.waitUntil(banner().then((b) => self.registration.showNotification(b.title, {
    body: b.body,
    tag: b.tag,
    renotify: true,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: b.url || "./" },
  })));
});

/* Focus the desk if it is already open rather than opening a second copy of it, and take it to
   the view the banner names. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const want = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.indexOf(self.registration.scope) === 0 && "focus" in c) {
        return c.focus().then((w) => (w && w.navigate && w.url !== want ? w.navigate(want).catch(() => w) : w));
      }
    }
    return clients.openWindow(want);
  }));
});
