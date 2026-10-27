/* test/cash-over.mjs: CASH PAST WHAT THE ORDER OWES (27 Oct 2026, his word: "input cash paid more than price (goods), but it will add to the refund
 * table"). The order card's Cash received takes more than the order owes, goods plus delivery the measure, and says the excess, which the fold raises
 * as a customerRefunds row (refundOnOverpay, unchanged). What is proved here, each check red under its own mutation (test/cash-over.mutations.json):
 *   1  the Desk's cashTap takes cash past what is owed and carries the excess as `refund`, on the tap and on what he was shown; cash within it carries none
 *   2  it is still refused beside a claim of theirs, and on an order that owes nothing
 *   3  the row's room still refuses it while other money is on its way to the row, or while the row owes another figure than the order
 *   4  the Counter's own cash event takes the same cash and refuses the same two cases
 *   5  an overpay rejected under Approve is offered again on the order as it stood before it (Fable's review) */
import { cashTap, pastRoom, againRoomOrder } from "../engine/stages.mjs";
import { decideDesk } from "../stmt/orders.js";

const J = JSON.stringify;

export async function run({ ok }) {
  const at = new Date("2026-10-27T03:00:00.000Z");
  const base = () => ({ id: "ord-over", u: "1111-2222", code: "AB1-CDE", product: "salt", status: "ready", mode: "collect", qty: 1, total: 100, delivery: 10,
    paid: 0, ledgerKey: "AB1-CDE|2026-10-26|1|100", payments: [], history: [] });
  const room = (owes, on) => () => ({ owes, on, left: +(owes - on).toFixed(2) });
  const tap = (o, amount, r) => cashTap(o, at, { amount }, { rej: null, room: r || room(110, 0) });

  /* 1 */
  const a = tap(base(), 120);
  ok(a.entry && !a.error && a.refund === 10 && a.shown && a.shown.refund === 10 && a.site.cash.amount === 120 && +a.entry.payload.cash === 120,
    "cash past what the order owes is taken whole, and RM 10.00 over goods plus delivery rides as the refund: " + J({ error: a.error, refund: a.refund, shown: a.shown }));
  const b = tap(base(), 110);
  ok(b.entry && !b.error && !("refund" in b) && !("refund" in b.shown), "cash of exactly what is owed carries no refund: " + J({ error: b.error, refund: b.refund }));

  /* 2 */
  const c = tap(Object.assign(base(), { claimed: 20 }), 100);
  ok(!!c.error && /beside what they say they sent/.test(c.error) && !c.entry, "beside a claim of theirs, cash past what is owed less the claim is refused: " + J(c));
  const d = tap(Object.assign(base(), { paid: 110 }), 5);
  ok(!!d.error && /RM 0\.00 still owed/.test(d.error) && !d.entry, "on an order that owes nothing, cash is refused: " + J(d));

  /* 3 */
  const e = tap(base(), 120, room(140, 30));   /* what it can still take agrees with the order; only the money on its way refuses */
  ok(e.status === 409 && /on its way already/.test(e.error || "") && !e.entry, "with other money on its way to the row, cash past what it can take is refused: " + J(e));
  const f = tap(base(), 50, room(40, 0));
  ok(f.status === 409 && /can still take/.test(f.error || ""), "a row owing less than the order still refuses cash that is within the order: " + J(f));
  const f2 = tap(base(), 120, room(40, 0));
  ok(f2.status === 409 && /can still take/.test(f2.error || "") && !f2.entry, "and refuses cash past both, so the refund he is told is never another than the fold raises: " + J(f2));

  /* 5: the site counts the rejected RM 120 already; offered again, it is measured on the order before it */
  const rej = { entry: { payload: { cash: 120 } } }, paidOn = Object.assign(base(), { paid: 120 });
  const again = pastRoom(room(110, 0), againRoomOrder(paidOn, rej, "cash"), { payload: { cash: 120 } }, "offered again", false, true);
  ok(again === null && againRoomOrder(paidOn, rej, "pay").paid === 120 && paidOn.paid === 120,
    "an overpay rejected and offered again passes on the order as it stood before it, and a claim's is measured as it was: " + J(again));

  /* 4 */
  const g = decideDesk(base(), { cash: { amount: 120 } }, at.toISOString());
  ok(g && g.ev && g.ev.kind === "cash" && g.ev.amount === 120, "the Counter's cash event takes cash past what is owed: " + J(g));
  const h = decideDesk(Object.assign(base(), { payments: [{ claim: "waiting", amount: 20, at: "2026-10-26T03:00:00.000Z" }] }), { cash: { amount: 100 } }, at.toISOString());
  ok(h && h.status === 400 && /outstanding/.test(h.error || ""), "and refuses it beside a claim of theirs: " + J(h));
  const i = decideDesk(Object.assign(base(), { paid: 110 }), { cash: { amount: 5 } }, at.toISOString());
  ok(i && i.status === 400 && /outstanding/.test(i.error || ""), "and on an order that owes nothing: " + J(i));
}
