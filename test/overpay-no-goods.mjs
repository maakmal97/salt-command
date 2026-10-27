/* test/overpay-no-goods.mjs: MONEY PAST AN ORDER IS NO SALT OWED (28 Oct 2026, his word "I do not owe them salt due to the extra prepayment").
 * The engine's txDeferUnits stops the units paid for at the units ordered, so an overpay handed over in full owes no goods out and commits
 * nothing on the shelf; money paid ahead of a handover still does. Each check is proved red by its own mutation
 * (test/overpay-no-goods.mutations.json). The live s296 shape.
 *   1  s296, 5 units for RM 455, RM 480 paid, all handed over: nothing paid ahead of delivery, nothing committed
 *   2  paid ahead with goods still to go: the units paid for and not handed over are still owed, up to the order and no further */
export async function run({ ok }) {
  const { default: PE } = await import("../engine/position.mjs");
  const s296 = { rid: "s296", customer: "CZ4-MK", qty: 5, total: 455, cash: 480, deliveredQty: 5, date: "2026-10-27" };
  /* 1 */
  ok(PE.txDeferUnits(s296) === 0, "s296 paid RM 25 past its RM 455 with all 5 units handed over owes no salt: " + PE.txDeferUnits(s296));
  const c = PE.commitments([s296], 10);
  ok(c.owedUnits === 0 && c.defRows.length === 0 && c.commitUnits === 0, "and commits nothing on the shelf: " + JSON.stringify(c));
  /* 2 */
  ok(Math.abs(PE.txDeferUnits({ qty: 5, total: 455, cash: 273, deliveredQty: 2 }) - 1) < 1e-9, "RM 273 paid at RM 91 a unit with 2 handed over owes 1 unit out");
  ok(PE.txDeferUnits({ qty: 5, total: 455, cash: 480, deliveredQty: 2 }) === 3, "paid past the order with 2 handed over owes the 3 left, not 3.27");
}
