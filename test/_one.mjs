/* verify.mjs — smoke tests for the new cloud surface.
 *
 * Covers the risky new code: the Worker's queue contract against a KV mock, the build's
 * patch integrity and script validity, and the drain's pure helpers. The desk's own
 * rendering is tested by the daily run's jsdom pass; this suite guards the cloud plumbing.
 * No network, no browser: `npm test` runs it in a couple of seconds.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { DATA_DIR, PROJECT_DIR } from "../tools/book.mjs";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import stmtWorker, { normUser } from "../stmt/worker.js";
import { unionByAt, pruneCommitted } from "../tools/drain.mjs";
import { NAME_STOPWORDS, NAME_COLLISIONS, areaNameSet, publishedLocalities } from "../tools/book.mjs";
import { opened } from "../tools/payload.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL: " + m); } };
/* AN ASSERTION THAT CANNOT RUN ON EVERY MACHINE IS NOT PART OF THE FLOOR (v437). Two blocks read
   files that live outside this repo and can never enter it: the plaintext directory (hard rule 3)
   and serve_desk.py. So the laptop runs ten checks CI cannot, the floor was raised to the laptop's
   count at v434, and CI has failed on that one line ever since -- through v434, v435 and v436, each
   of which was reported as shipped and green. Nothing substantive failed; the instrument did. Both
   halves of that are the round-ten lesson: a floor calibrated on one machine and enforced on
   another is not a floor, and a red run nobody reads is the same as no run.
   okOff counts as a pass or a fail exactly as ok does. It is subtracted from the FLOOR only, so
   the floor measures what every machine reaches and CI and the laptop can agree on it. */
let offMachine = 0;
const okOff = (c, m) => { offMachine++; ok(c, m); };
const skipOff = (m) => { console.log("  SKIP: " + m); };
/* A SKIP IS NOT A PASS (v442). Nine assertions were written as ok(true, "... (skipped)") for a
   state the book happens not to carry. Each was counted as proof, and each is an assertion that
   CANNOT FAIL, which is the fault this whole round is about: a green tick for a check that never
   ran. None of them is firing today, so nothing was actually being covered up, and that is
   exactly why it was worth fixing now rather than after a book change made one fire silently.
   skipData prints and counts NOTHING, so a section that goes quiet takes the assertion floor
   down with it and CI says so. It is deliberately NOT okOff: okOff is for a check this MACHINE
   cannot run, which is a property of where you are, and this is a check the BOOK cannot feed,
   which is a property of the data and can change under you.
   The floor keeps a margin for these, and the margin is not room for a section to fall out. */
const skipData = (m) => { console.log("  SKIP (no data): " + m); };
let sections = 0;
/* EACH SECTION'S BODY IS ITS OWN ASYNC FUNCTION, `await (async () => { ... })();` (17 Sep 2026). A block at
   the top level of this module is never freed: the module body is suspended at every await, and V8 keeps what
   its blocks held for as long as it runs, closed jsdom window or not. So every desk window stayed alive to the
   end, 4,031 MB of them after a forced GC at v682, and the Linux runner died of heap exhaustion in the v678
   sections while the laptop scraped through. One wrapper around the whole suite does not help, since that
   function is suspended just the same; each section has to return. The last section checks the shape.
   AND EVERY WINDOW openMaster OPENED IS CLOSED HERE, WHEN THE NEXT SECTION STARTS. Most sections never closed
   theirs, and a window left open is held by its own pending timers. Those timers do not fire between sections:
   most sections never yield to the event loop, so a timer waits for the next one that does file or crypto work,
   and a close put on a timer would wait with them. So the close is immediate. */
const section = (s) => {
  for (const w of opened) { try { w.close(); } catch (e) { /* closed already */ } }
  opened.clear();
  sections++; console.log("\n" + s);
};

/* ---- KV + env mocks ------------------------------------------------------------- */
class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  /* v688: the options are kept as well as the value. Real KV expires a key by them, and a route
     that means to write something short-lived (a sent tick, a one-time link) is only doing that
     if the expiry is really passed; ignoring them here would pass either way. */
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  /* Real KV takes a type argument and "json" parses for you. The statement route uses it, so
     the stand-in has to as well, or a call that works here fails in production. */
  async get(k, type) {
    if (!this.m.has(k)) return null;
    const raw = this.m.get(k);
    return type === "json" ? JSON.parse(raw) : raw;
  }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
  }
}
const assets = {
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === "/missing") return new Response("nope", { status: 404 });
    /* v387: THE FILES THAT ARE GONE 404 HERE TOO, or the harness cannot see the fallback.
       public/index.html and public/data.json are retired with the app, so the asset store
       has neither, and /app is no longer a route: all three land on the SPA fallback. */
    if (p === "/index.html" || p === "/data.json" || p === "/app") return new Response("nope", { status: 404 });
    if (p === "/") return new Response("nope", { status: 404 });
    return new Response("ASSET:" + p, { status: 200 });
  }
};
const mkEnv = (kv, requireAccess = "0") => ({ SALT_QUEUE: kv, ASSETS: assets, REQUIRE_ACCESS: requireAccess });
const req = (path, opts = {}) => new Request("https://salt-command.example" + path, opts);
const postQ = (body, extraHeaders = {}) => req("/queue", {
  method: "POST", headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body)
});

/* ---- 1. Worker: the queue contract --------------------------------------------- */
section("v759: every wake the desk mints reaches the phone, and the banner names what is waiting");
await (async () => {
  /* MEASURED ON THE LIVE STORE, 21 SEP 2026. All three of his subscriptions carried topics ["orders"]
     and nothing else, so sendPush dropped two of the three kinds of wake the desk mints: the row
     drafted from a CUSTOMER'S order, which waits under Approve, and the morning round, which is the
     only thing that chases money he is holding that is somebody else's. v708 says the round wakes him
     on an open refund; it could not, and had not since 16 September. THE FIXTURES IN THE SUITE WERE
     WIDER THAN HIS PHONE: v675's "everything" record and v708's push:aa11 both carry no topics at all,
     so both proved a send that his own device would have filtered. This section pins the shape his
     phone actually carries. */
  const { sendPush } = await import("../src/push.js");
  const { runDrafter } = await import("../src/drafter.js");
  const deskW9 = (await import("../src/worker.js")).default;
  const kp9 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapid9 = { VAPID_PUBLIC_KEY: "pub", VAPID_SUBJECT: "mailto:a@b.test",
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", kp9.privateKey)) };

  /* ---- 1. THE THREE KINDS OF WAKE, against the shape his phone carries ---- */
  const kv9 = new KV();
  await kv9.put("push:was", JSON.stringify({ endpoint: "https://push.example/as-it-was", topics: ["orders"] }));
  await kv9.put("push:now", JSON.stringify({ endpoint: "https://push.example/as-it-is", topics: ["orders", "approve", "salt"] }));
  const env9 = Object.assign({ SALT_QUEUE: kv9 }, vapid9);
  const fire = async (tag) => {
    const realF = globalThis.fetch, hit = [];
    globalThis.fetch = async (u) => { hit.push(String(u)); return new Response("", { status: 201 }); };
    try { await sendPush(env9, { tag }); } finally { globalThis.fetch = realF; }
    return hit.map((u) => u.split("/").pop()).sort();
  };
  const wOrders = await fire("orders"), wApprove = await fire("approve"), wSalt = await fire("salt");
  ok(JSON.stringify(wOrders) === '["as-it-is","as-it-was"]',
    "an order wakes both the old shape and the new: " + JSON.stringify(wOrders));
  ok(JSON.stringify(wApprove) === '["as-it-is"]' && JSON.stringify(wSalt) === '["as-it-is"]',
    "and a row waiting for approval and the morning round reach the device that asks for all three, "
    + "and reached nobody at all while every device asked for orders alone: " + JSON.stringify({ wApprove, wSalt }));

  /* ---- 2. THE SWITCH ASKS FOR ALL THREE, AND AN OLD SUBSCRIPTION IS UPGRADED WITHOUT A TAP ----
     The record is keyed by the endpoint's hash, so posting it again widens the same record. It is done
     once a load and only where a subscription is already on file, because a switch he turned on in
     September must not have to be turned off and on again to hear what it was always meant to hear. */
  const { openMaster: om59 } = await import("../tools/payload.mjs");
  const { w: w59 } = await om59();
  try {
    ok(JSON.stringify(w59.eval("ALERT_TOPICS")) === '["orders","approve","salt"]',
      "the desk names the three wakes it asks for in one place: " + JSON.stringify(w59.eval("ALERT_TOPICS")));
    const sent9 = [];
    const sub9 = { endpoint: "https://push.example/his-phone" };
    w59.localStorage.setItem("saltWriteKey", "k-fixture");
    const box9 = w59.document.createElement("div"); box9.id = "ordAlert"; w59.document.body.appendChild(box9);
    Object.defineProperty(w59.navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve({
      pushManager: { getSubscription: async () => sub9 } }) } });
    w59.PushManager = function () {};
    w59.Notification = { permission: "granted", requestPermission: async () => "granted" };
    w59.indexedDB = { open: () => { const rq = {}; setTimeout(() => { rq.result = { createObjectStore() {},
      transaction: () => { const tx = { objectStore: () => ({ put() {} }) }; setTimeout(() => tx.oncomplete && tx.oncomplete(), 0); return tx; } };
      if (rq.onsuccess) rq.onsuccess(); }, 0); return rq; } };
    w59.fetch = async (path, init) => { sent9.push({ path: String(path), key: init && init.headers && init.headers["X-Salt-Key"],
      body: init && init.body ? JSON.parse(init.body) : null }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
    await w59.eval("ordAlertDraw()");
    await new Promise((r) => setTimeout(r, 20));
    const ups = sent9.filter((x) => x.path === "push/subscribe");
    ok(ups.length === 1 && ups[0].key === "k-fixture"
      && JSON.stringify(ups[0].body) === '{"endpoint":"https://push.example/his-phone","topics":["orders","approve","salt"]}',
      "drawing the card over a subscription already on file widens it to all three, keyed and without a tap: " + JSON.stringify(ups));
    ok(/Alerts on/.test(box9.textContent) && /morning round/.test(box9.textContent),
      "and the switch says what now wakes the device: " + box9.textContent);
    await w59.eval("ordAlertDraw()");
    await new Promise((r) => setTimeout(r, 20));
    ok(sent9.filter((x) => x.path === "push/subscribe").length === 1,
      "it is done once a load and not once a draw: " + sent9.filter((x) => x.path === "push/subscribe").length);
  } finally { await new Promise((r) => setTimeout(r, 200)); try { w59.close(); } catch (e) { /* best effort */ } }

  /* ---- 3. A ROW HE JUST TYPED DOES NOT BUZZ THE PHONE HE TYPED IT ON ----
     The narrowing v675 wrote into the subscription is kept, at the source where it belongs. Both roads
     draft the same entry from the same store here, so neither can pass by drafting nothing. */
  const bookN = {
    version: "vN", pricing: { v: "vN", byProduct: { salt: { stockCost: 56, replCost: 56, floors: { "1": { floor: 60 } } } } },
    purchases: [{ date: "2026-08-13", supplier: "SA5-BTR", qty: 12.5, total: 700, receivedOn: "2026-08-13", receivedQty: 12.5 }],
    sales: [{ date: "2026-08-01", customer: "CC5-OKR", qty: 1, total: 90, cash: 90, deliveredQty: 1 }],
    state: { roster: ["CC5-OKR", "SA5-BTR"], QUEUE_COMMITTED: "2026-08-14T00:00:00.000Z" }
  };
  const mirrorN = (b) => {
    const self = { drafts: new Map(), refused: new Map() };
    self.prepare = (sql) => {
      const s = sql.replace(/\s+/g, " ").trim(); let binds = [];
      const api = {
        bind(...a) { binds = a; return api; },
        async all() {
          if (/^SELECT doc FROM entry/.test(s)) return { results: (b[binds[0]] || []).map((r) => ({ doc: JSON.stringify(r) })) };
          if (/^SELECT key,doc FROM state/.test(s)) return { results: Object.keys(b.state).map((k) => ({ key: k, doc: JSON.stringify(b.state[k]) })).concat([{ key: "PRICING", doc: JSON.stringify(b.pricing) }]) };
          if (/^SELECT id FROM draft/.test(s)) return { results: [...self.drafts.keys()].map((id) => ({ id })) };
          if (/^SELECT id,source FROM refused/.test(s)) return { results: [...self.refused.keys()].map((id) => ({ id })) };
          return { results: [] };
        },
        async first() {
          if (/^SELECT v,stamped FROM snapshot/.test(s)) return { v: b.version, stamped: null };
          if (/^SELECT MAX\(committed_at\)/.test(s)) return { t: null };
          if (/COUNT\(\*\)/.test(s)) return { n: 0 };
          return null;
        },
        async run() {
          if (/^INSERT OR IGNORE INTO draft/.test(s)) { self.drafts.set(binds[0], binds[3]); return { meta: { changes: 1 } }; }
          if (/^INSERT OR REPLACE INTO refused/.test(s)) { self.refused.set(binds[0], binds[2]); return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
      };
      return api;
    };
    return self;
  };
  const queued = (at) => JSON.stringify({ queue: [{ at, payload: { mode: "new", direction: "SELL", party: "CC5-OKR",
    qty: 1, total: 90, cash: 90, kg: 1, date: "2026-08-16", product: "salt" } }] });
  const road = async (how) => {
    const kvR = new KV(), db = mirrorN(bookN);
    await kvR.put("push:now", JSON.stringify({ endpoint: "https://push.example/as-it-is", topics: ["orders", "approve", "salt"] }));
    /* the arrival road POSTS the entry, which is what that road is; the net finds it already in the
       store. A queue POST REPLACES that device's key with the body it carries, so posting an empty
       queue beside a stored entry would have wiped the very row the drafter was meant to find. */
    if (how !== "arrival") await kvR.put("q:phone", queued("2026-08-16T01:00:00.000Z"));
    const envR = Object.assign({ SALT_QUEUE: kvR, SALT_LEDGER: db, REQUIRE_ACCESS: "0" }, vapid9);
    const realF = globalThis.fetch, realL = console.log, hit = [], logs = [];
    globalThis.fetch = async (u) => { hit.push(String(u)); return new Response("", { status: 201 }); };
    console.log = (...a) => logs.push(a.join(" "));
    try {
      if (how === "arrival") {
        const waits = [];
        await deskW9.fetch(new Request("https://salt-command.example/queue", { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.assign({ device: "phone", updated: "2026-08-16T01:00:01.000Z" }, JSON.parse(queued("2026-08-16T01:00:00.000Z")))) }),
          envR, { waitUntil: (p) => waits.push(p) });
        await Promise.all(waits);
      } else {
        const waits = [];
        await deskW9.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-09-21T02:15:00Z") },
          envR, { waitUntil: (p) => waits.push(p) });
        await Promise.all(waits);
      }
    } finally { globalThis.fetch = realF; console.log = realL; }
    return { hit, logs, drafts: db.drafts.size };
  };
  const arrival = await road("arrival"), net = await road("net");
  ok(arrival.drafts === 1 && net.drafts === 1,
    "both roads draft the same waiting entry, so neither passes here by drafting nothing: "
    + JSON.stringify({ arrival: arrival.drafts, net: net.drafts }));
  ok(arrival.hit.length === 0,
    "a row drafted ON ARRIVAL sends no banner: it is the tap in his hand, and the desk draws it under "
    + "Approve while he is looking: " + JSON.stringify(arrival.hit));
  ok(net.hit.some((u) => u.endsWith("as-it-is")),
    "and the same row found by the net, which is a row he was not watching for, does wake him: " + JSON.stringify(net.hit));

  /* ---- 4. THE SUMMARY CARRIES THE REFUND, so the round he now receives cannot say square over it ---- */
  const d1S = (refunds) => ({ prepare(q) {
    const first = async () => (/COUNT_ON/.test(q) ? { doc: JSON.stringify({ salt: "2026-09-21", oil: "2026-09-21" }) } : (/COUNT\(\*\)/.test(q) ? { n: 0 } : null));
    const all = async () => (/collection='customerRefunds'/.test(q) ? { results: refunds } : { results: [] });
    return { bind: () => ({ all, first, run: async () => ({}) }), all, first, run: async () => ({}) };
  } });
  const summary = async (refunds) => {
    const envS = { SALT_LEDGER: d1S(refunds), SALT_QUEUE: new KV(), REQUIRE_ACCESS: "0" };
    return (await (await deskW9.fetch(new Request("https://salt-command.example/push/summary"), envS)).json());
  };
  const open1 = await summary([{ doc: JSON.stringify({ party: "CZ4-MK", amount: 20, since: "2026-08-26" }) },
    { doc: JSON.stringify({ party: "CZ6-WM", amount: 80, since: "2026-07-24", paidOn: "2026-07-31" }) }]);
  const none1 = await summary([{ doc: JSON.stringify({ party: "CZ6-WM", amount: 80, paidOn: "2026-07-31" }) }, { doc: "not json" }]);
  ok(open1.refunds === 1, "the summary counts a refund still owed: " + JSON.stringify(open1.refunds));
  ok(none1.refunds === 0, "and counts neither one already paid back nor a row that will not parse: " + JSON.stringify(none1.refunds));

  /* ---- 5. THE BANNER NAMES IT, AND AN ORDER NO LONGER HIDES THE REST ---- */
  const vm9 = await import("node:vm");
  const swSrc9 = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  const wake9 = async (s) => {
    const L = {}, shown = [];
    const ctx = { URL, console, caches: {},
      self: { addEventListener: (t, f) => { L[t] = f; }, location: { origin: "https://salt-command.example" },
        registration: { scope: "https://salt-command.example/", showNotification: async (t, opt) => { shown.push({ t, opt }); } } },
      clients: { matchAll: async () => [], openWindow: async () => {} },
      fetch: async () => ({ ok: true, json: async () => s }) };
    vm9.createContext(ctx); vm9.runInContext(swSrc9, ctx);
    const waits = []; L.push({ waitUntil: (pr) => waits.push(pr) }); await Promise.all(waits);
    return shown[0];
  };
  const bRefund = await wake9({ ok: true, pending: 0, refused: 0, refunds: 1, countDue: [], orders: 0 });
  const bBoth = await wake9({ ok: true, pending: 2, refused: 0, refunds: 1, countDue: ["salt"], orders: 1 });
  const bQuiet = await wake9({ ok: true, pending: 0, refused: 0, refunds: 0, countDue: [], orders: 0 });
  ok(bRefund && /1 refund to pay back/.test(bRefund.opt.body),
    "the morning round names a refund still owed, which it never did: " + (bRefund && bRefund.opt.body));
  ok(bBoth && bBoth.t === "New customer order" && /acknowledge/.test(bBoth.opt.body)
    && /1 refund to pay back/.test(bBoth.opt.body) && /2 rows waiting/.test(bBoth.opt.body) && /salt not counted/.test(bBoth.opt.body),
    "an order still leads and no longer hides a refund, a row owed a decision or a shelf not counted: " + (bBoth && bBoth.opt.body));
  ok(bQuiet && /Nothing waiting/.test(bQuiet.opt.body) && bQuiet.t === "Salt Command is square",
    "and with nothing owed it still says so: " + (bQuiet && bQuiet.opt.body));
})();


console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
