/* test/ledger-road.mjs: 4 Nov 2026, his answer A to docs/plan-ledger-conventions.html. Every sale row carries the road it came by (`road`): site, admin, desk, hand
 * or fold. The engine names it (ROADS, roadOf), applyEntry stamps it on a new sale for the fold and the tap alike, the fold-raised units carry fold, the book's history
 * is stamped, Salt Admin's book-row card and trip details say it, and the Desk's ledger card shows it and its search finds it. Classifies only: nothing prices from it.
 * Each check red under its own mutation (test/ledger-road.mutations.json); invented codes only (rule 2). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { openMaster } from "../tools/payload.mjs";

export async function run({ ok, pageWork }) {
  const ENG = await import("../engine/apply.mjs"), E = (await import("../engine/position.mjs")).default;
  const { nextRid } = await import("../tools/rid.mjs");

  /* 1. the engine's word and rule */
  ok(E.roadOf({ orderId: "20311102010101-abcdef", makerRequest: "x" }) === "site" && E.roadOf({ makerRequest: "x" }) === "admin" && E.roadOf({}) === "desk" && E.roadOf(undefined) === "desk",
    "R1: a site order is site, a Salt Admin entry admin, anything else from a draft desk");
  ok(E.ROADS.site === "Site order" && E.ROADS.hand === "Hand fold" && E.ROADS.fold === "Fold-raised unit" && Object.keys(E.ROADS).length === 5,
    "R1: the five roads have their words");

  /* 2. applyEntry stamps a new sale, from the entry that made it */
  const mk = () => ({ STATED_STOCK: 10, COUNT_ON: {}, COUNTS: [], NOTES: {}, PROD_OPENING: {}, sales: [], purchases: [], roster: ["ZZ1-AAA"], QUEUE_COMMITTED: "" });
  const book = (entry, coll = "sales") => {
    const b = mk(), item = { id: "q-1", status: "approved", collection: coll, entry, row: coll === "sales" ? { customer: "ZZ1-AAA", date: "2031-01-02", qty: 2, deliveredQty: 2, product: "salt", total: 20 }
      : { supplier: "ZZ9-SUP", date: "2031-01-02", qty: 2, receivedQty: 2, product: "salt", total: 20 } };
    ENG.applyEntry(b, { id: "q-1", append: coll }, { nextRid, staged: { approved: [item] }, notes: { version: "v1", rows: { "q-1": { note: "invented" } } }, moves: [] });
    return b[coll][0];
  };
  ok(book({ orderId: "20311102010101-abcdef" }).road === "site" && book({ makerRequest: "abc" }).road === "admin" && book({ raw: "laptop" }).road === "desk",
    "R2: a new sale is stamped with its road as it is booked: site, admin or desk");
  ok(!("road" in book({ orderId: "20311102010101-abcdef" }, "purchases")), "R2: a purchase carries no road (sales alone)");

  /* 3. the history was stamped once (every row of ledger/book.json, 4 Nov 2026); the suite reads the frozen book, never the live one, and the units the fold raises
     carry the fold road in their own sections (assoc-reward-fold, loyalty-fold) */

  /* 4. the rows Salt Admin reads carry it */
  const { makerRows } = await import("../src/maker-inputs.js");
  const rb = mk(); rb.roster.push("ZZ2-BBB");
  rb.sales.push({ rid: "s1", customer: "ZZ1-AAA", date: "2031-01-02", qty: 1, total: 100, cash: 0, deliveredQty: 0, product: "salt", road: "hand" });
  const mr = makerRows(rb, [], []);
  ok(mr.length === 1 && mr[0].road === "hand", "R4: Salt Admin's read of a book row carries its road: " + JSON.stringify(mr.map((r) => r.road)));

  /* 5. Salt Admin's book-row card and a trip's details say it */
  const ROW = { rid: "sr1", party: "CQ7-ZED", product: "salt", date: "2031-01-02", key: "k-sr1", qty: 1, total: 110, delivery: 0, paid: 0, owed: 110, handed: 0, left: 1, waiting: 0, stage: "confirmed", road: "hand" };
  const TRIP = { trip: "t1792000000000", party: "CQ7-ZED", date: "2031-01-02", owed: 145, stage: "confirmed",
    lines: [{ rid: "st1", key: "k-st1", product: "salt", qty: 1, total: 130, delivery: 0, paid: 0, owed: 130, handed: 0, left: 1, road: "desk" }, { rid: "st2", key: "k-st2", product: "rice", qty: 2, total: 15, delivery: 0, paid: 0, owed: 15, handed: 0, left: 2, road: "desk" }] };
  const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: [], drafts: [], queue: [], rows: [ROW], trips: [TRIP], sameDay: [] }) });
  try {
    await p.work.quiet();
    const d = p.d, tap = async (act, key) => { const e = byAct(d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    await tap("nav.orders"); await tap("part.orders.open");
    await tap("order.open", "row:sr1");
    const chip = d.querySelector('#makerReview [data-row="sr1"] [data-road]');
    ok(!!chip && chip.getAttribute("data-road") === "hand" && /Hand fold/.test(chip.textContent), "R5: a book row's card says its road beside its stage: " + (chip && chip.textContent));
    await tap("order.open", "trip:t1792000000000");
    const det = [...d.querySelectorAll("#makerReview .rdet .salt-ledger__row")].map((r) => r.textContent);
    ok(det.filter((t) => t.replace(/\s+/g, "") === "RoadDeskentry").length === 1,"R5: a trip's details name its road once: " + det.join(" | "));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 6. the Desk's ledger: the card shows the road, and the search finds it by its word */
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  try {
    w.eval("setProd('salt');recompute();if(!HTMLElement.prototype.scrollIntoView)HTMLElement.prototype.scrollIntoView=function(){};"
      + "sales.push({rid:'rd-1',date:'2031-01-02',customer:'CY2-NIL',qty:1,total:110,cost:60,cash:0,deliveredQty:0,road:'hand'});"
      + "sales.push({rid:'rd-2',date:'2031-01-02',customer:'CY3-NIL',qty:1,total:110,cost:60,cash:0,deliveredQty:0,road:'site'});recompute();");
    const look = (q) => JSON.parse(String(w.eval("(function(){ledOlder=true;ledF={q:" + JSON.stringify(q) + ",state:'',party:'',month:'',product:''};switchTab('ledger');"
      + "var c=function(r){var e=document.querySelector('.lcard[data-rid=\"'+r+'\"]');var t=e&&e.querySelector('.lroad');return e?(t?t.textContent:'no tag'):'absent';};"
      + "return JSON.stringify({a:c('rd-1'),b:c('rd-2')});})()")));
    const all = look(""), hand = look("hand fold");
    ok(all.a === "Hand fold" && all.b === "Site order", "R6: the Desk's ledger card shows each sale's road beside the party: " + JSON.stringify(all));
    ok(hand.a === "Hand fold" && hand.b === "absent", "R6: typing a road's word in the ledger's search keeps that road's orders alone: " + JSON.stringify(hand));
  } finally { w.close(); }
}
