/* test/stock-light-relay.mjs: THE RESTOCK LIGHT MADE PLAIN, P1, THE LIGHT IN STOCK (22 Oct 2026; docs/plan-restock-light.html, his word).
 * What is proved here, each check red under its own mutation (test/stock-light-relay.mutations.json):
 *   1  the snapshot carries each book's light, the engine's restockLight asked of that book's own shelf and commitments, as it answered
 *   2  makerStock carries a light that is green, yellow or red beside the five figures, and nothing for any other or for none
 *   3  the Counter's relay carries it the same way, and the /all/test example carries one
 * The expected figures are written out by hand, never computed by the code under test. */
import { readBook, stockSnapshot } from "../tools/book.mjs";
import { makerStock } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";

const J = JSON.stringify;

export async function run({ ok }) {
  /* 1: the engine's rule is stood in for by one that answers by the call, so the wiring is what is measured */
  const { w } = await readBook();
  try {
    w.eval("window.__slr=[];window.__slrWas=POSITION_ENGINE.restockLight;POSITION_ENGINE.restockLight=function(s,c){__slr.push([s,c]);return ['green','yellow','red'][(__slr.length-1)%3];};");
    const S = stockSnapshot(w), calls = J(w.eval("__slr"));
    w.eval("POSITION_ENGINE.restockLight=__slrWas;");
    const ids = w.eval("PROD_IDS.slice()"), seen = JSON.parse(calls);
    ok(seen.length === ids.length && ids.every((p, i) => S.books[p].light === ["green", "yellow", "red"][i % 3]
      && Math.abs(seen[i][0] - S.books[p].shelf) < 0.006 && Math.abs(seen[i][1] - S.books[p].commit) < 0.006),
    "the snapshot carries each book's light as the engine's restockLight answered it, asked of that book's shelf then its commitments: " + calls + " " + J(S.books));
    const real = stockSnapshot(w).books;
    ok(ids.every((p) => real[p].light === (real[p].shelf < 0.005 ? "red" : real[p].commit - real[p].shelf > 0.005 ? "yellow" : "green")),
      "with the engine's own rule, red on an empty shelf, yellow when more is agreed than the shelf holds, else green: " + J(real));
  } finally { w.close(); }

  /* 2 */
  const STOCK = { today: "2026-10-22", books: { salt: { shelf: 3, free: 1, commit: 5, coverDays: 1.2, transit: 8, light: "yellow" },
    oil: { shelf: 0, free: 0, commit: 0, coverDays: null, transit: 0, light: "red" }, rice: { shelf: 9, free: 9, commit: 0, coverDays: 4, transit: 0, light: "blue" },
    candy: { shelf: 6, free: 6, commit: 0, coverDays: 3, transit: 0 } } };
  const PRICING = { byProduct: { salt: {}, oil: {}, rice: {}, candy: {} }, v: "v9" };
  const d = makerStock({ sales: [], purchases: [], version: "v9", pricing: PRICING, state: { STOCK, PRICING } });
  ok(J(d.books) === J({ salt: { shelf: 3, free: 1, commit: 5, coverDays: 1.2, transit: 8, light: "yellow" },
    oil: { shelf: 0, free: 0, commit: 0, coverDays: null, transit: 0, light: "red" }, rice: { shelf: 9, free: 9, commit: 0, coverDays: 4, transit: 0 },
    candy: { shelf: 6, free: 6, commit: 0, coverDays: 3, transit: 0 } }),
  "makerStock carries a green, yellow or red light beside the five figures, nothing for another word or for none: " + J(d.books));

  /* 3 */
  const env = { COUNTER_MAKER_KEY: "k".repeat(40), STMT: { get: async () => null },
    DESK_MAKER: { fetch: async () => new Response(J({ ok: true, today: "2026-10-22", books: d.books && { ...d.books, rice: { ...d.books.rice, light: "blue" } } })) } };
  const owner = { email: "maakmal97@icloud.com" };
  const call = (opts) => handleMaker(new Request("https://counter.test/all/maker/stock"), env, "/all/maker/stock", owner, opts);
  const c = await (await call()).json();
  ok(c.books && c.books.salt.light === "yellow" && c.books.oil.light === "red" && !("light" in c.books.rice) && !("light" in c.books.candy),
    "the Counter's relay carries the light as it came, and no light for another word or for none: " + J(c.books));
  const t = await (await call({ test: true })).json();
  ok(t.books && t.books.salt.light === "green", "the /all/test example carries a light: " + J(t.books));
}
