/* test/cash-roads.mjs: TWO MONEY GAPS THE REVIEW FOUND WHILE v1566 LANDED (its notes 5 and 6, 25 Nov 2026), and his answers of that day: a lot's paid
 * money stays what it was when its price moves, either way; and Correct a row no longer sets Cash paid, which Record moves (a raise as a payment, a
 * lot's lower asked and naming the cash it was read with, a sale's lower by Undo). Each check red under its own mutation
 * (test/cash-roads.mutations.json), invented codes only (rule 2):
 *   P1  a lot stored paid with no cash figure, its total raised by Correction: it keeps the old total as its cash, reads partial, owes the difference,
 *       drops its paid day, and its trail says both
 *   P2  its total lowered: it keeps the old total as its cash and reads paid (overpaid, as a lot with its cash written already reads)
 *   P3  the undo of P1's step puts the lot back: paid in full, at its old total, on its paid day
 *   P4  a Modification raising the total does the same as P1
 *   P5  a lot with its cash written, a total sent unchanged (by Correction or Modification), an unpaid lot and a lot only agreed are as before
 *   C1  Correct a row's catalog offers no Cash paid, Settled RM, units handed over or units received (his answers: each moves on Record)
 *   C2  the Desk refuses a Correction setting any of them, a sale's cash lower or higher, a lot's raised or cleared, naming Record
 *   C3  and still drafts a lot's lower from Record, naming the cash it was read with
 *   D1  the Approve card says a lot paid in full and raised owes the difference */
import { applyAmend } from "../engine/apply.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerInputCatalog, makerLedgerAmendment } from "../src/maker-inputs.js";
import { readBook } from "../tools/book.mjs";

const J = JSON.stringify, E = POSITION_ENGINE;
const D = "2026-11-20";
/* a lot paid in full before lots carried their cash: status "paid" and no cash field */
const bare = (rid, more = {}) => ({ rid, supplier: "SX9-ZED", product: "salt", qty: 2, total: 100, status: "paid", date: D, paidOn: D, receivedOn: D, receivedQty: 2, ...more });
const correct = (row, fields, more = {}) => applyAmend(row, { date: "2026-11-25", kind: "Correction", cash: 0, kg: 0, fields, ...more }, "BUY", null);

export async function run({ ok }) {
  /* P1 */
  const up = bare("zr1");
  correct(up, { total: 120 });
  const step = up.amend[up.amend.length - 1];
  ok(up.cash === 100 && up.status === "partial" && E.poCash(up) === 100 && E.poOwed(up) === 20 && E.poStat(up).pay === "Partial"
    && J(step.was) === J({ total: 100, paidOn: D }) && up.paidOn === undefined
    && /cash \(unset\) to 100, what was paid is kept as the price moves/.test(up.mod) && /paidOn 2026-11-20 to \(cleared\), the lot is no longer paid in full/.test(up.mod),
    "P1: a paid lot with no cash figure, its total raised, keeps its old total as cash, owes the difference and drops its paid day: " + J([up.cash, up.status, E.poOwed(up), step.was, up.mod]));

  /* P2 */
  const down = bare("zr2");
  correct(down, { total: 80 });
  ok(down.cash === 100 && down.status === "paid" && E.poCash(down) === 100 && E.poOwed(down) === 0 && down.paidOn === D,
    "P2: its total lowered, it keeps the RM 100 it paid and reads paid: " + J([down.cash, down.status, E.poCash(down)]));

  /* P3 */
  const u = E.undoOf(up, up.amend.length - 1);
  if (!u.fault) correct(up, u.fields, { undo: u.i });
  ok(!u.fault && J(u.fields) === J({ total: 100, paidOn: D }) && up.total === 100 && up.cash === 100 && up.status === "paid" && up.paidOn === D && E.poCash(up) === 100 && E.poOwed(up) === 0,
    "P3: the undo of that step puts the lot back, paid in full at its old total on its paid day: " + J([u.fault || u.fields, up.total, up.cash, up.status, up.paidOn, E.poCash(up)]));

  /* P4 */
  const mod = bare("zr3");
  applyAmend(mod, { date: "2026-11-25", kind: "Modification", cash: 0, kg: 0, newQty: 2, newTotal: 130 }, "BUY", null);
  ok(mod.cash === 100 && mod.status === "partial" && E.poOwed(mod) === 30 && mod.paidOn === undefined
    && /; cash \(unset\) to 100, what was paid is kept as the price moves; paidOn 2026-11-20 to \(cleared\)/.test(mod.mod),
    "P4: a Modification raising the total keeps what was paid as cash: " + J([mod.cash, mod.status, E.poOwed(mod)]));

  /* P5 */
  const written = bare("zr4", { cash: 100 }), same = bare("zr9"), unpaid = bare("zr5", { status: "unpaid", paidOn: undefined }), agreed = bare("zr6", { pending: true, status: "unpaid", paidOn: undefined, receivedQty: 0 });
  const modSame = bare("zr11"), modWritten = bare("zr12", { cash: 100 });
  applyAmend(modWritten, { date: "2026-11-25", kind: "Modification", cash: 0, kg: 0, newQty: 2, newTotal: 130 }, "BUY", null);
  applyAmend(modSame, { date: "2026-11-25", kind: "Modification", cash: 0, kg: 0, newQty: 3, newTotal: 100 }, "BUY", null);
  correct(written, { total: 120 }); correct(same, { total: 100, receivedOn: "2026-11-21" }); correct(unpaid, { total: 120 }); correct(agreed, { total: 120 });
  ok(written.cash === 100 && written.status === "partial" && !("cash" in unpaid) && unpaid.status === "unpaid" && !("cash" in agreed) && E.poCash(agreed) === 0
    && !("cash" in same) && same.status === "paid" && !("cash" in modSame) && modSame.status === "paid" && modSame.paidOn === D && modWritten.cash === 100 && modWritten.status === "partial" && !/cash \(unset\)/.test(modWritten.mod) && !/cash \(unset\)/.test(written.mod + same.mod + unpaid.mod + agreed.mod),
    "P5: a lot with its cash written, a total sent unchanged, an unpaid lot and an agreed lot are as before: " + J([written.cash, written.status, unpaid.cash, unpaid.status, agreed.cash]));

  /* C1 to C3, on the Desk's road over the live book with three invented rows */
  const source = await readBook();
  const { w, version } = source;
  try {
    const copy = JSON.parse(JSON.stringify(source.ledger));
    copy.sales = copy.sales.concat([{ rid: "zr7", customer: "CX9-ZED", date: D, qty: 2, total: 200, cost: 90, cash: 50, deliveredQty: 1, handover: "collected", delivery: 0 }]);
    copy.purchases = copy.purchases.concat([bare("zr8", { cash: 50, status: "partial", paidOn: undefined }), bare("zr10")]);
    const book = { sales: copy.sales, purchases: copy.purchases, state: copy, version, pricing: copy.PRICING };
    const today = w.eval("TODAY.toISOString().slice(0,10)");
    let n = 0;
    const amend = (rid, extra) => makerLedgerAmendment({ at: "2026-11-25T03:00:" + String(n++).padStart(2, "0") + ".000Z", rid, kind: "Correction", date: today, ...extra }, book);

    /* C1 */
    const fields = makerInputCatalog(book).correctionFields.map((f) => f.field);
    ok(["cash", "settledRM", "deliveredQty", "receivedQty"].every((f) => !fields.includes(f)) && ["total", "qty", "paidOn", "deliveredOn", "handover"].every((f) => fields.includes(f)),
      "C1: Correct a row offers no paid, settled, handed over or received figure: " + fields.join(","));

    /* C2 */
    const refused = [amend("zr7", { fields: { cash: 20 } }), amend("zr7", { fields: { cash: 80 } }), amend("zr8", { fields: { cash: 70 } }), amend("zr7", { fields: { cash: 20, total: 210 } }),
      amend("zr7", { fields: { settledRM: 30 } }), amend("zr7", { fields: { deliveredQty: 2 } }), amend("zr8", { fields: { receivedQty: 1 } }),
      amend("zr8", { fields: { cash: 40, receivedQty: 1 }, expect: { cash: 50 } }), amend("zr8", { fields: { cash: null } })];
    ok(refused.every((r) => !r.entry && /^Paid, settled, handed over and received figures change on Record/.test(r.error || "")),
      "C2: a Correction setting what a row holds paid, settled, handed over or received is refused, naming Record, a lot's lower carrying another alike: " + J(refused.map((r) => r.error)));

    /* C3 */
    const lower = amend("zr8", { fields: { cash: 40 }, expect: { cash: 50 } });
    ok(lower.entry && !lower.error && J(lower.entry.payload.fields) === J({ cash: 40 }) && J(lower.entry.payload.expect) === J({ cash: 50 }),
      "C3: a lot's lower from Record, naming the cash it was read with, is still drafted: " + J(lower.error || lower.entry.payload));

    /* D1 */
    const raised = amend("zr10", { fields: { total: 130 } }), said = J((raised.draft && raised.draft.flags) || []);
    ok(raised.entry && /The lot was paid in full at RM 100; at RM 130 it owes RM 30\./.test(said),
      "D1: the Approve card says a lot paid in full and raised owes the difference: " + J(raised.error || said));
  } finally { w.close(); }
}
