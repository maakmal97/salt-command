/* test/band-v2-fixes.mjs: FABLE'S REVIEW OF THE PRICE BAND'S VERSION 2, the findings applied (13 Nov 2026). Each check red under its own mutation
   (test/band-v2-fixes.mutations.json):
   F1  the market's shelf lands a lot on each day a part of it landed (lotLandings), so a lot received days after its order is not stock on its order day
   F3  a served book carrying MARKET replaces the Desk's switch and points in place; one carrying none is not refused for it and keeps them
   F4  a site order's row reads their price as the lower of the card today and the total their list quoted at Place
   F10 a Median point is set at 12.5 units or under
   F11 an Add ID stamped before the start shipped keeps 0%; one stamped after starts at +30%
   F12 the Approve card of a new customer naming no salt figure says the fold starts them at +30%
   F13 the quotes reading stops reading keys that carry no counts after its cap, and says partial */
import { frozenBook } from "./frozen.mjs";

export async function run({ ok }) {
  const S = (await import("../engine/snapshot.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { inputsFromBook, pricingFromBook } = await import("../engine/book-inputs.mjs");
  const D = await import("../src/drafter.js");
  const MI = await import("../src/maker-inputs.js");
  const Q = await import("../stmt/quotes.js");
  const J = JSON.stringify;

  /* F1 */
  {
    const book = (purchases) => ({ sales: [], purchases, PROD_OPENING: { salt: { qty: 0, costPerKg: 50 } }, STATED_STOCK: 0, COUNTS: [], selfUseLog: [], QUOTES: {},
      COST_RULE: { salt: { kind: "latestCogs" } }, customerRefunds: [], roster: [], partners: [], TIER_OF: {}, PROD_ORDER: ["salt"], loans: [] });
    const ctx = (b, day) => { const B = inputsFromBook(b); return { B, R: RULES, today: new Date(day + "T00:00:00Z"), over: null, memo: B.memo, W: { buyUnits: 0, selfUse: 0, wavgBuy: 0, stockCost: null } }; };
    /* ordered on 1 Oct, 20 units landed by a Fulfilment on 4 Oct and 20 on 6 Oct, no receivedOn */
    const lot = { rid: "p990", date: "2026-10-01", qty: 40, total: 2000, receivedQty: 40, supplier: "SUP",
      amend: [{ kind: "Fulfilment", date: "2026-10-04", kg: 20 }, { kind: "Fulfilment", date: "2026-10-06", kg: 20 }] };
    const C = ctx(book([lot]), "2026-10-10"), at = (t) => S.shelfAt(C, "salt", t);
    ok(at("2026-10-02") === 0 && at("2026-10-05") === 20 && at("2026-10-07") === 40,
      "F1 a lot landed in two parts is stock from each part's day, never on the day it was ordered: " + J([at("2026-10-02"), at("2026-10-05"), at("2026-10-07")]));
  }

  /* F4 */
  {
    const fb = frozenBook(), pricing = pricingFromBook(fb, new Date("2026-10-20T04:00:00Z"));
    const code = Object.keys((pricing.byProduct.salt || {}).cards || {})[0];
    const book = { state: Object.assign({}, fb, { REWARD: { stated: { salt: { associate: { times: 10, since: "2026-10-20" } } } } }), pricing };
    const card = pricing.byProduct.salt.cards[code].find((x) => x[0] === 1);
    const day = "2026-10-20";
    const row = () => ({ product: "salt", qty: 1, customer: code, date: day });
    const a = D.listStamp(row(), book), b = D.listStamp(row(), book, card[1] - 10), c = D.listStamp(row(), book, card[1] + 10);
    ok(!!card && a.listRM === card[1] && b.listRM === card[1] - 10 && c.listRM === card[1],
      "F4 their price is the lower of the card today and the total their list quoted at Place: " + J([card && card[1], a.listRM, b.listRM, c.listRM]));
  }

  /* F10 */
  {
    const fb = frozenBook(), pricing = pricingFromBook(fb, new Date("2026-11-13T04:00:00Z"));
    const book = { state: Object.assign({}, fb, { roster: fb.roster || [], associates: fb.associates || [] }), pricing, ledger: [], version: "v1514" };
    const r25 = MI.makerMarket({ at: "2026-11-13T04:00:00.000Z", kind: "anchor", product: "salt", q: 25, price: 2000 }, book, []);
    const r12 = MI.makerMarket({ at: "2026-11-13T04:00:01.000Z", kind: "anchor", product: "salt", q: 12.5, price: 995 }, book, []);
    ok(r25 && r25.error === "A Median point is set at 12.5 units or under." && r12 && !/12[.]5 units or under/.test(r12.error || ""),
      "F10 a Median point is set at 12.5 units or under: " + J([r25 && r25.error, r12 && (r12.error || "queued")]));
  }

  /* F11 and F12: the fold's start and the card's line */
  {
    const { applyBatch } = await import("../engine/apply.mjs");
    const fb = frozenBook();
    const startFrom = RULES.TIER_RULE.salt.startFrom;
    const before = new Date(Date.parse(startFrom) - 3600e3).toISOString(), after = new Date(Date.parse(startFrom) + 3600e3).toISOString();
    const reg = (code, at) => ({ id: at, collection: "roster", entry: { at }, row: { code, kind: "customer", parent: null, note: null } });
    let a1 = null, a2 = null, err = null;
    try {
      const plan = (it) => applyBatch(fb, { approved: [it] }, {}, { driftBooks: ["salt"], pinnedInMaster: () => false, today: "2026-11-13", nextRid: () => "s999", sortBook: (b) => b });
      a1 = plan(reg("ZQ1-AAA", before)); a2 = plan(reg("ZQ2-AAA", after));
    } catch (e) { err = e.message; }
    const tier = (out, c) => out && ((out.book || out).TIER_OF || {})[c];
    ok(!err && !(tier(a1, "ZQ1-AAA") && "salt" in tier(a1, "ZQ1-AAA")) && tier(a2, "ZQ2-AAA") && tier(a2, "ZQ2-AAA").salt === 0.3,
      "F11 an Add ID stamped before the start shipped keeps 0%, one after starts at +30%: " + J([err, tier(a1, "ZQ1-AAA"), tier(a2, "ZQ2-AAA")]));
    const pricing = pricingFromBook(fb, new Date("2026-11-13T04:00:00Z"));
    const l1 = D.startLine({ pricing }, [], "ZQ3-AAA", "customer", {}), l2 = D.startLine({ pricing }, [], "ZQ3-AAA", "customer", { tiers: { salt: 0 } });
    ok(l1 === " It names no salt figure, so the fold starts them at +30% on salt, where a new customer starts." && l2 === "" && D.startLine({ pricing }, ["ZQ3-AAA"], "ZQ3-AAA", "customer", {}) === "",
      "F12 the card of a new customer naming no salt figure says the fold starts them at +30%; a figure he named, or a code on the roster, says nothing: " + J([l1, l2]));
  }

  /* F12, on the card itself: the drafter's reading of an Add ID that names no figure */
  {
    const fb = frozenBook(), pricing = pricingFromBook(fb, new Date("2026-11-13T04:00:00Z"));
    const entry = { at: "2026-11-13T04:00:00.000Z", type: "ADDID", party: "ZQ4-AAA", qty: null, total: null, status: "addid", raw: "Add ZQ4-AAA to the roster as: customer",
      payload: { mode: "addid", code: "ZQ4-AAA", kind: "customer", parent: null, rev: null, note: null, geo: null, tiers: null } };
    const d = D.draftRow(entry, { state: fb, pricing, ledger: [], version: "v1514" });
    ok(d && /It names no salt figure, so the fold starts them at \+30% on salt/.test(d.reasoning || "") && !/It touches no figure/.test(d.reasoning || ""),
      "F12 the Approve card's reading of that Add ID says the fold starts them at +30%, and no longer that it touches no figure: " + J(d && (d.reasoning || d.skip)).slice(0, 300));
    const old = Object.assign({}, entry, { at: new Date(Date.parse(RULES.TIER_RULE.salt.startFrom) - 60e3).toISOString() });
    const d0 = D.draftRow(old, { state: fb, pricing, ledger: [], version: "v1514" });
    ok(d0 && !/starts them at/.test(d0.reasoning || "") && /It touches no figure/.test(d0.reasoning || ""),
      "F12 an Add ID stamped before the start shipped, which the fold leaves at 0%, says nothing of +30%: " + J(d0 && (d0.reasoning || d0.skip)).slice(0, 200));
    /* F10, the drafter too: a point over 12.5 queued another way is refused at drafting */
    const pt = { at: "2026-11-13T04:00:00.000Z", type: "EDIT", party: null, qty: null, total: null, status: "edit", raw: "Median point", payload: { mode: "edit", kind: "anchor", product: "salt", q: 25, price: 2000 } };
    const dp = D.draftRow(pt, { state: fb, pricing, ledger: [], version: "v1514" });
    ok(dp && dp.skip === "a Median point is set at 12.5 units or under", "F10 the drafter refuses a Median point over 12.5 units too: " + J(dp && (dp.skip || dp.reasoning)).slice(0, 200));
  }

  /* F4, an amendment: at the same size their price stays the lower of what it was and the card today; a new size takes the card */
  {
    const { applyBatch } = await import("../engine/apply.mjs");
    const fb = frozenBook(), pricing = pricingFromBook(fb, new Date("2026-11-13T04:00:00Z"));
    const code = Object.keys(pricing.byProduct.salt.cards)[0], card = (q) => (pricing.byProduct.salt.cards[code].find((x) => x[0] === q) || [])[1];
    const row = { rid: "s9990", date: "2026-11-01", customer: code, product: "salt", qty: 1, total: card(1) - 5, cash: 0, cost: 60, listRM: card(1) - 10, listQty: 1 };
    const book = Object.assign({}, fb, { sales: (fb.sales || []).concat([row]) });
    const fix = (fields, at) => applyBatch(book, { approved: [{ id: at, status: "approved", collection: "sales", amends: "s9990", amendKind: "Correction", row: {},
      entry: { at, type: "AMEND", payload: { mode: "amend", kind: "Correction", fields } } }] }, {}, { driftBooks: ["salt"], pinnedInMaster: () => false, today: "2026-11-13", pricing, nextRid: () => "s9991", sortBook: (b) => b });
    let a = null, b = null, err = null;
    try { a = fix({ total: card(1) - 4 }, "2026-11-13T04:00:00.000Z"); b = fix({ qty: 2, total: card(2) }, "2026-11-13T04:00:01.000Z"); } catch (e) { err = e.message; }
    const rowOf = (o) => o && ((o.book || o).sales || []).find((s) => s.rid === "s9990");
    ok(!err && rowOf(a) && rowOf(a).listRM === card(1) - 10 && rowOf(b) && rowOf(b).listRM === card(2) && rowOf(b).listQty === 2,
      "F4 an amendment at the same size keeps their price as it was, below the card today; one at a new size takes the card: " + J([err, rowOf(a) && rowOf(a).listRM, card(1), rowOf(b) && rowOf(b).listRM, card(2)]));
  }

  /* F13 */
  {
    const m = new Map(); let gets = 0;
    const env = { STMT: { async get(k) { gets++; return m.has(k) ? JSON.parse(m.get(k)) : null; }, async put(k, v) { m.set(k, v); },
      async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } } };
    const day = Date.now(), kl = Q.klDay(day);
    for (let i = 0; i < Q.QUOTE_READS + 5; i++) m.set("quote:" + kl + ":u" + String(i).padStart(4, "0") + "-aaaa", J([{ at: "x", u: "u", sheet: "s".repeat(32), lines: [{ b: "salt", q: 1, p: 100 }] }]));
    const r = await Q.quoteSummary(env, 1, day);
    ok(gets === Q.QUOTE_READS && r.partial === true && r.books.salt["1"].shown === Q.QUOTE_READS,
      "F13 the reading reads at most " + Q.QUOTE_READS + " keys that carry no counts, then says partial: " + J([gets, r.partial, r.books.salt && r.books.salt["1"]]));
  }
}

/* F3, in the real page (the master the suite reads): a served book that carries MARKET replaces the page's switch and points in place, as every
   other document it carries; one that carries none is not refused for it and the page keeps what it held */
export async function runPage({ ok }) {
  const { openMaster } = await import("../tools/payload.mjs");
  const { dom, w } = await openMaster(process.env.SALT_MASTER || "master/salt_command.html");
  try {
    const served = (market) => "(function(){var b={};Object.keys(BOOK_LISTS).forEach(function(k){b[k]=BOOK_LISTS[k];});Object.keys(BOOK_DOCS).forEach(function(k){b[k]=BOOK_DOCS[k];});"
      + "b.STATED_STOCK=BOOK_STATED;b.QUEUE_COMMITTED=BOOK_MARK;b.PRICE_SET=BASE_PRICESET;" + (market ? "b.MARKET=" + JSON.stringify(market) + ";" : "") + "return {ok:true,book:JSON.parse(JSON.stringify(b)),booked:[]};})()";
    const on = { salt: { switch: [{ on: false, from: "2026-11-13", at: "2026-11-13T01:00:00.000Z" }], anchors: [] } };
    const r1 = w.eval("bookApply(" + served(on) + ")"), m1 = w.eval("JSON.stringify(MARKET_BOOK)"), same = w.eval("snapCtx().B.market===MARKET_BOOK");
    const r2 = w.eval("bookApply(" + served(null) + ")"), m2 = w.eval("JSON.stringify(MARKET_BOOK)");
    ok(r1 === null && m1 === JSON.stringify(on) && same === true && r2 === null && m2 === JSON.stringify(on),
      "F3 a served book's MARKET reaches the Desk's switch and points at once; a served book with none is taken and keeps them: " + JSON.stringify([r1, m1, same, r2, m2]));
  } finally { dom.window.close(); }
}
