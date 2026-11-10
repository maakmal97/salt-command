/* test/gas-prep-books.mjs: gas, the fifth book (27 Oct 2026, his word; it took the place of the retired spare book), and PrEP,
   opened beside it and REMOVED ENTIRELY on his word of 10 Nov 2026. On the LIVE book: gas is live, spare and PrEP are gone with no
   row and no map key, the Counter's word list names exactly the books, gas has its mark, shape and letter (POP, a starburst, set
   small), PrEP has none of them, no rule names it, and the `multiples` grid made for it still cuts a grid that carries one. */
import { readFileSync } from "node:fs";
import { LIVE_BOOK } from "./frozen.mjs";

export async function run({ ok }) {
  const O = await import("../src/orders.js");
  const P = await import("../stmt/page.js");
  const book = JSON.parse(readFileSync(LIVE_BOOK, "utf8"));
  const rowsOf = (id) => ["sales", "purchases", "loans", "COUNTS", "selfUseLog", "lostDemand"].reduce((n, k) => n + (book[k] || []).filter((r) => r && r.product === id).length, 0);
  const MAPS = ["PRODUCTS", "PROD_OPENING", "COUNT_ON", "PRICE_SET", "COST_RULE", "QUOTES"];
  const keyed = (id) => MAPS.filter((k) => book[k] && id in book[k]).concat(book.PROD_ORDER.includes(id) ? ["PROD_ORDER"] : [])
    .concat(Object.keys(book.TIER_OF || {}).filter((c) => book.TIER_OF[c] && id in book.TIER_OF[c]).map((c) => "TIER_OF." + c));
  ok(!!book.PRODUCTS.gas && !book.PRODUCTS.gas.retired && ["spare", "prep"].every((id) => !keyed(id).length && rowsOf(id) === 0)
    && !/\bprep\b/i.test(JSON.stringify(book.NOTES || {})),
    "gas is a live book, and spare and PrEP are gone with no row, no map key, no customer % and no note: " + JSON.stringify({ order: book.PROD_ORDER, spare: keyed("spare"), prep: keyed("prep"), prepRows: rowsOf("prep") }));
  const live = Object.values(book.PRODUCTS).filter((p) => !p.retired).map((p) => String(p.name).toLowerCase());
  ok(live.length === 5 && JSON.stringify(O.PRODUCT_WORDS.slice().sort()) === JSON.stringify(live.slice().sort()), "the Counter's product words are exactly the live books: " + JSON.stringify({ live, words: O.PRODUCT_WORDS }));
  ok(P.PLET.gas === "POP" && P.PSHAPE.gas === "Starburst" && !!P.PSYM.gas && !("prep" in P.PLET) && !("prep" in P.PSHAPE) && !("prep" in P.PSYM),
    "gas is a starburst lettered POP, and PrEP has no mark, shape or letter");
  const g = P.psymSvg("gas", 28), q = P.psymSvg("prep", 28);
  const fs = (s) => Number((s.match(/font-size="([0-9.]+)"/) || [])[1]);
  ok(/>POP<\/text>/.test(g) && fs(g) < 8 && fs(g) * 0.6 * 3 <= 13.01 && !/<text/.test(q) && /A8\.6 8\.6/.test(q),
    "gas sets POP small enough to sit inside the starburst, and a mark asked for PrEP is the bare Ring");
  const R = await import("../engine/rules.mjs"), D = R.default || R;
  const TR = R.TIER_RULE || D.TIER_RULE, PE = R.PRICE_ENGINE || D.PRICE_ENGINE, LB = R.LADDER_BY || D.LADDER_BY;
  const css = readFileSync(new URL("../design/salt-ds.css", import.meta.url), "utf8");
  ok(!("prep" in TR) && !(PE && PE.sizesBy && "prep" in PE.sizesBy) && !(LB && "prep" in LB) && !/salt-product-prep|--prep\b/.test(css),
    "no pricing rule, size list or ladder names PrEP, and the design carries no PrEP hue or class: " + JSON.stringify({ tier: "prep" in TR, sizes: !!(PE && PE.sizesBy && "prep" in PE.sizesBy), ladder: !!(LB && "prep" in LB) }));
  /* the order grid: `multiples` (made for PrEP, 27 Oct 2026) still takes 12N or 30N and nothing else on a grid that carries it */
  const pg = { min: 12, step: 6, max: 120, multiples: [12, 30] };
  const SO = await import("../stmt/orders.js");
  const take = (q) => SO.onStep(q, pg, q > pg.max);
  const yes = [12, 24, 30, 36, 48, 60, 72, 90, 120, 132, 150], no = [6, 18, 42, 54, 66, 78, 100, 13, 11, 31];
  ok(yes.every(take) && no.every((q) => !take(q)) && !SO.onStep(0, pg), "a grid with multiples of 12 and 30 takes 12N and 30N, on the board or by Negotiate, and no other size: " + JSON.stringify({ wrongYes: yes.filter((q) => !take(q)), wrongNo: no.filter(take) }));
  const spans = { gas: [1, 1, 20], candy: [1, 1, 50], rice: [1, 1, 100] };
  ok(Object.entries(spans).every(([b, [mn, st, mx]]) => TR[b].grid.min === mn && TR[b].grid.step === st && TR[b].grid.max === mx && SO.onStep(mx, TR[b].grid) && !SO.onStep(mx + 1, TR[b].grid) && SO.onStep(mx + 1, TR[b].grid, true)),
    "gas runs 1 to 20, candy 1 to 50 and rice 1 to 100 in ones, any whole number beyond by Negotiate: " + JSON.stringify(Object.fromEntries(Object.keys(spans).map((b) => [b, TR[b].grid]))));
  /* salt's list (his word of 27 Oct 2026): halves to 5, then 6.25, 12.5, 25, 50 and 100, and no other size to 100 */
  const sg = TR.salt.grid, listed = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6.25, 12.5, 25, 50, 100], unlisted = [0.75, 5.5, 6, 7, 10, 12, 20, 30, 75, 99.75];
  ok(sg.max === 100 && sg.step === 0.25 && listed.every((q) => SO.onStep(q, sg)) && unlisted.every((q) => !SO.onStep(q, sg)) && SO.onStep(100.25, sg, true)
    && JSON.stringify(sg.only) === JSON.stringify(listed) && JSON.stringify(TR.salt.rungs) === JSON.stringify(listed),
    "salt may be ordered in the listed sizes only, to 100, with the walk still on quarters: " + JSON.stringify({ wrongYes: listed.filter((q) => !SO.onStep(q, sg)), wrongNo: unlisted.filter((q) => SO.onStep(q, sg)) }));
  const offOnly = SO.checkPlacement({ product: "salt", qty: 7, mode: "collected", total: 800, unit: 114 }, [], "2026-10-27T10:00:00Z", false, { salt: sg });
  ok(offOnly.code === "offOnly", "a 7-unit salt order is refused as not a listed size: " + JSON.stringify(offOnly).slice(0, 120));
  const refuse = SO.checkPlacement({ product: "gas", qty: 18, mode: "collected", total: 80, unit: 4.4 }, [], "2026-10-27T10:00:00Z", false, { gas: pg });
  ok(refuse.code === "offMult", "an 18 order on a grid of multiples is refused as off the multiples: " + JSON.stringify(refuse).slice(0, 120));
}
