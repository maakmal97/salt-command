/* test/s5f-compact-mark.mjs: S5f-2 OF THE BOOK PLAN, A COMPACTION MOVES THE BASE'S WATERMARK TO THE NEWEST ENTRY IT CLOSES (28 Oct 2026). On the recovery-test style object (a Book over node:sqlite), never the live Book.
 * Why: QUEUE_COMMITTED is the newest queue entry the base holds. The fold moves it; a replay never does. A compaction that closed entries and left it behind has the S5d page count a phone's queued entry
 * twice (the new base holds it, the entry is no longer open so the served view does not name it, and it is not under the old mark). Each check red under its own mutation (test/s5f-compact-mark.mutations.json):
 *   1  after a compaction the base's QUEUE_COMMITTED is the newest draft id it closed, in the base the page is served, and the served view names no open draft
 *   2  never lowered: a base already past the newest closed id keeps its mark
 *   3  a dry compaction moves nothing; a refused compaction (a stuck entry) leaves the mark where it was
 *   4  the mark is only the watermark: the view's money is unchanged by it, the revision moves once, a tap after it books on the new base and leaves the mark for the next compaction
 *   5  the page: a queued entry at or under the served mark is dropped by the queue judgment as at load (the same one a fold's mark gets) */
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, canon } from "../src/book.js";

const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";
const OLD = (n) => "2020-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const { servedBook } = await import("../src/book-page.js");
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const mk = (book = fb()) => {
    const b = new Book(objectState(), {}); let t = 0;
    b.clock = () => "2026-10-28T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    const post = (path, body) => call(path, { method: "POST", body: JSON.stringify(body || {}) });
    const load = (bk = book, v = V) => b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: bk, pricing: { ...pricing, v }, derived, v, stamped: AT_STAMP }) })).then((r) => r.json());
    const tap = (items) => post("/tap", { items, day: "2031-01-02", v: V });
    return { b, call, post, load, tap, mark: async () => (await call("/read?base=1")).state.QUEUE_COMMITTED, rev: async () => (await call("/at")).rev };
  };
  const sale = (id, qty, extra) => ({ id, status: "approved", collection: "sales", row: Object.assign({ customer: "ZZ1-AAA", date: "2031-01-02", qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra || {}) });
  const count = (id, q) => ({ id, status: "approved", collection: "count", row: { product: "salt", qty: q, date: "2031-01-03" } });
  const money = (r) => JSON.stringify({ rows: canon(r.rows), state: canon({ ...r.state, QUEUE_COMMITTED: undefined }) });

  /* 1: the mark follows the close */
  const A = mk(); await A.load();
  const was = await A.mark();
  ok(was === "2026-10-14T07:18:49.142Z", "the frozen base's mark is the one the fixture carries: " + was);
  await A.tap([sale(IDN(1), 2)]); await A.tap([count(IDN(3), 10.5)]); await A.tap([sale(IDN(2), 1, { customer: "ZZ2-BBB" })]);
  const view = await A.call("/read");
  ok(view.booked.length === 3 && view.state.QUEUE_COMMITTED === was, "three entries are open and the view still carries the old mark (a replay never moves it): " + JSON.stringify([view.booked.length, view.state.QUEUE_COMMITTED]));
  const dry = await A.post("/compact?dry=1");
  ok(dry.ok && dry.dry && await A.mark() === was, "a dry compaction moves nothing, the mark included: " + was);
  const real = await A.post("/compact");
  ok(real.ok && real.compacted === 3 && await A.mark() === IDN(3), "a compaction moves the mark to the newest id it closed, whatever order they were booked in: " + (await A.mark()));
  const base = await A.call("/read?base=1"), served = servedBook(base, 5);
  ok(served.book.QUEUE_COMMITTED === IDN(3) && served.booked.length === 0 && base.booked === undefined,
    "the page is served the new mark and no open draft: a queued entry at or under it is the Book's, not counted again: " + JSON.stringify([served.book.QUEUE_COMMITTED, served.booked]));

  /* 2: never lowered */
  const B = mk(); await B.load();
  await B.tap([sale(OLD(1), 1)]);
  const bmark = await B.mark(), bc = await B.post("/compact");
  ok(bc.ok && bc.compacted === 1 && await B.mark() === bmark && bmark > OLD(1), "an entry older than the base's mark is closed and the mark is kept, never lowered: " + (await B.mark()));
  const futureBook = fb(); futureBook.QUEUE_COMMITTED = "2040-01-01T00:00:00.000Z";
  const Fu = mk(futureBook); await Fu.load(); await Fu.tap([sale(IDN(1), 1)]); await Fu.post("/compact");
  ok(await Fu.mark() === "2040-01-01T00:00:00.000Z", "a base whose mark is past the newest closed id keeps it");

  /* 3: a refused compaction leaves the mark */
  const G = mk(); await G.load();
  const gt = await G.tap([sale(IDN(1), 2)]);
  const stranger = fb(); stranger.sales.push({ rid: gt.booked[0].rids[0], customer: "ZZ2-BBB", date: "2031-01-01", qty: 1, total: 10, cash: 10, deliveredQty: 1, product: "salt", note: "x" });
  await G.load(stranger, "v1253");
  const gm = await G.mark(), gc = await G.post("/compact");
  ok(gc.status === 409 && await G.mark() === gm, "a compaction the Book refuses (an entry is stuck) leaves the mark where it was: " + gm);

  /* 4: the mark is only the watermark */
  const D = mk(); await D.load(); await D.tap([sale(IDN(1), 2)]); await D.tap([sale(IDN(2), 1, { customer: "ZZ2-BBB" })]);
  const dview = await D.call("/read"), drev = await D.rev();
  await D.post("/compact");
  const after = await D.call("/read");
  ok(money(after) === money(dview) && await D.rev() === drev + 1, "the view's money is unchanged and the revision moves once; only the mark differs: " + JSON.stringify([drev, await D.rev()]));
  const more = await D.tap([sale(IDN(5), 1)]), keep = await D.mark();
  ok(more.ok && keep === IDN(2) && (await D.call("/read")).state.QUEUE_COMMITTED === IDN(2), "a tap after the compaction books on the new base and leaves the mark for the next compaction: " + keep);
  await D.post("/compact");
  ok(await D.mark() === IDN(5), "and the next compaction takes it to that entry");

  /* 5: the page's judgment of its queue against the served mark */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  try {
    const q = (n, raw) => "{at:" + JSON.stringify(IDN(n)) + ",raw:'" + raw + "',payload:{mode:'count',qty:1,date:'2026-10-28'}}";
    w.eval("OVERLAY_UNSENT=true;qSentThrough='2999-12-31T00:00:00.000Z';BOOK_MARK=" + JSON.stringify(IDN(3)) + ";queue=[" + q(2, "in") + "," + q(3, "edge") + "," + q(4, "out") + "];bookTrimQueue()");
    ok(w.eval("queue.length") === 1 && w.eval("queue[0].raw") === "out", "against the compacted mark the page drops a queued entry at or under it and keeps a newer one: " + w.eval("JSON.stringify(queue.map(q=>q.raw))"));
  } finally { try { w.close(); } catch (e) { /* closed */ } }
}
