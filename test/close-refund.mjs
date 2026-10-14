/* test/close-refund.mjs: a close at what was handed over, or an amendment of an agreed order, under what the customer has
   paid opens a refund for the difference (06 Oct 2026). The engine's refundOnOverpay beside refundOnCancel, read off the
   row; the drafter's card says what opens; the fold books one customerRefunds row for the difference and the rest on a
   later cancellation; the desk's overlay previews the same payable and lets it go with the entry. Invented codes only. */
import { FROZEN_MASTER } from "./frozen.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { draftRow } from "../src/drafter.js";
import { readBook } from "../tools/book.mjs";
import { apply as foldApply } from "../tools/fold.mjs";
import { openMaster } from "../tools/payload.mjs";

const REPO = join(import.meta.dirname, "..");

export async function run({ ok }) {
  const { default: PE } = await import("../engine/position.mjs");
  const mk = (o) => Object.assign({ rid: "ov1", date: "2026-10-01", customer: "CY2-NIL", qty: 3, total: 300 }, o);

  /* THE RULE: what was paid less what the row comes to, less every refund the rid already carries */
  {
    const list = [];
    const rec = PE.refundOnOverpay(list, mk({ cash: 300, qty: 1, total: 100 }), "2026-10-06");
    ok(!!rec && list.length === 1 && rec.party === "CY2-NIL" && rec.amount === 200 && rec.since === "2026-10-06" && rec.rid === "ov1" && !("paidOn" in rec),
      "a row closed at RM 100 with RM 300 paid books one open payable of RM 200, naming the row and the day: " + JSON.stringify(rec));
    ok(PE.refundOnOverpay(list, mk({ cash: 300, qty: 1, total: 100 }), "2026-10-06") === null && list.length === 1,
      "a second reading adds nothing: the overlay rebuilds every pass and the fold can be re-run");
    const more = PE.refundOnOverpay(list, mk({ cash: 300, qty: 1, total: 80 }), "2026-10-07");
    ok(!!more && more.amount === 20 && list.length === 2, "a further lowering raises only the further difference: " + JSON.stringify(more));
    const rest = PE.refundOnOverpay(list, mk({ cash: 300, qty: 1, total: 80, cancelled: true }), "2026-10-08");
    ok(!!rest && rest.amount === 80 && /cancelled order ov1/.test(rest.note) && list.reduce((a, r) => a + r.amount, 0) === 300,
      "a cancellation after that raises the rest, so the rid's refunds add up to what was paid: " + JSON.stringify(rest));
    ok(PE.refundOnOverpay([{ rid: "ov1", party: "CY2-NIL", amount: 200, since: "2026-10-06", paidOn: "2026-10-07" }], mk({ cash: 300, qty: 1, total: 100 }), "2026-10-06") === null,
      "a refund already returned (paidOn) counts against the rid too, so nothing is raised twice");
  }
  ok(PE.refundOnOverpay([], mk({ cash: 300, delivery: 20, total: 280 }), "2026-10-06") === null, "goods and delivery together are what the row comes to: RM 300 paid against RM 300 owed books none");
  ok(PE.refundOnOverpay([], mk({ cash: 300, delivery: 10, total: 280 }), "2026-10-06").amount === 10, "and a delivery charge lowered under what was paid is the difference");
  ok(PE.refundOnOverpay([], mk({ cash: 100.005, total: 100 }), "2026-10-06") === null, "a rounding crumb is not a payable");
  ok(PE.refundOnOverpay([], mk({ cash: 200, total: 300 }), "2026-10-06") === null, "a row paid under what it comes to books none");
  ok(PE.refundOnOverpay([], mk({ cash: 300, total: 0, unpriced: true }), "2026-10-06") === null, "an unpriced row comes to nothing yet and books none");
  ok(PE.refundOnOverpay([], mk({ rid: undefined, cash: 300, total: 100 }), "2026-10-06") === null, "a row with no rid is left to refundOnCancel and the hand");
  ok(PE.refundOnOverpay([], mk({ cash: 140, settledRM: 160, total: 100 }), "2026-10-06").amount === 200, "what was paid is txPaid, cash and what was settled in kind");

  /* THE DRAFTER'S CARD: the close, the amendment and a payment over the row each say the refund the fold raises */
  const src = await readBook();
  const fresh = () => JSON.parse(JSON.stringify(src.ledger));
  const withRow = (row) => { const c = fresh(); c.sales.push(row); return { c, book: { sales: c.sales, purchases: c.purchases, state: c, version: "v1", pricing: c.PRICING } }; };
  const base = { date: "2026-10-01", customer: "CY2-NIL", qty: 3, total: 300, cost: 150, deliveredQty: 0 };
  const fix = (rid, fields) => ({ at: "2026-10-06T01:00:00Z", type: "SELL", party: "CY2-NIL", qty: 0, total: 0, status: "Close", raw: "x",
    payload: { mode: "amend", kind: "Correction", direction: "SELL", party: "CY2-NIL", rid, date: "2026-10-06", qty: 0, total: 0, cash: 0, kg: 0, fields } });
  const closeFields = { qty: 1, total: 100, deliveredQty: 1, deliveredOn: "2026-10-06", handover: "collected" };
  const refundFlag = (d) => (d.flags || []).find((f) => /refund payable/.test(f)) || null;
  {
    const d = draftRow(fix("cr-close", closeFields), withRow({ ...base, rid: "cr-close", cash: 300 }).book);
    ok(!d.skip && /comes to RM 100, under the RM 300 already paid/.test(refundFlag(d) || "") && /refund payable to the customer for RM 200/.test(refundFlag(d)) && /paidOn/.test(refundFlag(d)),
      "a close under what they paid is drafted, its card naming the RM 200 refund the fold raises: " + JSON.stringify(d.skip || d.flags));
    const dd = draftRow(fix("cr-deliv", { delivery: 5 }), withRow({ ...base, rid: "cr-deliv", cash: 320, delivery: 20 }).book);
    ok(!dd.skip && /refund payable to the customer for RM 15/.test(refundFlag(dd) || ""), "a delivery charge amended under what they paid says the difference: " + JSON.stringify(dd.skip || dd.flags));
    const under = draftRow(fix("cr-under", closeFields), withRow({ ...base, rid: "cr-under", cash: 50 }).book);
    ok(!under.skip && !refundFlag(under), "a close over what they paid carries no refund flag");
    const pay = draftRow({ at: "2026-10-06T01:00:00Z", type: "SELL", party: "CY2-NIL", qty: 0, total: 0, status: "Payment", raw: "x",
      payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: "CY2-NIL", rid: "cr-pay", date: "2026-10-06", qty: 0, total: 0, cash: 350, kg: 0 } },
      withRow({ ...base, rid: "cr-pay", cash: 0 }).book);
    ok(!pay.skip && /RM 50 more than the order is owed/.test(refundFlag(pay) || "") && /refund payable to the customer/.test(refundFlag(pay)),
      "a payment over what the row owes says the fold raises the refund for it: " + JSON.stringify(pay.skip || pay.flags));
  }

  /* THE FOLD: the close books one open refund of the difference; an amendment then a cancellation book the rest */
  const master = readFileSync(FROZEN_MASTER, "utf8");
  const staged = (id, rid, row, kind, fields) => ({ approved: [{ id, amends: rid, amendKind: kind, collection: "sales",
    entry: { payload: Object.assign({ direction: "SELL", kind, date: "2026-10-06" }, fields ? { fields } : {}) },
    row, pay: Object.assign({ kind, date: "2026-10-06" }, fields ? { fields } : {}) }] });
  const notes = (id) => ({ version: "v9999", title: "t", notes: ["n"], rows: { [id]: { note: "folded" } } });
  {
    const f = withRow({ ...base, rid: "cf-close", cash: 300 });
    const n = (f.c.customerRefunds || []).length;
    const res = foldApply(f.c, staged("x1", "cf-close", f.c.sales.at(-1), "Correction", closeFields), notes("x1"), master);
    const rows = (f.c.customerRefunds || []).slice(n), row = f.c.sales.find((s) => s.rid === "cf-close");
    ok(res && res.ok !== false && rows.length === 1 && rows[0].rid === "cf-close" && rows[0].amount === 200 && rows[0].since === "2026-10-06" && !rows[0].paidOn
      && row.total === 100 && row.qty === 1 && row.cash === 300,
      "the fold of a close under what was paid opens exactly one refund for the RM 200 difference, the row restated: " + JSON.stringify({ res, rows }));
  }
  {
    const f = withRow({ ...base, rid: "cf-amend", cash: 300 });
    const n = (f.c.customerRefunds || []).length;
    const r1 = foldApply(f.c, staged("x2", "cf-amend", f.c.sales.at(-1), "Correction", { total: 250 }), notes("x2"), master);
    const r2 = foldApply(f.c, staged("x3", "cf-amend", f.c.sales.find((s) => s.rid === "cf-amend"), "Cancellation"), notes("x3"), master);
    const rows = (f.c.customerRefunds || []).slice(n);
    ok(r1 && r1.ok !== false && r2 && r2.ok !== false && rows.length === 2 && rows[0].amount === 50 && rows[1].amount === 250 && rows.every((r) => r.rid === "cf-amend" && !r.paidOn),
      "an amendment to RM 250 opens RM 50, and its cancellation after that opens the RM 250 left, never the RM 300 twice: " + JSON.stringify({ r1, r2, rows }));
  }

  /* A STALE REFUND IS FLAGGED, NEVER WITHDRAWN: raise one, correct the cash down, and the fold raises no second, keeps the row,
     and says how much of it is no longer owed */
  {
    const f = withRow({ ...base, rid: "cf-stale", cash: 300 });
    const n = (f.c.customerRefunds || []).length;
    foldApply(f.c, staged("y1", "cf-stale", f.c.sales.at(-1), "Correction", closeFields), notes("y1"), master);
    const r2 = foldApply(f.c, staged("y2", "cf-stale", f.c.sales.find((s) => s.rid === "cf-stale"), "Correction", { cash: 250 }), notes("y2"), master);
    const rows = (f.c.customerRefunds || []).slice(n);
    ok(rows.length === 1 && rows[0].amount === 200 && !rows[0].paidOn && JSON.stringify(r2.moves).includes("STALE refund on cf-stale: RM 50 of its open refunds is no longer owed"),
      "cash corrected down to RM 250 raises no second refund, withdraws none, and the fold names the RM 50 no longer owed: " + JSON.stringify({ rows, moves: r2.moves }));
    ok(PE.refundStale([{ rid: "z", amount: 200, paidOn: "2026-10-07" }], mk({ rid: "z", cash: 250, total: 100 })) === 0, "a refund already returned is never called stale");
  }

  /* THE DESK'S OVERLAY: the same payable previewed from the queue, said in the provenance, and gone with the entry */
  {
    const { w } = await openMaster();
    try {
      w.eval("setProd('salt');recompute();");
      const committed = +w.eval("customerRefunds.length");
      w.eval("sales.push({rid:'fx-over',customer:'CY2-NIL',qty:3,total:300,cost:150,cash:300,deliveredQty:0});recompute();");
      w.eval("ovAmend({kind:'Correction',date:'2026-10-06',direction:'SELL',rid:'fx-over',fields:" + JSON.stringify(closeFields) + "},{at:'r1'})");
      const got = JSON.parse(String(w.eval("JSON.stringify(customerRefunds.slice(" + committed + "))")));
      ok(got.length === 1 && got[0].rid === "fx-over" && got[0].amount === 200 && !got[0].paidOn && /paid past what the row comes to/.test(String(w.eval("provNotes.join(' | ')"))),
        "a previewed close under what they paid books the RM 200 payable on the desk too, and says so in the provenance: " + JSON.stringify(got));
      w.eval("sales.push({rid:'fx-pay',customer:'CY2-NIL',qty:3,total:300,cost:150,cash:0,deliveredQty:0});recompute();");
      w.eval("ovAmend({kind:'Fulfilment',date:'2026-10-06',direction:'SELL',rid:'fx-pay',cash:320,kg:0},{at:'r2'})");
      const paid = JSON.parse(String(w.eval("JSON.stringify(customerRefunds.slice(" + committed + "))")));
      ok(paid.length === 2 && paid[1].rid === "fx-pay" && paid[1].amount === 20, "and a previewed payment over the row books the RM 20 past it: " + JSON.stringify(paid));
      w.eval("sales.push({rid:'fx-stale',customer:'CY2-NIL',qty:1,total:100,cost:50,cash:300,deliveredQty:1});customerRefunds.push({party:'CY2-NIL',rid:'fx-stale',amount:200,since:'2026-10-06'});recompute();");
      w.eval("ovAmend({kind:'Correction',date:'2026-10-06',direction:'SELL',rid:'fx-stale',fields:{cash:250}},{at:'r3'})");
      ok(/STALE refund on fx-stale: .*50.* no longer owed/.test(String(w.eval("provNotes.join(' | ')"))), "the desk's overlay names the stale refund too: " + String(w.eval("provNotes.join(' | ')")).slice(-200));
      w.eval("applyOverlay();");
      ok(+w.eval("customerRefunds.length") === committed, "an empty queue takes both away again");
    } finally {
      await new Promise((r) => setTimeout(r, 200));
      try { w.close(); } catch (e) { /* best effort */ }
    }
  }
}
