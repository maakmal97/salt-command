#!/usr/bin/env node
/* tools/pricelist.mjs: A CUSTOMER'S OWN PRICE LIST, for the week, from his own history.
 *
 * His instruction of 06 Sep 2026: after the username and the password, a customer can also find
 * a price list based on his historical purchase price, changing weekly. This is the whole of
 * that rule, stated once so the page, the deploy and the suite cannot disagree about it.
 *
 * THE RATE IS HIS, NOT THE BOARD'S. A customer who has bought before is quoted the rate he has
 * been paying: the median unit rate of his last four committed orders of that product. Four,
 * not all: a price he moved to in July should be the price he sees in September, and a median
 * so one odd order (a gift, a settlement, a favour) cannot drag the list. A customer with no
 * history on a product sees the board's ask for it, which is the one price the desk quotes to
 * a stranger. The rule is the drafter's own "this party typically pays" test, read forward.
 *
 * THE FLOOR STILL HOLDS. A quoted total is never below what the engine says that size costs him
 * to sell; so a customer whose old rate has fallen under a risen floor is lifted to the floor
 * rather than quoted a loss. Nothing here prices: floorTotal, priceLadder and the
 * cost stack are the engine's, fed the same PRICING inputs the desk and the drafter read.
 *
 * WEEKLY, AND WHAT THAT MEANS. The week runs Monday to Sunday in Kuala Lumpur. His own rate is
 * read from orders dated BEFORE the week's Monday, so an order he places on Wednesday cannot
 * move the price he was shown on Tuesday; the list is stamped with the week it is for. The
 * floor is the engine's at the moment the deploy writes the list, which is the one part that
 * can move inside a week, and only ever upwards for him. That is deliberate: a floor that has
 * risen is a floor.
 *
 * DELIVERY IS NOT ON THE LIST (v502, his instruction of 07 Sep 2026): it is a figure he types on
 * the order when he marks it ready to deliver, and the customer sees it then, on top of these.
 *
 *   node tools/pricelist.mjs --show <CODE>     print the list the customer would see, now
 */
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import PRICING_ENGINE from "../engine/pricing.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const prodOf = (r) => (r && r.product) || "salt";
export const HISTORY_ORDERS = 4;

/** The week that holds `now`, in Kuala Lumpur: Monday to Sunday, as dates and as a label. */
export function weekOf(now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const kl = new Date(at.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  const day = (kl.getDay() + 6) % 7;                  // Monday 0 .. Sunday 6
  const mon = new Date(kl); mon.setDate(kl.getDate() - day);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const say = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return { monday: iso(mon), sunday: iso(sun),
           label: say(mon) + " to " + say(sun) + " " + sun.getFullYear() };
}

/** The customer's own rate on a product: the median of his last four committed orders before `before`. */
export function ownRate(sales, code, product, before) {
  const rows = (sales || [])
    .filter((s) => s.customer === code && prodOf(s) === product && !s.cancelled && s.date && s.date < before
      && isNum(s.total) && s.total > 0 && isNum(s.qty) && s.qty > 0)
    /* v502: the rate a customer paid is on the goods, the delivery charge inside the total taken out */
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-HISTORY_ORDERS)
    .map((s) => (s.total - (isNum(s.delivery) ? s.delivery : 0)) / s.qty).sort((a, b) => a - b);
  if (!rows.length) return { rate: null, orders: 0 };
  const n = rows.length;
  const mid = n % 2 ? rows[(n - 1) / 2] : (rows[n / 2 - 1] + rows[n / 2]) / 2;
  return { rate: +mid.toFixed(2), orders: n };
}

/* HIS RATE, DRAWN TOWARD THE BOARD (v510, his instruction of 07 Sep 2026). The board's ask is the
   minimum for anyone, so a list under it is a design fault; but a customer's own history is not
   thrown away either. At each size, with R his rate times the size, F the floor, A the board's
   ask and CAP three times COGS (a 2x markup, the ladder's ceiling):
     below the floor       up more:      halfway from R to A, and never under F
     under the ask         up slightly:  a quarter of the way from R to A
     above the cap         down more:    halfway from R back to A, and never above CAP
     above the ask, loyal  down slightly: a quarter of the way from R back to A
     above the ask, other  his rate stands
   then up to the whole ringgit. "Slightly" is a quarter of the gap and "more" is half, stated
   here once so the desk's printed board (pbPrices in the master) reads the same. Loyal is the
   desk's own badge: three or more priced orders and the last within fourteen days. */
export function adjustedPrice(R, F, A, cap, loyal) {
  let p;
  if (R < F) p = Math.max(F, R + 0.5 * (A - R));
  else if (R < A) p = R + 0.25 * (A - R);
  else if (R > cap) p = Math.max(A, Math.min(cap, R - 0.5 * (R - A)));
  else p = loyal ? R - 0.25 * (R - A) : R;
  return Math.ceil(Math.max(p, F) - 1e-9);
}
export function loyalFor(sales, code, product, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const rows = (sales || []).filter((s) => s.customer === code && prodOf(s) === product && !s.cancelled && s.date && isNum(s.total) && s.total > 0);
  if (rows.length < 3) return false;
  const last = rows.map((s) => s.date).sort().pop();
  return (at - new Date(last + "T00:00:00Z")) / 86400000 <= 14;
}

/** The list: one block per product, every board size, one price each. */
export function priceList(code, book, pricing, now) {
  const week = weekOf(now);
  const sizes = (pricing && pricing.sizes) || [];
  const products = book.PROD_ORDER || Object.keys(book.PRODUCTS || { salt: 1 });
  const out = { at: new Date(now || Date.now()).toISOString(), week, products: [] };
  for (const p of products) {
    const snap = pricing && pricing.byProduct && pricing.byProduct[p];
    const inputs = snap && snap.inputs;
    if (!inputs || !inputs.cost || !inputs.policy) continue;      // a product the desk cannot price is left off
    const C = PRICING_ENGINE.costStack(inputs.cost), P = inputs.policy;
    const own = ownRate(book.sales, code, p, week.monday);
    const loyal = loyalFor(book.sales, code, p, now);
    const rows = sizes.map((q) => {
      const floor = PRICING_ENGINE.floorTotal(q, C, P);
      const ask = PRICING_ENGINE.priceLadder(q, C, P).ask.total;
      let price;
      if (own.rate != null) price = adjustedPrice(own.rate * q, floor, ask, 3 * PRICING_ENGINE.ladderCogs(q, C), loyal);
      else price = ask;
      return { q, price: +price.toFixed(2) };
    });
    out.products.push({
      product: p,
      name: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      basis: own.rate != null ? "yours" : "board",
      rate: own.rate, orders: own.orders, loyal, sizes: rows
    });
  }
  return out;
}

async function main() {
  const i = process.argv.indexOf("--show");
  const code = i >= 0 ? process.argv[i + 1] : null;
  if (!code) { console.error("usage: node tools/pricelist.mjs --show <CODE>"); process.exit(2); }
  const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const { readBook } = await import("./book.mjs");
  const pricing = (await readBook()).ledger.PRICING;
  const list = priceList(code, book, pricing, new Date());
  console.log(code + ", week " + list.week.label + " (history before " + list.week.monday + ")");
  for (const p of list.products) {
    console.log("\n" + p.name + ": " + (p.basis === "yours" ? "your rate RM " + p.rate + "/" + p.unit + " over " + p.orders + " order(s)" : "the board's ask; no history")
      );
    for (const r of p.sizes) console.log("  " + String(r.q).padStart(5) + " " + p.unit + "  RM " + r.price);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
