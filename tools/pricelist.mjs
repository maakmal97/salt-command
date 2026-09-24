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
import { createHmac } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import PRICING_ENGINE from "../engine/pricing.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { MON3 } from "../stmt/page.js";

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
  const say = (d) => String(d.getDate()).padStart(2, "0") + " " + MON3[d.getMonth()];   /* Sep, never en-GB's Sept */
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
    .map((s) => (s.total) / s.qty);
  if (!rows.length) return { rate: null, orders: 0 };
  return { rate: +Math.max.apply(null, rows).toFixed(2), orders: rows.length };
}


/** The list: one block per product, every board size, one price each. */
/** The month a customer's first priced order falls in, for the greeting on their own page. Sealed
 *  with the rest of their list, so it reaches them and nobody else. Null before their first order. */
export function since(sales, code) {
  let first = null;
  for (const s of sales || []) {
    if (!POSITION_ENGINE.ownsCode(code, s.customer)) continue;
    if (!pricedOrder(s) || !s.date || !(s.total > 0) || !(s.qty > 0)) continue;
    if (first == null || String(s.date) < first) first = String(s.date);
  }
  return first;
}

export function priceList(code, book, pricing, now) {
  const week = weekOf(now);
  const sizes = (pricing && pricing.sizes) || [];
  const products = book.PROD_ORDER || Object.keys(book.PRODUCTS || { salt: 1 });
  const out = { at: new Date(now || Date.now()).toISOString(), week, since: since(book.sales, code), products: [], soon: [] };
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
    /* v651: the customer's tier for this product, held or proposed, priced off the ladder the desk carried into the snapshot.
       v670: what is held may be a band set, a level for small, mid and big orders, so each size reads its own level through
       the engine's levelAt, on the band cuts the desk carried in the snapshot. One level still reads the same at every size. */
    const name = (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p;
    const names = pricing.tierNames || [];
    const held = ((pricing.tierOf || {})[code] || {})[p];
    const bandCuts = pricing.profileRule || { smallUpTo: 1, bigFrom: 3 };
    /* their NORMAL level is the one a mid-sized order takes, halfway between the two cuts; it answers "is this priced at all"
       and it is the mark the page draws, a band set's small and big levels being departures from it */
    const midQ = (bandCuts.smallUpTo + bandCuts.bigFrom) / 2;
    /* 19 SEP 2026: A STATED BOARD HAS NO TIER AND IS PRICED FOR EVERYBODY. The gate below is the
       "no tier, no price" rule, which is right where a level decides the price and wrong where he has
       typed one price for all: it would have told thirty of thirty-six customers their oil price was
       still coming. A fixed ladder says so on its own rows, so the signal travels with the data
       rather than being looked up a second time here. */
    const fixedBoard = (snap.ladder || []).some((r) => r && r.fixed);
    const t = fixedBoard ? 0 : names.indexOf(PRICING_ENGINE.levelAt(held, midQ, bandCuts));
    if (t < 0) { out.soon.push({ product: p, name }); continue; }
    const rows = sizesHere.slice().sort((a, b) => a - b).map((q) => {
      const rung = snap.ladder.find((r) => Math.abs(r.q - q) < 0.009);
      /* a size the ladder does not carry is not priced rather than crashing: it happened the day oil
         lost its 80 and 100 rungs while the printed size list still named them */
      if (!rung || !rung.prices || !rung.prices.length) return null;
      if (fixedBoard) {
        const board = rung.prices[rung.prices.length - 1];
        return { q, price: +PRICING_ENGINE.cardPrice(null, PRICING_ENGINE.floorTotal(q, C, P), board, true).toFixed(2) };
      }
      const tq = names.indexOf(PRICING_ENGINE.levelAt(held, q, bandCuts));
      const price = PRICING_ENGINE.cardPrice(own.rate != null ? own.rate * q : null, PRICING_ENGINE.floorTotal(q, C, P), rung.prices[tq]);
      /* a level the board has no column for is a size NOT PRICED, which is what the caller already
         knows how to show; it was a TypeError until 19 Sep, and the crash was the only way to find out */
      if (price == null || !isFinite(price)) return null;
      return { q, price: +price.toFixed(2) };
    }).filter(Boolean);
    /* 24 Sep 2026: A PRODUCT WITH NO PRICED SIZE IS COMING SOON, never a product with an empty list. Every size
       dropping out above (a level the board has no column for) pushed sizes: [], and the page reads the first size
       to set up the order form, so the Order tab went blank, orders and Notifications with it. */
    if (!rows.length) { out.soon.push({ product: p, name }); continue; }
    out.products.push({
      product: p,
      name,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      /* 23 Sep 2026: a stated board is the same for everybody, so it is neither their rate nor a level; it carries no
         level, so the page draws no mark (it drew Ambassador's beside oil for every customer from 19 Sep) */
      basis: fixedBoard ? "board" : (own.rate != null ? "yours" : "tier"),
      /* the page draws ONE mark a product, so `tier` is their normal level, a band set's mid; the set itself travels as
         `levels` for whatever later reads it, and the page still never names either */
      tier: fixedBoard ? null : names[t],
      levels: (!fixedBoard && held && typeof held === "object") ? held : null,
      rate: own.rate, orders: own.orders, sizes: rows
    });
  }
  return out;
}

/* S4 4.1: THE LIST'S STAMP IS A DIGEST OF ITS FIGURES, each product's sizes and prices, and never its `at`: the
   hourly publish re-strikes every list, so a stamp that moved with the clock would refuse every order placed across
   the hour. It is sealed inside the list and written in the clear beside it, and the Worker compares the two at
   Place (4.2) without reading a price. KEYED, under STMT_KEY and over the username: a bare hash in the clear would
   let a copy of the store test a guessed board against it, and would show which accounts share one. */
export function priceDigest(list, secret, username) {
  const figures = ((list && list.products) || []).map((p) => [p.product, (p.sizes || []).map((r) => [r.q, r.price])]);
  return createHmac("sha256", String(secret)).update("prices\n" + username + "\n" + JSON.stringify(figures)).digest("hex");
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
    /* v785: A BOOK WITH NO COST HAS NO BOARD. A book opened empty (v780) has inputs and a policy and
       no lot, so its cost stack is 0 and the fallback row below prices every size at 0, which is
       finite and so passed `usable`: candy, rice and spare went out on all five guest boards at RM 0
       at twelve sizes each from the v780 publish until this. The test is the engine's own basis and
       not the prices, because a laddered book with no lot would price at 10, 20, 30, each level a
       ten over the one below, and clear any test on the prices. */
    if (!(PRICING_ENGINE.ladderCogs(1, C) > 0)) continue;
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
      /* v787: A LEVEL'S NAME NEVER TRAVELS ON A BOOK OF A GUEST BOARD (his instruction, 22 Sep 2026).
         `tierName: row.name` sat here, null on a row pinned to the link's level and the fallback row's
         own name otherwise, so oil's pane read "Bronze" on every level's board, Titanium's included.
         The rule is for every book, not oil's: a stranger is handed prices, and what a level is called
         is the desk's. The standing link's own level stays on the BOARD as `tierName`, for his listing. */
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

/* ============ v696, HIS RULE: FIVE LINKS, ONE PER TIER ============
 *
 * "For the guest links, produce exactly 5 links, for the five tier pricing." A standing link is a
 * LEVEL of the ladder and nothing else: no introducer, nothing to follow, the same board every time
 * it is opened until the board itself moves. The level is the index into the book's own tier names,
 * so 1 is the first tier and the last is the one a stranger is quoted anyway.
 *
 * It is boardList with the level pinned, rather than a second way of reading the ladder: one
 * definition of what a board is, which is the same reason guestBoard below is a pick and not a
 * copy. A product with fewer levels than asked for falls back exactly as it does there.
 */
export function tierBoard(level, book, pricing, now) {
  /* `+level || 5` sent level 0 to the last rather than the first, because 0 is falsy: the floor
     would have been served as the ask. Read the number, then decide. */
  const n = Number(level);
  const names = (pricing && pricing.tierNames) || [];
  /* the last level is the book's own count, four tiers since 23 Sep 2026; five where no names travel */
  const top = names.length > 1 ? names.length - 1 : 5;
  const k = Number.isFinite(n) ? Math.max(1, Math.min(top, Math.round(n))) : top;
  const out = boardList(2, book, pricing, now, (p, last) => Math.min(k, last));
  out.standing = true;
  out.level = k;
  out.tierName = names[k] || null;
  return out;
}

/* ============ v658, HIS RULE: A GUEST BOARD FOLLOWS THE INTRODUCER ============
 *
 * A link is handed out BY somebody: the introducer is a customer of his, named by their username,
 * and the stranger they bring is quoted TWO LEVELS ABOVE them where there is room, else one, capped
 * at the last. Above means a higher price, because the introducer's own level is earned and a stranger has
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
  /* v671: the introducer may hold, or be proposed, a band set; their NORMAL level is a mid-sized order's, and the link is
     cut two levels above that */
  const cuts = (pricing && pricing.profileRule) || { smallUpTo: 1, bigFrom: 3 };
  const pick = (product, last) => {
    const t = names.indexOf(PRICING_ENGINE.levelAt(held[product], (cuts.smallUpTo + cuts.bigFrom) / 2, cuts));
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
