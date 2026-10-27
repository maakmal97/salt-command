/* test/gas-prep-books.mjs: gas and PrEP, the fifth and sixth books (27 Oct 2026, his word; they took the place of the retired spare
   book). On the LIVE book: both are live and hold no row, spare is gone from it, the Counter's word list names exactly the live
   books, and each book has its mark, shape and letter (gas P, a flame; PrEP, a heart-shaped pill, its four letters set small). */
import { readFileSync } from "node:fs";
import { LIVE_BOOK } from "./frozen.mjs";

export async function run({ ok }) {
  const O = await import("../src/orders.js");
  const P = await import("../stmt/page.js");
  const book = JSON.parse(readFileSync(LIVE_BOOK, "utf8"));
  const rows = ["sales", "purchases", "loans", "COUNTS", "selfUseLog", "lostDemand"].reduce((n, k) => n + (book[k] || []).filter((r) => r && ["gas", "prep", "spare"].includes(r.product)).length, 0);
  ok(!book.PRODUCTS.spare && !book.PROD_ORDER.includes("spare") && book.PRODUCTS.gas && book.PRODUCTS.prep && !book.PRODUCTS.gas.retired && !book.PRODUCTS.prep.retired && rows === 0,
    "gas and PrEP are live books with no row, and spare is gone: " + JSON.stringify({ order: book.PROD_ORDER, rows }));
  const live = Object.values(book.PRODUCTS).filter((p) => !p.retired).map((p) => String(p.name).toLowerCase());
  ok(live.length === 6 && JSON.stringify(O.PRODUCT_WORDS.slice().sort()) === JSON.stringify(live.slice().sort()), "the Counter's product words are exactly the live books: " + JSON.stringify({ live, words: O.PRODUCT_WORDS }));
  ok(P.PLET.gas === "P" && P.PLET.prep === "PrEP" && P.PSHAPE.gas === "Flame" && P.PSHAPE.prep === "Heart" && !!P.PSYM.gas && !!P.PSYM.prep,
    "gas is a flame lettered P and PrEP a heart lettered PrEP");
  const g = P.psymSvg("gas", 28), q = P.psymSvg("prep", 28);
  ok(/>P<\/text>/.test(g) && /font-size="8"/.test(g) && />PrEP<\/text>/.test(q) && Number((q.match(/font-size="([0-9.]+)"/) || [])[1]) < 8 && Number((q.match(/font-size="([0-9.]+)"/) || [])[1]) * 0.6 * 4 <= 13.01,
    "gas draws its capital at the common size and PrEP sets its word small enough to sit inside the heart");
  /* the order grid: gas is bought in ones with the board at 1; PrEP takes 12N or 30N and nothing else (his word of 27 Oct 2026) */
  const R = await import("../engine/rules.mjs"), TR = (R.TIER_RULE || (R.default && R.default.TIER_RULE)), pg = TR.prep.grid;
  const SO = await import("../stmt/orders.js");
  const take = (q) => SO.onStep(q, pg, q > pg.max);
  const yes = [12, 24, 30, 36, 48, 60, 72, 90, 120, 132, 150], no = [6, 18, 42, 54, 66, 78, 100, 13, 11, 31];
  ok(yes.every(take) && no.every((q) => !take(q)) && !SO.onStep(0, pg), "PrEP takes 12N and 30N, on the board or by Negotiate, and no other size: " + JSON.stringify({ wrongYes: yes.filter((q) => !take(q)), wrongNo: no.filter(take) }));
  const spans = { gas: [1, 1, 20], candy: [1, 1, 50], rice: [1, 1, 100] };
  ok(Object.entries(spans).every(([b, [mn, st, mx]]) => TR[b].grid.min === mn && TR[b].grid.step === st && TR[b].grid.max === mx && SO.onStep(mx, TR[b].grid) && !SO.onStep(mx + 1, TR[b].grid) && SO.onStep(mx + 1, TR[b].grid, true) && !SO.onStep(mx + 0.5, TR[b].grid, true) && !SO.onStep(0.5, TR[b].grid)),
    "gas runs 1 to 20, candy 1 to 50 and rice 1 to 100 in ones, any whole number beyond by Negotiate: " + JSON.stringify(Object.fromEntries(Object.keys(spans).map((b) => [b, TR[b].grid]))));
  /* salt's list (his word of 27 Oct 2026): halves to 5, then 6.25, 12.5, 25, 50 and 100, and no other size to 100 */
  const sg = TR.salt.grid, listed = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6.25, 12.5, 25, 50, 100], unlisted = [0.75, 5.5, 6, 7, 10, 12, 20, 30, 75, 99.75];
  ok(sg.max === 100 && sg.step === 0.25 && listed.every((q) => SO.onStep(q, sg)) && unlisted.every((q) => !SO.onStep(q, sg)) && SO.onStep(100.25, sg, true)
    && JSON.stringify(sg.only) === JSON.stringify(listed) && JSON.stringify(TR.salt.rungs) === JSON.stringify(listed),
    "salt may be ordered in the listed sizes only, to 100, with the walk still on quarters: " + JSON.stringify({ wrongYes: listed.filter((q) => !SO.onStep(q, sg)), wrongNo: unlisted.filter((q) => SO.onStep(q, sg)) }));
  const offOnly = SO.checkPlacement({ product: "salt", qty: 7, mode: "collected", total: 800, unit: 114 }, [], "2026-10-27T10:00:00Z", false, { salt: sg });
  ok(offOnly.code === "offOnly", "a 7-unit salt order is refused as not a listed size: " + JSON.stringify(offOnly).slice(0, 120));
  const refuse = SO.checkPlacement({ product: "prep", qty: 18, mode: "collected", total: 80, unit: 4.4 }, [], "2026-10-27T10:00:00Z", false, { prep: pg });
  ok(refuse.code === "offMult", "an 18-pill order is refused as off the multiples: " + JSON.stringify(refuse).slice(0, 120));
}
