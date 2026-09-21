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
section("v760: a customer paying or taking an order back wakes him, and the banner says which");
await (async () => {
  /* MEASURED 21 SEP 2026: the site has written the moment of every change since v694, the desk asked
     the site for it every minute, and the nudge read the placement and the message and threw the rest
     away. So somebody settling RM435 at midnight, or taking an order back, woke nobody at all and sat
     there until he next opened the desk. HIS OWN MOVES WRITE `last-touched` TOO, which is why waking
     on that mark was never the answer: the reconcile has to list after a handover, so his tap moves it. */
  const { placeOrder, customerMove, deskMove, LAST_THEIRS, LAST_TOUCHED } = await import("../stmt/orders.js");
  const { nudgeOrders } = await import("../src/orders.js");
  const stmtW6 = (await import("../stmt/worker.js")).default;
  const deskW6 = (await import("../src/worker.js")).default;
  const kp6 = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const skv6 = new KV(), dkv6 = new KV();
  const senv6 = { STMT: skv6, STMT_DESK_KEY: "desk-key" };
  const denv6 = { SALT_QUEUE: dkv6, STMT_DESK_KEY: "desk-key", VAPID_PUBLIC_KEY: "pub", VAPID_SUBJECT: "mailto:a@b.test",
    VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", kp6.privateKey)),
    STMT_SITE: { fetch: (url, init) => stmtW6.fetch(new Request(url, init), senv6) } };
  await dkv6.put("push:his", JSON.stringify({ endpoint: "https://push.example/his-phone", topics: ["orders", "approve", "salt"] }));

  const u6 = "abcd-efgh";
  const place6 = async () => (await placeOrder(senv6, u6, { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" })).order;
  const nudge = async () => {
    const realF = globalThis.fetch, hit = [];
    globalThis.fetch = async (uu) => { hit.push(String(uu)); return new Response("", { status: 201 }); };
    let r; try { r = await nudgeOrders(denv6); } finally { globalThis.fetch = realF; }
    return { r, hit };
  };

  const o6 = await place6();
  await nudge();   /* the placement's own wake, taken out of the way */
  await deskMove(senv6, u6, o6.id, { status: "acknowledged", mode: "collect" });
  const afterHis = await skv6.get(LAST_THEIRS);
  ok(afterHis === null || afterHis === undefined,
    "his own acknowledgement writes nothing on the customers' mark, though it moves the shared one: "
    + JSON.stringify({ theirs: afterHis, touched: !!(await skv6.get(LAST_TOUCHED)) }));
  const quiet = await nudge();
  ok(quiet.hit.length === 0, "and it wakes him for his own tap not at all: " + JSON.stringify(quiet.hit));

  await customerMove(senv6, u6, o6.id, "method", { method: "cod" });
  const afterRail = await skv6.get(LAST_THEIRS);
  ok(afterRail === null || afterRail === undefined,
    "choosing how to pay is not news either: " + JSON.stringify(afterRail));

  await customerMove(senv6, u6, o6.id, "pay", { amount: 100, method: "cod" });
  const mark6 = await skv6.get(LAST_THEIRS);
  ok(/^\d{4}-\d\d-\d\dT.+\|pay$/.test(String(mark6)),
    "a payment writes the moment AND the word, the moment first so it still compares as a string: " + mark6);
  const lastR = await stmtW6.fetch(new Request("https://k7m3p2.example/desk/orders/last", { headers: { "X-Stmt-Desk": "desk-key" } }), senv6);
  const lastJ = await lastR.json();
  ok(lastJ.theirs === mark6 && (await stmtW6.fetch(new Request("https://k7m3p2.example/desk/orders/last"), senv6)).status === 401,
    "the desk reads it in the same one call it already made, and only on the desk key: " + JSON.stringify(lastJ.theirs));

  const paid6 = await nudge();
  ok(paid6.hit.length === 1 && paid6.hit[0] === "https://push.example/his-phone" && paid6.r.did === "A customer has paid",
    "and that wakes him, which nothing did before: " + JSON.stringify({ hit: paid6.hit, did: paid6.r.did }));
  const again6 = await nudge();
  ok(again6.hit.length === 0, "the same payment does not wake him every minute after: " + JSON.stringify(again6.hit));

  /* ---- THE THREE MARKS DO NOT BURY EACH OTHER ---- */
  const o7 = await place6();
  await customerMove(senv6, u6, o7.id, "cancel", {});
  const both = await nudge();
  ok(both.r.newest && both.r.did === "A customer has withdrawn an order" && both.hit.length === 1,
    "a placement and a withdrawal inside one minute are both seen, and are one wake: " + JSON.stringify({ newest: !!both.r.newest, did: both.r.did }));
  ok((await dkv6.get("orders:theirs")) && (await dkv6.get("orders:nudged")),
    "each keeps its own mark, so the newer of them cannot make the other look old");

  /* ---- THE BANNER IS WRITTEN FROM THE SUMMARY, so the summary carries it while it is fresh ---- */
  const news = await dkv6.get("orders:news", "json");
  ok(news && news.what === "A customer has withdrawn an order", "the desk remembers what to say: " + JSON.stringify(news));
  const d1S6 = { prepare: (q) => { const first = async () => (/COUNT_ON/.test(q) ? { doc: JSON.stringify({ salt: "2026-09-21", oil: "2026-09-21" }) } : (/COUNT\(\*\)/.test(q) ? { n: 0 } : null));
    const all = async () => ({ results: [] }); return { bind: () => ({ all, first, run: async () => ({}) }), all, first, run: async () => ({}) }; } };
  const summ6 = async () => (await (await deskW6.fetch(new Request("https://salt-command.example/push/summary"),
    Object.assign({ SALT_LEDGER: d1S6, REQUIRE_ACCESS: "0" }, denv6))).json());
  const fresh = await summ6();
  ok(fresh.news === "A customer has withdrawn an order", "the summary carries it: " + JSON.stringify(fresh.news));
  await dkv6.put("orders:news", JSON.stringify({ what: "A customer has paid", at: "2026-09-21T00:00:00.000Z" }));
  ok((await summ6()).news === undefined,
    "and drops it once it is stale, because a banner about a payment made this morning is a lie by lunchtime");

  const vm6 = await import("node:vm");
  const swSrc6 = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  const wake6 = async (s) => {
    const L = {}, shown = [];
    const ctx = { URL, console, caches: {},
      self: { addEventListener: (t, f) => { L[t] = f; }, location: { origin: "https://salt-command.example" },
        registration: { scope: "https://salt-command.example/", showNotification: async (t, opt) => { shown.push({ t, opt }); } } },
      clients: { matchAll: async () => [], openWindow: async () => {} },
      fetch: async () => ({ ok: true, json: async () => s }) };
    vm6.createContext(ctx); vm6.runInContext(swSrc6, ctx);
    const waits = []; L.push({ waitUntil: (pr) => waits.push(pr) }); await Promise.all(waits);
    return shown[0];
  };
  const bNews = await wake6({ ok: true, pending: 1, refused: 0, refunds: 0, countDue: [], orders: 2, news: "A customer has paid" });
  const bPlain = await wake6({ ok: true, pending: 1, refused: 0, refunds: 0, countDue: [], orders: 2 });
  ok(bNews && bNews.t === "A customer has paid" && /2 orders waiting on you/.test(bNews.opt.body)
    && /1 row waiting for approval/.test(bNews.opt.body) && bNews.opt.data.url === "./desk#orders",
    "the banner leads with what they just did, and still carries what is waiting: " + JSON.stringify(bNews && bNews.opt.body));
  ok(bPlain && bPlain.t === "2 customer orders waiting",
    "and with no news it is the count, as it was: " + (bPlain && bPlain.t));
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
