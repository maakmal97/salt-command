/* test/book-tap-worker.mjs: S4d OF THE BOOK PLAN, A TAP BOOKS THE ROW AT ONCE (27 Oct 2026; his answers of the same day). The flag `book_tap` (migrations/0019) ships 'off'.
 * The Worker's roads over a real SQLite D1 and the real Book (node:sqlite object), each check red under its own mutation (test/book-tap-worker.mutations.json):
 *   1  the flag: shipped 'off' and checked to two values; off (or a store before the table) approves exactly as before, with no call to the Book and nothing written beside the row
 *   2  on: an approval books the row in the Book first and writes its rids and booking order into the draft's row in the approval's own batch; the view holds the row; a tap again changes nothing
 *   3  a refusal by the law is a 409 with the reason, the draft stays pending and nothing is booked; a Book behind the mirror, silent, or holding the fold's alone approves as before
 *   4  a trip books whole on one tap; a trip with one row the fold's alone is approved with no booking at all; decide-many books each card once and says a refusal with its fix
 *   5  an entry never outlives a rejection: a rejection takes it back, a Book that will not stops the rejection with the flag on and not with it off; an approval that lost a race to a rejection,
 *      or whose D1 batch failed, takes its entry back; the readcheck names an entry whose draft was rejected
 *   6  his pre-approval is a tap too: spent through the same road, and a refusal leaves the draft pending with his yes marked as differing
 *   7  the minute net books an approved draft that has no booking (and a trip whole), voids the entry of a rejected draft, leaves a row the fold staged untouched under a booking, and does nothing with the flag off
 *   8  the fold's side of it: the staged row carries its rids and booking order, and the approved list reads booked rows in booking order */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "27 Oct 2026, 10:00 KL";
const IDN = (n, d = 2) => "2031-01-0" + d + "T0" + n + ":00:00.000Z";
const J = JSON.stringify;

export async function run({ ok }) {
  const worker = (await import("../src/worker.js")).default;
  const { buildSeed } = await import("../tools/d1.mjs");
  const { bookNet, tapMode, klDay, ridStmts } = await import("../src/book-tap.js");
  const { applyPre, offerDigest, bindBook } = await import("../src/drafter.js");
  const { APPROVED_SQL } = await import("../tools/drafts.mjs");

  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-27T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-27", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const { NOTES, ...bookless } = fb();
  const ledger = { ...bookless, PRICING: pricing, ...derived };

  /* a world: the mirror in SQLite, the Book loaded, and the Worker's env. `over` moves the flag, the versions, and what the Book's door does. */
  const world = async (over = {}) => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    db.exec(buildSeed({ v: over.mirrorV || V, stamped: AT_STAMP, ledger: { ...ledger, PRICING: { ...pricing, v: over.mirrorV || V } } }).sql);
    if (over.flag) db.exec("UPDATE book_tap SET mode='" + over.flag + "'");
    if (over.readFlag !== false) db.exec("UPDATE book_read SET mode='book'");
    const calls = [], hooks = { failBatch: false };
    const mk = (a, sql) => { const st = db.prepare(sql); return { sql, run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; }, first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mk([], sql); o.bind = (...a) => mk(a, sql); return o; },
      batch(list) { calls.push("d1.batch"); if (hooks.failBatch) { hooks.failBatch = false; throw new Error("D1 went away"); } db.exec("BEGIN"); try { const out = list.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
    const os = objectState(), book = new Book(os, {}); let t = 0;
    book.clock = () => "2026-10-27T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    await (await book.fetch(new Request("https://book/load", { method: "POST", body: J({ rev: "r", book: fb(), pricing, derived, v: over.bookV || V, stamped: AT_STAMP }) }))).json();
    const door = { tapAfter: null, silent: false, voidFails: false };
    const ns = { idFromName: (n) => n, get: () => ({ fetch: async (r) => {
      const p = new URL(r.url).pathname; calls.push("book" + p);
      if (door.silent) throw new Error("the Book is down");
      if (door.voidFails && p === "/void") return new Response(J({ ok: false, error: "no" }), { status: 500 });
      const out = await book.fetch(r);
      if (p === "/tap" && door.tapAfter) { door.tapAfter(); }
      return out;
    } }) };
    const env = { REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", COUNTER_MAKER_KEY: "mk-fixture-key-0123456789abcdef0123", BOOK: over.noBook ? undefined : ns, SALT_LEDGER: D1 };
    if (!over.noBook) bindBook(D1, ns);   /* the Worker's entry points do this once a request; a direct call here needs it too */
    const waits = [];
    const call = async (path, body) => { const r = await worker.fetch(new Request("https://salt.test" + path, { method: "POST", headers: { "X-Salt-Key": "wk", "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" }, body: J(body || {}) }), env, { waitUntil(p) { waits.push(p); } }); await Promise.all(waits.splice(0)); let b = null; try { b = await r.json(); } catch (e) { b = null; } return { status: r.status, body: b }; };
    const approve = (id) => call("/drafts/" + encodeURIComponent(id) + "/approve");
    const reject = (id) => call("/drafts/" + encodeURIComponent(id) + "/reject");
    const many = (b) => call("/_internal/maker/drafts/decide-many", b);
    const put = (id, collection, row, extra = {}) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,amends,amend_kind,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, extra.status || "pending", collection, J(extra.entry || { at: id, payload: { mode: "new" } }), J(row), "r", "[]", row.customer || null, row.product || "salt", row.date || null, row.qty == null ? null : row.qty, row.total == null ? null : row.total, null, extra.amends || null, extra.amendKind || null, "test", id);
    const sale = (id, qty, d, extra = {}) => { put(id, "sales", Object.assign({ customer: "ZZ1-AAA", date: d || "2031-01-02", qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra.row || {}), extra); return id; };
    const row = (id) => db.prepare("SELECT * FROM draft WHERE id=?").get(id);
    const rowOf = (id) => JSON.parse(row(id).row);
    const events = async () => (await (await book.fetch(new Request("https://book/events"))).json()).ids;
    const read = async () => (await book.fetch(new Request("https://book/read"))).json();
    return { db, D1, book, os, env, calls, hooks, door, call, approve, reject, many, put, sale, row, rowOf, events, read, ns };
  };

  /* 1: the flag */
  const mig = readFileSync(join(REPO, "migrations", "0019_book_tap.sql"), "utf8");
  const W0 = await world();
  ok(W0.db.prepare("SELECT mode FROM book_tap WHERE one=1").get().mode === "off" && /INSERT OR IGNORE INTO book_tap \(one, mode\) VALUES \(1, 'off'\)/.test(mig), "migrations/0019 ships the flag book_tap as 'off', one row");
  let bad = null; try { W0.db.exec("UPDATE book_tap SET mode='maybe'"); } catch (e) { bad = e.message; }
  let two = null; try { W0.db.exec("INSERT INTO book_tap (one, mode) VALUES (2, 'on')"); } catch (e) { two = e.message; }
  ok(!!bad && !!two && await tapMode(W0.D1) === "off", "the flag takes 'off' or 'on' and only one row: " + J([bad, two]));
  const a0 = W0.sale(IDN(1), 2);
  const r0 = await W0.approve(a0);
  ok(r0.status === 200 && W0.row(a0).status === "approved" && !("rids" in W0.rowOf(a0)) && !("booked_seq" in W0.rowOf(a0)) && !W0.calls.some((c) => c === "book/tap") && (await W0.events()).length === 0,
    "with the flag off an approval is as it was: approved, no rids in its row, no call to tap, nothing booked: " + J([r0, W0.calls]));
  const Wm = await world({ flag: "on" }); Wm.db.exec("DROP TABLE book_tap");
  const am = Wm.sale(IDN(1), 2); const rm = await Wm.approve(am);
  ok(rm.status === 200 && !("rids" in Wm.rowOf(am)) && (await Wm.events()).length === 0 && await tapMode(Wm.D1) === "off", "a store before migrations/0019 reads as off and approves as before");

  /* 2: on, a tap books first and writes the rids beside the approval */
  const W = await world({ flag: "on" });
  const s1 = W.sale(IDN(1), 2), s2 = W.sale(IDN(2), 1, "2031-01-03");
  const t1 = await W.approve(s1);
  const rw1 = W.rowOf(s1), ev1 = await W.events(), rd1 = await W.read();
  const maxS = Math.max(...fb().sales.map((r) => +String(r.rid).slice(1)).filter(Number.isFinite));
  ok(t1.status === 200 && t1.body.ok && W.row(s1).status === "approved" && J(rw1.rids) === J(["s" + String(maxS + 1).padStart(3, "0")]) && rw1.booked_seq === 1 && ev1.join() === s1,
    "an approval with the flag on books the row, writes its rids and booking order into the draft's row, and approves it: " + J([t1.status, rw1.rids, rw1.booked_seq, ev1]));
  ok((rd1.booked || []).join() === s1 && rd1.rows.sales.some((r) => r.rid === rw1.rids[0]), "the Book's view holds the row at once, the draft named among those booked");
  const order = W.calls.filter((c) => c === "book/tap" || c === "d1.batch");
  ok(order.join() === "book/tap,d1.batch", "Book first, D1 second: the tap is asked before the approval's batch is written: " + order.join());
  const bk = W.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c;
  const again = await W.approve(s1);
  ok(again.status === 409 && /already approved/.test(again.body.error) && W.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === bk, "a second tap on the same draft is refused as decided, and books nothing more");
  const t2 = await W.approve(s2);
  ok(t2.status === 200 && W.rowOf(s2).booked_seq === 2 && W.rowOf(s2).rids[0] !== rw1.rids[0], "the next tap books the next rid and the next place in the order");

  /* 3: refusals and fallbacks */
  const tw = fb().sales[fb().sales.length - 1];
  const W3 = await world({ flag: "on" });
  const twin = W3.sale(IDN(3), +tw.qty, tw.date, { row: { customer: tw.customer, total: tw.total, product: tw.product || "salt", cash: 0, deliveredQty: 0 } });
  const r3 = await W3.approve(twin);
  ok(r3.status === 409 && /^the Book refuses it: /.test(r3.body.error) && /replay/.test(r3.body.error) && W3.row(twin).status === "pending" && !("rids" in W3.rowOf(twin)) && (await W3.events()).length === 0,
    "a refusal by the law is a 409 with its reason, the draft stays pending and nothing is booked: " + J(r3));
  const Wb = await world({ flag: "on", mirrorV: "v1253" });
  const sb = Wb.sale(IDN(1), 2); const rb = await Wb.approve(sb);
  ok(rb.status === 200 && Wb.row(sb).status === "approved" && !("rids" in Wb.rowOf(sb)) && (await Wb.events()).length === 0, "a Book behind the mirror approves as before, with no booking");
  const Ws = await world({ flag: "on" }); Ws.door.silent = true;
  const ss = Ws.sale(IDN(1), 2);
  const fbLines = [], fbWas = console.log; console.log = (...x) => { fbLines.push(x.join(" ")); };
  let rs; try { rs = await Ws.approve(ss); } finally { console.log = fbWas; }
  ok(rs.status === 200 && Ws.row(ss).status === "approved" && !("rids" in Ws.rowOf(ss)), "a Book that does not answer approves as before");
  ok(fbLines.some((l) => l.startsWith("tap fallback " + ss + ": ")), "and the approval that fell back is counted in the log, so a Book that quietly refuses for a day does not look like a healthy day: " + JSON.stringify(fbLines.filter((l) => /fallback/.test(l))));
  const Wn = await world({ flag: "on", noBook: true });
  const sn = Wn.sale(IDN(1), 2); const rn = await Wn.approve(sn);
  ok(rn.status === 200 && Wn.row(sn).status === "approved" && !("rids" in Wn.rowOf(sn)), "no Book bound approves as before");
  const Wf = await world({ flag: "on" });
  const unk = Wf.sale(IDN(1), 1, "2031-01-02", { row: { customer: "ZZ7-NEW" }, entry: { at: IDN(1), makerRequest: "m1", payload: { mode: "new", party: "ZZ7-NEW" } } });
  const rf = await Wf.approve(unk);
  ok(rf.status === 200 && Wf.row(unk).status === "approved" && !("rids" in Wf.rowOf(unk)) && (await Wf.events()).length === 0, "a trade naming a party the book lacks is the fold's: approved as before, not booked");

  /* the fold has already taken it: an entry a load closed answers as taken, and approving the draft again would book the row twice */
  const Wt = await world({ flag: "on" }); const x1 = Wt.sale(IDN(1), 2);
  const ix = JSON.parse(Wt.db.prepare("SELECT collection,row FROM draft WHERE id=?").get(x1).row);
  await Wt.book.fetch(new Request("https://book/tap", { method: "POST", body: J({ items: [{ id: x1, status: "approved", collection: "sales", row: ix }], day: "2031-01-02" }) }));
  await Wt.book.fetch(new Request("https://book/load?folded=" + encodeURIComponent(x1), { method: "POST", body: J({ rev: "r", book: fb(), pricing: { ...pricing, v: "v1253" }, derived, v: "v1253", stamped: AT_STAMP }) }));
  const rx = await Wt.approve(x1);
  ok(rx.status === 409 && /already booked/.test(rx.body.error) && Wt.row(x1).status === "pending" && !("rids" in Wt.rowOf(x1)), "a draft whose entry the fold has already taken is refused, not approved a second time: " + J(rx));

  /* 4: a trip, and decide-many */
  const W4 = await world({ flag: "on" });
  const ta = W4.sale(IDN(1), 1, "2031-01-02", { row: { trip: "t1791900000099", delivery: 10, cash: 0, deliveredQty: 0 } });
  const tb = W4.sale(IDN(2), 1, "2031-01-02", { row: { trip: "t1791900000099", product: "oil", cash: 0, deliveredQty: 0 } });
  const r4 = await W4.approve(ta);
  ok(r4.status === 200 && r4.body.trip && r4.body.trip.join() === tb && W4.row(ta).status === "approved" && W4.row(tb).status === "approved"
    && (W4.rowOf(ta).rids || []).length === 1 && (W4.rowOf(tb).rids || []).length === 1 && W4.rowOf(ta).booked_seq < W4.rowOf(tb).booked_seq && (await W4.events()).length === 2,
  "a trip is booked whole on one tap, every row with its rid and its place in the order: " + J(r4));
  const W4b = await world({ flag: "on" });
  const ua = W4b.sale(IDN(1), 1, "2031-01-02", { row: { trip: "t1791900000098", delivery: 10, cash: 0, deliveredQty: 0 } });
  const ub = W4b.sale(IDN(2), 1, "2031-01-02", { row: { trip: "t1791900000098", product: "oil", customer: "ZZ7-NEW", cash: 0, deliveredQty: 0 }, entry: { at: IDN(2), makerRequest: "m1", payload: { mode: "new", party: "ZZ7-NEW" } } });
  const r4b = await W4b.approve(ua);
  ok(r4b.status === 200 && W4b.row(ua).status === "approved" && W4b.row(ub).status === "approved" && !("rids" in W4b.rowOf(ua)) && !("rids" in W4b.rowOf(ub)) && (await W4b.events()).length === 0,
    "a trip with one row the fold's alone is approved with no booking at all, so the fold books the whole trip");
  const W4c = await world({ flag: "on" });
  const ma = W4c.sale(IDN(1), 1, "2031-01-02"), mb = W4c.sale(IDN(2), 2, "2031-01-03");
  const mt = W4c.sale(IDN(3), +tw.qty, tw.date, { row: { customer: tw.customer, total: tw.total, cash: 0, deliveredQty: 0 } });
  const rmany = await W4c.many({ approve: [ma, mb, mt] });
  ok(rmany.status === 200 && rmany.body.decided.length === 2 && rmany.body.refused.length === 1 && rmany.body.refused[0].id === mt && /Book refuses/.test(rmany.body.refused[0].error) && /own rules/.test(rmany.body.refused[0].fix)
    && W4c.rowOf(ma).booked_seq === 1 && W4c.rowOf(mb).booked_seq === 2 && W4c.row(mt).status === "pending" && (await W4c.events()).length === 2,
  "decide-many books each card once in the order given, and says a refusal by the Book with how to fix it: " + J(rmany.body));

  /* 5: an entry never outlives a rejection */
  const W5 = await world({ flag: "on" });
  const o1 = W5.sale(IDN(1), 2);
  await W5.book.fetch(new Request("https://book/tap", { method: "POST", body: J({ items: [{ id: o1, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: "2031-01-02", qty: 2, total: 200, cash: 200, deliveredQty: 2, product: "salt" } }], day: "2031-01-02" }) }));
  ok((await W5.events()).join() === o1, "(setup) an open entry whose draft is still pending: what a tap leaves when its approval did not land");
  const rj = await W5.reject(o1);
  ok(rj.status === 200 && W5.row(o1).status === "rejected" && (await W5.events()).length === 0, "a rejection takes the open entry back first: " + J([rj.status, await W5.events()]));
  const W5b = await world({ flag: "on" }); const o2 = W5b.sale(IDN(1), 2);
  W5b.door.voidFails = true;
  const rj2 = await W5b.reject(o2);
  ok(rj2.status === 503 && /take the entry back/.test(rj2.body.error) && W5b.row(o2).status === "pending", "with the flag on a Book that will not take the entry back stops the rejection: " + J(rj2));
  const W5c = await world({ flag: "off" }); const o3 = W5c.sale(IDN(1), 2);
  W5c.door.voidFails = true;
  const rj3 = await W5c.reject(o3);
  ok(rj3.status === 200 && W5c.row(o3).status === "rejected" && !W5c.calls.some((c) => c === "book/void"), "with the flag off a rejection is as it always did: it goes through and never calls the Book");
  const W5d = await world({ flag: "on" }); const l1 = W5d.sale(IDN(1), 2);
  W5d.door.tapAfter = () => W5d.db.prepare("UPDATE draft SET status='rejected' WHERE id=?").run(l1);
  const rl = await W5d.approve(l1);
  ok(rl.status === 409 && /already rejected/.test(rl.body.error) && (await W5d.events()).length === 0, "an approval that lost a race to a rejection takes its entry back: " + J([rl, await W5d.events()]));
  const W5e = await world({ flag: "on" }); const f1 = W5e.sale(IDN(1), 2);
  W5e.hooks.failBatch = true;
  let threw = null; try { await W5e.approve(f1); } catch (e) { threw = e.message; }
  const st5e = W5e.row(f1).status;
  ok(st5e === "pending" && (await W5e.events()).length === 0, "an approval whose D1 batch failed leaves the draft pending and takes the entry back: " + J([threw, st5e, await W5e.events()]));
  const W5f = await world({ flag: "off" }); const g1 = W5f.sale(IDN(1), 2);
  await W5f.book.fetch(new Request("https://book/tap", { method: "POST", body: J({ items: [{ id: g1, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: "2031-01-02", qty: 2, total: 200, cash: 200, deliveredQty: 2, product: "salt" } }], day: "2031-01-02" }) }));
  W5f.db.prepare("UPDATE draft SET status='rejected' WHERE id=?").run(g1);
  const rc = await (await worker.fetch(new Request("https://salt.test/book/readcheck", { headers: { "X-Book-Key": "bk" } }), { ...W5f.env, SALT_BOOK_KEY: "bk" }, { waitUntil() {} })).json();
  ok(rc.ok === false && rc.differ.some((d) => d.includes(g1) && /rejected/.test(d)), "the readcheck names an entry whose draft was rejected, whatever the flag says: " + J(rc));
  W5f.db.prepare("UPDATE draft SET status='pending' WHERE id=?").run(g1);
  const rcp = await (await worker.fetch(new Request("https://salt.test/book/readcheck", { headers: { "X-Book-Key": "bk" } }), { ...W5f.env, SALT_BOOK_KEY: "bk" }, { waitUntil() {} })).json();
  ok(rcp.ok === false && rcp.differ.some((d) => d.includes(g1) && /still pending/.test(d)), "and one open under a draft still pending (a batch and its void both failed): " + J(rcp));

  /* 6: his pre-approval is a tap */
  const W6 = await world({ flag: "on" });
  const p1 = W6.sale(IDN(1), 2);
  const dr = (id, collection, rowv, entry) => ({ id, entry, collection, row: rowv, flags: [], amendKind: null });
  const rowv = W6.rowOf(p1), ent = JSON.parse(W6.row(p1).entry);
  const pre = { id: "p6", hash: await offerDigest(ent, { collection: "sales", row: rowv, flags: [] }), stage: "ack", shown: J({ offer: { total: 200 } }) };
  W6.db.prepare("INSERT INTO preapproval (id,order_id,stage,hash,shown,entry_at,status,at) VALUES (?,?,?,?,?,?,?,?)").run("p6", "o6", "ack", pre.hash, pre.shown, p1, "waiting", "2026-10-27T09:00:00.000Z");
  const ap = await applyPre(W6.D1, pre, dr(p1, "sales", rowv, ent), {}, "2026-10-27T10:00:00.000Z");
  ok(ap === "applied" && W6.row(p1).status === "approved" && W6.rowOf(p1).booked_seq === 1 && W6.rowOf(p1).rids.length === 1 && (await W6.events()).join() === p1, "his yes spent on a row books it in the Book and writes its rids, as a tap does: " + J([ap, W6.rowOf(p1)]));
  const W6b = await world({ flag: "on" });
  const q1 = W6b.sale(IDN(1), +tw.qty, tw.date, { row: { customer: tw.customer, total: tw.total, cash: 0, deliveredQty: 0 } });
  const rowq = W6b.rowOf(q1), entq = JSON.parse(W6b.row(q1).entry);
  const preq = { id: "p7", hash: await offerDigest(entq, { collection: "sales", row: rowq, flags: [] }), stage: "ack", shown: J({ offer: { total: 1 } }) };
  W6b.db.prepare("INSERT INTO preapproval (id,order_id,stage,hash,shown,entry_at,status,at) VALUES (?,?,?,?,?,?,?,?)").run("p7", "o7", "ack", preq.hash, preq.shown, q1, "waiting", "2026-10-27T09:00:00.000Z");
  const apq = await applyPre(W6b.D1, preq, dr(q1, "sales", rowq, entq), {}, "2026-10-27T10:00:00.000Z");
  ok(apq === "differs" && W6b.row(q1).status === "pending" && W6b.db.prepare("SELECT status FROM preapproval WHERE id='p7'").get().status === "differs" && (await W6b.events()).length === 0,
    "a refusal by the law leaves the draft pending and his yes marked as differing: " + apq);
  const W6c = await world({ flag: "off" }); const z1 = W6c.sale(IDN(1), 2);
  const rowz = W6c.rowOf(z1), entz = JSON.parse(W6c.row(z1).entry);
  const prez = { id: "p8", hash: await offerDigest(entz, { collection: "sales", row: rowz, flags: [] }), stage: "ack", shown: J({ offer: { total: 200 } }) };
  const apz = await applyPre(W6c.D1, prez, dr(z1, "sales", rowz, entz), {}, "2026-10-27T10:00:00.000Z");
  ok(apz === "applied" && !("rids" in W6c.rowOf(z1)) && !W6c.calls.some((c) => c === "book/tap"), "with the flag off his yes is spent as before");

  /* 7: the minute net */
  const W7 = await world({ flag: "off" });
  const n1 = W7.sale(IDN(1), 2), n2 = W7.sale(IDN(2), 1, "2031-01-03");
  await W7.approve(n1); await W7.approve(n2);
  const off7 = await bookNet(W7.D1);
  ok(off7.booked === 0 && !("rids" in W7.rowOf(n1)) && (await W7.events()).length === 0, "the net does nothing with the flag off");
  W7.db.exec("UPDATE book_tap SET mode='on'");
  const on7 = await bookNet(W7.D1);
  ok(on7.booked === 2 && W7.rowOf(n1).booked_seq === 1 && W7.rowOf(n2).booked_seq === 2 && (await W7.events()).length === 2, "with the flag on the net books approved drafts that have no booking, in the order approved: " + J(on7));
  const seqBefore = W7.rowOf(n1).booked_seq, tapsBefore = W7.calls.filter((c) => c === "book/tap").length, on7b = await bookNet(W7.D1);
  ok(on7b.booked === 0 && W7.rowOf(n1).booked_seq === seqBefore && (await W7.events()).length === 2 && W7.calls.filter((c) => c === "book/tap").length === tapsBefore, "a second run books nothing more and does not even ask the Book: a booked row is not a candidate");
  const W7b = await world({ flag: "off" });
  const k1 = W7b.sale(IDN(1), 1, "2031-01-02", { row: { trip: "t1791900000097", delivery: 10, cash: 0, deliveredQty: 0 } });
  const k2 = W7b.sale(IDN(2), 1, "2031-01-02", { row: { trip: "t1791900000097", product: "oil", cash: 0, deliveredQty: 0 } });
  await W7b.approve(k1);
  W7b.db.exec("UPDATE book_tap SET mode='on'");
  const nt = await bookNet(W7b.D1);
  ok(nt.booked === 2 && W7b.rowOf(k1).rids && W7b.rowOf(k2).rids && (await W7b.events()).length === 2, "the net books a trip whole: " + J(nt));
  const W7c = await world({ flag: "on" });
  const v1 = W7c.sale(IDN(1), 2); W7c.put(IDN(2), "sales", { customer: "ZZ1-AAA", date: "2031-01-03", qty: 1, total: 100, cash: 100, deliveredQty: 1, product: "salt" }, {});
  await W7c.book.fetch(new Request("https://book/tap", { method: "POST", body: J({ items: [{ id: v1, status: "approved", collection: "sales", row: W7c.rowOf(v1) }], day: "2031-01-02" }) }));
  W7c.db.prepare("UPDATE draft SET status='rejected' WHERE id=?").run(v1);
  const nv = await bookNet(W7c.D1);
  ok(nv.voided === 1 && (await W7c.events()).length === 0, "the net voids the entry of a draft that was rejected by a road that does not take it back: " + J(nv));
  const W7d = await world({ flag: "off" });
  const m1 = W7d.sale(IDN(1), 2); await W7d.approve(m1);
  W7d.db.exec("UPDATE book_tap SET mode='on'");
  W7d.db.prepare("UPDATE draft SET committed_at='2026-10-27T10:30:00.000Z' WHERE id=?").run(m1);
  const nd = await bookNet(W7d.D1);
  ok(nd.booked === 0 && !("rids" in W7d.rowOf(m1)) && (await W7d.events()).length === 0, "a draft the fold has marked committed is neither given a booking under it nor an entry in the Book");
  const W7f = await world({ flag: "off" }); const h1 = W7f.sale(IDN(1), 2);
  await W7f.book.fetch(new Request("https://book/tap", { method: "POST", body: J({ items: [{ id: h1, status: "approved", collection: "sales", row: W7f.rowOf(h1) }], day: "2031-01-02" }) }));
  W7f.db.prepare("UPDATE draft SET status='rejected' WHERE id=?").run(h1);
  const nf = await bookNet(W7f.D1);
  ok(nf.voided === 0 && (await W7f.events()).length === 1, "with the flag off the net voids nothing either: the entry is left, and the readcheck names it");

  const W7g = await world({ flag: "off" });
  const dA = W7g.sale(IDN(1), 2), dB = W7g.sale(IDN(2), 1, "2031-01-03");
  W7g.db.prepare("UPDATE draft SET status='approved', decided_at='2026-10-27T10:00:09.000Z' WHERE id=?").run(dB);
  W7g.db.prepare("UPDATE draft SET status='approved', decided_at='2026-10-27T10:00:10.000Z' WHERE id=?").run(dA);
  W7g.db.exec("UPDATE book_tap SET mode='on'");
  await bookNet(W7g.D1);
  ok(W7g.rowOf(dA).booked_seq === 1 && W7g.rowOf(dB).booked_seq === 2, "the net books in the order the rows were drafted, which is the order the fold mints in, not the order they were approved: " + J([W7g.rowOf(dA).booked_seq, W7g.rowOf(dB).booked_seq]));
  const W7e = await world({ flag: "on" });
  const e1 = W7e.sale(IDN(1), 1, "2031-01-02", { row: { trip: "t1791900000096", delivery: 10, cash: 0, deliveredQty: 0 } });
  const e2 = W7e.sale(IDN(2), 1, "2031-01-02", { row: { trip: "t1791900000096", product: "oil", delivery: 5, cash: 0, deliveredQty: 0 } });
  W7e.db.prepare("UPDATE draft SET status='approved' WHERE id IN (?,?)").run(e1, e2);
  const ne = await bookNet(W7e.D1);
  ok(ne.booked === 0 && ne.left === 2 && (await W7e.events()).length === 0 && !("rids" in W7e.rowOf(e1)), "a trip the law refuses whole (two deliveries) is refused whole by the net, not booked a row at a time: " + J(ne));
  const kvStub = { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) };
  const Wcr = await world({ flag: "off" }); const c1 = Wcr.sale(IDN(1), 2); await Wcr.approve(c1);
  Wcr.db.exec("UPDATE book_tap SET mode='on'");
  const cronWaits = [];
  const logged = console.log; console.log = () => {};
  try {
    await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-10-27T10:07:00.000Z") }, { ...Wcr.env, SALT_QUEUE: kvStub }, { waitUntil(p) { cronWaits.push(p); } });
    await Promise.all(cronWaits);
  } finally { console.log = logged; }
  ok(Wcr.rowOf(c1).booked_seq === 1 && (await Wcr.events()).join() === c1, "the minute cron runs the net: an approved draft with no booking is booked by it");
  const Wg = await world({ flag: "on" }); const gg = Wg.sale(IDN(1), 2); await Wg.approve(gg);
  const before = Wg.row(gg).row;
  await Wg.D1.batch(ridStmts(Wg.D1, [{ id: gg, rids: ["s999"], seq: 9 }], true));
  ok(Wg.row(gg).row === before, "a booking is never written under a row that already has one when only a fresh one is wanted (the net)");
  Wg.db.prepare("UPDATE draft SET committed_at='2026-10-27T10:30:00.000Z' WHERE id=?").run(gg);
  await Wg.D1.batch(ridStmts(Wg.D1, [{ id: gg, rids: ["s999"], seq: 9 }], false));
  ok(Wg.row(gg).row === before, "nor under a row the fold has marked committed");

  /* 8: the fold's side */
  const staged = W.db.prepare(APPROVED_SQL).all().map((r) => ({ id: r.id, row: JSON.parse(r.row) }));
  ok(staged.length === 2 && staged[0].row.booked_seq === 1 && staged[1].row.booked_seq === 2 && Array.isArray(staged[0].row.rids) && typeof staged[0].row.rids[0] === "string", "the staged rows carry their rids and booking order, and the approved list reads them in that order");
  const plain = await world({ flag: "on" });
  plain.put(IDN(1, 1), "roster", { code: "ZZ9-NEW", kind: "customer" }, {});
  const pl = plain.sale(IDN(2), 1); await plain.approve(pl);
  plain.db.prepare("UPDATE draft SET status='approved' WHERE id=?").run(IDN(1, 1));
  const mixed = plain.db.prepare(APPROVED_SQL).all().map((r) => r.id);
  ok(mixed.join() === [pl, IDN(1, 1)].join(), "a booked row is read before a fold-only row that was drafted earlier");
  ok(klDay(Date.parse("2026-10-27T17:00:00.000Z")) === "2026-10-28" && klDay(Date.parse("2026-10-27T15:59:00.000Z")) === "2026-10-27", "the day an entry is booked on is the Kuala Lumpur day");
}
