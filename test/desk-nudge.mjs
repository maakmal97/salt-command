/* test/desk-nudge.mjs: A CUSTOMER'S MOVE TELLS THE DESK AT ONCE (18 Nov 2026, docs/plan-nudge.html, his answers A to C). The order book (stmt/orderbook.js)
 * sends one empty POST to the Desk's /_internal/maker/nudge after a customer's write, and the Desk (src/worker.js) answers 202 and runs the order pass its
 * minute runs, one pass at a time in an isolate, the minute taking the same road. Driven on the real roads: the order book over node:sqlite
 * (test/orderbook-harness.mjs), both Workers, and the Desk's D1 on the migrated schema. Every code, username and id is invented. Each check is red under its
 * own mutation (test/desk-nudge.mutations.json):
 *   N1  the call carries nothing: POST to the one address, no body, no query, the bridge's key the only header; the customer's tap never waits on it
 *   N2  each listed move makes one call: Place, a change of theirs, I have sent it, a withdrawal, a rating, a claim on the account, a line, a join
 *   N3  each excluded write makes none: the Desk's own (his move, his line, his Received, a pool opened or closed, his Place), the chase and the
 *       rating's ask, a practice account's, their Yes to an offer, a refusal and a retry
 *   N4  a burst on the Counter is two calls, not one each; a call held past NUDGE_STALE_MS blocks nothing
 *   N5  the Desk's route: behind the key (404 without it), POST only, 202 at once, and it runs the pass, whose first step reads the site once
 *   N6  a burst on the Desk is two passes, not one each; the minute's cron takes the same road (it reads nothing of its own while a pass runs);
 *       a pass held past PASS_STALE_MS blocks nothing
 *   N7  a Desk without the route (404) or a call that fails is let go: the tap is answered and nothing is held
 *   N8  end to end, a customer's move brings the row under Approve with no cron, and no pass books a payment
 *   N9  two overlapping passes (two isolates) queue one row, spend one yes and make one draft
 *   N9b two takes that both read the yes before either claims its entry queue one row: the claim decides
 *   N10 the minute's pass still catches a move whose call was dropped
 *   N11 the banner's marks are read with KV's shortest cache, so a pass elsewhere does not ring the same news a minute later
 *   N12 a take cut off between claiming the yes's entry and queueing its row is queued once by the next pass
 *   N13 the minute waits a bounded time on a pass it did not start, then runs its own (a pass cut off with its request never ends)
 *   N14 an entry the desk pass cannot queue is left for the next pass, and the rest of the pass goes on */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { orderBook } from "./orderbook-harness.mjs";

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

const J = JSON.stringify;
const KEY = "nudge-fixture-bridge-key-0123456789abcdef";
const NUDGE = "https://desk/_internal/maker/nudge";
const tick = () => new Promise((r) => setTimeout(r, 0));
let n = 0;
const rid = () => ("nudgeTap" + (++n) + "0".repeat(24)).slice(0, 24);
const quiet = async (f) => { const l = console.log; console.log = () => {}; try { return await f(); } finally { console.log = l; } };

export async function run({ ok, skip }) {
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (!DatabaseSync) { if (skip) skip("node:sqlite is unavailable here, so the nudge was not driven through the order book"); return; }
  const O = await import("../stmt/orders.js");
  const OB = await import("../stmt/orderbook.js");
  const W = await import("../src/worker.js"), deskW = W.default, stmtW = (await import("../stmt/worker.js")).default;
  await counterSide(ok, O, OB);
  await deskSide(ok, W, deskW);
  await bothWorkers(ok, O, W, deskW, stmtW, DatabaseSync);
}

/* ---- the Counter: what the order book sends, and when ---- */
async function counterSide(ok, O, OB) {
  const calls = [];
  let hold = null, answer = () => new Response(J({ ok: true }), { status: 202 });
  const DESK_MAKER = { fetch: async (req) => {
    calls.push({ url: req.url, method: req.method, headers: [...req.headers.keys()], key: req.headers.get("X-Counter-Maker-Key"), body: await req.text() });
    if (hold) await hold;
    return answer();
  } };
  const env = { STMT: new Store(), ORDER_STORE: "object", STMT_DESK_KEY: "desk-key", COUNTER_MAKER_KEY: KEY, DESK_MAKER };
  const h = orderBook(env);
  env.ORDERBOOK = h.ns;
  const settle = async () => { for (let i = 0; i < 50 && h.book.nudging; i++) { await h.book.nudging; await tick(); } await tick(); };
  const U = ["nuaa-cdef", "nubb-cdef", "nucc-cdef", "nudd-cdef", "nuee-cdef"];
  const place = (u, extra, by) => O.placeOrder(env, u, Object.assign({ product: "salt", qty: 2, mode: "collect", place: "", unit: 100, total: 200, week: "", rid: rid() }, extra || {}), by);
  const ack = (u, id) => h.book.fetch(new Request("https://orderbook/desk", { method: "POST", body: J({ u, id, body: { status: "acknowledged", delivery: 0 } }) })).then((r) => r.json());
  const book = (op, a) => h.book.fetch(new Request("https://orderbook/" + op, { method: "POST", body: J(a) })).then((r) => r.json());
  const count = async (f) => { await settle(); const before = calls.length; const out = await f(); await settle(); return { made: calls.length - before, out }; };

  /* N1: one Place, held at the Desk: the tap is answered first, and the call is the bare POST */
  let release; hold = new Promise((r) => { release = r; });
  const p1 = await place(U[0]);
  const answeredFirst = !!(p1.order && calls.length === 1 && h.book.nudging);
  release(); hold = null; await settle();
  const c = calls[0] || {};
  ok(answeredFirst && c.url === NUDGE && c.method === "POST" && c.body === "" && J(c.headers) === J(["x-counter-maker-key"]) && c.key === KEY,
    "N1: a customer's Place calls the Desk once, a POST to the one address with no body, no query and the bridge's key alone, and the tap is answered while it is on its way: " + J({ answeredFirst, c }));

  /* N2: each listed move, one call each */
  const made = {};
  made.place = (await count(() => place(U[1]))).made;
  const o2 = (await place(U[2])).order; await settle();
  made.replace = (await count(() => book("replace", { u: U[2], id: o2.id, body: { product: "salt", qty: 3, mode: "collect", place: "", unit: 100, total: 300, week: "", rid: rid(), digest: "" }, rid: rid(), digest: "" }))).made;
  const o3 = (await place(U[3])).order; await settle();
  await ack(U[3], o3.id); await settle();
  made.sent = (await count(() => O.customerMove(env, U[3], o3.id, "pay", { amount: 50, method: "transfer", account: "maybank", rid: rid() }))).made;
  made.said = (await count(() => O.customerMove(env, U[3], o3.id, "say", { text: "Is Friday fine", rid: rid() }))).made;
  const o4 = (await place(U[4])).order; await settle();
  made.withdrawn = (await count(() => O.customerMove(env, U[4], o4.id, "cancel", { rid: rid() }))).made;
  made.claim = (await count(() => O.claimAccount(env, U[4], { amount: 40, method: "transfer", account: "maybank", rid: rid() }))).made;
  made.line = (await count(() => O.sayThread(env, U[4], { text: "Thank you", rid: rid() }))).made;
  const pool = (await O.poolOpen(env, { product: "salt", q: 2, target: 10 })).pool; await settle();
  made.join = (await count(() => O.poolJoin(env, U[1], pool.id, { q: 2, total: 200, unit: 100, digest: "", rid: rid() }))).made;
  const listed = OB.NUDGE_OPS.filter((op) => !OB.nudgesDesk(op, { u: U[0] }, { ok: true, order: { u: U[0] } }));
  const rate = OB.nudgesDesk("customer", { u: U[0], action: "rate" }, { ok: true, order: { u: U[0] } });
  ok(Object.values(made).every((x) => x === 1) && Object.keys(made).length === 8 && listed.length === 0 && rate === true
    && J(OB.NUDGE_OPS.slice().sort()) === J(["aclaim", "customer", "pjoin", "place", "replace", "tsay"]),
    "N2: each listed move calls the Desk once: Place, their change, I have sent it, a line on an order, a withdrawal, a claim on the account, a line on the account, a join, and a rating by the rule: " + J({ made, listed, rate }));

  /* N3: each excluded write, none */
  const none = {};
  const o5 = (await place(U[0], { qty: 1, total: 100 })).order; await settle();
  none.hisMove = (await count(() => ack(U[0], o5.id))).made;
  none.hisLine = (await count(() => O.deskThread(env, U[4], { message: "Friday is fine", rid: rid() }))).made;
  const claims = await O.claimsOf(env, U[4]);
  none.hisReceived = (await count(() => book("adesk", { u: U[4], id: claims[0].id, body: { verdict: { kind: "received", amount: 40 } } }))).made;
  none.poolOpen = (await count(() => O.poolOpen(env, { product: "salt", q: 1, target: 5 }))).made;
  none.poolClose = (await count(() => O.poolClose(env, pool.id, {}))).made;
  none.hisPlace = (await count(() => place(U[2], { qty: 1, total: 100 }, "desk"))).made;
  none.chase = (await count(() => book("chase", { u: U[3], hour: 480000 }))).made;
  none.refused = (await count(() => O.sayThread(env, U[4], { text: "   ", rid: rid() }))).made;
  const r1 = rid();
  await O.sayThread(env, U[3], { text: "Hello", rid: r1 }); await settle();
  none.retry = (await count(() => O.sayThread(env, U[3], { text: "Hello", rid: r1 }))).made;
  const take = OB.nudgesDesk("customer", { u: U[0], action: "take" }, { ok: true, order: { u: U[0] } });
  const practice = ["0000-0000", "0000-0001", "0000-0002"].map((u) => OB.nudgesDesk("place", { u }, { ok: true, order: { u } }));
  const ops = ["desk", "adesk", "tdesk", "popen", "pclose", "chase", "rateask", "fixture-account", "fixture-thread", "fixture-reset", "drop", "deskseen", "orders"]
    .filter((op) => OB.nudgesDesk(op, { u: U[0] }, { ok: true, order: { u: U[0] } }));
  ok(Object.values(none).every((x) => x === 0) && Object.keys(none).length === 9 && take === false && practice.every((x) => x === false) && ops.length === 0,
    "N3: no excluded write calls the Desk: his move, his line, his Received, a pool opened or closed, his own Place, the chase, a refusal, a retry, their Yes to an offer, a practice account and every Desk or site op: " + J({ none, take, practice, ops }));

  /* N4: a burst while one call is on its way: one more after it, not one each; and a call held past the stale mark blocks nothing */
  await settle(); const b0 = calls.length;
  let open; hold = new Promise((r) => { open = r; });
  for (const t of ["One", "Two", "Three"]) await O.sayThread(env, U[2], { text: t, rid: rid() });
  const whileHeld = calls.length - b0;
  open(); hold = null; await settle();
  const burst = calls.length - b0;
  let stuck; hold = new Promise((r) => { stuck = r; });
  await O.sayThread(env, U[1], { text: "Four", rid: rid() });
  const s0 = calls.length, realNow = Date.now;
  try { Date.now = () => realNow() + OB.NUDGE_STALE_MS + 1000; await O.sayThread(env, U[1], { text: "Five", rid: rid() }); }
  finally { Date.now = realNow; }
  const afterStale = calls.length - s0;
  stuck(); hold = null; await settle();
  ok(whileHeld === 1 && burst === 2 && afterStale === 1,
    "N4: three moves while a call is on its way make one call more, two in all; a call held past a minute blocks nothing, the next move sends its own: " + J({ whileHeld, burst, afterStale }));

  /* N7: a Desk without the route, or a call that throws: the tap is answered, the call let go, nothing held */
  answer = () => new Response(J({ ok: false, error: "not found" }), { status: 404 });
  const n404 = await quiet(async () => { const r = await O.sayThread(env, U[0], { text: "Six", rid: rid() }); await settle(); return r; });
  answer = () => { throw new Error("the bridge is away"); };
  const nThrow = await quiet(async () => { const r = await O.sayThread(env, U[0], { text: "Seven", rid: rid() }); await settle(); return r; });
  answer = () => new Response(J({ ok: true }), { status: 202 });
  const after = await count(() => O.sayThread(env, U[0], { text: "Eight", rid: rid() }));
  ok(!!(n404.thread && nThrow.thread) && !h.book.nudging && after.made === 1,
    "N7: a Desk that answers 404, and a call that fails, are let go: the line is recorded, nothing is held, and the next move calls again: " + J({ a: !!n404.thread, b: !!nThrow.thread, next: after.made }));
}

/* ---- the Desk: the route and its one pass at a time ---- */
async function deskSide(ok, W, deskW) {
  const reads = [];
  let gate = null;
  const STMT_SITE = { fetch: async (url) => {
    const u = String(url);
    if (u.includes("/desk/orders/last")) { reads.push(u); if (gate) await gate; }
    return new Response(J({ ok: true, orders: [] }), { headers: { "content-type": "application/json" } });
  } };
  const denv = { COUNTER_MAKER_KEY: KEY, STMT_SITE, STMT_DESK_KEY: "desk-key", SALT_QUEUE: new Store(), REQUIRE_ACCESS: "0" };
  const jobs = [], ctx = { waitUntil(p) { jobs.push(Promise.resolve(p).catch(() => {})); } };
  const drain = async () => { for (let i = 0; i < 200 && jobs.length; i++) await jobs.shift(); };
  const post = (headers, method = "POST") => deskW.fetch(new Request(NUDGE, { method, headers }), denv, ctx);

  /* N5 */
  const noKey = await post({}), wrongKey = await post({ "X-Counter-Maker-Key": KEY.replace("0", "1") }), get = await post({ "X-Counter-Maker-Key": KEY }, "GET");
  await quiet(drain);
  const refusedReads = reads.length;
  let hold; gate = new Promise((r) => { hold = r; });
  const good = await post({ "X-Counter-Maker-Key": KEY });
  const answeredFirst = good.status === 202 && (await good.json()).ok === true;
  hold(); gate = null; await quiet(drain);
  ok(noKey.status === 404 && wrongKey.status === 404 && get.status === 405 && refusedReads === 0 && answeredFirst && reads.length === 1 && reads[0].endsWith("/desk/orders/last?work=1"),
    "N5: the nudge is behind the bridge's key and POST only; a keyed call is answered 202 before its pass ends, and the pass reads the site once: " + J([noKey.status, wrongKey.status, get.status, refusedReads, answeredFirst, reads]));

  /* N6: three calls while a pass runs are one pass more; the cron waits on the same road; a stale pass blocks nothing */
  reads.length = 0;
  let free; gate = new Promise((r) => { free = r; });
  W.ordersOnce(denv, ctx); await tick();
  await post({ "X-Counter-Maker-Key": KEY }); await post({ "X-Counter-Maker-Key": KEY });
  const cronJobs = [];
  const cron = quiet(() => deskW.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-11-18T03:01:00Z") }, denv, { waitUntil: (p) => cronJobs.push(p) }));
  await cron; for (let i = 0; i < 20; i++) await tick();
  const duringPass = reads.length;
  free(); gate = null;
  await quiet(async () => { await drain(); await Promise.all(cronJobs); await drain(); });
  const burst = reads.length;
  reads.length = 0;
  let unstick; gate = new Promise((r) => { unstick = r; });
  W.ordersOnce(denv, ctx); await tick();
  const realNow = Date.now;
  try { Date.now = () => realNow() + W.PASS_STALE_MS + 1000; W.ordersOnce(denv, ctx); await tick(); }
  finally { Date.now = realNow; }
  const stale = reads.length;
  unstick(); gate = null; await quiet(drain);
  ok(duringPass === 1 && burst === 2 && stale === 2,
    "N6: two nudges and the minute's cron while a pass runs read nothing of their own, and make one pass more, two in all; a pass held past its stale mark blocks nothing: " + J({ duringPass, burst, stale }));

  /* N13: a pass the minute did not start that never ends (its request cut off): the minute waits PASS_WAIT_MS, then runs its own and its later steps */
  reads.length = 0;
  let never; gate = new Promise((r) => { never = r; });
  W.ordersOnce(denv, ctx); await tick();
  const realST = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...x) => realST(fn, ms === W.PASS_WAIT_MS ? 0 : ms, ...x);
  const logs = [], realLog = console.log, cronWaits = [];
  console.log = (...x) => logs.push(x.join(" "));
  try {
    await deskW.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-11-18T03:15:00Z") }, denv, { waitUntil: (p) => cronWaits.push(p) });
    for (let i = 0; i < 40 && reads.length < 2; i++) await new Promise((r) => realST(r, 5));
  } finally { globalThis.setTimeout = realST; console.log = realLog; }
  const ownPass = reads.length, said = logs.some((l) => l.startsWith("orders pass: the running pass did not end"));
  never(); gate = null; await quiet(async () => { await drain(); await Promise.all(cronWaits); });
  ok(ownPass === 2 && said, "N13: the minute waits a bounded time on a pass it did not start, then runs its own and says so: " + J({ ownPass, said }));
}

/* ---- both Workers, the order book and the Desk's D1 ---- */
async function bothWorkers(ok, O, W, deskW, stmtW, DatabaseSync) {
  const REPO = join(import.meta.dirname, "..");
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
  /* claimHook, while set, runs before take's claim of a yes's entry (N9b): how two takes both get past their read of the yes before either claims */
  let claimHook = null;
  const CLAIM_RE = /^UPDATE preapproval SET entry=\?1 WHERE id=\?2 AND status='waiting'/;
  const D1 = { prepare(sql) { const st = db.prepare(sql);
    const mk = (a) => ({ run() { const go = () => { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; };
        return claimHook && CLAIM_RE.test(sql) ? Promise.resolve(claimHook()).then(go) : go(); },
      first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self; },
    batch(list) { db.exec("BEGIN IMMEDIATE"); try { const out = list.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
  const CODES = ["CN4-NA", "CN5-NB", "CN6-NC", "CN7-ND"], US = ["naab-cdef", "nbab-cdef", "ncab-cdef", "ndab-cdef"];
  const PRICING = { v: "v900", takenAt: "2026-10-01T00:00:00.000Z", tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], profileRule: { smallUpTo: 1, bigFrom: 3 },
    byProduct: { salt: { stockCost: 56, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
  const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, J(doc));
  let seq = 0;
  for (const cust of CODES) for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"]) db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
    .run("sales", seq++, "h" + seq, J({ rid: "s9" + seq, customer: cust, date: d, qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: d, paidOn: d }));
  setState("roster", CODES); setState("PRICING", PRICING); setState("OPEN", { byKey: {}, position: {} });
  db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
  const skv = new Store(), dkv = new Store();
  await dkv.put("stmt-users", J(Object.fromEntries(US.map((u, i) => [u, CODES[i]]))));
  const assets = { fetch: async () => new Response(J({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
  const deskJobs = [], dctx = { waitUntil(p) { deskJobs.push(Promise.resolve(p).catch(() => {})); } };
  let bridge = "on", forwarded = 0;   /* on: the call reaches the Desk; off: it is dropped */
  const senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object", COUNTER_MAKER_KEY: KEY,
    /* capped, so a mutation that has the two Workers call each other for ever ends the run instead of spinning it */
    DESK_MAKER: { fetch: async (req) => { if (bridge !== "on") throw new Error("dropped"); if (++forwarded > 400) return new Response("{}", { status: 503 }); return deskW.fetch(req, denv, dctx); } } };
  const ob = orderBook(senv);
  senv.ORDERBOOK = ob.ns;
  const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets, COUNTER_MAKER_KEY: KEY,
    STMT_SITE: { fetch: async (url, init) => stmtW.fetch(new Request(url, init), senv) } };
  const settle = async () => { for (let i = 0; i < 60; i++) { if (ob.book.nudging) await ob.book.nudging; for (let k = 0; k < 20 && deskJobs.length; k++) await deskJobs.shift(); await tick(); if (!ob.book.nudging && !deskJobs.length) break; } };
  const call = async (path, body) => { const r = await deskW.fetch(new Request("https://salt-command.example" + path, { method: "POST",
    headers: { "content-type": "application/json", "X-Salt-Key": "k-fixture" }, body: J(body || {}) }), denv, dctx); return { status: r.status, j: await r.json() }; };
  const place = async (u, qty = 2) => (await O.placeOrder(senv, u, { product: "salt", qty, mode: "collect", place: "", unit: 100, total: 100 * qty, week: "", rid: rid() })).order;
  const deskAck = (u, id) => stmtW.fetch(new Request("https://site.test/desk/orders/" + u + "/" + id, { method: "POST",
    headers: { "content-type": "application/json", "X-Stmt-Desk": "desk-key" }, body: J({ status: "acknowledged", delivery: 0 }) }), senv);
  const queued = (id) => [...dkv.values.entries()].filter(([k]) => k.startsWith("q:")).map(([, v]) => JSON.parse(v).queue || []).flat().filter((e) => e && (e.orderId === id || (e.payload && e.payload.orderId === id)));
  const drafts = (id) => db.prepare("SELECT id,status,entry FROM draft").all().map((r) => ({ id: r.id, status: r.status, entry: JSON.parse(r.entry) })).filter((d) => d.entry.orderId === id);
  const cron = (iso) => quiet(async () => { const waits = []; await deskW.scheduled({ cron: "* * * * *", scheduledTime: Date.parse(iso) }, denv, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); });

  /* N8: his acknowledgement (no call), then their I have sent it: the call runs the pass, which queues the pending row and drafts it, with no cron */
  const a = await quiet(async () => { const o = await place(US[0]); await settle(); return o; });
  await quiet(async () => { await deskAck(US[0], a.id); await settle(); });
  const beforeMove = { q: queued(a.id).length, d: drafts(a.id).length };
  await quiet(async () => { await O.customerMove(senv, US[0], a.id, "pay", { amount: 50, method: "transfer", account: "maybank", rid: rid() }); await settle(); });
  const qa = queued(a.id), da = drafts(a.id);
  const pays = [...dkv.values.entries()].filter(([k]) => k.startsWith("q:")).map(([, v]) => JSON.parse(v).queue || []).flat().filter((e) => e && /payment/i.test(String(e.status || "")));
  const payYes = db.prepare("SELECT COUNT(*) AS n FROM preapproval WHERE stage='pay'").get().n;
  ok(beforeMove.q === 0 && beforeMove.d === 0 && qa.length === 1 && qa[0].status === "Pending" && da.length === 1 && da[0].status === "pending" && pays.length === 0 && payYes === 0,
    "N8: their I have sent it, told at once, brings the acknowledged order's row under Approve with no cron, and no pass books a payment: " + J({ beforeMove, queued: qa.map((e) => e.status), drafts: da.map((d) => d.status), pays: pays.length, payYes }));

  /* N9: two passes at once, as two isolates would run them: an order owing its pending row, and an offer they took (one yes waiting) */
  const b = await quiet(async () => { const o = await place(US[1]); await settle(); return o; });
  await quiet(async () => { await deskAck(US[1], b.id); });
  const c = await quiet(async () => { const o = (await O.placeOrder(senv, US[2], { product: "salt", qty: 2, mode: "collect", place: "", unit: 100, total: 200, week: "", rid: rid(), ask: true })).order; await settle(); return o; });
  const pv = await quiet(() => call("/orders/" + c.id + "/preview", { total: 180 }));
  const of = await quiet(() => call("/orders/" + c.id + "/offer", { total: 180, delivery: 0, hash: pv.j.offerHash, rid: rid() }));
  await quiet(async () => { await settle(); await O.customerMove(senv, US[2], c.id, "take", { rid: rid() }); await settle(); });
  const yesBefore = db.prepare("SELECT status FROM preapproval WHERE order_id=?").all(c.id).map((r) => r.status);
  await quiet(async () => { await Promise.all([W.ordersPass(denv, dctx), W.ordersPass(denv, dctx)]); await settle(); });
  const qb = queued(b.id), dbs = drafts(b.id), qc = queued(c.id), dc = drafts(c.id);
  const yes = db.prepare("SELECT status FROM preapproval WHERE order_id=?").all(c.id).map((r) => r.status);
  ok(of.status === 200 && J(yesBefore) === J(["waiting"]) && qb.length === 1 && dbs.length === 1 && qc.length === 1 && dc.length === 1 && J(yes) === J(["applied"]) && dc[0].status === "approved",
    "N9: two passes at once queue the pending row once and draft it once, and spend their taken offer's one yes once, on one approved draft: " + J({ offer: of.status, yesBefore, b: [qb.length, dbs.length], c: [qc.length, dc.length, dc.map((d) => d.status)], yes }));

  /* N9b: two takes that both read the yes before either claims its entry (the take's own call and a pass, in two isolates): one claims and
     queues, the other queues nothing, so one row, one draft, the yes spent once */
  const g = await quiet(async () => { const o = (await O.placeOrder(senv, US[1], { product: "salt", qty: 1, mode: "collect", place: "", unit: 100, total: 100, week: "", rid: rid(), ask: true })).order; await settle(); return o; });
  const pv3 = await quiet(() => call("/orders/" + g.id + "/preview", { total: 90 }));
  await quiet(() => call("/orders/" + g.id + "/offer", { total: 90, delivery: 0, hash: pv3.j.offerHash, rid: rid() }));
  await quiet(async () => { await settle(); await O.customerMove(senv, US[1], g.id, "take", { rid: rid() }); await settle(); });
  const { takeOffer } = await import("../src/orders.js");
  let first = null, arrived = 0;
  claimHook = () => { arrived++; if (arrived === 1) return new Promise((r) => { first = r; }); first(); return tick(); };
  let takes;
  try { takes = await quiet(() => Promise.all([takeOffer(denv, g.id), takeOffer(denv, g.id)])); } finally { claimHook = null; }
  await quiet(settle);
  const qg = queued(g.id), dg = drafts(g.id), yg = db.prepare("SELECT status FROM preapproval WHERE order_id=?").all(g.id).map((r) => r.status);
  ok(arrived === 2 && qg.length === 1 && dg.length === 1 && dg[0].status === "approved" && J(yg) === J(["applied"]) && takes.filter((t) => t && t.again).length === 1,
    "N9b: two takes that both read the yes before either claims it: one claims and queues, the other is told it is taken, so one row, one approved draft, the yes spent once: " + J({ arrived, q: qg.length, d: dg.map((x) => x.status), yg, again: takes.map((t) => !!(t && t.again)) }));

  /* N10: a dropped call: nothing moves until the minute, whose pass queues and drafts it */
  const d = await quiet(async () => { const o = await place(US[3]); await settle(); return o; });
  await quiet(async () => { await deskAck(US[3], d.id); });
  bridge = "off";
  await quiet(async () => { await O.customerMove(senv, US[3], d.id, "say", { text: "Is it ready", rid: rid() }); await settle(); });
  const dropped = { q: queued(d.id).length, d: drafts(d.id).length };
  bridge = "on";
  await cron("2026-11-18T03:07:00Z");
  ok(dropped.q === 0 && dropped.d === 0 && queued(d.id).length === 1 && drafts(d.id).length === 1,
    "N10: a move whose call was dropped is caught by the minute's pass, which queues and drafts its row: " + J({ dropped, after: [queued(d.id).length, drafts(d.id).length] }));

  /* N12: a take cut off after it claimed the yes's entry and before its row reached the queue: the next pass queues it from the yes, once */
  const e = await quiet(async () => { const o = (await O.placeOrder(senv, US[3], { product: "salt", qty: 3, mode: "collect", place: "", unit: 100, total: 300, week: "", rid: rid(), ask: true })).order; await settle(); return o; });
  const pv2 = await quiet(() => call("/orders/" + e.id + "/preview", { total: 270 }));
  await quiet(() => call("/orders/" + e.id + "/offer", { total: 270, delivery: 0, hash: pv2.j.offerHash, rid: rid() }));
  await quiet(async () => { await settle(); await O.customerMove(senv, US[3], e.id, "take", { rid: rid() }); await settle(); });
  const realPut = dkv.put.bind(dkv);
  dkv.put = async (k, v) => { if (k.startsWith("q:orders:")) { dkv.put = realPut; throw new Error("cut off"); } return realPut(k, v); };
  await quiet(async () => { try { await W.ordersPass(denv, dctx); } catch (x) { /* the pass logs its own */ } await settle(); });
  dkv.put = realPut;
  const cut = { q: queued(e.id).length, entry: !!(db.prepare("SELECT entry FROM preapproval WHERE order_id=? AND status='waiting'").get(e.id) || {}).entry };
  /* N14: while that claimed entry still cannot be queued, the pass goes on: another order's pending row, queued by the reconcile, is drafted */
  bridge = "off";   /* its Place calls nothing, so no pass heals the cut-off take before this check */
  const f = await quiet(async () => { const o = await place(US[0], 1); await settle(); return o; });
  bridge = "on";
  await quiet(async () => { await deskAck(US[0], f.id); });
  const stuckKey = "q:orders:" + JSON.parse(db.prepare("SELECT entry FROM preapproval WHERE order_id=? AND status='waiting'").get(e.id).entry).at;
  dkv.put = async (k, v) => { if (k === stuckKey) throw new Error("refused"); return realPut(k, v); };
  await quiet(async () => { await W.ordersPass(denv, dctx); await settle(); });
  dkv.put = realPut;
  const goesOn = { f: drafts(f.id).map((x) => x.status), e: queued(e.id).length };
  ok(J(goesOn.f) === J(["pending"]) && goesOn.e === 0,
    "N14: an entry the desk pass cannot queue is left for the next pass, and the pass goes on: another order's pending row is drafted: " + J(goesOn));
  await quiet(async () => { await W.ordersPass(denv, dctx); await settle(); });
  const de = drafts(e.id), ye = db.prepare("SELECT status FROM preapproval WHERE order_id=?").all(e.id).map((r) => r.status);
  ok(cut.q === 0 && cut.entry && queued(e.id).length === 1 && de.length === 1 && de[0].status === "approved" && J(ye) === J(["applied"]),
    "N12: a take cut off between claiming the yes's entry and queueing its row is queued by the next pass from the yes, once, its yes spent on it: " + J({ cut, after: [queued(e.id).length, de.map((x) => x.status)], ye }));

  /* N11: the banner's marks */
  const got = [];
  const SALT_QUEUE = { get: async (k, o) => { got.push([k, o]); return null; }, put: async () => {}, delete: async () => {} };
  const { nudgeOrders } = await import("../src/orders.js");
  try { await nudgeOrders({ SALT_QUEUE }, { ok: true, marks: {} }); } catch (e) { /* the wake itself is not this check's */ }
  ok(got.length === 3 && got.every(([, o]) => o && o.cacheTtl === 30), "N11: the banner's three marks are read with KV's shortest cache, 30 s: " + J(got));
}
