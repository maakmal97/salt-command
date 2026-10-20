/* test/loyalty-seal.mjs: THE LOYALTY UNIT, P4: THE CUSTOMER SEES A SHARE OF ONE (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html).
 * On the desk's own window; each check red under its own mutation (test/loyalty-seal.mutations.json):
 *   1  a customer's card is salt alone and carries one figure, loyal.next, and nothing else: no units, step, cost, margin, ringgit or paused word
 *   2  the share is at two decimals, read off the walk on the desk's own rows (an invented customer given 6.667 units at their price)
 *   3  an associate, the partner and a supplier carry none
 *   4  the publish seals every customer's card off the same window as their prices, an associate's card standing
 *   5  the order's mark stays on the book: rwdLoyal is in no customer field, and their view of an order carrying it drops it */
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readBook, customerCard, LOYAL_FIELDS } from "../tools/book.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const j = (x) => JSON.stringify(x);

export async function run({ ok }) {
  const desk = await readBook();
  try {
    const w = desk.w, L = desk.ledger;
    const codes = L.roster.filter((c) => !c.endsWith("-R"));
    const cards = codes.map((c) => [c, customerCard(w, c)]).filter((x) => x[1]);
    /* 1 */
    const bad = cards.filter(([, c]) => j(Object.keys(c).sort()) !== j(["at", "products"]) || c.products.length !== 1 || c.products[0].product !== "salt"
      || j(Object.keys(c.products[0]).sort()) !== j(["loyal", "product"]) || j(Object.keys(c.products[0].loyal)) !== j(LOYAL_FIELDS)
      || /units|every|step|cost|margin|RM|paus|why|late|writeoff|earned/i.test(j(c.products)));
    ok(cards.length > 10 && bad.length === 0 && j(LOYAL_FIELDS) === j(["next"]),
      "a customer's card is salt alone with one figure, the share of the next unit: " + cards.length + " cards, " + j(bad.slice(0, 2)));
    /* 2: an invented customer, three orders at their price paid on the day, 6.667 units since the switch */
    const day = w.eval("TODAY.toISOString().slice(0,10)");
    const rows = [[3, "s99901"], [2, "s99902"], [1.667, "s99903"]].map(([q, rid]) => ({ rid, customer: "CQ1-ZUL", product: "salt", date: day, qty: q, total: 100 * q, cost: 58 * q,
      listRM: 100 * q, listQty: q, cash: 100 * q, paidOn: day, deliveredQty: q, deliveredOn: day, note: "test" }));
    w.eval("roster.push('CQ1-ZUL');" + rows.map((r) => "sales.push(" + j(r) + ");").join(""));
    const mine = customerCard(w, "CQ1-ZUL");
    ok(mine && mine.products[0].loyal.next === 0.33, "the share is at two decimals, off the walk on the desk's rows: " + j(mine));
    /* 3 */
    const assoc = (L.associates || []).filter((c) => !(L.partners || []).includes(c)), partner = (L.partners || [])[0];
    const supplier = [...new Set((L.purchases || []).map((p) => p.supplier).filter((s) => typeof s === "string" && codes.includes(s)))];
    w.eval("roster.push('SX9-MEB');purchases.push({rid:'p9999',supplier:'SX9-MEB',product:'salt',qty:1,total:58,date:'2026-10-01',note:'test'});"
      + "sales.push(" + j({ ...rows[0], rid: "s99904", customer: "SX9-MEB" }) + ");"
      + "roster.push('PX9-NUD');partners.push('PX9-NUD');sales.push(" + j({ ...rows[0], rid: "s99905", customer: "PX9-NUD" }) + ");");
    ok(assoc.length > 3 && assoc.every((c) => customerCard(w, c) === null) && !!partner && customerCard(w, partner) === null
      && customerCard(w, "SX9-MEB") === null && customerCard(w, "PX9-NUD") === null && supplier.every((c) => customerCard(w, c) === null),
      "an associate, the partner and a supplier carry none: " + j([assoc.length, partner, customerCard(w, "SX9-MEB")]));
  } finally { desk.dom.window.close(); }
  /* 4 */
  const PUB = readFileSync(join(REPO, "tools", "stmt-publish.mjs"), "utf8");
  ok(/for \(const code of rb\.ledger\.roster \|\| \[\]\) \{\n\s+if \(typeof code !== "string" \|\| cards\[code\] \|\| code\.endsWith\("-R"\)\) continue;\n\s+const c = customerCard\(rb\.w, code\);\n\s+if \(c\) cards\[code\] = c;/.test(PUB)
    && PUB.indexOf("customerCard(rb.w, code)") > PUB.indexOf("associateCard(rb.w, row.id)") && PUB.indexOf("customerCard(rb.w, code)") < PUB.indexOf("const plan = await planPublish("),
    "the publish seals every customer's card off the prices' window, after the associates' cards");
  /* 5 */
  const O = await import("../stmt/orders.js");
  const view = O.customerView({ id: "o1", u: "abcd-efgh", product: "salt", qty: 1, total: 100, status: "acknowledged", rwd: "cross", rwdLoyal: true, at: "2026-10-21T01:00:00.000Z", history: [] });
  ok(!O.CUSTOMER_FIELDS.includes("rwdLoyal") && view.rwd === "cross" && !("rwdLoyal" in view),
    "rwdLoyal reaches no customer, the one word does: " + j(Object.keys(view).filter((k) => /rwd/.test(k))));
}
