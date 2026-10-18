/* test/maker-trade-reading.mjs: B1 of #62, THE COUNTER'S TRADE FORM READS COST AND MARGIN BEFORE SEND (13 Oct 2026).
 *
 * The Workbench shows cost, margin, the floor and the party's history before Record; the Counter showed them only after drafting.
 * The reading is one route (/all/maker/trade-reading, behind the owner's verified identity and the keyed bridge) over the engine's own
 * functions. These checks hold it to the Workbench's figures for the same entry, the refusal-style line under the floor, no margin on
 * a purchase, canonical history only, and the route's two locks. Invented codes and figures throughout. */
import { readBook, pricingSnapshot } from "../tools/book.mjs";
import { makerTradeReading } from "../src/maker-inputs.js";
import { cogsFor } from "../src/drafter.js";
import worker from "../src/worker.js";
import { world, ownerTrade } from "./maker-trades.mjs";

const sale = (id, total, date, more = {}) => ({ rid: id, customer: "CX1-ZED", date, qty: 1, total, cash: total, cost: 40,
  deliveredQty: 1, deliveredOn: date, ...more });
const HISTORY = [sale("h1", 130, "2099-08-01"), sale("h2", 140, "2099-08-15"), sale("h3", 150, "2099-09-01")];
const LOT = { rid: "pA", supplier: "SX1-ZED", date: "2099-09-01", receivedOn: "2099-09-01", receivedQty: 100, qty: 100, total: 4000,
  freight: 200, cash: 4000, handover: "collected", status: "paid", product: "salt" };

/* the Workbench's own pre-record reading of an entry: what its coach and preview print, read off the real master */
function desk(w, qty, total) {
  w.eval("wbCashTouched=true;(function(){var s=function(id,v){var e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};"
    + "s('wbPartyTxt','CX1-ZED');s('wbDate','2099-10-05');s('wbQty','" + qty + "');s('wbTotal','" + total + "');})()");
  const prev = w.eval("document.getElementById('wbPrev').textContent"), msgs = w.eval("document.getElementById('wbMsgs').textContent");
  const m = /margin (-?[0-9]+)% on RM ([0-9.]+)/.exec(prev);
  return { pct: m ? Number(m[1]) : null, repl: w.eval("replCost()"), floor: w.eval("floorTotal(" + qty + ")"),
    median: w.eval("median(custPrices('CX1-ZED'))"), under: /under the floor for|it costs to replace/.test(msgs) };
}

/* the Counter's world with this fixture's lot, history and pricing in the mirror (the screenshot script reads it too) */
export function readingWorld(pricing) {
  const wd = world();
  const put = (collection, seq, doc) => wd.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES (?,?,'fixture',?)").run(collection, seq, JSON.stringify(doc));
  HISTORY.forEach((row, i) => put("sales", i, row)); put("purchases", 0, LOT);
  wd.sqlite.prepare("UPDATE state SET doc=? WHERE key='PRICING'").run(JSON.stringify(pricing));
  wd.sqlite.prepare("UPDATE snapshot SET v=? WHERE one=1").run(pricing.v);
  return wd;
}

export async function fixturePricing() {
  const source = await readBook(), w = source.w;
  try {
    w.eval(`sales.splice(0,sales.length,...${JSON.stringify(HISTORY)});BASE_SALES.splice(0,BASE_SALES.length,...${JSON.stringify(HISTORY)});
      purchases.splice(0,purchases.length,${JSON.stringify(LOT)});BASE_PURCHASES.splice(0,BASE_PURCHASES.length,${JSON.stringify(LOT)});
      roster.splice(0,roster.length,'CX1-ZED');associates.splice(0,associates.length);INTRODUCTIONS.length=0;PROD='salt';recompute();`);
    const pricing = pricingSnapshot(w); pricing.v = "trade-fixture"; return pricing;
  } finally { w.close(); }
}

export async function run({ ok, pageWork }) {
  const source = await readBook(), w = source.w;
  let pricing, deskReads;
  try {
    w.eval(`sales.splice(0,sales.length,...${JSON.stringify(HISTORY)});BASE_SALES.splice(0,BASE_SALES.length,...${JSON.stringify(HISTORY)});
      purchases.splice(0,purchases.length,${JSON.stringify(LOT)});BASE_PURCHASES.splice(0,BASE_PURCHASES.length,${JSON.stringify(LOT)});
      roster.splice(0,roster.length,'CX1-ZED');associates.splice(0,associates.length);INTRODUCTIONS.length=0;PROD='salt';recompute();`);
    pricing = pricingSnapshot(w);
  } finally { w.close(); }
  const book = { version: "reading-fixture", sales: HISTORY, purchases: [LOT], pricing,
    state: { PRODUCTS: { salt: {}, oil: {} }, roster: ["CX1-ZED", "SX1-ZED"] } };
  pricing.v = book.version;
  const read = (patch) => makerTradeReading({ direction: "sale", product: "salt", party: "CX1-ZED", qty: 1, total: 130, ...patch }, book);

  const good = read(), low = read({ qty: 3, total: 100 });
  ok(good.margin.rm === 88 && good.goods === 130 && good.floor.under === false && good.floor.warn === null
    && low.margin.rm === -26 && low.floor.under === true && low.floor.short === 30
    && /RM 100 for the goods is RM 30 under the floor of RM 130/.test(low.floor.warn),
  "trade reading: margin in RM over cost, and a refusal-style line when the goods are under the floor " + JSON.stringify({ good: good.margin, low: low.floor }));

  const buy = makerTradeReading({ direction: "purchase", product: "salt", qty: 100, total: 4400, freight: 200 }, book);
  ok(buy.purchase?.perUnit === 46 && buy.purchase.versusCogs === 4 && buy.cogs.rate === 42
    && !("margin" in buy) && !("floor" in buy) && !("history" in buy),
  "trade reading: a purchase shows its cost a unit against the current cost and carries no margin, floor or history " + JSON.stringify(buy));

  const muddied = { ...book, sales: HISTORY.concat([
    { rid: "pend", customer: "CX1-ZED", date: "2099-09-20", qty: 1, total: 10, cash: 0, cost: 40 },
    sale("gift", 5, "2099-09-25", { goodwill: true }),
    sale("other", 999, "2099-09-26", { customer: "SX1-ZED" })]) };
  const hist = makerTradeReading({ direction: "sale", product: "salt", party: "CX1-ZED", qty: 1, total: 130 }, muddied).history;
  ok(hist.count === 3 && hist.low === 130 && hist.high === 150 && JSON.stringify(hist.recent.map((x) => x.rate)) === "[150,140,130]",
  "trade reading: history is canonical only, so a pending row, a gift and another party's price stay out " + JSON.stringify(hist));
  ok(makerTradeReading({ direction: "sale", product: "salt", qty: 0, total: 1 }, book).error
    && makerTradeReading({ direction: "sale", product: "salt", qty: 1, total: 1, delivery: 5 }, book).error
    && makerTradeReading({ direction: "sale", product: "retired", qty: 1, total: 1 }, book).error,
  "trade reading: a bad size, an unknown field or an unknown book is refused");

  /* a sale is costed at the latest purchase on or before its own date, equal to the drafter's cogsFor */
  const later = { ...LOT, rid: "pB", date: "2099-09-20", receivedOn: "2099-09-20", total: 4400, freight: 0 };
  const dated = { ...book, purchases: [LOT, later] };
  const back = makerTradeReading({ direction: "sale", product: "salt", party: "CX1-ZED", qty: 1, total: 130, date: "2099-09-10" }, dated);
  const fore = makerTradeReading({ direction: "sale", product: "salt", party: "CX1-ZED", qty: 1, total: 130, date: "2099-10-01" }, dated);
  ok(back.cogs.rate === 42 && back.cogs.rate === +cogsFor(dated, "salt", "2099-09-10").cost.toFixed(2)
    && fore.cogs.rate === 44 && fore.cogs.rate === +cogsFor(dated, "salt", "2099-10-01").cost.toFixed(2)
    && makerTradeReading({ direction: "sale", product: "salt", qty: 1, total: 1, date: "tomorrow" }, dated).error,
  "trade reading: a backdated sale reads the lot on or before its date, as the drafter does " + JSON.stringify([back.cogs.rate, fore.cogs.rate]));
  /* the margin and the below-cost verdict are struck on the unrounded rate: 42.004 a unit, RM 42,002 for 1,000 units */
  const fine = { ...book, purchases: [{ ...LOT, rid: "pC", qty: 1000, receivedQty: 1000, total: 42004, freight: 0 }] };
  const edge = makerTradeReading({ direction: "sale", product: "salt", qty: 1000, total: 42002 }, fine);
  ok(edge.margin.rm === -2 && edge.margin.belowCost === true && edge.cogs.rate === 42,
    "trade reading: margin and below cost are struck on the unrounded rate, so the 2dp rate cannot flip the verdict " + JSON.stringify(edge.margin));
  const noShelf = JSON.parse(JSON.stringify(book)); noShelf.purchases = []; noShelf.pricing.byProduct.salt.stockCost = null;
  noShelf.purchases = [{ ...LOT, rid: "pD", date: "2099-09-01", receivedOn: "2099-09-01" }];
  const noBasis = makerTradeReading({ direction: "sale", product: "salt", qty: 1, total: 130, date: "2099-08-01" }, noShelf);
  ok(noBasis.cogs.basis === null && noBasis.cogs.source === "the newest received lot",
    "trade reading: with no lot on or before the date the source line names costFor's own basis " + JSON.stringify(noBasis.cogs));

  /* the route and the page, end to end over the real bridge and the real Worker */
  const wd = readingWorld(pricing);
  try {
    const ask = { direction: "sale", product: "salt", party: "CX1-ZED", qty: 3, total: 100 };
    const answer = await wd.call("/all/maker/trade-reading", ask);
    const got = (await answer.json()).reading;
    const denied = await wd.call("/all/maker/trade-reading", ask, null);
    const stranger = await wd.call("/all/maker/trade-reading", ask, { email: "someone@example.com" });
    const noKey = await worker.fetch(new Request("https://desk.test/_internal/maker/trade-reading", { method: "POST", body: JSON.stringify(ask) }),
      wd.desk, { waitUntil() {} });
    const wrongKey = await worker.fetch(new Request("https://desk.test/_internal/maker/trade-reading", { method: "POST", body: JSON.stringify(ask),
      headers: { "x-maker-key": "not-the-bridge-key-not-the-bridge-key" } }), wd.desk, { waitUntil() {} });
    ok(answer.status === 200 && got.cogs.rate === 42 && got.floor.under === true && got.history.count === 3 && wd.puts.length === 0,
      "trade reading route: the owner's read goes through the bridge and answers the figures, writing nothing");
    ok(denied.status === 403 && stranger.status === 403 && wd.calls.filter((p) => p === "/_internal/maker/trade-reading").length === 1,
      "trade reading route: without the owner's verified identity it is refused before the bridge is called");
    ok(noKey.status === 404 && wrongKey.status === 404,
      "trade reading route: the Desk side refuses a call without the bridge key");

    /* the page: the reading is on the form before Send is tapped */
    const page = await ownerTrade(wd, pageWork);
    try {
      const box = page.section.querySelector(".maker-reading"), text = () => box.textContent;
      page.change("Units", "3"); page.change("Price (goods)", "100"); await page.work.quiet();
      const warn = [...box.querySelectorAll("p.msg.bad")].map((p) => p.textContent).join("|");
      ok(!box.hidden && /Cost a unit RM 42[.]00/.test(text()) && /margin -?RM 26[.]00|margin RM -26[.]00/.test(text()) && /Floor RM 130[.]00 for 3 units/.test(text())
        && /RM 30 under the floor of RM 130/.test(warn) && /Their usual RM 140[.]00 a unit over 3 orders/.test(text()),
      "trade reading page: before Send the form shows cost, margin, the floor, a warning under it and their usual " + text());
      page.change("Date", "2099-08-01"); await page.work.quiet();
      ok(!/latest purchase/.test(text()) && /Cost a unit RM/.test(text()),
        "trade reading page: the form sends its date, so a date before the lot does not read that lot " + text());
      page.change("Date", ""); await page.work.quiet();
      ok(/latest purchase/.test(text()), "trade reading page: clearing the date reads the latest lot again " + text());
      page.change("Price (goods)", "300"); await page.work.quiet();
      ok(!box.querySelector("p.msg.bad") && /Goods RM 300[.]00/.test(text()),
        "trade reading page: a price at or over the floor draws no warning " + text());
      page.change("Sale or purchase", "purchase"); await page.work.quiet();
      page.change("Units", "100"); page.change("Price (goods)", "4400"); page.change("Freight", "200"); await page.work.quiet();
      ok(!/margin/i.test(text()) && !/Floor/.test(text()) && /This buy costs RM 46[.]00 a unit, RM 4[.]00 above the current cost/.test(text()),
        "trade reading page: a purchase shows its cost a unit against the current cost and no margin " + text());
    } finally { page.dom.window.close(); }
  } finally { wd.sqlite.close(); }
}
