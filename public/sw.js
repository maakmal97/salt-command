/* Salt Command service worker.
   Caches the app shell so the desk opens with no signal. It never caches the queue
   API: /queue, /vault, /bio and /bye must always hit the Worker, or a stale ping
   would strand the desk in read-only mode and a cached POST is meaningless. */

/* bumped 08 Sep 2026: /orders and /stmt-users leave the cache. Bumped 28 Sep 2026: the manifest names the desk Salt Desk,
   and the manifest and icons are served cache first below and sit outside the build id, so a phone reads a new one only
   when this name moves: a change to either bumps it in the same version. Bumped 29 Sep 2026 (Step 7): /threads joins the API,
   and a phone's old cache may hold a first answer to it. */
const CACHE = "salt-shell-v7";

/* "./index.html" is deliberately absent: the host serves "./" and a navigation
   cannot be answered from a redirected response. The manifest starts at "./" too. */
const SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  /* the brand faces (22 Sep 2026): cached with the shell, so the desk reads in its own type offline */
  "./fonts/fraunces-latin.woff2",
  "./fonts/jetbrains-mono-latin.woff2"
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
/* /bulletin joins 26 Sep 2026 for the same reason: his editor read back the notice it first cached. */
/* /slips joins 29 Sep 2026 (F13): a slip is fetched live when he opens it, and never kept on the phone, ciphertext or not. */
/* /threads joins 29 Sep 2026 (Step 7): his Chat reads it every 2 seconds, and a cached first answer would be all it ever read. */
const API = /^\/(queue|vault|bio|bye|menu|qr|rev|rev\.json|drafts|push|orders|stmt-users|draft-now|bulletin|slips|threads)(\/|$)/;

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
/* THE MARK: the moment of the newest customer line already shown, kept here beside the key. `idb` answers true
   for a key never written, so only a string is a mark. */
const getSince = () => idb("readonly", (st) => st.get("since")).then((v) => (typeof v === "string" ? v : null));
const putSince = (at) => idb("readwrite", (st) => st.put(String(at), "since"));

/* THE STATUS IS ONE BANNER, NOT A PILE. It keeps a single tag, so a second wake REPLACES the first rather than
   stacking behind it: four a day that each replace the last is a glance; four that queue up is a chore, and a
   chore gets swiped away unread.
   A CUSTOMER'S LINE IS THE EXCEPTION (29 Sep 2026): EACH LINE IS A BANNER OF ITS OWN, tagged by its moment so none
   replaces another. The summary hands over the lines newer than the mark sent as `?since=` (at most three); once
   they are shown the mark moves to the newest, so a line is shown once. */
const n1 = (n, one, many) => (n === 1 ? "1 " + one : n + " " + many);
const join = (a) => (a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0]);
/* WHAT WAITS, BY DEADLINE, soonest first, a group a line: Now, then Today, then the orders acknowledged and still waiting on
   him, on a last line with no group word (a by-when comes later). Nothing here is a code, a name or an amount. */
function tail(s) {
  const now = [], today = [], out = [];
  if (s.refunds) now.push("pay back " + n1(s.refunds, "refund", "refunds"));   /* v759: money he is holding that is somebody else's */
  const cd = (s.countDue || []).filter((x) => typeof x === "string" && /^[A-Za-z0-9 _-]{1,20}$/.test(x));
  if (cd.length) today.push("count " + join(cd));
  if (s.pending) today.push("approve " + n1(s.pending, "row", "rows"));
  if (s.refused) today.push("check " + n1(s.refused, "refused entry", "refused entries"));
  if (now.length) out.push("Now: " + now.join(", ") + ".");
  if (today.length) out.push("Today: " + today.join(", ") + ".");
  const rest = (s.orders || 0) - (s.placed || 0);   /* only a placed order is his to acknowledge; the rest are rows (v766) */
  if (rest > 0) out.push(n1(rest, "order", "orders") + " waiting on you.");
  return out.join("\n");
}
const withTail = (line, t) => (t ? line + "\n" + t : line);

async function banners() {
  const key = await getKey(), since = await getSince();
  let s = null;
  try {
    const r = await fetch("push/summary" + (since ? "?since=" + encodeURIComponent(since) : ""), { cache: "no-store", headers: key ? { "X-Salt-Key": key } : {} });
    if (r.ok) s = await r.json();
  } catch { /* offline, or the desk is down: fall through to the generic banner */ }

  if (!s) {
    return { list: [{ title: "Something needs a look", body: "The desk could not say what just now. Open it to see.", tag: "salt" }], newest: null };
  }
  const list = [];
  const lines = (s.lines || []).filter((x) => x && typeof x.at === "string" && typeof x.t === "string").slice(0, 3);
  for (const x of lines) list.push({ title: "A customer wrote", body: "“" + x.t + "”", tag: "m-" + x.at, url: "./desk#orders/newest" });
  const newest = lines.length ? lines[lines.length - 1].at : null;
  const t = tail(s);

  /* v760: WHAT A CUSTOMER JUST DID LEADS OVER WHAT IS MERELY WAITING. A payment or a withdrawal is
     minutes old and is why this wake was sent; the count of orders waiting was as true an hour ago.
     It still opens Orders, because that is where the answer to it is.
     S11 11.16: THE NEWS NAMES THE KIND OF ACT AND NOTHING ELSE (src/orders.js NEWS_WORD), so it is taken
     only in letters and spaces: a roster code or an amount carries a digit and never reaches the title.
     "A customer wrote" is that news for a line, and a line shown above says it already: it is not repeated. */
  if (s.news && /^[A-Za-z ]{1,60}$/.test(String(s.news)) && !(lines.length && s.news === "A customer wrote")) {
    const what = s.news === "A customer says they paid" ? "Check it arrived, then tap Received or Not found."
      : s.news === "A customer cancelled" ? "Tap to see which order." : "Open the desk to look.";
    list.push({ title: s.news, body: withTail(what, t), tag: "salt", url: "./desk#orders/newest" /* the card of the newest act, which is what woke him (S11) */ });
    return { list, newest };
  }
  /* A CUSTOMER ORDER LEADS (16 Sep 2026): it is the one thing here a customer is waiting on, so it
     is the title, and a tap opens the Orders card where it is acknowledged. IT DOES NOT HIDE
     THE REST (v759): the list below it says what else waits.
     24 Sep 2026: ONLY A PLACED ORDER IS HIS TO ACKNOWLEDGE. `orders` counts the acknowledged ones as
     well, which are rows (v766), so those are named in the tail and never asked to be acknowledged. */
  const placed = s.placed || 0;
  if (placed) {
    list.push({ title: placed === 1 ? "New order" : placed + " new orders",
      body: withTail(placed === 1 ? "Acknowledge it on the desk." : "Acknowledge them on the desk.", t), tag: "salt", url: "./desk#orders/newest" });
    return { list, newest };
  }
  if (t) list.push({ title: "Waiting on you", body: t, tag: "salt", url: (s.orders || 0) > 0 ? "./desk#orders" : undefined });
  /* a push must show something: a line counts, and only when there is none does "All square" stand */
  else if (!lines.length) list.push({ title: "All square", body: "Nothing waiting, and nothing owed a decision.", tag: "salt" });
  return { list, newest };
}

/* A PUSH WAKES AN OPEN DESK (26 Sep 2026). The banner reached only this worker, so a desk already on
   screen learnt of a new build at its next ten-second /rev tick and of a new row at Approve's thirty-second
   poll, or at a reload. So every desk this worker controls is told as well, beside the banner and not after
   it, since the banner waits on a read of its own. The worker only says so: `{salt:'wake'}` carries no code,
   name or amount, and the page decides what to read, under its own busy, hidden and focus guards
   (tools/build.mjs, the PWA block). A desk that cannot be told never stops the banner or the others. */
function wakeDesks() {
  try {
    return clients.matchAll({ type: "window" })
      .then((list) => { for (const c of list) { try { c.postMessage({ salt: "wake" }); } catch (x) { /* the next desk */ } } })
      .catch(() => {});
  } catch (x) { return Promise.resolve(); }
}

self.addEventListener("push", (e) => {
  e.waitUntil(Promise.all([wakeDesks(), banners().then(async (r) => {
    for (const b of r.list) {
      await self.registration.showNotification(b.title, {
        body: b.body,
        tag: b.tag,
        renotify: true,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        data: { url: b.url || "./" },
      });
    }
    if (r.newest) await putSince(r.newest);   /* the mark moves only once its lines are shown */
  })]));
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
