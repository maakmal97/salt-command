/* cost-migrate.mjs — v496, run ONCE by hand: a sale's cost becomes the cost of the order in RM.
 *
 *   node tools/cost-migrate.mjs            rewrite ledger/book.json, then run booksync --sync
 *
 * Until v496 `cost` on a sale was RM per unit and every reader multiplied it by a quantity of its
 * own choosing. From v496 it is the cost of the whole order, and each movement that moved product
 * carries the cost of what it moved on its step (`amend[i].cost`). This converts every stated
 * cost once, unit times the order's quantity, and writes each product-moving step's cost as unit
 * times the units it moved, both to the sen. The one live row with no stated cost, s107, takes
 * the figure the desk had been costing it at, the product's weighted average buy price, so no
 * margin on the book moves; the cancelled rows without a cost stay without one, since nothing
 * was delivered. Refuses to run twice: an absolute cost divided by its quantity is a unit figure,
 * and the book's unit figures all sit under RM 80.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOK = resolve(REPO, "ledger", "book.json");
const book = JSON.parse(readFileSync(BOOK, "utf8"));
const r2 = (x) => +(+x).toFixed(2);

const stated = book.sales.filter((s) => s.cost != null && s.qty > 0);
const maxUnit = Math.max(...stated.map((s) => s.cost / s.qty));
if (stated.some((s) => s.qty > 1.5 && s.cost / s.qty > 80)) { console.error(`refusing: a cost divided by its quantity exceeds RM 80, so the book already carries absolute costs (max ${maxUnit.toFixed(2)})`); process.exit(1); }

const { openMaster } = await import("./payload.mjs");
const { w } = await openMaster();
w.eval("setProd('salt');recompute();");
const shelfUnit = +w.eval("wavgFor('salt')");

let rows = 0, steps = 0, filled = [];
for (const s of book.sales) {
  let unit;
  if (s.cost != null) { unit = +s.cost; s.cost = r2(unit * s.qty); rows++; }
  else if (!s.cancelled && s.qty > 0 && (s.total || 0) > 0) {
    unit = shelfUnit; s.cost = r2(unit * s.qty); filled.push(s.rid);
    s.note = `<b>COSTED AT v496.</b> No cost was stated on this row; it is stored at RM ${s.cost} for ${s.qty} unit, the product's weighted average buy price of RM ${unit.toFixed(4)} a unit that the desk had been costing it at, so the margin it showed does not move. ` + (s.note || "");
  } else continue;
  for (const a of s.amend || []) if ((a.kg || 0) > 0.0001) { a.cost = r2(unit * a.kg); steps++; }
}
writeFileSync(BOOK, JSON.stringify(book, null, 1) + "\n");
console.log(`  ok    ${rows} stated costs made absolute, ${steps} movement costs written, ${filled.length} filled from the shelf at RM ${shelfUnit.toFixed(4)}/unit (${filled.join(" ")})`);
console.log(`  next  node tools/booksync.mjs --normalise && node tools/booksync.mjs --sync`);
