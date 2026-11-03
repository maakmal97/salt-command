/* test/close-queue.mjs: 4 Nov 2026, his yes after the ledger conventions. A new sale is a site order: the queue's roads (the drafter's pass, its dry run and
 * tools/drafts.mjs --from-queue) refuse a new sale with no site order behind it and no Salt Admin request, through one rule, queueSaleFault. The pass itself is
 * driven in Fold 1.4 (a Desk sale lands in refused with these words). draftRow, the law, is unchanged. Each check red under its own mutation
 * (test/close-queue.mutations.json); invented codes only. */
export async function run({ ok }) {
  const { queueSaleFault, QUEUE_SALE_REFUSAL } = await import("../src/drafter.js");
  const e = (payload, top = {}) => ({ at: "2026-11-04T01:00:00.000Z", payload: { mode: "new", direction: "SELL", party: "ZZ1-AAA", qty: 1, total: 120, ...payload }, ...top });
  ok(queueSaleFault(e({})) === QUEUE_SALE_REFUSAL && /Order for them/.test(QUEUE_SALE_REFUSAL),
    "Q1: a new sale from the Desk's or the laptop's queue, with no site order and no Salt Admin request, is refused and says where to place it");
  ok(queueSaleFault(e({ direction: "sell" })) === QUEUE_SALE_REFUSAL && queueSaleFault(e({ mode: undefined })) === QUEUE_SALE_REFUSAL,
    "Q1: whatever the case of its direction, and with no mode at all");
  ok(queueSaleFault(e({}, { orderId: "20261104010101-abcdef" })) === null && queueSaleFault(e({}, { makerRequest: "f".repeat(64) })) === null,
    "Q2: a site order's sale and a Salt Admin entry pass");
  ok(queueSaleFault(e({ direction: "BUY", party: "ZZ9-SUP" })) === null && queueSaleFault(e({ mode: "amend" })) === null && queueSaleFault(e({ mode: "gift" })) === null,
    "Q3: a purchase, a change to a booked row and a gift pass");
  ok(queueSaleFault(e({}, { at: "2026-11-03T23:59:59.000Z" })) === null && queueSaleFault(e({}, { at: "2026-11-04T00:00:00.000Z" })) === QUEUE_SALE_REFUSAL && queueSaleFault(e({}, { at: undefined })) === QUEUE_SALE_REFUSAL,
    "Q4: from 04 Nov 2026: a sale queued the day before is still drafted, one stamped that day or with no stamp is refused");
}
