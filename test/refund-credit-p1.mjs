/* test/refund-credit-p1.mjs: A REFUND IS NEVER THE BOOK'S MONEY (27 Oct 2026, docs/plan-refund-credit.html P1). What a book received on a row
 * is its cash less every refund raised on its rid (the engine's bookCash); money received by book, the product summary and the P&L read it,
 * while cash flow keeps the till's raw cash and its refunds in refPaid (the s190 and s191 precedent). Each check is proved red by its own
 * mutation (test/refund-credit-p1.mutations.json). Invented codes, and the live s296 case read off the book as it stands.
 *   1  bookCash: s296's RM 480 less its RM 25 refund is RM 455; a row with no refund keeps its cash; never under nought
 *   2  the walk's money received and the product summary read it, by the refund, and nothing else moves
 *   3  cash flow keeps raw cash: an open refund leaves the till alone, one set off as credit counts in refPaid and its words say so
 *   4  the 25 is never lost or doubled: once set off on the order it pays, the books add up to the till */
import { openMaster } from "../tools/payload.mjs";
import { LIVE_MASTER } from "./frozen.mjs";

const J = JSON.stringify;

export async function run({ ok }) {
  const { default: PE } = await import("../engine/position.mjs");

  /* 1 */
  const s296 = { rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 480, deliveredQty: 5, date: "2026-10-27" };
  const r296 = [{ party: "CZ4-MK", rid: "s296", amount: 25, since: "2026-10-27" }];
  ok(PE.bookCash(s296, r296) === 455, "s296's RM 480 less the RM 25 refund raised on it reads RM 455 on salt: " + PE.bookCash(s296, r296));
  ok(PE.bookCash(s296, [{ party: "CZ4-MK", amount: 20, since: "2026-08-26", paidOn: "2026-09-21" }]) === 480 && PE.bookCash(s296, []) === 480,
    "a row with no refund on its rid keeps its cash, a refund with no rid naming none");
  ok(PE.bookCash({ rid: "x1", cash: 40, settledRM: 60, total: 100, cancelled: true }, [{ rid: "x1", amount: 100 }]) === 0,
    "never under nought: a cancelled row's refund carrying what was settled in kind leaves RM 0 received");
  ok(PE.bookCash(s296, r296.concat([{ party: "CZ4-MK", rid: "s296", amount: 5, since: "2026-10-27", paidOn: "2026-10-28", setOff: "s300" }])) === 450,
    "every refund on the rid counts, open, paid out or set off");

  const { w } = await openMaster();
  try {
    /* 2 */
    w.eval("setProd('salt');recompute();");
    const before = JSON.parse(w.eval("JSON.stringify({rev:revCollected,sum:prodSummary('salt').cash,cf:cashFlow(),fin:(finRows().find(m=>m[0]==='2026-10')||[0,{cash:0}])[1].cash})"));
    w.eval("sales.push({rid:'fx-rc1',customer:'CY2-NIL',qty:5,total:455,cost:240,cash:480,deliveredQty:5,deliveredOn:'2026-10-27',date:'2026-10-27',handover:'collected'});"
      + "customerRefunds.push({party:'CY2-NIL',rid:'fx-rc1',amount:25,since:'2026-10-27'});recompute();");
    const after = JSON.parse(w.eval("JSON.stringify({rev:revCollected,sum:prodSummary('salt').cash,cf:cashFlow(),fin:(finRows().find(m=>m[0]==='2026-10')||[0,{cash:0}])[1].cash})"));
    ok(Math.abs(after.rev - before.rev - 455) < 0.006 && Math.abs(after.sum - before.sum - 455) < 0.006,
      "money received on salt rises by RM 455, the row's cash less its refund, in the walk and the product summary: " + J({ rev: after.rev - before.rev, sum: after.sum - before.sum }));
    ok(Math.abs(after.fin - before.fin - 455) < 0.006, "and in the P&L's October, collected in cash: " + J(after.fin - before.fin));
    /* 3 */
    ok(Math.abs(after.cf.inRM - before.cf.inRM - 480) < 0.006 && Math.abs(after.cf.net - before.cf.net - 480) < 0.006 && after.cf.refPaid === before.cf.refPaid,
      "cash flow is the till: RM 480 in, and the open refund out of refPaid: " + J({ inRM: after.cf.inRM - before.cf.inRM, net: after.cf.net - before.cf.net }));
    /* 4: set off on the order it pays, RM 25 of that order's cash being the credit */
    w.eval("customerRefunds[customerRefunds.length-1].paidOn='2026-10-28';customerRefunds[customerRefunds.length-1].setOff='fx-rc2';"
      + "sales.push({rid:'fx-rc2',customer:'CY2-NIL',qty:1,total:100,cost:48,cash:100,deliveredQty:1,deliveredOn:'2026-10-28',date:'2026-10-28',handover:'collected'});recompute();");
    const set = JSON.parse(w.eval("JSON.stringify({rev:revCollected,sum:prodSummary('salt').cash,cf:cashFlow(),fin:(finRows().find(m=>m[0]==='2026-10')||[0,{cash:0}])[1].cash})"));
    ok(Math.abs(set.sum - before.sum - 555) < 0.006 && Math.abs(set.cf.net - before.cf.net - 555) < 0.006 && Math.abs(set.cf.refPaid - before.cf.refPaid - 25) < 0.006,
      "set off on the order it pays, the books read RM 555 and the till nets to RM 555, RM 580 in less the RM 25 set off: the 25 neither lost nor doubled: "
      + J({ sum: set.sum - before.sum, net: set.cf.net - before.cf.net, refPaid: set.cf.refPaid - before.cf.refPaid }));
    ok(Math.abs(set.cf.refSetOff - (before.cf.refSetOff || 0) - 25) < 0.006, "cash flow names the RM 25 set off as credit: " + J(set.cf.refSetOff));
    ok(/RM ?25(.00)? of it set off as credit on a later order/.test(String(w.eval("consoCashBlock()"))), "and its words say the set-off, the till's figure unchanged");
  } finally { w.close(); }
  /* the live case, as the book stands: s296 reads RM 455 */
  const { w: lw } = await openMaster(LIVE_MASTER);
  try {
    const live = JSON.parse(lw.eval("JSON.stringify((function(){const s=sales.find(x=>x&&x.rid==='s296');return s?{bc:POSITION_ENGINE.bookCash(s,customerRefunds),cash:s.cash}:null})())"));
    ok(!!live && (live.cash === 480 && live.bc === 455), "the live s296, cash RM 480, reads RM 455 on salt: " + J(live));
  } finally { lw.close(); }
}
