#!/usr/bin/env node
/* tools/pricelist.mjs: A CUSTOMER'S OWN PRICE LIST.
 *
 * His instruction of 06 Sep 2026: after the username and the password, a customer can also find
 * a price list. This is the whole of that rule, stated once so the page, the deploy and the suite
 * cannot disagree about it.
 *
 * A CARD IS ITS TIER (his decisions of 15 Sep 2026, v651, and of 27 Sep 2026). A customer is quoted the
 * price of their own tier for each product, held on the book or, until he sets one, proposed from what
 * they pay for it. From v651 to 27 Sep 2026 the tier was only a ceiling: where they had bought before,
 * the card was never more than the best unit rate of their last four orders read before the week's
 * Monday. HE RETIRED THAT CAP ON 27 SEP 2026, so what they paid before no longer lowers a card, and the
 * list has nothing weekly left in it. NO TIER FOR A PRODUCT, HELD OR PROPOSED, AND IT IS NOT PRICED: it
 * goes on the list as coming soon, and the page offers no order for it. The rule is the engine's
 * cardPrice, the one the desk's printed board quotes too.
 *
 * THE FLOOR STILL HOLDS. A quoted total is never below what the engine says that size costs him
 * to sell, so a tier under a risen floor is lifted to the floor rather than quoted a loss. Nothing
 * here prices: floorTotal, cardPrice and the cost stack are the engine's, fed the same PRICING inputs
 * the desk and the drafter read, and the tier's prices are the ladder the desk carried into those
 * inputs. The list is written at every publish, hourly, so it follows the ladder and the floor as
 * they stand then; `week` stays on it as a stamp, which an order carries.
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

/** The customer's own rate on a product: the best of his last four committed orders before `before` (v655). It prices
 *  nothing since the cap was retired on 27 Sep 2026; it is kept as the reading the desk's pbOwnRate makes for a tier
 *  proposal, which the suite holds equal to it. */
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

/* F4: THE LIGHT A BOOK SHOWS, red, yellow or green, from tools/book.mjs supplySnapshot's two figures and the restock date he
   set (KV `expected`); the engine's restockSupply says the colour and drops a day already past. {<book>: {light, by}} */
export function supplyLights(raw, expected, today) {
  const out = {};
  for (const [p, v] of Object.entries(raw || {}))
    out[p] = POSITION_ENGINE.restockSupply(v.shelf, v.commit, expected && expected[p], today);
  return out;
}

export function priceList(code, book, pricing, now, supply) {
  const week = weekOf(now);
  const sizes = (pricing && pricing.sizes) || [];
  const products = book.PROD_ORDER || Object.keys(book.PRODUCTS || { salt: 1 });
  const out = { at: new Date(now || Date.now()).toISOString(), week, since: since(book.sales, code), products: [], soon: [] };
  for (const p of products) {
    const snap = pricing && pricing.byProduct && pricing.byProduct[p];
    const inputs = snap && snap.inputs;
    if (!inputs || !inputs.cost || !inputs.policy) continue;      // a product the desk cannot price is left off
    const C = PRICING_ENGINE.costStack(inputs.cost), P = inputs.policy;
    /* 08 Sep 2026: THIS BOOK'S SIZES. `pricing.sizes` is the one global grid, salt's 0.5 to 12.5,
       and every customer's oil list was drawn on it: sizes the desk never sells, and none it does.
       The board's own sizes travel in the policy; the snapshot carries them too since today. */
    const sizesHere = (Array.isArray(P.boardSizes) && P.boardSizes.length) ? P.boardSizes
      : ((Array.isArray(snap.sizes) && snap.sizes.length) ? snap.sizes : sizes);
    const name = (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p;
    /* 19 SEP 2026: A STATED BOARD HAS NO TIER AND IS PRICED FOR EVERYBODY. The gate below is the
       "no tier, no price" rule, which is right where a level decides the price and wrong where he has
       typed one price for all: it would have told thirty of thirty-six customers their oil price was
       still coming. A fixed ladder says so on its own rows, so the signal travels with the data
       rather than being looked up a second time here. */
    const fixedBoard = (snap.ladder || []).some((r) => r && r.fixed);
    const partner = (snap.partners || []).includes(code);   // 06 Oct 2026, his decision: a partner pays cost on every book
    /* 05 OCT 2026, HIS DECISION: A DRIFT BOOK (salt's Set Price and drift) IS PRICED FROM THE DESK'S OWN CARDS, the snapshot's
       cardQuote for this customer at every size the board shows, which already carries their drift, the walk and the floor.
       Nothing is worked out here, and no level travels: the list says card. A customer with no card on it is coming soon. */
    if ((snap.ladder || []).some((r) => r && r.drift)) {
      const mine = (snap.cards && snap.cards[code]) || [];
      const rowsD = sizesHere.slice().sort((a, b) => a - b).map((q) => { const hit = mine.find((x) => Math.abs(x[0] - q) < 0.009);
        return hit && isFinite(hit[1]) && hit[1] > 0 ? { q, price: +(+hit[1]).toFixed(2) } : null; }).filter(Boolean);
      if (!rowsD.length) { out.soon.push({ product: p, name }); continue; }
      /* 05 Oct 2026 (any quantity at an automatic price): AND THE GRID, the engine's quoteGrid at their drift, every point from
         the book's min to its max, so the page quotes any quantity off the list and works nothing out. A snapshot carrying no
         drift for them (one taken before this) sends the board alone. No cost and no drift parameter travels, only prices. */
      const dr = snap.lift && Object.prototype.hasOwnProperty.call(snap.lift, code) ? snap.lift[code] : null;
      const gridD = typeof dr === "number" || dr === "partner" ? PRICING_ENGINE.quoteGrid(C, P, dr) : null;
      out.products.push(Object.assign({ product: p, name, unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
        basis: "card", sizes: rowsD }, gridD ? { grid: gridD } : {},
        (supply && supply[p]) ? { supply: { light: supply[p].light, by: supply[p].by || null } } : {}));
      continue;
    }
    /* 18 Oct 2026: the five levels are gone, so a book with neither a Set Price nor a stated board is not priced */
    if (!fixedBoard) { out.soon.push({ product: p, name }); continue; }
    /* 22 Oct 2026, HIS DECISION: THEIR % ON EVERY BOOK. A customer holding a % other than nought on a stated board is quoted his board moved by
       it, the engine's quoteAt over the same walk the grid takes, and the list says card; at nought it is the board, the same for everybody. */
    const liftF = snap.lift && Object.prototype.hasOwnProperty.call(snap.lift, code) ? snap.lift[code] : null;
    const heldF = !partner && typeof liftF === "number" && Math.abs(liftF) > 1e-9 && PRICING_ENGINE.pctBook(P.tierRule) ? liftF : 0;
    const rows = sizesHere.slice().sort((a, b) => a - b).map((q) => {
      const rung = snap.ladder.find((r) => Math.abs(r.q - q) < 0.009);
      /* a size the ladder does not carry is not priced rather than crashing: it happened the day oil
         lost its 80 and 100 rungs while the printed size list still named them */
      if (!rung || !rung.prices || !rung.prices.length) return null;
      if (partner) return { q, price: PRICING_ENGINE.quoteAt(q, C, P, "partner") };
      if (heldF) return { q, price: PRICING_ENGINE.quoteAt(q, C, P, heldF) };   // 22 Oct 2026: their % on his board
      const board = rung.prices[rung.prices.length - 1];
      return { q, price: +PRICING_ENGINE.cardPrice(null, PRICING_ENGINE.floorTotal(q, C, P), board, true).toFixed(2) };
    }).filter(Boolean);
    /* 24 Sep 2026: A PRODUCT WITH NO PRICED SIZE IS COMING SOON, never a product with an empty list. Every size
       dropping out above (a level the board has no column for) pushed sizes: [], and the page reads the first size
       to set up the order form, so the Order tab went blank, orders and Notifications with it. */
    if (!rows.length) { out.soon.push({ product: p, name }); continue; }
    /* 05 Oct 2026: a stated board's grid, the same for everybody, the engine's quoteGrid; a level-priced book has none */
    const gridF = PRICING_ENGINE.quoteGrid(C, P, partner ? "partner" : heldF);
    out.products.push(Object.assign({
      product: p,
      name,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      /* a stated board is the same for everybody, so it is neither their rate nor a level (27 Sep 2026: "yours" went with the cap) */
      basis: heldF ? "card" : "board",
      sizes: rows
    }, gridF ? { grid: gridF } : {}, (supply && supply[p]) ? { supply: { light: supply[p].light, by: supply[p].by || null } } : {}));
  }
  return out;
}

/* S4 4.1: THE LIST'S STAMP IS A DIGEST OF ITS FIGURES, each product's sizes and prices, and never its `at`: the
   hourly publish re-strikes every list, so a stamp that moved with the clock would refuse every order placed across
   the hour. It is sealed inside the list and written in the clear beside it, and the Worker compares the two at
   Place (4.2) without reading a price. KEYED, under STMT_KEY and over the username: a bare hash in the clear would
   let a copy of the store test a guessed board against it, and would show which accounts share one. */
/* V3's cap left the stamp with the cap (V5b2, 29 Sep 2026), so a list that carried one re-quotes once. */
/* 05 Oct 2026 (any quantity at an automatic price): THE STAMP COVERS THE GRID, every point's price and its min, step and max,
   so an order at any quantity is checked at Place exactly as one at a board size is, and a moved grid re-quotes (409). */
export function priceDigest(list, secret, username) {
  const figures = ((list && list.products) || []).map((p) => [p.product, (p.sizes || []).map((r) => [r.q, r.price]),
    p.grid ? (p.grid.multiples ? [p.grid.min, p.grid.step, p.grid.max, p.grid.p, p.grid.multiples] : [p.grid.min, p.grid.step, p.grid.max, p.grid.p]) : null]);
  return createHmac("sha256", String(secret)).update("prices\n" + username + "\n" + JSON.stringify(figures)).digest("hex");
}
/* THE STEPS IN THE CLEAR, beside the stamp: each product's {min, step, max}, no price, so the Counter's Worker refuses a
   quantity off the step or over the max (stmt/orders.js checkPlacement) without reading the sealed list. */
export function priceSteps(list) {
  const out = {};
  for (const p of (list && list.products) || []) if (p.grid) out[p.product] = p.grid.multiples ? { min: p.grid.min, step: p.grid.step, max: p.grid.max, multiples: p.grid.multiples } : { min: p.grid.min, step: p.grid.step, max: p.grid.max };
  return out;
}

/* THE BOARD A STRANGER IS SHOWN (his instruction, 10 Sep 2026; 18 Oct 2026: ONE BOARD, THE SET PRICE).
 *
 * A guest has no history and no account, so there is no "his rate" to draw toward: what he gets is what the desk quotes a
 * stranger, the engine's quoteAt at a lift of nought: salt's Set Price, and a stated board's own price for oil, candy and rice.
 * The five levels are gone, so every guest link opens this one board, whoever handed it out. This prices NOTHING of its own;
 * a size the engine does not price is left off, and a book with no cost has no board (a book opened empty would be priced at 0).
 */
export function guestBoard(book, pricing, now) {
  const week = weekOf(now);
  const products = book.PROD_ORDER || Object.keys(book.PRODUCTS || { salt: 1 });
  const out = { at: new Date(now || Date.now()).toISOString(), week, products: [] };
  for (const p of products) {
    const snap = pricing && pricing.byProduct && pricing.byProduct[p];
    const inputs = snap && snap.inputs;
    if (!inputs || !inputs.cost || !inputs.policy) continue;    // a product the desk cannot price is left off
    const C = PRICING_ENGINE.costStack(inputs.cost), P = inputs.policy;
    if (!(PRICING_ENGINE.ladderCogs(1, C) > 0)) continue;
    const sizesHere = (Array.isArray(P.boardSizes) && P.boardSizes.length) ? P.boardSizes
      : ((Array.isArray(snap.sizes) && snap.sizes.length) ? snap.sizes : ((pricing && pricing.sizes) || []));
    const sizes = sizesHere.slice().sort((a, b) => a - b)
      .map((q) => ({ q, price: PRICING_ENGINE.quoteAt(q, C, P, 0) }))
      .filter((r) => isNum(r.price) && r.price > 0);
    if (!sizes.length) continue;
    out.products.push({
      product: p,
      name: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].name) || p,
      unit: (book.PRODUCTS && book.PRODUCTS[p] && book.PRODUCTS[p].unit) || "unit",
      basis: "board",
      sizes
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
  console.log(code + ", as at " + list.at);
  for (const p of list.products) {
    console.log("\n" + p.name + (p.basis === "board" ? ": the stated board, the same for everybody" : ": their own price"));
    for (const r of p.sizes) console.log("  " + String(r.q).padStart(5) + " " + p.unit + "  RM " + r.price);
  }
  for (const p of list.soon) console.log("\n" + p.name + ": no price yet, so it is coming soon");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
}
