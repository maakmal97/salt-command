/* test/amend-way.mjs: THE WAY IS AMENDABLE (17 Nov 2026, his TA95-7J2: "Collected to Delivered, Delivery Charges from 0 to 15"). Change the order
 * carried units, price and delivery alone, and both the Desk (restateTap) and the order book refuse a charge on a collection, so a collected order
 * could never become a delivery, and Salt Admin said only "The Counter could not do that". The restate now carries `mode`:
 *   M1  the Desk: a collected order's restate to deliver with a charge drafts one Correction setting the charge AND the row's handover delivered,
 *       and tells the site the way
 *   M2  the Desk: a charge on a collection with no change of way is still refused, and so is a bad way
 *   M3  the Desk: a change of way before anything is handed over leaves the row's handover alone, and a change of way alone is a change
 *   M4  the order book: the restate with the way moves the order's mode and takes the charge; without it the charge on a collection is refused
 *   M5  the bridges: the Desk's maker gate takes the way on a restate, alone or with figures, and refuses any other
 *   M6  Salt Admin words the restate's refusals instead of the general sentence
 *   M7  the return leg heals a change of way he rejected, off the row, only where row and order contradict (Fable's review)
 *   M8  a group order's way is not changed
 * Every assertion is red under its own mutation (test/amend-way.mutations.json). */
import { readFileSync } from "node:fs";
import { restateTap, termsFromRow, settledFromRow } from "../engine/stages.mjs";
import { decideDesk, applyEvent, wakes, customerView } from "../stmt/orders.js";
import { NEWS } from "../stmt/sw.js";
import { buildAll, FEATURES } from "../tools/testfix.mjs";
import { makerOrderFault } from "../src/maker.js";

const at = new Date("2026-11-17T05:00:00.000Z");
const book = { version: 1524, sales: [], state: {}, pricing: {} };
const ctx = () => ({ book, room: null, earlier: [], live: null });
const order = (over) => Object.assign({ id: "20261117042500-ta957j", u: "cz5-tm", code: "CZ5-TM", status: "ready", mode: "collect", product: "salt",
  qty: 1, total: 105, delivery: 0, moved: 1, movedOn: "2026-11-17", paid: 0, at: "2026-11-17T04:25:00.000Z", history: [], payments: [] }, over || {});

export async function run({ ok }) {
  /* M1 */
  const a = restateTap(order(), at, { mode: "deliver", delivery: 15 }, ctx());
  const f = a.entry && a.entry.payload.fields;
  ok(!a.error && f && f.delivery === 15 && f.handover === "delivered" && a.site.restate.mode === "deliver" && a.site.restate.delivery === 15,
    "M1: a collected order changed to deliver with RM 15 drafts one Correction of the charge and the handover, and tells the site the way: " + JSON.stringify(a.error || f));
  /* M2 */
  const b = restateTap(order(), at, { delivery: 15 }, ctx()), b2 = restateTap(order(), at, { mode: "post", delivery: 15 }, ctx());
  ok(b.error === "a collection carries no delivery charge" && b2.error === "the way is collect or deliver",
    "M2: a charge on a collection with no change of way is refused, and a way that is neither: " + b.error + " / " + b2.error);
  /* M3 */
  const c = restateTap(order({ moved: 0 }), at, { mode: "deliver" }, ctx());
  ok(!c.error && c.entry && !("handover" in c.entry.payload.fields) && c.site.restate.mode === "deliver",
    "M3: a change of way alone, nothing handed over yet, is a change and leaves the row's handover alone: " + JSON.stringify(c.error || c.entry.payload.fields));
  /* M4 */
  const o = order();
  const d = decideDesk(o, { restate: { qty: 1, total: 105, delivery: 15, mode: "deliver" } }, at.toISOString());
  const d2 = decideDesk(order(), { restate: { qty: 1, total: 105, delivery: 15 } }, at.toISOString());
  const applied = d.ev ? applyEvent(o, d.ev).order : null;
  ok(d.ev && d.ev.mode === "deliver" && applied && applied.mode === "deliver" && applied.delivery === 15 && d2.error && d2.status === 400,
    "M4: the order book takes the way with the charge and moves the order's mode; without it the charge is refused: " + JSON.stringify(d.error || d2));
  /* M5 */
  const rid = "rid-amend-way-0001";
  ok(makerOrderFault("restate", { rid, mode: "deliver", delivery: 15 }) === "" && makerOrderFault("restate", { rid, mode: "deliver" }) === ""
    && makerOrderFault("restate", { rid, mode: "post" }) !== "",
    "M5: the Desk's maker gate takes the way on a restate, alone or with a figure, and refuses any other");
  /* M7 (Fable's review): a change of way the site took at the tap and he then rejected is healed by the return leg off the row, only where the two contradict */
  const back1 = termsFromRow(order({ mode: "collect", delivery: 0 }), { qty: 1, total: 105, delivery: 15, handover: "delivered" }, 1);
  const back2 = termsFromRow(order({ mode: "deliver", delivery: 15 }), { qty: 1, total: 105, delivery: 0, handover: "collected" }, 1);
  const kept = termsFromRow(order({ mode: "deliver", delivery: 0 }), { qty: 1, total: 105, delivery: 0 }, 1);
  const done = settledFromRow(order({ status: "done", mode: "deliver", delivery: 15, queued: { paid: 0, moved: 1 } }), { qty: 1, total: 105, delivery: 0, handover: "collected", deliveredQty: 1 });
  ok(back1 && back1.mode === "deliver" && back1.delivery === 15 && back2 && back2.mode === "collect" && back2.delivery === 0 && kept === null && done && done.mode === "collect",
    "M7: the return leg puts the row's way back on an order that contradicts it, agreed or settled, and leaves an order that agrees alone: " + JSON.stringify([back1, back2, kept, done]));
  const bk = decideDesk(order({ mode: "deliver", delivery: 15, queued: { paid: 0, moved: 1 } }), { restate: { qty: 1, total: 105, delivery: 0, paid: 0, moved: 1, mode: "collect", book: true } }, at.toISOString());
  ok(bk.ev && bk.ev.mode === "collect", "M7: the order book takes the book's way on its whole restate: " + JSON.stringify(bk));
  /* M8 */
  const pl = decideDesk(order({ pool: "p1", moved: 0 }), { restate: { qty: 1, total: 105, delivery: 0, mode: "deliver" } }, at.toISOString());
  ok(pl.error === "a group order is collect only", "M8: a group order's way is not changed: " + JSON.stringify(pl));
  /* T1 to T5: version 1 of the order-changes plan, his answers as recommended: every change of his is told; a discount when cheaper for the same or more goods */
  const told = (r, over) => { const o2 = order(over), d2 = decideDesk(o2, { restate: r }, at.toISOString()); if (d2.error) return { error: d2.error }; const a2 = applyEvent(order(over), d2.ev); return { ev: d2.ev, w: wakes(d2.ev, a2.order, a2.done), v: customerView(a2.order) }; };
  const way = told({ qty: 1, total: 105, delivery: 15, mode: "deliver", tell: true }), cheaper = told({ qty: 1, total: 95, delivery: 0, tell: true });
  const fewer = told({ qty: 0.5, total: 60, delivery: 0, tell: true }, { moved: 0 }), toCollect = told({ qty: 1, total: 105, delivery: 0, mode: "collect", tell: true }, { mode: "deliver", delivery: 15 });
  ok(way.w && way.w.k === "changed" && cheaper.w && cheaper.w.k === "discount" && fewer.w && fewer.w.k === "changed" && toCollect.w && toCollect.w.k === "changed",
    "T1: his change is told: a way and a charge as changed, a lower price as a discount, fewer units and a delivery turned collection as changed: " + JSON.stringify([way.w, cheaper.w, fewer.w, toCollect.w]));
  const cutOnBook = told({ qty: 1, total: 95, delivery: 0 }), raisedOnBook = told({ qty: 1, total: 115, delivery: 0 }), undone = told({ qty: 1, total: 105, delivery: 0, undo: true }, { total: 95 });
  ok(cutOnBook.w && cutOnBook.w.k === "discount" && raisedOnBook.w && raisedOnBook.w.k === "changed" && undone.w && undone.w.k === "corrected" && !("tell" in undone.ev),
    "T2: a change the book makes takes the same rule (a cut a discount, a raise changed), and an undo keeps its own corrected: " + JSON.stringify([cutOnBook.w, raisedOnBook.w, undone.w]));
  /* T7 (Fable's review): a raise he then rejected, put back by the book, says changed (never a discount) and takes the Bill's line away; so does an undo */
  const raised = { total: 115, changed: { at: "2026-11-17T04:00:00.000Z", kind: "changed", was: { qty: 1, total: 105, delivery: 0, mode: "collect" } } };
  const putBack = told({ qty: 1, total: 105, delivery: 0 }, raised), undoneBack = told({ qty: 1, total: 110, delivery: 0, undo: true }, raised);
  ok(putBack.w && putBack.w.k === "changed" && putBack.v.changed === undefined && undoneBack.v.changed === undefined,
    "T7: a change put back says changed, never a discount, and the Bill's line goes, as with an undo: " + JSON.stringify([putBack.w, putBack.v.changed, undoneBack.v.changed]));
  ok(cheaper.v.changed && cheaper.v.changed.kind === "discount" && JSON.stringify(cheaper.v.changed.was) === JSON.stringify({ qty: 1, total: 105, delivery: 0, mode: "collect" }),
    "T3: the order keeps what it was before his newest change, and their view carries it: " + JSON.stringify(cheaper.v.changed));
  const bk4 = decideDesk(order({ status: "done", queued: { paid: 0, moved: 1 } }), { restate: { qty: 1, total: 105, delivery: 0, paid: 20, moved: 1, book: true } }, at.toISOString());
  ok(bk4.ev && !bk4.ev.tell && decideDesk(order(), { restate: { qty: 1, total: 105, delivery: 15, mode: "deliver", tell: "yes" } }, at.toISOString()).error,
    "T4: the book's money alone coming back is not told, and a restate's tell is true or absent: " + JSON.stringify(bk4.ev));
  ok(NEWS.changed === "Your order has changed" && NEWS.discount === "You have received a discount on your order",
    "T5: the customer's phone knows both banners, in his words: " + JSON.stringify([NEWS.changed, NEWS.discount]));
  const fx = buildAll ? buildAll() : null, line = FEATURES.find(([n]) => /a discount after confirming/.test(n));
  ok(!!line && Object.values(fx || {}).some((f) => line[1](f)), "T6: the practice accounts carry an order given a discount, its Bill saying what it was");
  /* M6 */
  const owner = readFileSync(new URL("../stmt/owner.js", import.meta.url), "utf8");
  const { REFUSALS } = (() => { const m = /var REFUSALS=(\{[\s\S]*?\n  \});/.exec(owner); return { REFUSALS: m ? new Function("return " + m[1])() : {} }; })();
  ok(/Deliver/.test(REFUSALS["a collection carries no delivery charge"] || "") && /Deliver/.test(REFUSALS["the delivery charge is a figure from nothing, and nothing on a collection"] || ""),
    "M6: Salt Admin words a charge on a collection, from the Desk and from the order book, and names Deliver");
}
