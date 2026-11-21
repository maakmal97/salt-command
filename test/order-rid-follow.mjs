/* test/order-rid-follow.mjs: EVERY ORDER FOLLOWS ITS ROW BY RID, version A (21 Nov 2026, item 3 of docs/plan-ledger-simplify.html, Fable's plan with
 * Opus's H2 and M1). Additive: an order with no rid reads exactly as before; one whose rid names a live row reads that row whatever its key now says.
 *   R1  rowFor: a live rid first, its key the row's as it stands; a cancelled or other book's rid falls back to the key; the fallback counted only where a rid is owed
 *   R2  no reader looks an order's row up by key alone: no `byKey.get(ledgerKeyOf(` left in the Desk's order code or the stages
 *   R3  the Counter takes a rid once; a second rid only by a mark naming the first (ridWas); a replay over a moved order changes nothing
 *   R4  the customer's view never carries the rid
 *   R5  a Correction that moved the key moves no stamped order off its row: the follow takes the new key, the return leg and the tie-out read the row
 *   R6  the s218 shape: orders sharing one summed row, one carrying the rid of its own cancelled row, stay live and follow the summed row
 *   R7  the stamp: a clean tie-out offers the row it tied each order to, once its Accept row has landed; never on a fault, never onto a cancelled row;
 *       a rid naming a row no longer live is moved by a mark naming both, or listed (staleRid)
 *   R8  every stage entry carries the order's rid, so the drafter finds its row by rid; rowRoom reads money on its way at the row's own key
 *   R9  the backfill: refused on an unclean tie-out, dry by default, the run stamps and reads back; the laptop tool asks dry first
 * Every assertion is red under its own mutation (test/order-rid-follow.mutations.json). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { frozenBook } from "./frozen.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1552", J = JSON.stringify;
const CODE = "ZZ1-AAA", DAY = "2026-11-18";
const A = "20261118135922-aaaaaa", B = "20261118131627-bbbbbb";
const key = (total, delivery = 0, customer = CODE, product = "oil") => POSITION_ENGINE.ovKey({ customer, date: DAY, total, delivery, product });
const row = (over) => Object.assign({ customer: CODE, date: DAY, product: "oil", qty: 10, total: 110, delivery: 0, cash: 110, deliveredQty: 10, road: "site", rev: "R2" }, over || {});
const order = (over) => Object.assign({ id: A, u: "u1", code: CODE, status: "done", mode: "deliver", product: "oil", forFriend: false, qty: 10, total: 110, delivery: 0, paid: 110, moved: 10,
  at: "2026-11-18T13:59:22.294Z", ledgerKey: key(110), queued: { ack: "2026-11-18T14:00:00.568Z", paid: 110, moved: 10 }, history: [], payments: [] }, over || {});
const NOW = new Date("2026-11-20T03:00:00.000Z");

export async function run({ ok }) {
  const { buildSeed } = await import("../tools/d1.mjs");
  const O = await import("../src/orders.js");
  const { tellSite, tieOut, rowIndex, undoFixes, yesHeld, rowRoom, stampRids, deskRidStamp } = O;
  const S = await import("../engine/stages.mjs");
  const C = await import("../stmt/orders.js");
  const world = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = frozenBook();
    db.exec(buildSeed({ v: V, stamped: "20 Nov 2026, 03:00 KL", ledger: { ...bookless, PRICING: { v: V, floors: {}, sizes: [1] }, OPEN: { v: V, count: 0, byKey: {} }, TERMS: {}, REWARD: { stated: {} }, STOCK: { books: {} } } }).sql);
    db.exec("UPDATE snapshot SET at='2026-11-19T23:00:00.000Z'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } };
    const draft = (id, oid, over = {}) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,party,drafter,drafted_at,decided_at,decided_by,amends,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, over.status || "approved", "sales", J(Object.assign({ at: id, orderId: oid }, over.entry || {})), "{}", "r", "[]", CODE, "t", id, id, "t", over.amends || null, over.committed === null ? null : "2026-11-18T19:26:24.375Z");
    return { db, D1, draft };
  };
  const kv = (m = new Map()) => ({ m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } });
  /* the site: its orders, every body the desk sends, and each mark taken as the order book takes one (decideDesk, then applyEvent); `refuseKey` holds keys back */
  const envOf = (W, orders, { told = V, refuseKey = false } = {}) => {
    const q = kv(); q.m.set("stmt-users", J({ u1: CODE })); q.m.set("orders:told", told); q.m.set("orders:fixed", "{}");
    const sent = [];
    const STMT_SITE = { fetch: async (url, init) => {
      if (String(url).includes("/desk/orders?")) return Response.json({ ok: true, orders });
      const id = decodeURIComponent(String(url).split("/").pop()), i = orders.findIndex((x) => x.id === id), b = init && init.body ? JSON.parse(init.body) : {};
      sent.push({ id, body: b });
      if (i >= 0 && b.mark) {
        if (refuseKey && b.mark.ledgerKey) return Response.json({ ok: true, order: orders[i] });
        const d = C.decideDesk(orders[i], b, NOW.toISOString());
        if (d.error) return Response.json({ ok: false, error: d.error }, { status: d.status });
        if (d.ev) orders[i] = Object.assign(orders[i], C.applyEvent(JSON.parse(J(orders[i])), d.ev).order);
      }
      return Response.json({ ok: true, order: i >= 0 ? orders[i] : null });
    } };
    return { env: { SALT_LEDGER: W.D1, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, sent, orders };
  };
  const book = (sales) => async () => ({ version: V, sales, state: { OPEN: { byKey: {} } } });

  /* R1 */
  {
    const live = row({ rid: "s395", total: 120, cash: 120 }), dead = row({ rid: "s393", cancelled: true }), ix = rowIndex([live, dead]);
    const byRid = S.rowFor(order({ rid: "s395" }), ix), stale = S.rowFor(order({ rid: "s393" }), ix), none = S.rowFor(order(), ix);
    ok(byRid.by === "rid" && byRid.row === live && byRid.k === key(120), "R1: a live rid names its row, at the row's key as it stands, not the order's: " + J([byRid.by, byRid.k]));
    ok(stale.by === "key" && stale.k === key(110) && none.by === "key" && none.row === dead, "R1: a rid naming a cancelled row falls back to the key, and no rid reads the key as before: " + J([stale.by, none.by]));
    const other = S.rowFor(order({ rid: "s395", product: "salt", ledgerKey: key(120, 0, CODE, "salt") }), ix);
    ok(other.by === "key", "R1: a rid naming another book's row is not this order's row");
    const tally = new Map();
    S.rowFor(order(), ix, tally, "t"); S.rowFor(order({ id: "x2", status: "placed" }), ix, tally, "t"); S.rowFor(order({ id: "x3", test: true }), ix, tally, "t");
    S.rowFor(order({ id: "x4", status: "cancelled" }), ix, tally, "t"); S.rowFor(order({ id: "x5", ledgerKey: key(999) }), ix, tally, "t"); S.rowFor(order({ id: "x6", rid: "s395" }), ix, tally, "t");
    ok(J([...(tally.get("t") || [])]) === J([A]), "R1: the fallback is counted only for an accepted live order whose row is on the book, read by key: " + J([...(tally.get("t") || [])]));
  }
  /* R2 */
  {
    const files = ["src/orders.js", "engine/stages.mjs", "src/worker.js"].map((f) => readFileSync(join(REPO, f), "utf8"));
    const hits = files.flatMap((t) => t.split("\n").filter((l) => /byKey\.get\(ledgerKeyOf\(/.test(l)));
    ok(hits.length === 0, "R2: no reader looks an order's row up by its key alone: " + J(hits.map((h) => h.trim().slice(0, 80))));
  }
  /* R3 */
  {
    const at = NOW.toISOString(), mk = (o, mark) => C.decideDesk(o, { mark }, at);
    const fresh = mk(order(), { rid: "s395" });
    ok(fresh.ev && fresh.ev.mark.rid === "s395", "R3: an order with no rid takes one: " + J(fresh));
    const again = mk(order({ rid: "s395" }), { rid: "s396" });
    ok(again.status === 409 && !again.ev, "R3: a fresh stamp never moves a rid the order holds: " + J(again));
    const moved = mk(order({ rid: "s393" }), { rid: "s395", ridWas: "s393" }), wrongWas = mk(order({ rid: "s393" }), { rid: "s395", ridWas: "s390" });
    ok(moved.ev && moved.ev.mark.rid === "s395" && wrongWas.status === 409, "R3: a rid moves only by a mark naming the one it holds: " + J([moved.ev && moved.ev.mark, wrongWas.status]));
    const bad = mk(order(), { rid: "20261118135922-aaaaaa" });
    ok(bad.status === 400, "R3: a request id is never taken for a row's rid: " + J(bad));
    const replay = C.applyEvent(order({ rid: "s396" }), { kind: "mark", at, mark: { rid: "s395" } }).order;
    const take = C.applyEvent(order(), { kind: "mark", at, mark: { rid: "s395" } }).order;
    ok(replay.rid === "s396" && take.rid === "s395", "R3: the order book takes a rid once, and a replay over a moved order changes nothing: " + J([replay.rid, take.rid]));
  }
  /* R4 */
  {
    const v = C.customerView(order({ rid: "s395" }));
    ok(!("rid" in v) && !C.CUSTOMER_FIELDS.includes("rid"), "R4: the customer's view never carries the rid");
  }
  /* R5 */
  {
    const W = world(); W.draft("2026-11-18T14:00:00.568Z", A);
    const moved = row({ rid: "s395", total: 120, cash: 120 });
    const stamped = () => order({ rid: "s395", total: 120, paid: 0, status: "ready", queued: { ack: "2026-11-18T14:00:00.568Z" } });
    const E = envOf(W, [stamped()], { told: "v1" });
    const t = await tellSite(E.env, [], book([moved]));
    ok(t.ok && E.orders[0].ledgerKey === key(120), "R5: a stamped order follows its row's new key, whatever its old key named: " + J([t.followed, E.orders[0].ledgerKey]));
    const E2 = envOf(W, [stamped()], { told: "v1", refuseKey: true });
    await tellSite(E2.env, [], book([moved]));
    const raised = E2.sent.find((x) => x.body.ledger);
    ok(E2.orders[0].ledgerKey === key(110) && raised && raised.body.ledger.paid === 120, "R5: and the return leg reads its row by rid even while the key is the old one: " + J(E2.sent.map((x) => x.body)));
    const E3 = envOf(W, [stamped()], { told: V });
    const tie = await tieOut(E3.env, book([moved]), NOW), said = J(tie.faults.concat(tie.waiting));
    ok(tie.ok && !/has no sale for this order/.test(said) && /paid RM 0 on the order, RM 120 on the book/.test(said), "R5: the tie-out reads the stamped order against its row, not as an order with no sale: " + said);
    const ix = rowIndex([moved]), o = stamped();
    const yes = yesHeld({ stage: "pay" }, Object.assign(o, { paid: 120 }), ix.byKey, ix.rows, ix.byRid);
    const undo = undoFixes([o], ix.byKey, ix.rows, ix.byRid), undone = undoFixes([o], new Map([[key(120), { ...moved, amend: [{ undoes: 0, took: { cash: 5 }, date: DAY }] }]]), new Map([[key(120), 1]]), new Map([["s395", { ...moved, amend: [{ undoes: 0, took: { cash: 5 }, date: DAY }] }]]));
    ok(yes === true && J(undo) === "[]" && undone.length === 1 && undone[0].order === A, "R5: a stale yes and an undo on the row read the row by rid too: " + J([yes, undone]));
  }
  /* R6 */
  {
    const W = world(); W.draft("2026-11-18T14:00:00.568Z", A); W.draft("2026-11-18T13:16:30.757Z", B);
    const dead = row({ rid: "s218", qty: 1, total: 8, cash: 8, deliveredQty: 1, cancelled: true }), summed = row({ rid: "s219", qty: 2, total: 16, cash: 16, deliveredQty: 2 });
    const one = (over) => order(Object.assign({ qty: 1, total: 8, paid: 8, moved: 1, ledgerKey: key(8), queued: { ack: "2026-11-18T14:00:00.568Z", paid: 8, moved: 1 } }, over));
    const E = envOf(W, [one({ rid: "s218" }), one({ id: B, queued: { ack: "2026-11-18T13:16:30.757Z", paid: 8, moved: 1 } })], { told: "v1" });
    const t = await tellSite(E.env, [], book([dead, summed]));
    const ends = E.sent.filter((x) => x.body.bookEnd);
    ok(t.ok && !ends.length && E.orders.every((o) => o.ledgerKey === key(16) && o.status === "done"), "R6: orders sharing one summed row, one naming its own cancelled row's rid, stay live and follow the summed row: " + J([ends, E.orders.map((o) => o.ledgerKey)]));
  }
  /* R7 */
  {
    const W = world(); W.draft("2026-11-18T14:00:00.568Z", A); W.draft("2026-11-18T15:00:00.000Z", B, { committed: null });
    const s395 = row({ rid: "s395" }), s396 = row({ rid: "s396", total: 50, cash: 50, qty: 5, deliveredQty: 5 });
    const orders = [order(), order({ id: B, total: 50, paid: 50, qty: 5, moved: 5, ledgerKey: key(50), queued: { ack: "2026-11-18T15:00:00.000Z", paid: 50, moved: 5 } })];
    const E = envOf(W, orders), t = await tieOut(E.env, book([s395, s396]), NOW);
    ok(t.ok && t.clean && J(t.stamp) === J([{ u: "u1", id: A, rid: "s395" }]), "R7: a clean tie-out offers the row it tied each order to, and only once its Accept row has landed: " + J(t.stamp));
    ok(t.ridFallback && t.ridFallback.count === 2, "R7: and counts the orders it read by key: " + J(t.ridFallback));
    const st = await stampRids(E.env, t.stamp);
    ok(st.stamped === 1 && E.orders[0].rid === "s395" && !E.orders[1].rid, "R7: the stamp is a mark the Counter takes once: " + J([st, E.orders.map((o) => o.rid)]));
    const t2 = await tieOut(E.env, book([s395, s396]), NOW);
    ok(J(t2.stamp) === "[]" && t2.ridFallback.count === 1, "R7: a stamped order is never offered again, and is read by rid: " + J([t2.stamp, t2.ridFallback]));
    const W2 = world(); W2.draft("2026-11-18T14:00:00.568Z", A);
    const F = envOf(W2, [order(), order({ id: B, total: 50, paid: 0, qty: 5, moved: 5, ledgerKey: key(50), status: "ready", queued: { ack: "2026-11-18T14:00:00.568Z" } })]);
    const tf = await tieOut(F.env, book([s395, s396]), NOW);
    ok(!tf.clean && tf.stamp === undefined, "R7: never while the tie-out has a fault: " + J([tf.clean, tf.stamp]));
    const G = envOf(W, [order({ ledgerKey: key(110) })]), tg = await tieOut(G.env, book([row({ rid: "s395", cancelled: true })]), NOW);
    ok(!(tg.stamp || []).length, "R7: never onto a cancelled row: " + J(tg.stamp));
    const H = envOf(W, [order({ rid: "s390" })]), th = await tieOut(H.env, book([s395, row({ rid: "s390", cancelled: true, total: 99 })]), NOW);
    ok(J(th.stamp) === J([{ u: "u1", id: A, rid: "s395", ridWas: "s390" }]), "R7: an order naming a cancelled row moves to the live row it ties out with only by a mark naming both: " + J(th.stamp));
    await stampRids(H.env, th.stamp);
    ok(H.orders[0].rid === "s395", "R7: and the Counter takes that move: " + H.orders[0].rid);
    const K = envOf(W, [order({ rid: "s390", ledgerKey: key(77) })]), tk = await tieOut(K.env, book([row({ rid: "s390", cancelled: true, total: 99 })]), NOW);
    ok(J((tk.staleRid || []).map((x) => [x.order, x.rid])) === J([[A, "s390"]]), "R7: an order whose rid names a row no longer live, with no live row to move to, is listed: " + J(tk.staleRid));
  }
  /* R8 */
  {
    const o = order({ rid: "s395", status: "ready", paid: 0, moved: 0 });
    const es = [S.payEntry(o, CODE, 10, NOW), S.closeEntry(o, CODE, NOW), S.cancelEntry(o, CODE, "why", NOW)];
    ok(es.every((e) => e.payload.rid === "s395") && S.payEntry(order(), CODE, 10, NOW).payload.rid === null, "R8: every stage entry carries the order's rid, and none with no rid: " + J(es.map((e) => e.payload.rid)));
    const W = world(), moved = row({ rid: "s395", total: 120, cash: 20 });
    const way = [{ at: "x1", payload: { kind: "Fulfilment", cash: 30, rid: "s395", orderKey: key(110) } }];
    const room = await rowRoom(W.D1, "SELL", way, book([moved]));
    const r = room(key(110), { at: "x2", payload: { rid: "s395" } });
    ok(r && r.owes === 100 && r.on === 30 && r.left === 70, "R8: a row found by rid is read with what is on its way to its own key: " + J(r));
    const fl = S.claimOrderFlight([moved], [order({ rid: "s395", status: "ready", paid: 0, moved: 0 })], "u1");
    ok(J(fl.ready) === J([key(120)]), "R8: a claim against the account takes a stamped order's row at the row's key: " + J(fl.ready));
  }
  /* R9 */
  {
    const W = world(); W.draft("2026-11-18T14:00:00.568Z", A);
    const E = envOf(W, [order()]);
    const dry = await deskRidStamp(E.env, {}, book([row({ rid: "s395" })]), NOW);
    ok(dry.ok && dry.dry && J(dry.stamp) === J([{ u: "u1", id: A, rid: "s395" }]) && !E.orders[0].rid, "R9: the backfill is dry by default and changes nothing: " + J(dry));
    const go = await deskRidStamp(E.env, { dry: false }, book([row({ rid: "s395" })]), NOW);
    ok(go.ok && go.stamped === 1 && J(go.differ) === "[]" && E.orders[0].rid === "s395", "R9: its run stamps and reads every one back: " + J(go));
    const F = envOf(W, [order({ paid: 0, status: "ready" })]);
    const no = await deskRidStamp(F.env, {}, book([row({ rid: "s395" })]), NOW);
    ok(!no.ok && no.status === 409 && !F.orders[0].rid, "R9: refused whole while the tie-out is not clean: " + J(no));
    const T = await import("../tools/orders-rid.mjs"), asked = [];
    const c = { stamp: async (d) => { asked.push(d); return { ok: true, dry: d, stamp: [{ id: A, rid: "s395" }], staleRid: [{ order: B, rid: "s390", who: "w" }], stamped: d ? undefined : 1, failed: [], differ: [] }; } };
    const lines = [], r1 = await T.drive(c, { run: false, say: (s) => lines.push(s) });
    ok(r1.ok && J(asked) === "[true]" && lines.some((l) => /^DRY: 1 order\(s\) to stamp; 1 naming a row no longer live/.test(l)), "R9: the laptop tool is dry unless told to run, and lists the stale rids: " + J([asked, lines]));
    asked.length = 0;
    const r2 = await T.drive(c, { run: true, say: () => {} });
    ok(r2.ok && J(asked) === "[true,false]", "R9: a run asks dry first, then stamps: " + J(asked));
  }
}
