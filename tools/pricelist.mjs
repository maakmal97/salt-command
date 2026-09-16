#!/usr/bin/env node
/* tools/pricelist.mjs: A CUSTOMER'S OWN PRICE LIST, for the week, from his own history.
 *
 * His instruction of 06 Sep 2026: after the username and the password, a customer can also find
 * a price list based on his historical purchase price, changing weekly. This is the whole of
 * that rule, stated once so the page, the deploy and the suite cannot disagree about it.
 *
 * THE TIER IS A CEILING (his decisions of 15 Sep 2026, v651). A customer is quoted the price of their
 * own tier for each product, held on the book or, until he sets one, proposed from what they pay for
 * it; and where they have bought before, never more than their own rate: the BEST unit rate of their
 * last four committed orders of that product, to the nearest five (his decision of 16 Sep 2026; it was
 * the median until then). Four, not all: a price moved to in July should be the price seen in September,
 * and the window is what keeps one old high day from setting a card for good. A tier and no history, and
 * the tier's price stands. NO TIER FOR A
 * PRODUCT, HELD OR PROPOSED, AND IT IS NOT PRICED: it goes on the list as coming soon, and the page
 * offers no order for it. The rule is the engine's cardPrice, the one the desk's printed board quotes too.
 *
 * THE FLOOR STILL HOLDS. A quoted total is never below what the engine says that size costs him
 * to sell; so a customer whose old rate has fallen under a risen floor is lifted to the floor
 * rather than quoted a loss. Nothing here prices: floorTotal, cardPrice and the cost stack are the
 * engine's, fed the same PRICING inputs the desk and the drafter read, and the tier's prices are the
 * ladder the desk carried into those inputs.
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

/** The customer's own rate on a product: the best of his last four committed orders before `before` (v655). */
export function ownRate(sales, code, product, before) {
  const rows = (sales || [])
    /* v609: the bucket is the associate's own, so what they bought for resale is a price they paid too */
    .filter((s) => POSITION_ENGINE.ownsCode(code, s.customer) && prodOf(s) === product && pricedOrder(s) && s.date && s.date < before
      && isNum(s.total) && s.total > 0 && isNum(s.qty) && s.qty > 0)
    /* v502: the rate a customer paid is on the goods, the delivery charge inside the total taken out */
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(-HISTORY_ORDERS)
    .map((s) => (s.total - (isNum(s.delivery) ? s.delivery : 0)) / s.qty);
  if (!rows.length) return { rate: null, orders: 0 };
  return { rate: +Math.max.apply(null, rows).toFixed(2), orders: rows.length };
}


/** The list: one block per product, every board size, one price each. */
export function priceList(code, book, pricing, now) {
  const week = weekOf(now);
  const sizes = (pricing && pricing.sizes) || [];
  const products = book.PROD_ORDER || Object.keys(book.PRODUCTS || { salt: 1 });
  const out = { at: new Date(now || Date.now()).toISOString(), week, products: [], soon: [] };
  for (const p of products) {
    const snap = pricing && pricing.byProduct && pricing.byProduct[p];
    const inputs = snap && snap.inputs;
    if (!inputs || !inputs.cost || !inputs.policy) continue;      // a product the desk cannot price is left off
    const C = PRICING_ENGINE.costStack(inputs.cost), P = inputs.policy;
    const own = ownRate(book.sales, code, p, week.monday);
    /* 08 Sep 2026: THIS BOOK'S SIZES. `pricing.sizes` is the one global grid, salt's 0.5 to 12.5,
       and every customer's oil list was drawn on it: sizes the desk never sells, and none it does.
       The board's own sizes travel in the policy; the snapshot carries them too since today. */
    const sizesHere = (Array.isArray(P.boardSizes) && P.boardSizes.length) ? P.boardSizes
      : ((Array.isArray(snap.sizes) && snap.sizes.length) ? snap.sizes : sizes);
    /* v651: the customer's tier for this product, held or proposed, priced off the ladder the desk carried into the snapshot */
    const name = (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p;
    const t = (pricing.tierNames || []).indexOf(((pricing.tierOf || {})[code] || {})[p]);
    if (t < 0) { out.soon.push({ product: p, name }); continue; }
    const rows = sizesHere.slice().sort((a, b) => a - b).map((q) => {
      const rung = snap.ladder.find((r) => Math.abs(r.q - q) < 0.009);
      const price = PRICING_ENGINE.cardPrice(own.rate != null ? own.rate * q : null, PRICING_ENGINE.floorTotal(q, C, P), rung.prices[t]);
      return { q, price: +price.toFixed(2) };
    });
    out.products.push({
      product: p,
      name,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      basis: own.rate != null ? "yours" : "tier",
      tier: pricing.tierNames[t],
      rate: own.rate, orders: own.orders, sizes: rows
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
export function boardList(tier, book, pricing, now, pick) {
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
    /* ============ v656: A GUEST LINK IS A LEVEL OF THE LADDER ============
       The board is the ladder, so both codes would otherwise resolve to the one row and the two links
       would serve the same prices under two names. They are mapped onto the ladder instead, and the
       mapping is the one the codes already meant: tier 2 is the ask, which is the last level, the one
       a new customer starts at; tier 1 was the cheaper trade board, which is now the FIRST of the five,
       Titanium. A book with no ladder still falls back to ladderRow and still reports `fellBack`. */
    const rule = (P.tierRule && Array.isArray(P.tierRule.multiples)) ? P.tierRule : null;
    let row = null, level = null;
    if (rule) {
      const grid = PRICING_ENGINE.fiveTiers(sizes, C, P);
      const last = rule.multiples.length;                     // 0 is Ambassador, the floor; never a guest's
      const k = pick ? pick(p, last) : (tier === 1 ? 1 : last);
      if (grid && grid.length) { level = k; row = { code: want, name: null, prices: grid.map((g) => g.prices[k]) }; }
    }
    if (!usable(row)) {
      const rows = PRICING_ENGINE.ladderRow(sizes, C, P);
      const asked = rows.find((r) => r.code === want);
      row = usable(asked) ? asked : rows.find(usable);
    }
    if (!usable(row)) continue;                // nothing on this product is priceable; leave it off
    out.products.push({
      product: p,
      name: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      basis: "board",
      tier: row.code === "T1" ? 1 : 2,
      tierName: row.name,
      /* true when this product could not be shown at the tier asked for, because it has only one */
      fellBack: row.code !== want,
      /* v658: which level of the ladder this product was priced at, for the desk's own listing */
      level,
      sizes: sizes.map((q, i) => ({ q, price: Number.isFinite(+row.prices[i]) ? +(+row.prices[i]).toFixed(2) : null }))
        .filter((r) => r.price != null)
    });
  }
  return out;
}

/* ============ v658, HIS RULE: A GUEST BOARD FOLLOWS THE INTRODUCER ============
 *
 * A link is handed out BY somebody: the introducer is a customer of his, named by their username,
 * and the stranger they bring is quoted TWO LEVELS ABOVE them where there is room, else one, capped
 * at the last. Above means dearer, because the introducer's own level is earned and a stranger has
 * earned nothing; the cap means the worst a guest can do is the board every stranger already sees.
 *
 * THE LEVEL IS PER PRODUCT, like every tier since v646: an introducer on Titanium for salt and with
 * no oil history hands out Gold on salt and the board on oil. A product the introducer holds no tier
 * on has no anchor, so it falls to the last level, which is what a stranger is quoted anyway.
 *
 * IT FOLLOWS: nothing is frozen into the link. The board is written on every publish from the
 * introducer's level AT THAT MOMENT, so when he moves a customer up, every link they introduced
 * moves with them on the next deploy.
 */
export function guestBoard(code, book, pricing, now) {
  const names = (pricing && pricing.tierNames) || [];
  /* tierOf is keyed by CODE; the link stores the introducer as a USERNAME and the publish resolves it */
  const held = ((pricing && pricing.tierOf) || {})[code] || {};
  const pick = (product, last) => {
    const t = names.indexOf(held[product]);
    return t < 0 ? last : Math.min(t + 2, last);
  };
  const out = boardList(2, book, pricing, now, pick);
  out.introducer = code;
  out.levels = {};
  for (const p of out.products) out.levels[p.product] = names[p.level] || null;
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
    console.log("\n" + p.name + " at " + p.tier + ": " + (p.basis === "yours" ? "never above your rate RM " + p.rate + "/" + p.unit + " over " + p.orders + " order(s)" : "the tier's prices; no history")
      );
    for (const r of p.sizes) console.log("  " + String(r.q).padStart(5) + " " + p.unit + "  RM " + r.price);
  }
  for (const p of list.soon) console.log("\n" + p.name + ": no tier, so the price is coming soon");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
