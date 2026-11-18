/* test/instant.mjs: A CUSTOMER'S MOVE REACHES HIM AT ONCE (19 Nov 2026, docs/plan-ring.html, his answers "Both, one version" and "Counter rings,
 * with guards"). Measured on v1547: the banner took about 5 s and the row 10 s, nearly all of it waiting on the network. Now the push sends go to
 * every device at once; the Counter's order book rings Salt Admin at the move, with the guards of Fable's review, and the Desk rings only what it
 * did not; the nudge names the orders moved and its pass reconciles those (and every order owing its pending row); queueSale's first look reads
 * together; and a drafted row is told to an open Salt Admin. Driven on the real roads: the order book over node:sqlite, both Workers, the Desk's D1
 * on the migrated schema, phones with real keys. Every code, username, id and endpoint is invented. Each check is red under its own mutation
 * (test/instant.mutations.json):
 *   I1  every device at once: three subscriptions are all being sent to before any answers
 *   I2  a bounded wake: a send still open at its deadline is aborted and counted failed, the others sent
 *   I3  a customer's Place rings Salt Admin from the Counter, the kind and the order id sealed to each phone, and the nudge leaves after the ring
 *   I4  a ring no device took writes nothing into owner-rung, and the nudge still goes
 *   I5  the kinds are the move's own: I have sent it after an unrung Place rings pay alone
 *   I6  while a ring is on its way the book says pending, and not once it has ended
 *   I7  the ring is bounded: a push service that never answers is let go at RING_MS and what the other phone took is still written
 *   I8  owner-rung is max-merged: a slow ring never moves a mark back, and last-theirs takes only the value standing
 *   I9  a Place with a note rings order and said, and writes both
 *   I10 the Desk sends nothing for a kind the Counter rang, moves its mark and keeps Salt Admin marked on
 *   I11 the Desk holds a kind not rung while a ring is pending (no send, no mark), and rings it once nothing is pending
 *   I12 the Desk rings only the kinds the Counter did not
 *   I13 the Desk reads its three marks together
 *   I14 the nudge body: ids of the order shape, at most 50; missing or another shape is a whole pass, an empty list a pass of none
 *   I15 a call while a pass runs adds its orders to the next pass, and a whole call makes it whole
 *   I16 queueSale's first look has the blob, the entry's own key and its draft all open at once
 *   I17 a fixed id's unreadable draft still counts only past a blob with no hit
 *   I18 end to end, I have sent it is one banner a phone, from the Counter, none from the Desk's wake
 *   I19 a drafted row is told to Salt Admin's open sockets, and no customer's
 *   I20 a nudge's pass reconciles the order named and every order owing its pending row, and leaves the rest to the minute
 *   I21 a nudge's pass says how long each step took */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { orderBook, fakeServerSocket } from "./orderbook-harness.mjs";

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const J = JSON.stringify;
const KEY = "instant-fixture-bridge-key-0123456789abcdef";
const tick = () => new Promise((r) => setTimeout(r, 0));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const rid = () => ("instTap" + (++n) + "0".repeat(24)).slice(0, 24);
const quiet = async (f, logs) => { const l = console.log; console.log = (...a) => { if (logs) logs.push(a.join(" ")); }; try { return await f(); } finally { console.log = l; } };

const b64u = (a) => Buffer.from(a).toString("base64url");
const cat = (...a) => { const o = new Uint8Array(a.reduce((k, x) => k + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const te = new TextEncoder();
const hk = async (salt, ikm, info, len) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info },
  await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), len * 8));
/* a phone: its keys as the page files them, and RFC 8291's receiving side to read what is sealed to it (as test/admin-push.mjs) */
async function phone() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  const read = async (msg) => {
    const salt = msg.slice(0, 16), idlen = msg[20], asPub = msg.slice(21, 21 + idlen), ct = msg.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, kp.privateKey, 256));
    const ikm = await hk(auth, secret, cat(te.encode("WebPush: info"), [0], pub, asPub), 32);
    const cek = await hk(salt, ikm, cat(te.encode("Content-Encoding: aes128gcm"), [0]), 16), nonce = await hk(salt, ikm, cat(te.encode("Content-Encoding: nonce"), [0]), 12);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
    let end = pt.length - 1; while (end > 0 && pt[end] === 0) end--;
    return JSON.parse(new TextDecoder().decode(pt.slice(0, end)));
  };
  return { keys: { p256dh: b64u(pub), auth: b64u(auth) }, read };
}

/* the push services: every request recorded in one sequence with the nudges; each endpoint answers as its mode says */
let seq = 0;
const hits = [], mode = {}, held = [];
function pushStub() {
  const base = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (!u.startsWith("https://push.example/")) return base(url, init);
    const hit = { u, seq: ++seq, body: init.body, signal: init.signal || null, open: true };
    hits.push(hit);
    const m = mode[u] || 201;
    if (m === "hold" || m === "never") {
      return new Promise((resolve, reject) => {
        const go = () => { hit.open = false; resolve(new Response("", { status: 201 })); };
        if (m === "hold") held.push(go);
        if (hit.signal) hit.signal.addEventListener("abort", () => { hit.open = false; hit.aborted = true; reject(new Error("aborted")); });
      });
    }
    hit.open = false;
    return new Response("", { status: m });
  };
  return () => { globalThis.fetch = base; };
}
const release = () => { while (held.length) held.shift()(); };

async function vapid() {
  const vp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { STMT_VAPID_PUBLIC_KEY: "instant-public", STMT_VAPID_SUBJECT: "mailto:a@b.test", STMT_VAPID_PRIVATE_JWK: J(await crypto.subtle.exportKey("jwk", vp.privateKey)) };
}
async function subscribe(store, P, endpointId, ep, ph) { await store.put("opush:" + await endpointId(ep), J({ endpoint: ep, keys: ph.keys, at: "2026-11-19T00:00:00.000Z" })); P[ep] = ph; }
const kindsOf = async (P, list) => Promise.all(list.map(async (h) => (P[h.u] ? (await P[h.u].read(new Uint8Array(h.body))) : null)));

export async function run({ ok, skip }) {
  let DatabaseSync = null;
  try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
  if (!DatabaseSync) { if (skip) skip("node:sqlite is unavailable here, so the instant roads were not driven"); return; }
  const O = await import("../stmt/orders.js"), OB = await import("../stmt/orderbook.js"), PU = await import("../stmt/push.js");
  const DO = await import("../src/orders.js"), W = await import("../src/worker.js");
  const deskW = W.default, stmtW = (await import("../stmt/worker.js")).default;
  const restore = pushStub();
  try {
    await pushSide(ok, PU);
    await counterSide(ok, O, OB, PU);
    await deskSide(ok, DO, W);
    await bothWorkers(ok, O, OB, PU, W, deskW, stmtW, DatabaseSync);
  } finally { restore(); release(); }
}

/* ---- the push sends ---- */
async function pushSide(ok, PU) {
  const store = new Store(), env = Object.assign({ STMT: store }, await vapid()), P = {};
  const eps = ["https://push.example/i1-a", "https://push.example/i1-b", "https://push.example/i1-c"];
  for (const ep of eps) { await subscribe(store, P, PU.endpointId, ep, await phone()); mode[ep] = "hold"; }
  const h0 = hits.length;
  const w = PU.wakeOwner(env, { k: "order" });
  for (let i = 0; i < 200 && hits.length - h0 < 3; i++) await tick();
  const openAtOnce = hits.slice(h0).filter((h) => h.open).length;
  /* released again and again, bounded, so sends made one after another (the mutation) still end */
  const r = await Promise.race([w, (async () => { for (let i = 0; i < 100; i++) { release(); await sleep(10); } return "hung"; })()]);
  ok(openAtOnce === 3 && r.sent === 3, "I1: Salt Admin's wake sends to every device at once: three subscriptions all being sent to before any answers: " + J({ openAtOnce, r }));

  mode[eps[0]] = "never"; mode[eps[1]] = 201; mode[eps[2]] = 201;
  const h1 = hits.length, t0 = Date.now();
  const r2 = await Promise.race([PU.wakeOwner(env, { k: "order" }, { deadlineMs: 60 }), sleep(1500).then(() => "unbounded")]);
  const aborted = hits.slice(h1).filter((h) => h.u === eps[0]).every((h) => h.aborted === true);
  ok(r2 !== "unbounded" && r2.sent === 2 && r2.failed === 1 && aborted && Date.now() - t0 < 1500,
    "I2: a bounded wake aborts a send still open at its deadline and counts it failed, the others sent: " + J({ r2, aborted }));
  for (const ep of eps) delete mode[ep];
}

/* ---- the Counter: the ring at the move ---- */
async function counterSide(ok, O, OB, PU) {
  const store = new Store(), nudges = [], P = {};
  const DESK_MAKER = { fetch: async (req) => { nudges.push({ seq: ++seq, body: await req.text() }); return new Response(J({ ok: true }), { status: 202 }); } };
  const env = Object.assign({ STMT: store, ORDER_STORE: "object", STMT_DESK_KEY: "desk-key", COUNTER_MAKER_KEY: KEY, DESK_MAKER }, await vapid());
  const h = orderBook(env);
  env.ORDERBOOK = h.ns;
  const EA = "https://push.example/c-a", EB = "https://push.example/c-b";
  await subscribe(store, P, PU.endpointId, EA, await phone()); await subscribe(store, P, PU.endpointId, EB, await phone());
  const busy = () => h.book.nudging || (h.book.rings && h.book.rings.size);
  const settle = async (bound = 6000) => {
    const end = Date.now() + bound;
    while (busy() && Date.now() < end) { await Promise.race([Promise.all([...(h.book.rings || [])]), sleep(50)]); if (h.book.nudging) await Promise.race([h.book.nudging, sleep(50)]); await tick(); }
    return !busy();
  };
  const last = () => h.book.fetch(new Request("https://orderbook/last", { method: "POST", body: "{}" })).then((r) => r.json());
  const U = ["nraa-cdef", "nrbb-cdef", "nrcc-cdef", "nrdd-cdef", "nree-cdef"];
  const place = (u, extra) => quiet(() => O.placeOrder(env, u, Object.assign({ product: "salt", qty: 2, mode: "collect", place: "", unit: 100, total: 200, week: "", rid: rid() }, extra || {})));
  const ack = (u, id) => h.book.fetch(new Request("https://orderbook/desk", { method: "POST", body: J({ u, id, body: { status: "acknowledged", delivery: 0 } }) })).then((r) => r.json());
  const since = async (h0) => kindsOf(P, hits.slice(h0));

  /* I3 */
  let h0 = hits.length, n0 = nudges.length;
  const p1 = (await place(U[0])).order; await settle();
  const seen = await since(h0), nudge = nudges.slice(n0), lastPush = Math.max(...hits.slice(h0).map((x) => x.seq));
  const m1 = await last();
  ok(seen.length === 2 && seen.every((x) => x && x.k === "order" && x.o === p1.id) && nudge.length === 1 && nudge[0].seq > lastPush
    && nudge[0].body === J({ o: [p1.id] }) && m1.rung && m1.rung.last === m1.last && !m1.pending,
    "I3: a customer's Place rings Salt Admin from the Counter, order and the order id sealed to each phone, writes owner-rung, and the nudge (naming the order) leaves after the ring: " + J({ seen, nudge, lastPush, rung: m1.rung }));

  /* I4 */
  mode[EA] = 500; mode[EB] = 500;
  h0 = hits.length; n0 = nudges.length;
  const p2 = (await place(U[1])).order; await settle();
  const m2 = await last();
  ok(hits.length - h0 === 2 && m2.rung.last === m1.last && m2.last > m1.last && nudges.length - n0 === 1,
    "I4: a ring no device took writes nothing into owner-rung, so the Desk rings it, and the nudge still goes: " + J({ tried: hits.length - h0, rung: m2.rung, last: m2.last }));
  delete mode[EA]; delete mode[EB];

  /* I5: their I have sent it, after the Place whose ring nobody took */
  await ack(U[1], p2.id); await settle();
  h0 = hits.length;
  await quiet(() => O.customerMove(env, U[1], p2.id, "pay", { amount: 50, method: "transfer", account: "maybank", rid: rid() })); await settle();
  const k5 = (await since(h0)).map((x) => x && x.k), m5 = await last();
  ok(k5.length === 2 && k5.every((k) => k === "pay") && m5.rung.theirs === m5.theirs && m5.rung.last === m1.last,
    "I5: the kinds are the move's own: I have sent it after an unrung Place rings pay alone, and owner-rung still leaves that Place to the Desk: " + J({ k5, rung: m5.rung }));

  /* I6 */
  mode[EA] = "hold"; mode[EB] = "hold";
  const p3 = place(U[2]);
  await p3;
  for (let i = 0; i < 200 && held.length < 2; i++) await tick();
  const during = await last();
  release(); await settle();
  const after = await last();
  ok(during.pending === true && after.pending === undefined && after.rung.last === after.last,
    "I6: while a ring is on its way the book answers pending, and not once it has ended: " + J({ during: during.pending, after: after.pending }));

  /* I7 */
  mode[EA] = "never"; mode[EB] = 201;
  h0 = hits.length;
  await place(U[3]);
  const ended = await settle(OB.RING_MS + 3000);
  const m7 = await last(), stuck = hits.slice(h0).filter((x) => x.u === EA);
  ok(ended && stuck.length === 1 && stuck[0].aborted === true && m7.rung.last === m7.last,
    "I7: a push service that never answers is let go at RING_MS, and what the other phone took is written: " + J({ ended, aborted: stuck.map((x) => !!x.aborted), rung: m7.rung.last === m7.last }));
  delete mode[EA]; delete mode[EB];

  /* I8 */
  const a8 = OB.rungAfter({ last: "2026-11-19T02:00:00.000Z" }, [{ key: "last", v: "2026-11-19T01:00:00.000Z" }], null);
  const b8 = OB.rungAfter({ theirs: "2026-11-19T02:00:00.000Z|pay" }, [{ key: "theirs", v: "2026-11-19T02:00:00.000Z|cancel" }], "2026-11-19T02:00:00.000Z|cancel");
  const c8 = OB.rungAfter({ theirs: "2026-11-19T02:00:00.000Z|pay" }, [{ key: "theirs", v: "2026-11-19T02:00:00.000Z|cancel" }], "2026-11-19T02:00:00.000Z|pay");
  const d8 = OB.rungAfter({ said: "2026-11-19T01:00:00.000Z" }, [{ key: "said", v: "2026-11-19T03:00:00.000Z" }], null);
  ok(a8.last === "2026-11-19T02:00:00.000Z" && b8.theirs.endsWith("|cancel") && c8.theirs.endsWith("|pay") && d8.said === "2026-11-19T03:00:00.000Z",
    "I8: owner-rung is max-merged: a slow ring never moves a mark back, and in one millisecond last-theirs takes only the value standing: " + J({ a8, b8, c8, d8 }));

  /* I9 */
  h0 = hits.length;
  await place(U[4], { note: "Friday please" }); await settle();
  const k9 = (await since(h0)).map((x) => x && x.k).sort(), m9 = await last();
  ok(J(k9) === J(["order", "order", "said", "said"]) && m9.rung.last === m9.last && m9.rung.said === m9.said,
    "I9: a Place with a note rings order and said, as the Desk rings both, and writes both: " + J({ k9, rung: m9.rung }));
}

/* ---- the Desk's banner step ---- */
async function deskSide(ok, DO, W) {
  let marks = {};
  const wakes = [], q = new Store();
  const STMT_SITE = { fetch: async (url, init) => {
    const p = new URL(url).pathname;
    if (p === "/desk/orders/last") return Response.json(Object.assign({ ok: true }, marks));
    if (p === "/desk/owner-wake") { wakes.push(JSON.parse(init.body).k); return Response.json({ ok: true, devices: 1, sent: 1, failed: 0 }); }
    return Response.json({ ok: true });
  } };
  const env = { SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "desk-key" };
  const T1 = "2026-11-19T01:00:00.000Z|pay", T2 = "2026-11-19T01:05:00.000Z|pay";

  /* I10 */
  marks = { theirs: T1, rung: { theirs: T1 } };
  const r10 = await quiet(() => DO.nudgeOrders(env));
  ok(wakes.length === 0 && q.values.get("orders:theirs") === T1 && q.values.get(DO.ADMIN_ON) === "1" && r10.rung === true,
    "I10: the Desk sends nothing for a kind the Counter rang, moves its own mark and keeps Salt Admin marked on: " + J({ wakes, r10 }));

  /* I11 */
  marks = { theirs: T2, rung: { theirs: T1 }, pending: true };
  const r11 = await quiet(() => DO.nudgeOrders(env));
  const heldOk = wakes.length === 0 && q.values.get("orders:theirs") === T1 && r11.held === true;
  marks = { theirs: T2, rung: { theirs: T1 } };
  await quiet(() => DO.nudgeOrders(env));
  ok(heldOk && J(wakes) === J(["pay"]) && q.values.get("orders:theirs") === T2,
    "I11: the Desk holds a kind not rung while a ring is pending, no send and no mark, and rings it once nothing is pending: " + J({ heldOk, r11, wakes }));

  /* I12: a Place with a note whose order was rung and whose line was not */
  wakes.length = 0;
  const L = "2026-11-19T01:10:00.000Z";
  marks = { last: L, said: L, theirs: T2, rung: { last: L, theirs: T1 } };
  await quiet(() => DO.nudgeOrders(env));
  ok(J(wakes) === J(["said"]), "I12: the Desk rings only the kinds the Counter did not: " + J({ wakes }));

  /* I13 */
  const q2 = new Store(); let open = 0, most = 0;
  const get = q2.get.bind(q2);
  q2.get = async (k, t) => { open++; most = Math.max(most, open); await sleep(5); open--; return get(k, t); };
  marks = {};
  await quiet(() => DO.nudgeOrders(Object.assign({}, env, { SALT_QUEUE: q2 })));
  ok(most === 3, "I13: the Desk reads its three banner marks together: " + J({ most }));

  /* I14 */
  const id = "20261119010000-ab12cd34".slice(0, 23), ids = Array.from({ length: 51 }, (_, i) => "2026111901" + String(i).padStart(4, "0") + "-ab");
  const cases = { none: W.nudgeIds(""), notJson: W.nudgeIds("nudge"), noList: W.nudgeIds("{}"), empty: W.nudgeIds(J({ o: [] })), one: W.nudgeIds(J({ o: [id, id] })),
    bad: W.nudgeIds(J({ o: ["../x"] })), many: W.nudgeIds(J({ o: ids })), long: W.nudgeIds(J({ o: [id], pad: "x".repeat(5000) })) };
  ok(cases.none === null && cases.notJson === null && cases.noList === null && J(cases.empty) === "[]" && J(cases.one) === J([id]) && cases.bad === null && cases.many === null && cases.long === null,
    "I14: the nudge names orders of the order shape alone, at most 50; missing or another shape is a whole pass, an empty list a pass of none: " + J(cases));

  /* I15 */
  let go; const gate = new Promise((r) => { go = r; });
  const penv = { SALT_QUEUE: new Store(), STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: async () => { await gate; return Response.json({ ok: false, error: "fixture" }); } } };
  const A = "20261119010000-aa", B = "20261119010000-bb", C = "20261119010000-cc";
  const first = quiet(() => W.ordersOnce(penv, null, { only: [A] }));
  await tick();
  W.ordersOnce(penv, null, { only: [C] }); W.ordersOnce(penv, null, { only: [B] });
  const named = W.passNext();
  W.ordersOnce(penv, null, {});
  const whole = W.passNext();
  go(); await first; for (let i = 0; i < 20 && W.passRunning(); i++) await sleep(5);
  ok(named.again && J(named.only) === J([B, C]) && whole.again && whole.only === null,
    "I15: a call while a pass runs adds its orders to the next pass, and a call for the whole makes it whole: " + J({ named, whole }));

  /* I16 and I17: queueSale's first look */
  const q3 = new Store(); let qopen = 0, qmost = 0;
  const qget = q3.get.bind(q3);
  q3.get = async (k, t) => { qopen++; qmost = Math.max(qmost, qopen); await sleep(5); qopen--; return qget(k, t); };
  const LEDGER = { prepare: () => ({ bind: () => ({ first: async () => { qopen++; qmost = Math.max(qmost, qopen); await sleep(5); qopen--; return null; } }) }) };
  const entry = { at: "2026-11-19T01:20:00.000Z", raw: "instant fixture sale", collection: "sales", party: "IN1-AA" };
  const queued = await DO.queueSale({ SALT_QUEUE: q3, SALT_LEDGER: LEDGER }, Object.assign({}, entry));
  ok(queued === true && qmost === 3, "I16: queueSale's first look has the blob, the entry's own key and its draft all open at once: " + J({ queued, qmost }));

  const q4 = new Store();
  await q4.put("q:orders", J({ queue: [Object.assign({}, entry)] }));
  const BAD = { prepare: () => ({ bind: () => ({ first: async () => { throw new Error("the ledger is unreadable"); } }) }) };
  let r17;
  try { r17 = await DO.queueSale({ SALT_QUEUE: q4, SALT_LEDGER: BAD }, Object.assign({}, entry), true); } catch (e) { r17 = "threw: " + e.message; }
  ok(r17 === false, "I17: a fixed id whose draft cannot be read still counts that only past a blob with no hit: the blob's hit answers first: " + J({ r17 }));
}

/* ---- both Workers ---- */
async function bothWorkers(ok, O, OB, PU, W, deskW, stmtW, DatabaseSync) {
  const REPO = join(import.meta.dirname, "..");
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
  const D1 = { prepare(sql) { const st = db.prepare(sql);
    const mk = (a) => ({ run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
      first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self; },
    batch(list) { db.exec("BEGIN IMMEDIATE"); try { const out = list.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
  const CODES = ["IN4-NA", "IN5-NB", "IN6-NC", "IN7-ND"], US = ["nwab-cdef", "nxab-cdef", "nyab-cdef", "nzab-cdef"];
  const PRICING = { v: "v900", takenAt: "2026-10-01T00:00:00.000Z", tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], profileRule: { smallUpTo: 1, bigFrom: 3 },
    byProduct: { salt: { stockCost: 56, floors: { "1": { floor: 80 }, "2": { floor: 150 }, "3": { floor: 215 } }, inputs: null, sizes: [1, 2, 3] } } };
  const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, J(doc));
  let s0 = 0;
  for (const cust of CODES) for (const d of ["2026-08-01", "2026-08-10", "2026-08-20"]) db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
    .run("sales", s0++, "h" + s0, J({ rid: "s9" + s0, customer: cust, date: d, qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: d, paidOn: d }));
  setState("roster", CODES); setState("PRICING", PRICING); setState("OPEN", { byKey: {}, position: {} });
  db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
  const skv = new Store(), dkv = new Store(), P = {};
  await dkv.put("stmt-users", J(Object.fromEntries(US.map((u, i) => [u, CODES[i]]))));
  const assets = { fetch: async () => new Response(J({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
  const deskJobs = [], dctx = { waitUntil(p) { deskJobs.push(Promise.resolve(p).catch(() => {})); } };
  let bridge = "on", forwarded = 0;
  const senv = Object.assign({ STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object", COUNTER_MAKER_KEY: KEY,
    DESK_MAKER: { fetch: async (req) => { if (bridge !== "on") throw new Error("dropped"); if (++forwarded > 400) return new Response("{}", { status: 503 }); return deskW.fetch(req, denv, dctx); } } }, await vapid());
  const ob = orderBook(senv);
  senv.ORDERBOOK = ob.ns;
  const wakes = [];
  const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: assets, COUNTER_MAKER_KEY: KEY,
    STMT_SITE: { fetch: async (url, init) => { const p = new URL(url).pathname; if (p === "/desk/owner-wake") wakes.push(JSON.parse(init.body).k); return stmtW.fetch(new Request(url, init), senv); } } };
  const EA = "https://push.example/b-a", EB = "https://push.example/b-b";
  await subscribe(skv, P, PU.endpointId, EA, await phone()); await subscribe(skv, P, PU.endpointId, EB, await phone());
  const settle = async () => { for (let i = 0; i < 80; i++) { if (ob.book.rings && ob.book.rings.size) await Promise.all([...ob.book.rings]); if (ob.book.nudging) await ob.book.nudging;
    for (let k = 0; k < 20 && deskJobs.length; k++) await deskJobs.shift(); await tick(); if (!ob.book.nudging && !(ob.book.rings && ob.book.rings.size) && !deskJobs.length && !W.passRunning()) break; } };
  const place = async (u) => (await O.placeOrder(senv, u, { product: "salt", qty: 2, mode: "collect", place: "", unit: 100, total: 200, week: "", rid: rid() })).order;
  const deskAck = (u, id) => stmtW.fetch(new Request("https://site.test/desk/orders/" + u + "/" + id, { method: "POST",
    headers: { "content-type": "application/json", "X-Stmt-Desk": "desk-key" }, body: J({ status: "acknowledged", delivery: 0 }) }), senv);
  const pay = (u, id) => O.customerMove(senv, u, id, "pay", { amount: 50, method: "transfer", account: "maybank", rid: rid() });
  const queued = (id) => [...dkv.values.entries()].filter(([k]) => k.startsWith("q:")).map(([, v]) => JSON.parse(v).queue || []).flat().filter((e) => e && (e.orderId === id || (e.payload && e.payload.orderId === id)));
  const syncOf = (id) => { const r = ob.db.prepare("SELECT doc FROM ord WHERE oid = ?").get(id); return r ? (JSON.parse(r.doc).sync || null) : null; };
  const cron = (iso) => quiet(async () => { const waits = []; await deskW.scheduled({ cron: "* * * * *", scheduledTime: Date.parse(iso) }, denv, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); });
  /* an owner socket and a customer's, on the order book, as the platform keeps them */
  const owner = fakeServerSocket(), cust = fakeServerSocket();
  ob.state.acceptWebSocket(owner, ["owner"]);
  cust.serializeAttachment({ u: US[3], exp: Date.now() + 3600e3 }); ob.state.acceptWebSocket(cust, ["c"]);

  /* I18 and I19: an acknowledged order, then their I have sent it */
  const a = await quiet(async () => { const o = await place(US[0]); await settle(); return o; });
  await quiet(async () => { await deskAck(US[0], a.id); await settle(); });
  const h0 = hits.length, w0 = wakes.length, o0 = owner.sent.length, c0 = cust.sent.length;
  await quiet(async () => { await pay(US[0], a.id); await settle(); });
  const seen = (await kindsOf(P, hits.slice(h0))).map((x) => x && x.k);
  const deskPay = wakes.slice(w0).filter((k) => k === "pay").length;
  ok(seen.filter((k) => k === "pay").length === 2 && deskPay === 0,
    "I18: end to end, I have sent it is one banner a phone, rung by the Counter, and the Desk's wake sends none: " + J({ seen, deskWakes: wakes.slice(w0) }));
  const toOwner = owner.kinds().slice(o0).map((m) => m && m.k), toCust = cust.kinds().slice(c0).map((m) => m && m.k);
  ok(queued(a.id).length >= 1 && toOwner.includes("approve") && !toCust.includes("approve"),
    "I19: a drafted row is told to Salt Admin's open sockets at once, and to no customer's: " + J({ toOwner, toCust }));

  /* I20 and I21: X owes a claim and waits for its row, Z owes its pending row, and Y is the order moved */
  const x = await quiet(async () => { const o = await place(US[1]); await settle(); return o; });
  await quiet(async () => { await deskAck(US[1], x.id); await cron("2026-11-19T01:30:00Z"); await settle(); });
  bridge = "off"; await quiet(async () => { await pay(US[1], x.id); await settle(); }); bridge = "on";
  const xBefore = J(syncOf(x.id));
  const z = await quiet(async () => { bridge = "off"; const o = await place(US[2]); await settle(); await deskAck(US[2], o.id); bridge = "on"; return o; });
  const y = await quiet(async () => { const o = await place(US[3]); await settle(); await deskAck(US[3], o.id); return o; });
  const logs = [];
  await quiet(async () => { await pay(US[3], y.id); await settle(); }, logs);
  const xAfterNudge = J(syncOf(x.id)), zQueued = queued(z.id).length;
  await cron("2026-11-19T01:40:00Z"); await quiet(settle);
  const xAfterMinute = syncOf(x.id);
  ok(xAfterNudge === xBefore && zQueued >= 1 && queued(y.id).length >= 1 && xAfterMinute && xAfterMinute.state === "waiting" && xBefore !== J(xAfterMinute),
    "I20: a nudge's pass reconciles the order named and every order owing its pending row, and leaves the rest to the minute: " + J({ xBefore, xAfterNudge, zQueued, xAfterMinute }));
  const line = logs.find((l) => l.startsWith("orders pass (nudge): ")) || "";
  let said = null; try { said = JSON.parse(line.slice("orders pass (nudge): ".length)); } catch (e) { said = null; }
  ok(!!said && said.orders === 1 && ["read", "banner", "reconcile", "desk"].every((k) => Number.isFinite(said.ms[k])),
    "I21: a nudge's pass says how long each step took, and how many orders it was named: " + J({ line }));
}
