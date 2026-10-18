/* test/apply-entry.mjs: S1d of the Book plan. applyEntry books ONE planned entry, and (S1d-ii, 18 Oct 2026) applyInto is those entries booked in EVENT ORDER: a count stands and
   only the moves after it change it, a rename applies where it stands, the roll note is one a product for the batch, and a trip books whole or not at all. The replay of the
   staged batches (test/fold-replay.mjs) holds that no past fold moved. */
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function run({ ok }) {
  const ENG = await import("../engine/apply.mjs"), E = (await import("../engine/position.mjs")).default;
  const { nextRid } = await import("../tools/rid.mjs"), { sortBook } = await import("../tools/sort-ledger.mjs");
  /* 2. the entry law, on invented codes: the order of a sale and a count decides the figure */
  const mk = () => ({ STATED_STOCK: 10, COUNT_ON: {}, COUNTS: [], NOTES: {}, PROD_OPENING: {}, sales: [], purchases: [], roster: ["ZZ1-AAA"], QUEUE_COMMITTED: "" });
  const sale = { id: "q-1", status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: "2031-01-02", qty: 2, deliveredQty: 2, product: "salt", total: 20 } };
  const count = { id: "q-2", status: "approved", collection: "count", row: { product: "salt", qty: 10.5, date: "2031-01-03" } };
  const itSale = { id: "q-1", append: "sales" }, itCount = { id: "q-2", count: { product: "salt", qty: 10.5, date: "2031-01-03", was: 10, drift: 0.5 } };
  const mvSale = [{ product: "salt", kg: -2, who: "ZZ1-AAA", when: "2031-01-02" }];
  const staged = { approved: [sale, count] }, notes = { version: "v1", rows: { "q-1": { note: "invented sale" }, "q-2": {} } };
  const step = (book, it, moves) => ENG.applyEntry(book, it, { nextRid, staged, notes, moves });
  const a = mk(); step(a, itSale, mvSale); step(a, itCount, []);
  ok(a.STATED_STOCK === 10.5, "S1d-1: a sale delivering 2, then a count of 10.5, leaves the stated figure at 10.5");
  const b = mk(); step(b, itCount, []); step(b, itSale, mvSale);
  ok(b.STATED_STOCK === 8.5, "S1d-1: a count of 10.5, then a sale delivering 2, leaves the stated figure at 8.5");
  const r = step(mk(), itSale, mvSale);
  ok(r.rolls.length === 1 && r.rolls[0].from === 10 && r.rolls[0].to === 8 && r.rolls[0].out === 2 && r.id === "q-1", "S1d-1: an entry returns its roll (from, out, in, to) and its id for the wrapper's one sentence");
  ok(!Object.keys(a.NOTES).some((k) => (a.NOTES[k] || []).some((s) => /^ROLLED/.test(s))) && a.QUEUE_COMMITTED === "", "S1d-1: an entry writes no ROLLED sentence and leaves QUEUE_COMMITTED to the wrapper");

  /* the salt fallback rate is read on the book before THIS entry: a count to 1 unit leaves the newest lot (RM30) holding the shelf, where the book at the batch's start (2 units) had RM20 */
  const mk3 = () => ({ ...mk(), STATED_STOCK: 2, sales: [{ rid: "s1", customer: "ZZ1-AAA", date: "2030-01-01", qty: 1, total: 10, deliveredQty: 0, product: "salt" }],
    purchases: [{ rid: "p1", supplier: "ZZ9-SUP", date: "2032-01-01", qty: 1, total: 10, receivedQty: 1, product: "salt" }, { rid: "p2", supplier: "ZZ9-SUP", date: "2032-02-01", qty: 1, total: 30, receivedQty: 1, product: "salt" }] });
  const c3 = mk3(), st3 = { approved: [] }, it3 = [{ id: "q-4", count: { product: "salt", qty: 1, date: "2032-03-01" } }, { id: "q-5", dir: "SELL", target: c3.sales[0], pay: { kind: "Fulfilment", cash: 0, kg: 1, date: "2030-01-01" } }];
  for (const it of it3) ENG.applyEntry(c3, it, { nextRid, staged: st3, notes, moves: it.id === "q-5" ? [{ product: "salt", kg: -1, who: "ZZ1-AAA", when: "2030-01-01" }] : [] });
  ok(c3.sales[0].cost === 30, "S1d-1: a salt sale costed off the shelf takes the rate on the book before its own entry, not before the batch");

  /* movesOf, on a real plan (so it runs on a shallow clone too): a sale delivering 2 and a count on one product, planned by planBatch against the current book plus an invented code */
  { const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?movesof");
    const bk = (await import("./frozen.mjs")).frozenBook(); bk.roster.push("ZZ1-AAA");
    const sg = { ok: true, count: 2, approved: [
      { id: "2031-01-02T01:00:00.000Z", status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: "2031-01-02", qty: 2, total: 200, cash: 200, deliveredQty: 2, product: "salt" } },
      { id: "2031-01-02T02:00:00.000Z", status: "approved", collection: "count", row: { product: "salt", qty: 10.5, date: "2031-01-03" } }] };
    const pl = ENG.planBatch(bk, sg, null, FOLD.planCtx), [pSale, pCount] = pl.items;
    ok(pl.refused.length === 0 && pl.items.length === 2 && pl.moves.length === 1, "S1d-1: the invented sale and count are planned by planBatch, one move between them");
    ok(ENG.movesOf(pl, pSale).length === 1 && ENG.movesOf(pl, pSale)[0] === pl.moves[0] && ENG.movesOf(pl, pCount).length === 0, "S1d-1: movesOf holds the sale's own move and the count none");
    ok(pl.items.reduce((n, it) => n + ENG.movesOf(pl, it).length, 0) === pl.moves.length, "S1d-1: the moves over all entries add up to the plan's moves");
    let threw = false; try { ENG.movesOf({ items: pl.items, moves: pl.moves.slice() }, pSale); } catch (e) { threw = /not a plan built by planBatch/.test(e.message); }
    ok(threw, "S1d-1: movesOf refuses a plan planBatch did not build, rather than answering none");
  }

  /* S1d-ii: a batch is its entries in event order, on the current book with invented codes */
  { const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?s1d2");
    const { frozenBook } = await import("./frozen.mjs");
    const ctx = Object.assign(Object.create(FOLD.planCtx), { nextRid, sortBook });
    const fb = () => { const bk = frozenBook(); bk.roster.push("ZZ1-AAA"); bk.STATED_STOCK = 10; return bk; };
    const sl = (id, qty, d, extra) => ({ id, status: "approved", collection: "sales", row: Object.assign({ customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra || {}) });
    const ct = (id, q, d) => ({ id, status: "approved", collection: "count", row: { product: "salt", qty: q, date: d } });
    const rn = (id, from, to) => ({ id, status: "approved", collection: "rename", row: { from, to }, entry: { at: id, payload: { mode: "rename", from, to } } });
    const go = (rows) => {
      const bk = fb(), frozen = JSON.stringify(bk), st = { ok: true, count: rows.length, approved: rows };
      const nt = { version: "v9999", rows: Object.fromEntries(rows.map((r) => [r.id, { note: "note " + r.id }])) };
      const r = ENG.applyBatch(bk, st, nt, ctx);
      return Object.assign(r, { untouched: JSON.stringify(bk) === frozen });
    };
    const rolled = (r) => ((r.book.NOTES || {}).STATED_STOCK || []).filter((x) => /^ROLLED AT v9999/.test(x));
    const T = (n) => "2031-01-0" + n;
    const sc = go([sl("2031-01-02T01", 2, T(2)), ct("2031-01-02T02", 10.5, T(3))]), cs = go([ct("2031-01-02T01", 10.5, T(3)), sl("2031-01-02T02", 2, T(2))]);
    ok(sc.ok && sc.book.STATED_STOCK === 10.5 && sc.book.QUEUE_COMMITTED === "2031-01-02T02" && /now stands is 10\.5\./.test(rolled(sc)[0]) && sc.moves.find((m) => m.product === "salt").to === 10.5 && cs.ok && cs.book.STATED_STOCK === 8.5 && sc.untouched, "S1d-2: a batch of a sale then a count of 10.5 ends at 10.5, a count then the sale at 8.5, and the book it was given is untouched: " + (sc.book && sc.book.STATED_STOCK) + " / " + (cs.book && cs.book.STATED_STOCK));
    const two = go([sl("2031-01-02T01", 2, T(2)), sl("2031-01-02T02", 3, T(3))]);
    ok(two.ok && two.book.STATED_STOCK === 5 && rolled(two).length === 1 && /2 unit to ZZ1-AAA on 2031-01-02, 3 unit to ZZ1-AAA on 2031-01-03, so 10 less 5 is 5\./.test(rolled(two)[0]) && two.moves.filter((m) => m.product === "salt").length === 1 && two.moves.find((m) => m.product === "salt").out === 5,
      "S1d-2: the roll note is one a batch, the moves summed: " + JSON.stringify(rolled(two)));
    const mid = go([sl("2031-01-02T01", 2, T(2)), ct("2031-01-02T02", 10.5, T(3)), sl("2031-01-02T03", 1, T(4))]);
    ok(mid.ok && mid.book.STATED_STOCK === 9.5 && rolled(mid).length === 1 && /from 10; a count of this product came in this batch and stands, so the figure that now stands is 9\.5\./.test(rolled(mid)[0]) && mid.moves.find((m) => m.product === "salt").to === 9.5,
      "S1d-2: a count between two moves stands, the moves after it change it, and the one note says a count came between: " + JSON.stringify(rolled(mid)));
    const after = go([sl("2031-01-02T01", 2, T(2)), rn("2031-01-02T02", "ZZ1-AAA", "ZZ2-BBB")]), before = go([rn("2031-01-02T01", "ZZ1-AAA", "ZZ2-BBB"), sl("2031-01-02T02", 2, T(2))]);
    const own = (r) => r.ok && r.book.sales.filter((x) => /^note 2031/.test(x.note)).every((x) => x.customer === "ZZ2-BBB") && r.book.roster.includes("ZZ2-BBB") && !r.book.roster.includes("ZZ1-AAA");
    ok(own(after) && own(before) && after.renames.length === 1, "S1d-2: a rename applies where it stands: a sale booked before it and one booked after it under the old code both end under the new: " + JSON.stringify([after.problems, before.problems]));
    /* a trip books every row or none: two books and one delivery fold whole; a second delivery refuses the row and holds its sibling, and nothing folds */
    const tr = (id, product, extra) => sl(id, 1, T(2), Object.assign({ trip: "t1791900000099", product, cash: 0, deliveredQty: 0, total: 100 }, extra || {}));
    const okTrip = go([tr("2031-01-02T01", "salt", { delivery: 10 }), tr("2031-01-02T02", "oil")]), badTrip = go([tr("2031-01-02T01", "salt", { delivery: 10 }), tr("2031-01-02T02", "oil", { delivery: 5 })]);
    ok(okTrip.ok && okTrip.book.sales.filter((x) => x.trip === "t1791900000099").length === 2 && !badTrip.ok && badTrip.problems.length === 2 && badTrip.problems.some((x) => /another row of trip/.test(x)) && badTrip.untouched,
      "S1d-2: a trip books whole or not at all: " + JSON.stringify([okTrip.problems, badTrip.problems]));
  }
}
