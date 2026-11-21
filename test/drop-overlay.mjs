/* test/drop-overlay.mjs (21 Nov 2026, the ledger simplification's item 6): the Desk no longer replays a queued trade over its book.
 * The Book's own view (book_page) is what the Desk shows, so a queued sale, lot or amendment counts in no figure until the Book holds
 * it; ovNew and ovAmend are gone and the fold's applyAmend is the one applier. The other kinds (a count, a price, a loan) are left as
 * they were (his answer J). Each check is red under its own mutation (test/drop-overlay.mutations.json). Invented codes only. */
import { openMaster } from "../tools/payload.mjs";

const J = JSON.stringify;

export async function run({ ok }) {
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  try {
    w.eval("setProd('salt');queue=[];applyOverlay();recompute();");
    const rd = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
    const figures = () => rd("(function(){recompute();return {sales:sales.length,lots:purchases.length,cash:cashFlow().net,ar:+(sales.reduce(function(a,s){return a+txAdvance(s);},0)).toFixed(2)};})()");
    const before = figures();
    const sell = { at: "2026-11-21T01:00:00.000Z", type: "SELL", party: "CY2-NIL", qty: 2, total: 200, raw: "SELL CY2-NIL 2 salt RM 200",
      payload: { mode: "new", direction: "SELL", product: "salt", party: "CY2-NIL", date: "2026-11-21", qty: 2, total: 200, cash: 120, kg: 2 } };
    const rid = rd("(sales.find(function(s){return s.rid&&!s.cancelled&&txAdvance(s)>0.009;})||{}).rid||null");
    const row0 = rid ? rd("sales.find(function(s){return s.rid===" + J(rid) + ";})") : null;
    const amend = { at: "2026-11-21T01:00:01.000Z", type: "AMEND", party: row0 && row0.customer, raw: "Correction against " + rid,
      payload: { mode: "amend", kind: "Correction", direction: "SELL", party: row0 && row0.customer, rid, date: "2026-11-21", fields: { total: 1, cash: 999 } } };
    const count = { at: "2026-11-21T01:00:02.000Z", type: "COUNT", raw: "Count 7 salt",
      payload: { mode: "count", product: "salt", date: "2026-11-21", qty: 7 } };
    /* sent entries, so the unsent switch is not what keeps them out */
    w.eval("queue=" + J([sell, amend, count]) + ";qReceipt(" + J([sell.at, amend.at, count.at]) + ");applyOverlay();recompute();renderProvBar();renderQueue();");

    const after = figures();
    ok(after.sales === before.sales && after.lots === before.lots && Math.abs(after.cash - before.cash) < 0.005,
      "X1: a queued new SELL adds no row and moves no cash on the desk: " + J({ before, after }));
    const row1 = rid ? rd("sales.find(function(s){return s.rid===" + J(rid) + ";})") : null;
    ok(!!rid && J(row1) === J(row0) && Math.abs(after.ar - before.ar) < 0.005,
      "X2: a queued Correction leaves its row and what is owed as the Book holds them: " + J({ rid, total: row1 && row1.total, ar: [before.ar, after.ar] }));
    ok(rd("provTrades") === 2 && rd("provCount") === 1,
      "X3: the two trades are counted as waiting, and only the count as in the figures: " + J({ trades: rd("provTrades"), counted: rd("provCount") }));
    ok(rd("statedStockBy.salt||null") === 7,
      "X4: a queued count still applies, as his answer J leaves the other kinds: " + J(rd("statedStockBy")));
    const bar = String(w.eval("(document.getElementById('provBar')||{}).textContent||''"));
    ok(/2 queued trades wait on the Book and count in no figure/.test(bar),
      "X5: the bar says the queued trades count in no figure: " + bar.slice(0, 220));
    const panel = String(w.eval("(document.getElementById('queueBox')||{}).textContent||''"));
    ok(panel.includes(sell.raw) && /a queued trade counts in no figure until the Book holds it/.test(panel),
      "X6: the queued SELL is listed in the queue panel, which says it counts in no figure: " + panel.slice(0, 260));
    ok(rd("['ovNew','ovAmend','ovSeed','ovFind','ovRefund','ovAttribution','commitRisks'].filter(function(n){return typeof window[n]!=='undefined';})").length === 0,
      "X7: the page carries no second applier (ovNew, ovAmend and their helpers are gone)");
    w.eval("queue=[];applyOverlay();recompute();renderProvBar();");
    ok(String(w.eval("(document.getElementById('provBar')||{}).innerHTML||''")) === "" && rd("provTrades") === 0,
      "X8: with nothing queued the bar is empty again");
  } finally {
    await new Promise((r) => setTimeout(r, 200));
    try { w.close(); } catch (e) { /* best effort */ }
  }
}
