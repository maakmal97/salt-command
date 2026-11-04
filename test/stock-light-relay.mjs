/* test/stock-light-relay.mjs: THE RESTOCK LIGHT MADE PLAIN, P1, THE LIGHT IN STOCK (22 Oct 2026; docs/plan-restock-light.html, his word).
 * What is proved here, each check red under its own mutation (test/stock-light-relay.mutations.json):
 *   1  the snapshot carries each book's light, the engine's restockLight asked of that book's own shelf, commitments, the part agreed
 *      and measured demand (its days of cover and median order, 04 Nov 2026), as it answered
 *   2  makerStock carries a light that is green, yellow, amber or red beside the five figures, and nothing for any other or for none
 *   3  the Counter's relay carries it the same way, and the /all/test example carries one
 * The expected figures are written out by hand, never computed by the code under test. */
import { readBook, stockSnapshot } from "../tools/book.mjs";
import { makerStock } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";

const J = JSON.stringify;

export async function run({ ok }) {
  /* 1: the engine's rule is stood in for by one that answers by the call, so the wiring is what is measured */
  const { w } = await readBook();
  const agreedOf = (p) => w.eval("(function(){var k=PROD;PROD=" + J(p) + ";recompute();var a=POSITION_ENGINE.commitments(pSales(PROD),currentStock).promUnits;PROD=k;recompute();return a;})()");
  const usualOf = (p) => w.eval("(function(){var r=restockFor(" + J(p) + ");return r&&!r.empty&&r.buy?r.buy.median:null;})()");
  try {
    w.eval("window.__slr=[];window.__slrWas=POSITION_ENGINE.restockLight;POSITION_ENGINE.restockLight=function(s,c,d){__slr.push([s,c,d]);return ['green','yellow','red'][(__slr.length-1)%3];};");
    const S = stockSnapshot(w), calls = J(w.eval("__slr"));
    w.eval("POSITION_ENGINE.restockLight=__slrWas;");
    const ids = w.eval("PROD_IDS.slice()"), seen = JSON.parse(calls);
    ok(seen.length === ids.length && ids.every((p, i) => S.books[p].light === ["green", "yellow", "red"][i % 3]
      && Math.abs(seen[i][0] - S.books[p].shelf) < 0.006 && Math.abs(seen[i][1] - S.books[p].commit) < 0.006
      && seen[i][2] && seen[i][2].coverDays === S.books[p].coverDays && seen[i][2].usual === usualOf(p) && seen[i][2].agreed === agreedOf(p)),
    "the snapshot carries each book's light as the engine's restockLight answered it, asked of that book's shelf, its commitments and its demand: " + calls + " " + J(S.books));
    const real = stockSnapshot(w).books;
    /* the four steps written out (his rule of 04 Nov 2026): nothing free red, under one usual order or 3 days amber, 7 days yellow, else green */
    /* 04 Nov 2026, his word: red reads only what is free (the shelf less what is paid ahead); what is agreed makes it amber at most */
    const rule = (b, u) => { const after = b.shelf - b.commit; return b.free < 0.005 ? "red" : after < 0.005 || (u > 0 && u - after > 0.005) || (b.coverDays != null && b.coverDays <= 3) ? "amber" : b.coverDays != null && b.coverDays <= 7 ? "yellow" : "green"; };
    ok(ids.every((p) => real[p].light === rule(real[p], usualOf(p))),
      "with the engine's own rule, red with nothing free, amber low, yellow selling fast, else green: " + J(real));
  } finally { w.close(); }

  /* 2 */
  const STOCK = { today: "2026-10-22", books: { salt: { shelf: 3, free: 1, commit: 5, coverDays: 1.2, transit: 8, light: "yellow" },
    oil: { shelf: 0, free: 0, commit: 0, coverDays: null, transit: 0, light: "red" }, rice: { shelf: 9, free: 9, commit: 0, coverDays: 4, transit: 0, light: "blue" },
    candy: { shelf: 6, free: 6, commit: 0, coverDays: 3, transit: 0 }, gas: { shelf: 2, free: 2, commit: 0, coverDays: 2, transit: 0, light: "amber" } } };
  const PRICING = { byProduct: { salt: {}, oil: {}, rice: {}, candy: {}, gas: {} }, v: "v9" };
  const d = makerStock({ sales: [], purchases: [], version: "v9", pricing: PRICING, state: { STOCK, PRICING } });
  ok(J(d.books) === J({ salt: { shelf: 3, free: 1, commit: 5, coverDays: 1.2, transit: 8, light: "yellow" },
    oil: { shelf: 0, free: 0, commit: 0, coverDays: null, transit: 0, light: "red" }, rice: { shelf: 9, free: 9, commit: 0, coverDays: 4, transit: 0 },
    candy: { shelf: 6, free: 6, commit: 0, coverDays: 3, transit: 0 }, gas: { shelf: 2, free: 2, commit: 0, coverDays: 2, transit: 0, light: "amber" } }),
  "makerStock carries a green, yellow, amber or red light beside the five figures, nothing for another word or for none: " + J(d.books));

  /* 3 */
  const env = { COUNTER_MAKER_KEY: "k".repeat(40), STMT: { get: async () => null },
    DESK_MAKER: { fetch: async () => new Response(J({ ok: true, today: "2026-10-22", books: d.books && { ...d.books, rice: { ...d.books.rice, light: "blue" } } })) } };
  const owner = { email: "maakmal97@icloud.com" };
  const call = (opts) => handleMaker(new Request("https://counter.test/all/maker/stock"), env, "/all/maker/stock", owner, opts);
  const c = await (await call()).json();
  ok(c.books && c.books.salt.light === "yellow" && c.books.oil.light === "red" && c.books.gas.light === "amber" && !("light" in c.books.rice) && !("light" in c.books.candy),
    "the Counter's relay carries the light as it came, and no light for another word or for none: " + J(c.books));
  const t = await (await call({ test: true })).json();
  ok(t.books && t.books.salt.light === "green", "the /all/test example carries a light: " + J(t.books));
}
