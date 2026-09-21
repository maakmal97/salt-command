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
section("v764: what he records on the desk reaches the customer's order, and the chase stops");
await (async () => {
  /* HIS INSTRUCTION OF 21 SEP 2026. Every road built since v694 runs from the site to the book. A
     payment he took in cash and entered on the desk reached the ROW and never the ORDER, so the
     customer's page said nothing had been paid and the site's hourly chase asked them again every
     hour for money he already had. It happened on 20 September, to CS6-BS, and was patched by hand. */
  const { placeOrder, deskMove, customerMove, toChase, isAdvance } = await import("../stmt/orders.js");
  const { tellSite, reconcileOrders } = await import("../src/orders.js");
  const stmtW4 = (await import("../stmt/worker.js")).default;
  const skv4 = new KV(), dkv4 = new KV();
  const senv4 = { STMT: skv4, STMT_DESK_KEY: "desk-key" };
  const calls = [];
  const denv4 = { SALT_QUEUE: dkv4, STMT_DESK_KEY: "desk-key",
    STMT_SITE: { fetch: (url, init) => { calls.push(new URL(url).pathname); return stmtW4.fetch(new Request(url, init), senv4); } } };
  await dkv4.put("stmt-users", JSON.stringify({ "abcd-efgh": "CC5-OKR" }));

  /* the mirror: one sale, and a version that moves when a fold lands */
  let VER = "vA", SALE = null, refuse = false;
  const d1 = { prepare(q) {
    const all = async (b) => (/FROM entry/.test(q) ? { results: (b === "sales" && SALE) ? [{ doc: JSON.stringify(SALE) }] : [] }
      : (/FROM state/.test(q) ? { results: [] } : { results: [] }));
    const first = async () => (/FROM snapshot/.test(q) ? { v: VER, stamped: null } : null);
    return { bind: (...a) => ({ all: () => all(a[0]), first, run: async () => ({}) }), all: () => all(null), first, run: async () => ({}) };
  } };
  denv4.SALT_LEDGER = d1;

  const o4 = (await placeOrder(senv4, "abcd-efgh", { product: "salt", qty: 2, mode: "collect", unit: 100, total: 200, week: "" })).order;
  await deskMove(senv4, "abcd-efgh", o4.id, { status: "acknowledged", mode: "collect" });
  await deskMove(senv4, "abcd-efgh", o4.id, { mark: { ledgerKey: "CC5-OKR|2026-09-21|200", ack: "2026-09-21T01:00:00.000Z" } });
  const read = async () => (await skv4.get("order:abcd-efgh:" + o4.id, "json"));

  /* HE TAKES THE CASH AND TYPES IT ON THE DESK: the row is settled in full, and settled rows are
     exactly the ones that have left the open list, which is why the row is looked for among all of
     them and not in OPEN.byKey. */
  SALE = { rid: "s900", customer: "CC5-OKR", date: "2026-09-21", qty: 2, total: 200, cash: 200, deliveredQty: 2, deliveredOn: "2026-09-21" };
  const relay = [];
  const spy = async (fn) => { const realF = globalThis.fetch, hit = [];
    globalThis.fetch = async (u) => { hit.push(String(u)); return new Response("", { status: 201 }); };
    let r; try { r = await fn(); } finally { globalThis.fetch = realF; }
    relay.push(hit); return r; };

  const before = await read();
  ok((+before.paid || 0) === 0 && (+before.moved || 0) === 0,
    "the order says nothing is paid and nothing has moved, which is what the page was telling them: " + JSON.stringify({ paid: before.paid, moved: before.moved }));
  const t1 = await spy(() => tellSite(denv4));
  const after = await read();
  ok(t1.ok && t1.told === 1 && +after.paid === 200 && +after.moved === 2,
    "the desk tells the order what the row already holds: " + JSON.stringify({ told: t1.told, paid: after.paid, moved: after.moved }));
  ok(+after.queued.paid === 200 && Math.abs(+after.queued.moved - 2) < 1e-9,
    "AND MOVES THE MARK WITH IT, or the next pass would queue an entry for a payment already on the row "
    + "and count it twice: " + JSON.stringify(after.queued));
  ok(after.status === "done" && after.history.some((h) => h.by === "desk" && /payment of 200.00 recorded/.test(h.note || "")),
    "the order completes itself and says where the figure came from: " + JSON.stringify(after.history.slice(-3).map((h) => h.note)));
  const chased = await toChase(senv4);
  ok(!chased.length && !isAdvance(after),
    "and the hourly chase has nothing left to ask them for, which is the harm this undoes: " + JSON.stringify(chased));

  /* NOTHING IS QUEUED AFTERWARDS: the forward pass finds the order owes nothing */
  const rc = await reconcileOrders(denv4);
  ok(rc.ok && !rc.queued, "the forward pass then queues nothing at all: " + JSON.stringify(rc));

  /* ONCE A BOOK, and only when the pass got clean through */
  calls.length = 0;
  const t2 = await spy(() => tellSite(denv4));
  ok(t2.told === 0 && t2.v === "vA" && calls.length === 0,
    "a second pass on the same book asks the site nothing at all: it is one cheap read of the book's "
    + "version a minute, and a full pass only when a fold has landed: " + JSON.stringify({ t2, calls }));
  ok((await dkv4.get("orders:told")) === "vA", "and the book it last told is remembered: " + (await dkv4.get("orders:told")));

  /* IT ONLY EVER RAISES: a customer's own word is not erased by a row that has not caught up */
  const o5 = (await placeOrder(senv4, "abcd-efgh", { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" })).order;
  await deskMove(senv4, "abcd-efgh", o5.id, { status: "acknowledged", mode: "collect" });
  await deskMove(senv4, "abcd-efgh", o5.id, { mark: { ledgerKey: "CC5-OKR|2026-09-22|100", ack: "2026-09-22T01:00:00.000Z" } });
  await customerMove(senv4, "abcd-efgh", o5.id, "pay", { amount: 100, method: "cod" });
  SALE = { rid: "s901", customer: "CC5-OKR", date: "2026-09-22", qty: 1, total: 100, cash: 40, deliveredQty: 0 };
  VER = "vB";
  await spy(() => tellSite(denv4));
  const five = await skv4.get("order:abcd-efgh:" + o5.id, "json");
  ok(+five.paid === 100,
    "a row that has not caught up is not even sent: " + JSON.stringify({ paid: five.paid }));
  /* and the site refuses it on its own account, because two pieces guard this and each has to hold:
     the desk decides what is worth saying, the site decides what it will take */
  await deskMove(senv4, "abcd-efgh", o5.id, { ledger: { paid: 40, moved: 0 } });
  const low = await skv4.get("order:abcd-efgh:" + o5.id, "json");
  ok(+low.paid === 100 && (+low.moved || 0) === 0,
    "and handed one directly, the site still refuses to lower a figure the customer gave: " + JSON.stringify({ paid: low.paid }));

  /* A REFUSAL LEAVES THE MARK WHERE IT WAS, so it is tried again next minute and not next fold */
  VER = "vC";
  SALE = { rid: "s902", customer: "CC5-OKR", date: "2026-09-22", qty: 1, total: 100, cash: 100, deliveredQty: 1 };
  const broken = Object.assign({}, denv4, { STMT_SITE: { fetch: async (url, init) => (/\/desk\/orders\/[^/]+\/[^/]+$/.test(new URL(url).pathname) && init && init.method === "POST"
    ? new Response(JSON.stringify({ ok: false, error: "no" }), { status: 500, headers: { "content-type": "application/json" } })
    : stmtW4.fetch(new Request(url, init), senv4)) } });
  const t3 = await spy(() => tellSite(broken));
  const told3 = await dkv4.get("orders:told");
  ok(t3.failed && t3.failed.length === 1 && told3 !== "vC",
    "a site that will not take it leaves the mark where it was, so the next minute tries again rather than the next fold: " + JSON.stringify({ failed: t3.failed, told: told3 }));
})();

console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
