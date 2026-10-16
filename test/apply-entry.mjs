/* test/apply-entry.mjs: S1d-i of the Book plan. applyEntry books ONE planned entry, beside the batch's applyInto. Reduced over a batch in event order (the entries, then the
   renames, QUEUE_COMMITTED and sortBook, which a wrapper does once) it must leave the book applyBatch leaves, bar the ROLLED sentences the wrapper writes. Where the order of a
   count and a move on one product decides the figure, the entry law and the batch law differ, and that is recorded here, not changed: S1d-ii adopts it. */
import { batches, notesFor } from "./fold-replay.mjs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* the reducer a batch wrapper will be: every entry, then the renames, QUEUE_COMMITTED and the sort, once */
export function reduceEntries(ENG, E, book, p, staged, notes, ctx) {
  let newest = book.QUEUE_COMMITTED || "";
  const renames = [];
  for (const it of p.items) {
    const r = ENG.applyEntry(book, it, { nextRid: ctx.nextRid, staged, notes, moves: ENG.movesOf(p, it) });
    renames.push(...r.renames);
    if (r.newest > newest) newest = r.newest;
  }
  for (const rn of renames) {
    E.renameInBook(book, rn.pairs);
    if (rn.geo) { book.PLACED = book.PLACED || {}; book.PLACED[rn.to] = rn.geo; }
  }
  if (newest && newest > (book.QUEUE_COMMITTED || "")) book.QUEUE_COMMITTED = newest;
  ctx.sortBook(book);
  return book;
}

const unrolled = (book) => {   /* the book with its ROLLED sentences taken out, which the wrapper writes */
  const b = JSON.parse(JSON.stringify(book));
  for (const k of Object.keys(b.NOTES || {})) if (Array.isArray(b.NOTES[k])) b.NOTES[k] = b.NOTES[k].filter((s) => !/^ROLLED AT /.test(s));
  return JSON.stringify(b);
};

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

  /* a rename comes last: a row booked in the same batch under the old code moves with it */
  const c4 = mk(), st4 = { approved: [sale] };
  const p4 = { items: [{ id: "q-0", rename: { from: "ZZ1-AAA", to: "ZZ2-BBB", pairs: [["ZZ1-AAA", "ZZ2-BBB"]], geo: null } }, itSale], moves: [] };
  reduceEntries(ENG, E, c4, p4, st4, { version: "v1", rows: { "q-1": { note: "invented sale" } } }, { nextRid, sortBook });
  ok(c4.sales.length === 1 && c4.sales[0].customer === "ZZ2-BBB" && c4.roster.includes("ZZ2-BBB") && c4.QUEUE_COMMITTED === "q-1", "S1d-1: a rename planned first is applied last, after the sale booked under the old code, and QUEUE_COMMITTED follows the newest entry");

  /* 1. the last 20 staged batches, reduced entry by entry */
  let bs;
  try { bs = batches(20); } catch (e) { bs = []; }
  const shallow = (() => { try { return execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: REPO, encoding: "utf8" }).trim() === "true"; } catch (e) { return true; } })();
  if (!bs.length || shallow) { ok(true, "S1d-1: no staged batch in this clone's history (shallow): the reduction is run on the laptop"); return; }
  const realNow = Date.now;
  let same = 0, folded = 0;
  const differ = [];
  try {
    Date.now = () => Date.UTC(2026, 9, 14, 3, 0, 0);   /* pinned before the fold reads its clock */
    const NEW = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?applyentry");
    for (const x of bs) {
      const ctx = Object.assign(Object.create(NEW.planCtx), { nextRid, sortBook });
      const p = NEW.plan(JSON.parse(x.book), x.staged, null), nt = notesFor(p, x.master);
      const whole = ENG.applyBatch(JSON.parse(x.book), x.staged, nt, ctx);
      if (!whole.ok) { ok(true, `S1d-1: batch ${x.sha.slice(0, 8)} is refused as a whole, so nothing is reduced`); continue; }
      folded++;
      const st = JSON.parse(JSON.stringify(x.staged)), bk = JSON.parse(x.book), pl = ENG.planBatch(bk, st, nt, ctx);   /* planned against the book it is booked into: a correction's target is one of its rows */
      const red = reduceEntries(ENG, E, bk, pl, st, nt, ctx);
      const eq = unrolled(red) === unrolled(whole.book);
      if (eq) same++; else differ.push(x.sha.slice(0, 8));
      ok(eq, `S1d-1: batch ${x.sha.slice(0, 8)} (${x.staged.count} row(s)) reduced entry by entry ends where applyBatch ends`);
    }
  } finally { Date.now = realNow; }
  ok(folded >= 1 && same === folded, `S1d-1: ${same} of ${folded} folded batches reduce equal${differ.length ? "; not equal: " + differ.join(", ") : ""}`);
}
