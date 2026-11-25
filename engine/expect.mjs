/* engine/expect.mjs: A CORRECTION THAT TAKES BACK NAMES THE ROW IT WAS MEASURED ON (18 Nov 2026, the order-changes plan, version 4, Fable's review).
 * A lower of what is paid or handed over, from Salt Admin's Change sheet, is a Correction setting the row's `cash` or `deliveredQty` to absolute
 * figures. A payment or a handover that reached the row while it waited under Approve would be written over by them, and the return leg would then
 * lower the order to match, silently. So the Correction carries `expect`, the row's figures when it was measured, and the drafter, the fold's plan
 * and the booking law check them on the row as it then stands: any difference refuses it, and the order heals off the row.
 *
 * PURE, and it imports nothing, so the drafter (src/drafter.js), the taps (engine/stages.mjs) and the booking law (engine/apply.mjs, which must not
 * reach the drafter) read one copy. Nothing under stmt/ imports it. */

/** A lot's units received as the engine reads them (poRecvUnits in engine/position.mjs), copied because this file imports nothing; the suite holds
 *  the two equal over every state a lot takes (25 Nov 2026). A lot stored with no receivedQty has received its whole qty unless it is in transit, so
 *  that is the figure such a lot was measured on, never 0. */
export function recvOf(p) {
  if (!p || p.cancelled || p.defaulted || p.pending) return 0;
  if (p.receivedQty != null) return Math.max(0, Math.min(+p.receivedQty, +p.qty || 0));
  return p.inTransit ? 0 : +p.qty || 0;
}

/** "" when the row still holds what the Correction was measured on (or it names nothing), else why not. */
export function expectFault(row, expect) {
  if (expect === undefined) return "";
  if (!expect || typeof expect !== "object" || Array.isArray(expect) || !Object.keys(expect).length
    || Object.keys(expect).some((k) => !["cash", "deliveredQty", "receivedQty"].includes(k) || typeof expect[k] !== "number" || !Number.isFinite(expect[k])))
    return "it names the row's figures in a shape the desk does not make";
  const cash = +((row && row.cash) || 0), deliv = +((row && row.deliveredQty) || 0);
  /* 25 Nov 2026: a lot's units received set on Correct a row, measured as the engine reads them, so a Receipt approved while it waits refuses it */
  if (expect.receivedQty !== undefined && Math.abs(recvOf(row) - expect.receivedQty) > 0.0004)
    return "the lot's goods moved since it was measured (" + +recvOf(row).toFixed(4) + " unit received, not " + +expect.receivedQty.toFixed(4) + ")";
  if (expect.cash !== undefined && Math.abs(cash - expect.cash) > 0.004)
    return "the row's money moved since it was measured (RM " + cash.toFixed(2) + ", not RM " + expect.cash.toFixed(2) + ")";
  if (expect.deliveredQty !== undefined && Math.abs(deliv - expect.deliveredQty) > 0.0004)
    return "the row's goods moved since it was measured (" + deliv + " unit, not " + expect.deliveredQty + ")";
  return "";
}
