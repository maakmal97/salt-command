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
import POSITION_ENGINE from "../engine/position.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* 08 Sep 2026: A ROW THAT COUNTS AS A PRICE THIS CUSTOMER PAID. The window filtered on cancelled
   alone, so two award redemptions at RM 80 and RM 47 with no cash made a customer's rate 63.5
   against a board ask of RM 130, two defaulted rows made another loyal, and a pending row moved a
   median. Pending, cancelled and defaulted rows and awards with no cash are not prices paid. The
   desk's pbPriced is this rule word for word; the suite holds the two together. */
export function pricedOrder(s) {
  const st = POSITION_ENGINE.txStat(s).order;
  if (st === "Pending" || st === "Cancelled" || st === "Default") return false;
  if ((s.rebate || s.goodwill) && !((+s.cash || 0) > 0.009)) return false;
  return true;
}
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
    .filter((s) => s.customer === code && prodOf(s) === product && pricedOrder(s) && s.date && s.date < before
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
     above the cap         down more:    halfway from R back to A, and never above CAP (the ask
                                         itself stands where it is above the cap: nobody lists under the board)
     above the ask, loyal  down slightly: a quarter of the way from R back to A
     above the ask, other  his rate stands
   then to the nearest five. "Slightly" is a quarter of the gap and "more" is half, stated
   here once so the desk's printed board (pbPrices in the master) reads the same. Loyal is the
   desk's own badge: three or more priced orders and the last within fourteen days.

   THE NEAREST FIVE, HIS INSTRUCTION OF 10 SEP 2026 (v564). It was the whole ringgit up, which put
   RM 97, RM 123 and RM 416 on a sheet handed to a customer; the board itself has been quoted in
   tens since v326 and in fives where a ten will not fit since v263, and a suggested price is read
   out of the same mouth as a board price. NEAREST, not up: his word, and the drawing rules above
   already decide the direction, so rounding had no business deciding it again.
   THE FLOOR STILL WINS, AND IT IS THE ONE THING THAT DOES. Rounding to the nearest five can land
   under break-even by up to RM 2.50, so a price that does is lifted to the first five above the
   floor rather than left there. The cap is NOT re-clamped after rounding: it is a drawing target
   at three times COGS, not a refusal line, and rounding may pass it by at most RM 2.50 on a price
   in the hundreds. The floor is a refusal line and gets the guard. */
const near5 = (v) => Math.round(v / 5) * 5;
export function adjustedPrice(R, F, A, cap, loyal) {
  let p;
  if (R < F) p = Math.max(F, R + 0.5 * (A - R));
  else if (R < A) p = R + 0.25 * (A - R);
  else if (R > cap) p = Math.max(A, Math.min(cap, R - 0.5 * (R - A)));
  else p = loyal ? R - 0.25 * (R - A) : R;
  p = near5(Math.max(p, F));
  if (p < F - 0.009) p = Math.ceil((F - 0.009) / 5) * 5;
  return p;
}
export function loyalFor(sales, code, product, now) {
  const at = now instanceof Date ? now : new Date(now || Date.now());
  const rows = (sales || []).filter((s) => s.customer === code && prodOf(s) === product && pricedOrder(s) && s.date && isNum(s.total) && s.total > 0);
  if (rows.length < 3) return false;
  const last = rows.map((s) => s.date).sort().pop();
  /* the fourteen days run from Kuala Lumpur midnight, not UTC's, which ended them at 08:00 (08 Sep 2026) */
  return (at - new Date(last + "T00:00:00+08:00")) / 86400000 <= 14;
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
    /* 08 Sep 2026: THIS BOOK'S SIZES. `pricing.sizes` is the one global grid, salt's 0.5 to 12.5,
       and every customer's oil list was drawn on it: sizes the desk never sells, and none it does.
       The board's own sizes travel in the policy; the snapshot carries them too since today. */
    const sizesHere = (Array.isArray(P.boardSizes) && P.boardSizes.length) ? P.boardSizes
      : ((Array.isArray(snap.sizes) && snap.sizes.length) ? snap.sizes : sizes);
    const rows = sizesHere.slice().sort((a, b) => a - b).map((q) => {
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

/* THE BOARD A STRANGER IS SHOWN (his instruction, 10 Sep 2026), pinned to one tier.
 *
 * A guest has no history and no account, so there is no "his rate" to draw toward: what he gets is
 * the board itself, which is already defined as the one price the desk quotes to a stranger. So
 * this prices NOTHING of its own. It reads the same ladderRow the desk's board and the phone read,
 * and takes one row off it. Row order is load bearing elsewhere -- [0] is Tier 2 and the whole desk
 * reads it -- so the row is chosen BY CODE here rather than by index, and the index is never
 * assumed.
 *
 * A ONE-TIER BOOK HAS NO TIER 1, and oil is one (LADDER_BY.oil says tier1:null). Asking for tier 1
 * on such a product is not an error and not an omission: it has one price and that price is shown,
 * with `asked` recording that the tier fell back, so the page can say so rather than imply oil is
 * being discounted.
 */
export function boardList(tier, book, pricing, now) {
  const want = "T" + (tier === 1 ? 1 : 2);
  const week = weekOf(now);
  const products = book.PROD_ORDER || Object.keys(book.PRODUCTS || { salt: 1 });
  const out = { at: new Date(now || Date.now()).toISOString(), week, tier: tier === 1 ? 1 : 2, products: [] };
  for (const p of products) {
    const snap = pricing && pricing.byProduct && pricing.byProduct[p];
    const inputs = snap && snap.inputs;
    if (!inputs || !inputs.cost || !inputs.policy) continue;    // a product the desk cannot price is left off
    const C = PRICING_ENGINE.costStack(inputs.cost), P = inputs.policy;
    const sizesHere = (Array.isArray(P.boardSizes) && P.boardSizes.length) ? P.boardSizes
      : ((Array.isArray(snap.sizes) && snap.sizes.length) ? snap.sizes : ((pricing && pricing.sizes) || []));
    const sizes = sizesHere.slice().sort((a, b) => a - b);
    /* A ROW IS ONLY THE TIER IF IT CARRIES PRICES (10 Sep 2026). ladderRow offers the Tier 1 row on
       a bare `if(P.tier1)` while every other path in the engine gates on tier1Anchors, which wants
       two usable ends. So a book with ONE stated end, or two keys naming the same size, yields a row
       named "Tier 1" whose every price is null or NaN. Taking it on its name would hand a stranger a
       product with an empty table and no explanation. The same two lines also cover the honest
       one-tier case, oil's, so there is one rule here rather than two. */
    const usable = (r) => r && Array.isArray(r.prices)
      && r.prices.some((x) => x != null && Number.isFinite(+x));
    const rows = PRICING_ENGINE.ladderRow(sizes, C, P);
    const asked = rows.find((r) => r.code === want);
    const row = usable(asked) ? asked : rows.find(usable);
    if (!row) continue;                        // nothing on this product is priceable; leave it off
    out.products.push({
      product: p,
      name: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      basis: "board",
      tier: row.code === "T1" ? 1 : 2,
      tierName: row.name,
      /* true when this product could not be shown at the tier asked for, because it has only one */
      fellBack: row.code !== want,
      sizes: sizes.map((q, i) => ({ q, price: Number.isFinite(+row.prices[i]) ? +(+row.prices[i]).toFixed(2) : null }))
        .filter((r) => r.price != null)
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
