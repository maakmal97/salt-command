/* test/book-way.mjs: S4c OF THE BOOK PLAN, THE READERS COUNT ONCE (27 Oct 2026; Fable's review of the design applied). Dormant: no entry is booked until S4d, so the clauses below read as S3's.
 * A tap books an entry in the Book, so the view a reader reads already holds that draft's row; the draft must stop being "on its way" to that reader or its money counts twice.
 * What is proved here, each check red under its own mutation (test/book-way.mutations.json):
 *   1  the clauses: with no entry open they are byte for byte S3's; with some they exclude those draft ids, with the alias, and an id that is not a draft's is never spliced;
 *      `landedBy` stays on committed_at, the fold's own question
 *   2  the money: a payment on its way (a draft approved, not folded) counts once through rowRoom whether or not the Book already holds it as an open entry, and counts again
 *      when the entry is stuck (the base cannot take it) or voided
 *   3  the book a reader reads carries the ids from the same read as its bound, `/at` too, and the readcheck names a stuck entry
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FROZEN_BOOK } from "./frozen.mjs";
import { objectState } from "./orderbook-harness.mjs";
import { Book } from "../src/book.js";
import { buildSeed } from "../tools/d1.mjs";
import { readBook, bindBook, wayBound } from "../src/drafter.js";
import { rowRoom } from "../src/orders.js";
import POSITION_ENGINE from "../engine/position.mjs";
import { unfolded, onItsWay, landedBy, boundOf } from "../src/way.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "27 Oct 2026, 10:00 KL", AT = "2026-10-27T10:00:10.000Z";

export async function run({ ok }) {
  const frozen = JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
  const derived = { OPEN: { v: V, at: "2026-10-27T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-27", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const { NOTES, ...bookless } = frozen, ledger = { ...bookless, PRICING: pricing, ...derived };
  const d1 = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const mk = (a, sql) => { const st = db.prepare(sql); return { run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; }, first() { const r = st.get(...a); return r == null ? null : { ...r }; }, all() { return { results: st.all(...a).map((x) => ({ ...x })) }; } }; };
    return { db, D1: { prepare(sql) { const o = mk([], sql); o.bind = (...a) => mk(a, sql); return o; } } };
  };
  const theBook = (book = frozen, v = V) => {
    const os = objectState(), b = new Book(os, {}); let t = 0;
    b.clock = () => "2026-10-27T10:00:" + String(10 + t++).padStart(2, "0") + ".000Z";
    return { os, b,
      load: async (over = {}, book2 = book, q = "") => (await b.fetch(new Request("https://book/load" + q, { method: "POST", body: JSON.stringify({ rev: "r", book: book2, pricing: { ...pricing, v }, derived, v, stamped: AT_STAMP, ...over }) }))).json(),
      tap: async (items) => (await b.fetch(new Request("https://book/tap", { method: "POST", body: JSON.stringify({ items, day: "2026-10-27", v }) }))).json(),
      void: async (ids) => (await b.fetch(new Request("https://book/void", { method: "POST", body: JSON.stringify({ ids }) }))).json(),
      at: async () => (await b.fetch(new Request("https://book/at"))).json() };
  };
  const ns = (book) => ({ idFromName: (n) => n, get: () => ({ fetch: (r) => book.fetch(r) }) });

  /* 1: the clauses */
  const ID1 = "2031-01-02T01:00:00.000Z", ID2 = "2031-01-02T02:00:00.000Z";
  ok(unfolded(AT) === "(committed_at IS NULL OR committed_at > '" + AT + "')" && unfolded(null) === "committed_at IS NULL" && unfolded(AT, "d.") === "(d.committed_at IS NULL OR d.committed_at > '" + AT + "')"
    && onItsWay(null) === "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1))))"
    && onItsWay(AT) === "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > '" + AT + "')))"
    && landedBy(AT) === "committed_at IS NOT NULL AND committed_at <= '" + AT + "'",
    "with no entry open every clause is byte for byte what S3 shipped, for a Book bound and for the mirror's");
  const B = { at: AT, booked: [ID1, ID2] };
  ok(unfolded(B) === "(committed_at IS NULL OR committed_at > '" + AT + "') AND id NOT IN ('" + ID1 + "','" + ID2 + "')"
    && unfolded(B, "d.") === "(d.committed_at IS NULL OR d.committed_at > '" + AT + "') AND d.id NOT IN ('" + ID1 + "','" + ID2 + "')"
    && onItsWay(B) === "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > '" + AT + "'))) AND id NOT IN ('" + ID1 + "','" + ID2 + "')",
    "with entries open the clauses leave out those drafts, whatever their status or committed_at, and keep the alias");
  ok(unfolded({ at: AT, booked: ["x'); DROP TABLE draft; --", ID1] }) === unfolded({ at: AT, booked: [ID1] }) && unfolded({ at: AT, booked: ["nope"] }) === unfolded(AT) && onItsWay({ at: AT, booked: [] }) === onItsWay(AT),
    "an id that is not a draft's timestamp is never spliced into SQL");
  ok(landedBy(B) === landedBy(AT), "landed is the fold's question and stays on committed_at: a booked entry is in the view, but a site is told a row landed only when git has it");
  ok(boundOf({ at: AT }) === AT && boundOf({ at: AT, booked: [] }) === AT && JSON.stringify(boundOf({ at: AT, booked: [ID1] })) === JSON.stringify({ at: AT, booked: [ID1] }) && boundOf({ booked: [ID1] }) === null && boundOf(null) === null,
    "a book's bound is the plain `at` with no entry open, { at, booked } with some, and none for the mirror's own form");
  /* the clauses run: a draft the entries hold is not found by the SQL */
  { const w = d1(); const ins = (id, st, c) => w.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES (?,?,'sales','{}','{}','x','y',?,?)").run(id, st, id, c);
    ins(ID1, "approved", null); ins(ID2, "pending", null); ins("2031-01-02T03:00:00.000Z", "approved", null); ins("2031-01-02T04:00:00.000Z", "approved", "2026-10-27T09:00:00.000Z");
    const ids = (clause) => w.db.prepare("SELECT id FROM draft WHERE " + clause + " ORDER BY id").all().map((r) => r.id.slice(11, 13)).join();
    ok(ids(onItsWay(AT)) === "01,02,03" && ids(onItsWay(B)) === "03" && ids(unfolded(B)) === "03", "the clause finds the drafts not held by the Book's entries: " + ids(onItsWay(B))); }

  /* 2: the money counts once */
  const owes = (s) => POSITION_ENGINE.txOwed(s) - POSITION_ENGINE.txPaid(s), keys = new Map();
  for (const s of frozen.sales) keys.set(POSITION_ENGINE.ovKey(s), (keys.get(POSITION_ENGINE.ovKey(s)) || 0) + 1);
  const sale = frozen.sales.find((s) => !s.cancelled && !s.defaulted && s.rid && owes(s) > 60 && keys.get(POSITION_ENGINE.ovKey(s)) === 1);
  const key = POSITION_ENGINE.ovKey(sale);
  const entry = { at: ID1, payload: { mode: "amend", direction: "SELL", kind: "Fulfilment", cash: 50, kg: 0, date: "2026-10-27", amends: key, rid: sale.rid } };
  const item = { id: ID1, status: "approved", collection: "sales", amends: key, amendKind: "Fulfilment", row: { cash: 50, kg: 0, date: "2026-10-27" }, entry };
  const room = async (setup) => {
    const w = d1(); w.db.exec(buildSeed({ v: V, stamped: AT_STAMP, ledger }).sql); w.db.exec("UPDATE book_read SET mode='book'");
    const bk = theBook(); await bk.load(); bindBook(w.D1, ns(bk.b));
    w.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,decided_at,committed_at,amends,amend_kind) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(ID1, "approved", "sales", JSON.stringify(entry), JSON.stringify(item.row), "x", "y", ID1, ID1, null, key, "Fulfilment");
    await setup(bk, w);
    const r = await rowRoom(w.D1, "SELL");
    return { room: await r(key, { at: "own", payload: { rid: sale.rid } }), book: await readBook(w.D1), bk, w };
  };
  const none = await room(async () => {});
  ok(none.room && none.room.on === 50 && !none.book.booked.length, "no entry open: the approved payment is on its way, 50, as in S3: " + JSON.stringify(none.room));
  const held = await room(async (bk) => { const t = await bk.tap([item]); if (!t.ok) throw new Error(JSON.stringify(t)); });
  const rowIn = (b) => b.sales.find((s) => s.rid === sale.rid);
  ok(held.room && held.room.on === 0 && held.book.booked.join() === ID1 && POSITION_ENGINE.txPaid(rowIn(held.book)) === POSITION_ENGINE.txPaid(rowIn(none.book)) + 50,
    "the Book holds the payment as an open entry: the view's row is paid 50 more and the same draft is no longer on its way, so the room counts it once, not twice: " + JSON.stringify([held.room, held.book.booked]));
  const stuck = await room(async (bk) => {
    await bk.tap([item]);
    /* the next fold's base already holds a twin of the payment's effect: the row cancelled, so the plan refuses the entry and the view leaves it out */
    const nb = structuredClone(frozen); nb.sales = nb.sales.map((s) => (s.rid === sale.rid ? { ...s, cancelled: true, cancelledOn: "2026-10-26" } : s));
    const r = await bk.load({ v: "v1253" }, nb);
    if (!r.ok || !r.tap || r.tap.stuck.join() !== ID1) throw new Error("not stuck: " + JSON.stringify(r));
  });
  const wayIds = (r) => r.w.db.prepare("SELECT id FROM draft WHERE " + onItsWay(boundOf(r.book))).all().map((x) => x.id).join();
  ok(stuck.book.booked.length === 0 && wayIds(stuck) === ID1 && wayIds(held) === "" && wayIds(none) === ID1,
    "an entry the new base cannot take is out of `booked`, so its draft is on its way again, where a draft the Book holds is not: " + JSON.stringify([stuck.book.booked, wayIds(stuck), wayIds(held)]));
  const voided = await room(async (bk) => { await bk.tap([item]); await bk.void([ID1]); });
  ok(voided.room && voided.room.on === 50 && voided.book.booked.length === 0, "a voided entry leaves the view and the draft is on its way once more");

  /* 3: the ids come from the same read as the bound; /at and the readcheck */
  const w2 = d1(); w2.db.exec(buildSeed({ v: V, stamped: AT_STAMP, ledger }).sql); w2.db.exec("UPDATE book_read SET mode='book'");
  const bk2 = theBook(); await bk2.load(); bindBook(w2.D1, ns(bk2.b));
  const noBound = await wayBound(w2.D1);
  await bk2.tap([item]);
  const withBound = await wayBound(w2.D1), rb = await readBook(w2.D1);
  ok(typeof noBound === "string" && JSON.stringify(withBound) === JSON.stringify({ at: noBound, booked: [ID1] }) && rb.at === noBound && rb.booked.join() === ID1,
    "a reader with no book in hand and one with a book both get the Book's bound with the open entries named: " + JSON.stringify([noBound, withBound]));
  const a2 = await bk2.at();
  ok(a2.booked.join() === ID1 && Array.isArray(a2.stuck) && a2.stuck.length === 0, "/at names the open entries and the stuck ones from one read");
  const wsrc = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(/"https:\/\/book\/at"\)/.test(wsrc.slice(wsrc.indexOf("async function handleBookReadcheck"), wsrc.indexOf("async function handleBookLoad"))) && /stuck: the base cannot take it/.test(wsrc),
    "the readcheck asks the Book for its stuck entries and names each one");
}
