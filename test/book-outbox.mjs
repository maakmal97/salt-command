/* test/book-outbox.mjs: S6 OF THE BOOK PLAN, A BOOKED ROW TELLS ITS ORDER AT ONCE (28 Oct 2026; migrations/0020, flag book_outbox SHIPPED OFF). Each check red under its own mutation
 * (test/book-outbox.mutations.json):
 *   1  the Book's outbox: a tap that books a sale or an amendment leaves one row in the same transaction; a count, a purchase, a tap seen again and a refused tap leave none; rows are
 *      marked sent or tried by the verbs, which check their body; nothing moves the revision; the export carries the rows; the recovery test's object answers none of it
 *   2  tellSite's forced pass: it runs on a version the Counter was already told, and leaves TOLD_MARK and TOLD_FAILED to the regular pass, which still moves them exactly as before
 *   3  the drain: off as shipped (and with no flag table) it does nothing; on, one forced pass covers every live row, a clean pass marks them sent, a pass with a refusal or a throw marks none
 *      and counts the try, a rejected draft's row is dropped with no pass, a draft still pending is left alone, a Book that does not answer is said
 *   4  the roads: an approval through the Worker (one tap, decide-many) drains the row at once and the minute cron drains one that waited, only with the flag on */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const T = (n) => "2031-01-0" + n;
const IDN = (n, d = 2) => "2031-01-0" + d + "T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const worker = (await import("../src/worker.js")).default;
  const { buildSeed } = await import("../tools/d1.mjs");
  const { tellSite } = await import("../src/orders.js");
  const { drainOutbox, outboxMode } = await import("../src/outbox.js");
  const { bindBook } = await import("../src/drafter.js");
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const { NOTES, ...bookless } = fb();
  const ledger = { ...bookless, PRICING: pricing, ...derived };
  const sale = (id, qty, d, extra) => ({ id, status: "approved", collection: "sales", row: Object.assign({ customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra || {}) });
  const count = (id, q, d) => ({ id, status: "approved", collection: "count", row: { product: "salt", qty: q, date: d } });
  const lot = (id) => ({ id, status: "approved", collection: "purchases", row: { supplier: "ZZ9-SUP", date: T(2), qty: 5, total: 250, cash: 0, receivedQty: 5, product: "salt", cost: 250 } });
  const tr = (id, product, extra) => sale(id, 1, T(5), Object.assign({ trip: "t1791900000099", product, cash: 0, deliveredQty: 0, total: 100 }, extra || {}));

  const mkBook = async (env = {}) => {
    const os = objectState(), b = new Book(os, env); let t = 0;
    b.clock = () => "2026-10-28T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    const post = (path, body) => call(path, { method: "POST", body: JSON.stringify(body) });
    await b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: fb(), pricing, derived, v: V, stamped: AT_STAMP }) }));
    return { os, b, call, post, tap: (items) => post("/tap", { items, day: T(2), v: V }), pending: () => call("/outbox"), at: () => call("/at") };
  };

  /* 1: the Book's outbox */
  const A = await mkBook();
  ok((await A.pending()).pending.length === 0, "a Book that has booked nothing has an empty outbox");
  const s1 = sale(IDN(1), 2, T(2));
  await A.tap([s1]);
  let p = (await A.pending()).pending;
  ok(p.length === 1 && p[0].draft_id === s1.id && p[0].tries === 0 && Number.isInteger(p[0].seq), "a tap that booked a sale leaves one row, in the same transaction: " + JSON.stringify(p));
  await A.tap([count(IDN(2), 10.5, T(3))]); await A.tap([lot(IDN(3))]);
  ok((await A.pending()).pending.length === 1, "a count and a purchase leave none: only a sale can move an order");
  await A.tap([s1]);
  const tw = fb().sales[fb().sales.length - 1];
  await A.tap([sale(IDN(6), +tw.qty, tw.date, { customer: tw.customer, total: tw.total, product: tw.product || "salt", cash: 0, deliveredQty: 0 })]);
  ok((await A.pending()).pending.length === 1, "a tap seen again, and a tap the law refuses, leave none");
  await A.tap([tr(IDN(4), "salt", { delivery: 10 }), tr(IDN(5), "oil")]);
  p = (await A.pending()).pending;
  ok(p.length === 3 && p[1].seq < p[2].seq, "a trip of two sales leaves two rows, in booked order");
  const rev0 = (await A.at()).rev;
  const bad = await A.post("/outbox/done", { seqs: "all" }), bad2 = await A.post("/outbox/done", { seqs: [1.5] }), bad3 = await A.post("/outbox/done", { seqs: Array.from({ length: 501 }, (_, i) => i + 1) });
  ok(bad.status === 400 && bad2.status === 400 && bad3.status === 400 && (await A.pending()).pending.length === 3, "the verbs refuse a body that is not a short list of integers, and mark nothing");
  const f1 = await A.post("/outbox/fail", { seqs: [p[0].seq], err: "x".repeat(500) });
  const afterFail = (await A.pending()).pending;
  const errRow = A.os.db.prepare("SELECT tries, err FROM outbox WHERE seq = ?").get(p[0].seq);
  ok(f1.ok && afterFail.length === 3 && afterFail[0].tries === 1 && errRow.err.length === 200, "a try is counted and its reason kept (200 characters at most), and the row stays pending");
  const d1 = await A.post("/outbox/done", { seqs: [p[0].seq, p[1].seq] });
  ok(d1.ok && (await A.pending()).pending.map((r) => r.seq).join() === String(p[2].seq), "done marks exactly the rows named");
  await A.post("/outbox/fail", { seqs: [p[0].seq] });
  ok(A.os.db.prepare("SELECT tries FROM outbox WHERE seq = ?").get(p[0].seq).tries === 1, "a row already sent is not tried again");
  ok((await A.at()).rev === rev0, "marking rows sent or tried moves nothing a reader sees: the revision stays");
  const ex = await A.call("/export");
  ok(ex.ok && ex.outbox.length === 3 && ex.outbox.filter((r) => r.sent_at).length === 2, "the export carries every row and which are sent, so a restore does not send them again");
  const T0 = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); T0.state.id = { equals: (o) => o === "book-pitr-test" };
  ok((await T0.fetch(new Request("https://book/outbox"))).status === 404 && (await T0.fetch(new Request("https://book/outbox/done", { method: "POST", body: "{}" }))).status === 404, "the recovery test's object answers no outbox verb");

  /* 2: the forced pass of tellSite */
  const kv = () => { const m = new Map(); return { m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };
  const siteEnv = (marks = {}) => {
    const q = kv(); for (const [k, v] of Object.entries(marks)) q.m.set(k, v);
    const calls = [];
    const db = { prepare: (sql) => ({ first: async () => (/FROM snapshot/.test(sql) ? { v: "v1300", stamped: "s" } : null), bind() { return this; }, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }) };
    const STMT_SITE = { fetch: async (url) => { calls.push(String(url)); return Response.json({ ok: true, orders: [] }); } };
    return { env: { SALT_LEDGER: db, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, q, calls };
  };
  const mirror = async () => ({ sales: [{ rid: "s001", customer: "ZZ1-AAA", date: T(1), qty: 1, total: 100 }], version: "v1300" });
  const N = siteEnv({ "orders:told": "v1300" });
  const n1 = await tellSite(N.env, undefined, mirror);
  ok(n1.told === 0 && N.calls.length === 0, "the regular pass still stands down on a version the Counter was told of (no call to the site)");
  const F = siteEnv({ "orders:told": "v1300", "orders:toldFailed": "sentinel" });
  const f2 = await tellSite(F.env, undefined, mirror, { force: true });
  ok(f2.ok && f2.forced === true && F.calls.length >= 1, "a forced pass runs on a version the Counter was already told of: it reads the orders: " + JSON.stringify(f2));
  ok(F.q.m.get("orders:told") === "v1300" && F.q.m.get("orders:toldFailed") === "sentinel", "and leaves the regular pass's two marks as they were");
  const F2 = siteEnv({ "orders:told": "v1200" });
  await tellSite(F2.env, undefined, mirror, { force: true });
  ok(F2.q.m.get("orders:told") === "v1200", "a clean forced pass does not move the told mark past a fold it never read");
  const R2 = siteEnv({ "orders:told": "v1200", "orders:toldFailed": "old" });
  const r2 = await tellSite(R2.env, undefined, mirror);
  ok(R2.q.m.get("orders:told") === "v1300" && !R2.q.m.has("orders:toldFailed") && !r2.forced, "the regular pass still moves the mark on a clean pass and clears its fault, exactly as before");

  /* 3: the drain */
  const world = async (flag, over = {}) => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    db.exec(buildSeed({ v: V, stamped: AT_STAMP, ledger }).sql);
    db.exec("UPDATE book_read SET mode='book'");
    if (flag) db.exec("UPDATE book_outbox SET mode='" + flag + "'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; }, first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; }, batch(list) { return list.map((s) => ({ success: true, results: s.all().results })); } };
    const B = await mkBook();
    const conc = { cur: 0, max: 0, gets: 0 };
    const ns = { idFromName: (n) => n, get: () => ({ fetch: async (r) => {
      if (over.silent) throw new Error("down");
      const path = new URL(r.url).pathname;
      if (over.failDone && path === "/outbox/done") return new Response(JSON.stringify({ ok: false }), { status: 500 });
      if (path === "/outbox") { conc.gets++; conc.cur++; conc.max = Math.max(conc.max, conc.cur); await new Promise((res) => setTimeout(res, over.slow ? 20 : 0)); conc.cur--; }
      return B.b.fetch(r);
    } }) };
    bindBook(D1, ns);
    const put = (id, status) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, status, "sales", JSON.stringify({ at: id, payload: { mode: "new" } }), JSON.stringify({ customer: "ZZ1-AAA", date: T(2), qty: 1, total: 100 }), "r", "[]", "ZZ1-AAA", "salt", T(2), 1, 100, null, "test", id);
    const rows = () => B.os.db.prepare("SELECT seq, draft_id, sent_at, tries FROM outbox ORDER BY seq").all();
    return { db, D1, B, ns, put, rows, conc, env: { SALT_LEDGER: D1, BOOK: ns } };
  };
  const stub = (answer) => { const calls = []; const tell = async (env, fixes, mirrorFn, opts) => { calls.push({ opts }); if (answer instanceof Error) throw answer; return answer; }; return { tell, calls }; };
  const W0 = await world();
  await W0.B.tap([sale(IDN(1), 2, T(2))]); W0.put(IDN(1), "approved");
  const s0 = stub({ ok: true, told: 1 });
  const off = await drainOutbox(W0.env, { tell: s0.tell });
  ok(off.skipped && s0.calls.length === 0 && W0.rows()[0].sent_at === null && await outboxMode(W0.D1) === "off", "as shipped (flag off) the drain does nothing and the row waits");
  W0.db.exec("DROP TABLE book_outbox");
  ok((await drainOutbox(W0.env, { tell: s0.tell })).skipped && await outboxMode(W0.D1) === "off", "a store before migrations/0020 reads as off");
  let bad4 = null; try { const W9 = await world("on"); W9.db.exec("UPDATE book_outbox SET mode='maybe'"); } catch (e) { bad4 = e.message; }
  ok(!!bad4, "the flag takes 'off' or 'on' only");
  const W1 = await world("on");
  await W1.B.tap([sale(IDN(1), 2, T(2))]); await W1.B.tap([sale(IDN(2), 1, T(3))]); W1.put(IDN(1), "approved"); W1.put(IDN(2), "approved");
  const s1c = stub({ ok: true, told: 2 });
  const on = await drainOutbox(W1.env, { tell: s1c.tell });
  ok(on.ok && on.sent === 2 && s1c.calls.length === 1 && s1c.calls[0].opts && s1c.calls[0].opts.force === true && W1.rows().every((r) => r.sent_at), "on, ONE forced pass covers every live row and a clean pass marks them sent: " + JSON.stringify(on));
  const again = await drainOutbox(W1.env, { tell: s1c.tell });
  ok(again.pending === 0 && s1c.calls.length === 1, "a second drain finds nothing pending and runs no pass");
  const W2 = await world("on");
  await W2.B.tap([sale(IDN(1), 2, T(2))]); W2.put(IDN(1), "approved");
  const sf = stub({ ok: true, told: 0, failed: [{ order: "o1", why: "refused" }] });
  const fail = await drainOutbox(W2.env, { tell: sf.tell });
  ok(fail.ok === false && fail.failed === 1 && W2.rows()[0].sent_at === null && W2.rows()[0].tries === 1, "a pass in which an order refused marks nothing sent and counts the try: " + JSON.stringify(fail));
  const sg = stub({ ok: true, told: 1 });
  const heal = await drainOutbox(W2.env, { tell: sg.tell });
  ok(heal.sent === 1 && W2.rows()[0].sent_at && W2.rows()[0].tries === 1, "the next drain, clean, sends it");
  const W3 = await world("on");
  await W3.B.tap([sale(IDN(1), 2, T(2))]); W3.put(IDN(1), "approved");
  const sx = stub(new Error("boom"));
  let thrown; try { thrown = await drainOutbox(W3.env, { tell: sx.tell }); } catch (e) { thrown = { ok: "threw: " + e.message }; }
  ok(thrown.ok === false && W3.rows()[0].sent_at === null && W3.rows()[0].tries === 1, "a pass that throws marks nothing and counts the try");
  const sh = stub({ ok: false, error: "the order relay is not configured" });
  await drainOutbox(W3.env, { tell: sh.tell });
  ok(W3.rows()[0].sent_at === null && W3.rows()[0].tries === 2, "a pass that cannot read the orders marks nothing either");
  const W4 = await world("on");
  await W4.B.tap([sale(IDN(1), 2, T(2))]); W4.put(IDN(1), "rejected");
  const sd = stub({ ok: true, told: 1 });
  const dropped = await drainOutbox(W4.env, { tell: sd.tell });
  ok(dropped.dropped === 1 && sd.calls.length === 0 && W4.rows()[0].sent_at, "a row whose draft was rejected is dropped with no pass: nothing booked will tell an order");
  const W5 = await world("on");
  await W5.B.tap([sale(IDN(1), 2, T(2))]); W5.put(IDN(1), "pending");
  const sp = stub({ ok: true, told: 1 });
  const pend = await drainOutbox(W5.env, { tell: sp.tell });
  ok(sp.calls.length === 0 && W5.rows()[0].sent_at === null && W5.rows()[0].tries === 0 && !pend.dropped, "a row whose draft is still pending is left alone: neither sent nor dropped, no pass");
  W5.db.prepare("UPDATE draft SET status='approved' WHERE id=?").run(IDN(1));
  ok((await drainOutbox(W5.env, { tell: sp.tell })).sent === 1, "and is sent once the approval lands");
  const W6 = await world("on", { silent: true });
  const dn = await drainOutbox(W6.env, { tell: sp.tell });
  ok(dn.ok === false && /did not answer/.test(dn.why), "a Book that does not answer is said, and nothing runs");
  const W7 = await world("on");
  await W7.B.tap([sale(IDN(1), 2, T(2))]); W7.put(IDN(1), "approved");
  const mixed = stub({ ok: true, told: 1 });
  await W7.B.tap([sale(IDN(2), 1, T(3))]); W7.put(IDN(2), "rejected");
  const mx = await drainOutbox(W7.env, { tell: mixed.tell });
  ok(mx.sent === 1 && mx.dropped === 1 && mixed.calls.length === 1 && W7.rows().every((r) => r.sent_at), "live and dead rows in one drain: one pass, both closed");

  /* Fable's findings of 28 Oct */
  const W8 = await world("on");
  await W8.B.tap([sale(IDN(1), 2, T(2))]); W8.put(IDN(1), "approved");
  W8.db.prepare("UPDATE draft SET committed_at='2026-10-28T10:30:00.000Z' WHERE id=?").run(IDN(1));
  const sc = stub({ ok: true, told: 1 });
  const cm = await drainOutbox(W8.env, { tell: sc.tell });
  ok(cm.dropped === 1 && sc.calls.length === 0 && W8.rows()[0].sent_at, "a row whose draft the fold already took is dead: the regular pass told the orders at that fold, so it buys no pass");
  const WS = await world("on");
  await WS.B.tap([sale(IDN(1), 2, T(2))]); await WS.B.tap([sale(IDN(2), 1, T(3))]); WS.put(IDN(1), "approved"); WS.put(IDN(2), "approved");
  WS.db.prepare("UPDATE draft SET committed_at='2026-10-28T10:30:00.000Z' WHERE id=?").run(IDN(1));
  const ssb = stub({ ok: true, told: 1 });
  const sib = await drainOutbox(WS.env, { tell: ssb.tell });
  ok(sib.dropped === 1 && sib.sent === 1 && ssb.calls.length === 1 && WS.rows().every((r) => r.sent_at), "a folded row and a live one in one drain: the folded one is dropped and one pass serves the other");
  const W9 = await world("on");
  for (let i = 0; i < 601; i++) { const id = "2031-01-02T05:" + String(Math.floor(i / 60)).padStart(2, "0") + ":" + String(i % 60).padStart(2, "0") + ".000Z"; W9.B.os.db.prepare("INSERT INTO outbox (draft_id, at) VALUES (?, ?)").run(id, "2026-10-28T10:00:00.000Z"); W9.put(id, "approved"); }
  const sb = stub({ ok: true, told: 0 });
  const big = await drainOutbox(W9.env, { tell: sb.tell });
  ok(big.sent === 601 && W9.rows().every((r) => r.sent_at) && sb.calls.length === 1, "601 live rows are marked in lists of at most 500 and every one is sent, by one pass: " + JSON.stringify({ sent: big.sent, markFailed: big.markFailed }));
  const WA = await world("on", { failDone: true });
  await WA.B.tap([sale(IDN(1), 2, T(2))]); WA.put(IDN(1), "approved");
  const sdn = stub({ ok: true, told: 1 });
  const mf = await drainOutbox(WA.env, { tell: sdn.tell });
  ok(mf.ok === false && mf.markFailed === true && WA.rows()[0].sent_at === null, "a mark that did not land is said (markFailed), never assumed");
  const WB = await world("on");
  await WB.B.tap([sale(IDN(1), 2, T(2))]); WB.put(IDN(1), "pending");
  const quietTell = stub({ ok: true });
  const young = await drainOutbox(WB.env, { tell: quietTell.tell, now: Date.parse("2026-10-28T10:05:00.000Z") });
  const old = await drainOutbox(WB.env, { tell: quietTell.tell, now: Date.parse("2026-10-28T10:30:00.000Z") });
  ok(!young.stuck && old.stuck === 1 && quietTell.calls.length === 0, "a row stuck behind a draft that stayed pending for ten minutes is said (stuck), a younger one is not, and neither buys a pass");
  /* the forced pass reads the fixes and sends none; the regular pass still sends them */
  const fixEnv = (marks) => {
    const q = kv(); for (const [k, v] of Object.entries(marks)) q.m.set(k, v);
    const posts = [];
    const db = { prepare: (sql) => ({ first: async () => (/FROM snapshot/.test(sql) ? { v: "v1300", stamped: "s" } : null), bind() { return this; }, all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }) };
    const STMT_SITE = { fetch: async (url, init) => { if (init && init.body) posts.push(JSON.parse(init.body)); return url.includes("/desk/orders?") ? Response.json({ ok: true, orders: [{ id: "o1", u: "u1", status: "placed" }] }) : Response.json({ ok: true }); } };
    return { env: { SALT_LEDGER: db, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, posts, q };
  };
  const undo = [{ id: "un-test-0", order: "o1", undo: true, unpay: 50 }];
  const FX1 = fixEnv({ "orders:told": "v1300" });
  await tellSite(FX1.env, undo, mirror, { force: true });
  ok(!FX1.posts.some((b) => b.fix) && !(FX1.q.m.get("orders:fixed") || "").includes("un-test-0"), "a forced pass sends no fix and marks none: two passes at once cannot apply an undo twice");
  const FX2 = fixEnv({ "orders:told": "v1200" });
  await tellSite(FX2.env, undo, mirror);
  ok(FX2.posts.some((b) => b.fix && b.fix.id === "un-test-0") && (FX2.q.m.get("orders:fixed") || "").includes("un-test-0"), "and the regular pass still sends it, once, and marks it");
  /* the forced pass leaves followRows to the regular pass: an order whose key names no row makes followRows read the drafts */
  const followEnv = (marks) => {
    const q = kv(); for (const [k, v] of Object.entries(marks)) q.m.set(k, v);
    const reads = [];
    const db = { prepare: (sql) => { const o = { first: async () => (/FROM snapshot/.test(sql) ? { v: "v1300", stamped: "s" } : null), all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 0 } }) }; o.bind = (...a) => { if (/entry LIKE/.test(sql) && /amends IS NOT NULL/.test(sql)) reads.push(a); return o; }; return o; } };
    const STMT_SITE = { fetch: async (url) => (url.includes("/desk/orders?") ? Response.json({ ok: true, orders: [{ id: "o1", u: "u1", code: "ZZ1-AAA", ledgerKey: "ZZ1-AAA|2031-01-01|999", status: "placed" }] }) : Response.json({ ok: true })) };
    return { env: { SALT_LEDGER: db, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, reads };
  };
  const FL1 = followEnv({ "orders:told": "v1300" });
  await tellSite(FL1.env, undefined, mirror, { force: true });
  const FL2 = followEnv({ "orders:told": "v1200" });
  await tellSite(FL2.env, undefined, mirror);
  ok(FL1.reads.length === 0 && FL2.reads.length >= 1, "a forced pass does not run followRows (it reads no drafts to follow an order), and the regular pass still does: " + FL1.reads.length + " and " + FL2.reads.length);
  /* one drain at a time */
  const { outboxAfter } = await import("../src/worker.js");
  const WC = await world("on", { slow: true });
  await WC.B.tap([sale(IDN(1), 2, T(2))]); WC.put(IDN(1), "approved");
  const waited = [], ctxSpy = { waitUntil(p) { waited.push(p); } };
  const jobs = [outboxAfter(WC.env, ctxSpy), outboxAfter(WC.env, ctxSpy), outboxAfter(WC.env, ctxSpy)];
  const wasLog = console.log; console.log = () => {};
  try { await Promise.all(jobs); } finally { console.log = wasLog; }
  ok(waited.length === 4 && WC.conc.max === 1 && WC.conc.gets === 2, "three drains asked for at once run one pass at a time and look again at most once: " + JSON.stringify(WC.conc));

  /* 4: the roads through the Worker and the cron */
  const roads = async (flag) => {
    const w = await world(flag);
    const q = kv(), sitecalls = [];
    const env = { REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", COUNTER_MAKER_KEY: "mk-fixture-key-0123456789abcdef0123", BOOK: w.ns, SALT_LEDGER: w.D1, SALT_QUEUE: q, STMT_DESK_KEY: "k",
      STMT_SITE: { fetch: async (u) => { sitecalls.push(String(u)); return Response.json({ ok: true, orders: [] }); } } };
    const waits = [];
    const call = async (path, body) => { const r = await worker.fetch(new Request("https://salt.test" + path, { method: "POST", headers: { "X-Salt-Key": "wk", "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" }, body: JSON.stringify(body || {}) }), env, { waitUntil(p) { waits.push(p); } }); await Promise.all(waits.splice(0)); return { status: r.status, body: await r.json().catch(() => null) }; };
    w.db.exec("UPDATE book_tap SET mode='on'");
    const draft = (id, qty = 2, d = T(2)) => w.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, "pending", "sales", JSON.stringify({ at: id, payload: { mode: "new" } }), JSON.stringify({ customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }), "r", "[]", "ZZ1-AAA", "salt", d, qty, qty * 100, null, "test", id);
    const sent = () => w.db && w.B.os.db.prepare("SELECT sent_at FROM outbox ORDER BY seq").all().map((r) => !!r.sent_at);
    return { w, env, call, draft, sent, sitecalls, q, waits };
  };
  const quiet = async (fn) => { const was = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = was; } };
  const R1 = await roads("on"); R1.draft(IDN(1)); R1.draft(IDN(2), 1, T(3));
  const a1 = await quiet(() => R1.call("/drafts/" + encodeURIComponent(IDN(1)) + "/approve"));
  ok(a1.status === 200 && R1.sent().join() === "true" && R1.sitecalls.length >= 1, "with the flag on, an approval through the Worker drains the row it booked at once, by a forced pass that asks the site: " + JSON.stringify([a1.status, R1.sent(), R1.sitecalls.length]));
  const a2 = await quiet(() => R1.call("/_internal/maker/drafts/decide-many", { approve: [IDN(2)] }));
  ok(a2.status === 200 && R1.sent().join() === "true,true", "and so does a card of decide-many");
  const R0 = await roads("off"); R0.draft(IDN(1));
  const a0 = await quiet(() => R0.call("/drafts/" + encodeURIComponent(IDN(1)) + "/approve"));
  ok(a0.status === 200 && R0.sent().join() === "false" && R0.w.B.os.db.prepare("SELECT COUNT(*) AS c FROM outbox").get().c === 1, "with the flag off the Book still writes the row and nothing drains it");
  const Rc = await roads("on"); Rc.w.db.exec("UPDATE book_outbox SET mode='off'"); Rc.draft(IDN(1));
  await quiet(() => Rc.call("/drafts/" + encodeURIComponent(IDN(1)) + "/approve"));
  ok(Rc.sent().join() === "false", "(setup) a row waiting after a tap whose drain was off");
  Rc.w.db.exec("UPDATE book_outbox SET mode='on'");
  const waits = [];
  await quiet(async () => { await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-10-28T10:07:00.000Z") }, Rc.env, { waitUntil(p) { waits.push(p); } }); await Promise.all(waits); });
  ok(Rc.sent().join() === "true", "the minute cron drains a row that waited: the net for a tap whose own drain did not finish");
}
