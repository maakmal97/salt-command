/* test/order-import-desk.mjs: AN OLDER SALE'S ORDER FOLLOWS ITS ROW AND IS NEVER TOLD ITS OLD UNDOS (20 Nov 2026, docs/plan-order-import.html, Part 3).
 *   K1 THE KEY CHECK: a fresh pass over imported orders for settled rows (s297's shape among them) tells nothing, follows nothing, sends no fix; the tie-out is clean, nothing waiting
 *   F1 a Correction of an imported row's total restates its order and moves its key, by rid, with no draft behind its acknowledgement
 *   F2 a Correction of its date moves the key too
 *   U1 undoFixes never sends an imported order's past undo (s297), by the belt (a step dated on or before its day); a later undo is still sent; a site order's is as before
 *   U2 importFixedIds names every un-<rid>-<i> of a row's past undo steps, and nothing for a row with none
 *   P1 pendingDay reads an imported order's day from its row, never a database or today
 *   I1 no close or redate holds an imported order: orderInFlight, termsInFlight and takeBackHolds are all false
 *   A1 an amendment of an imported order is refused in plain words, never "its pending row is not drafted yet"
 * Every group is red under its own mutation (test/order-import-desk.mutations.json). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { frozenBook } from "./frozen.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1552", J = JSON.stringify;

/* s297's shape: an oil sale with a trip, a handover and payment undone by a Correction (`undoes`, `took`) and booked again */
const s297 = () => ({ customer: "CZ4-MK", date: "2026-10-27", product: "oil", qty: 10, total: 120, delivery: 0, cash: 120, cost: 78.6, deliveredOn: "2026-10-27", deliveredQty: 10, paidOn: "2026-10-27",
  handover: "collected", rid: "s297", road: "admin", trip: "t1793074793926", mod: "corrected on 2026-10-27: cash 120 to 0",
  amend: [{ cash: 0, date: "2026-10-27", kg: 0, kind: "Fulfilment", note: "as booked" },
    { cash: 120, date: "2026-10-27", kg: 10, kind: "Fulfilment", note: "paid", undone: "2026-10-27" },
    { cash: 0, date: "2026-10-27", kg: 0, kind: "Correction", note: "undoes step 2", took: { cash: 120, units: 10 }, undoes: 2 },
    { cash: 120, date: "2026-10-27", kg: 10, kind: "Fulfilment", note: "paid again" }] });
const plain = (n, over) => Object.assign({ customer: "CQ4-ZEN", date: "2026-11-0" + n, product: "salt", qty: 2, total: 190, delivery: 15, cash: 205, deliveredQty: 2, deliveredOn: "2026-11-0" + n, paidOn: "2026-11-0" + n,
  handover: "delivered", rid: "s40" + n, road: "admin" }, over || {});

export async function run({ ok }) {
  const { buildSeed } = await import("../tools/d1.mjs");
  const orders = await import("../src/orders.js");
  const { tellSite, tieOut, undoFixes, importFixedIds, orderInFlight, termsInFlight, takeBackHolds, isImported, pendingDay } = orders;
  const { importOf, stageAgainst } = await import("../engine/stages.mjs");
  const world = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = frozenBook();
    db.exec(buildSeed({ v: V, stamped: "20 Nov 2026, 03:00 KL", ledger: { ...bookless, PRICING: { v: V, floors: {}, sizes: [1] }, OPEN: { v: V, count: 0, byKey: {} }, TERMS: {}, REWARD: { stated: {} }, STOCK: { books: {} } } }).sql);
    db.exec("UPDATE snapshot SET at='2026-11-19T23:00:00.000Z'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return Promise.resolve({ results: st.all(...a) }); } }; };
    return { db, D1: { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } } };
  };
  const kv = (m = new Map()) => ({ m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } });
  const users = { "CQ4-ZEN": "abcd-efgh", "CQ4-ZEN-R": "abcd-efgh", "CZ4-MK": "ijkl-mnop" };
  const bookOf = (sales) => ({ version: V, sales, state: { OPEN: { byKey: {} } } });
  /* the site: its orders; every POST the desk makes is kept whole, the marks taken as the order book takes one. The told mark is empty, so the pass runs fresh. */
  const envOf = (orderList, told = "") => {
    const q = kv(); q.m.set("stmt-users", J({ "abcd-efgh": "CQ4-ZEN", "ijkl-mnop": "CZ4-MK" })); q.m.set("orders:told", told); q.m.set("orders:fixed", "{}");
    const posts = [], W = world();
    const STMT_SITE = { fetch: async (url, init) => {
      if (String(url).includes("/desk/orders?")) return Response.json({ ok: true, orders: orderList });
      const id = decodeURIComponent(String(url).split("/").pop()), o = orderList.find((x) => x.id === id), b = init && init.body ? JSON.parse(init.body) : {};
      posts.push({ id, b });
      if (o && b.mark) Object.assign(o, b.mark);
      return Response.json({ ok: true, order: o || null });
    } };
    return { env: { SALT_LEDGER: W.D1, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, posts, q, W };
  };
  const born = (rows) => { const c = { users, keys: new Map(rows.map((r) => [POSITION_ENGINE.ovKey(r), [r]])), orders: [] }; return rows.map((r) => { const g = importOf(r, c); if (!g.order) throw new Error(r.rid + ": " + g.refused); return g.order; }); };
  const NOW = new Date("2026-11-20T03:00:00.000Z");

  /* K1: the key check */
  {
    const rows = [plain(1), plain(2, { customer: "CQ4-ZEN-R", handover: "collected", delivery: 0, total: 205, cash: 205 }), plain(3, { product: "oil", total: 100, delivery: 0, cash: 100, qty: 5, deliveredQty: 5 }), s297()];
    const os = born(rows), E = envOf(os), mirror = async () => bookOf(rows);
    ok(os.length === 4 && os.every((o) => isImported(o) && o.queued.ack.endsWith("Z") && !o.queued.close), "K1: the world holds four imported orders, each born told with no draft behind its acknowledgement");
    const t = await tellSite(E.env, [], mirror);
    ok(t.ok && t.told === 0 && !t.followed && !t.fixed && !t.refused && !t.waiting && !t.failed && !E.posts.length,
      "K1: a fresh pass over them tells nothing, follows nothing and sends no fix: " + J([t, E.posts]));
    ok(J(await E.q.get("orders:fixed", "json")) === "{}", "K1: and the fixed mark is untouched, so no undo was sent or refused");
    E.q.m.set("orders:told", V);
    const tie = await tieOut(E.env, mirror, NOW);
    ok(tie.ok && tie.clean && !tie.faults.length && !tie.waiting.length && tie.orders === 4, "K1: the tie-out is clean with nothing waiting, all four read: " + J(tie));
  }
  /* F1: a Correction of the total */
  {
    const row = plain(1), [o] = born([row]), E = envOf([o]), k0 = o.ledgerKey;
    const corrected = Object.assign({}, row, { total: 200, cash: 215, mod: "corrected on 2026-11-19: total 190 to 200" });
    const t = await tellSite(E.env, [], async () => bookOf([corrected]));
    const nk = POSITION_ENGINE.ovKey(corrected), rs = E.posts.filter((p) => p.b.restate);
    ok(nk !== k0 && o.ledgerKey === nk && t.followed === 1 && E.posts.some((p) => p.b.mark && p.b.mark.ledgerKey === nk), "F1: the order follows its row to the new key by rid: " + J([t.followed, o.ledgerKey, nk]));
    ok(rs.length === 1 && rs[0].b.restate.total === 200 && rs[0].b.restate.book === true, "F1: and is restated to the row's goods: " + J(rs));
  }
  /* F3: another live row of theirs has taken the key its row left: the order follows its OWN row, by rid, never the stranger at its old key */
  {
    const row = plain(1), [o] = born([row]), E = envOf([o]), k0 = o.ledgerKey;
    const corrected = Object.assign({}, row, { total: 200, cash: 215, mod: "corrected on 2026-11-19: total 190 to 200" });
    const stranger = plain(1, { rid: "s499", road: "hand" });
    const t = await tellSite(E.env, [], async () => bookOf([corrected, stranger]));
    ok(POSITION_ENGINE.ovKey(stranger) === k0 && o.ledgerKey === POSITION_ENGINE.ovKey(corrected) && t.followed === 1, "F3: it follows its own row by rid, not the row now at its old key: " + J([t.followed, o.ledgerKey]));
  }
  /* T1: its sale dropped from the book is a fault, never "waiting" on a draft that never was */
  {
    const [o] = born([plain(1)]), E = envOf([o], V);
    const tie = await tieOut(E.env, async () => bookOf([plain(2)]), NOW);
    ok(tie.ok && !tie.clean && tie.faults.length === 1 && tie.faults[0].order === o.id && !tie.waiting.length, "T1: an imported order whose sale left the book is a fault, never a wait for its acknowledgement's draft: " + J([tie.faults, tie.waiting]));
  }
  /* F2: a Correction of the date */
  {
    const row = plain(1), [o] = born([row]), E = envOf([o]), k0 = o.ledgerKey;
    const moved = Object.assign({}, row, { date: "2026-11-02", mod: "corrected on 2026-11-19: date 2026-11-01 to 2026-11-02" });
    const t = await tellSite(E.env, [], async () => bookOf([moved]));
    const nk = POSITION_ENGINE.ovKey(moved);
    ok(nk !== k0 && o.ledgerKey === nk && t.followed === 1 && !(t.failed || []).length, "F2: a re-dated row moves its order's key, by rid: " + J([t.followed, o.ledgerKey, t.failed]));
    ok(E.posts.every((p) => !p.b.fix && !p.b.bookEnd), "F2: nothing ended or fixed on the way");
  }
  /* U1 + U2 */
  {
    const row = s297(), [o] = born([row]), byKey = new Map([[o.ledgerKey, row]]), rows = new Map([[o.ledgerKey, 1]]);
    ok(J(undoFixes([o], byKey, rows)) === "[]", "U1: an imported order is never told its row's past undo (s297): " + J(undoFixes([o], byKey, rows)));
    const later = Object.assign({}, row, { amend: row.amend.concat([{ cash: 0, date: "2026-11-21", kg: 0, kind: "Correction", note: "later", took: { cash: 5, units: 0 }, undoes: 4 }]) });
    const fl = undoFixes([o], new Map([[o.ledgerKey, later]]), rows);
    ok(fl.length === 1 && fl[0].id === "un-s297-4" && fl[0].unpay === 5, "U1: an undo dated after its day is still sent: " + J(fl));
    const site = Object.assign({}, o, { imported: undefined, rid: undefined });
    const sf = undoFixes([site], byKey, rows);
    ok(sf.length === 1 && sf[0].id === "un-s297-2" && sf[0].unpay === 120 && sf[0].unmove === 10, "U1: a site order's undo is sent as before: " + J(sf));
    ok(J(importFixedIds(row)) === J(["un-s297-2"]) && J(importFixedIds(later)) === J(["un-s297-2", "un-s297-4"]) && J(importFixedIds(plain(1))) === "[]" && J(importFixedIds(null)) === "[]",
      "U2: importFixedIds names every past undo step's id and none for a row without: " + J(importFixedIds(later)));
  }
  /* P1 */
  {
    const [o] = born([s297()]);
    let asked = 0;
    const counted = { prepare() { asked++; throw new Error("pendingDay asked the database"); } };
    const day = await pendingDay({ SALT_LEDGER: counted }, o);
    ok(day === "2026-10-27" && asked === 0, "P1: an imported order's day is its row's, with no database asked: " + J([day, asked]));
  }
  /* I1 */
  {
    const [o] = born([plain(1)]), E = envOf([o]);
    const flights = [await orderInFlight(E.env, o, 0), await termsInFlight(E.env, o, 0), await takeBackHolds(E.env, o, plain(1), 0)];
    ok(flights.every((f) => f === false) && !o.queued.close && !o.queued.redate, "I1: no imported order is held by a close, a redate or a flight: " + J(flights));
  }
  /* A1 */
  {
    const [o] = born([plain(1)]);
    const env = envOf([o]).env;
    const r = await orders.restateOrder(env, o.id, { total: 200, why: "x" }, "desk", NOW, async () => bookOf([plain(1)]));
    ok(r && r.ok === false && /older sale's order changes on the book/.test(r.error) && !/not drafted/.test(r.error), "A1: an amendment is refused in plain words: " + J(r));
    const ag = stageAgainst({ state: { OPEN: { byKey: {} } } }, { payload: { orderKey: "X|2026-11-01|1" } }, null, null, true);
    ok(!ag.ok && /older sale's order changes on the book/.test(ag.error), "A1: the engine's own refusal says the same: " + J(ag));
  }
}
