import { openMaster } from "../tools/payload.mjs";
import E from "../engine/position.mjs";

export async function run({ ok }) {
  const lot = { rid: "fixture-lot", supplier: "SX1-ZED", date: "2026-10-01", qty: 2, total: 100 };
  const payment = E.ledgerAmendmentEntry({ at: "2026-10-02T00:00:00.000Z", row: lot, direction: "BUY",
    kind: "Payment", date: "2026-10-02", cash: 50 });
  const receipt = E.ledgerAmendmentEntry({ at: "2026-10-02T00:01:00.000Z", row: lot, direction: "BUY",
    kind: "Receipt", date: "2026-10-02", movedUnits: 1 });
  ok(payment.payload.kind === "Payment" && payment.payload.cash === 50 && payment.payload.kg === 0
    && receipt.payload.kind === "Receipt" && receipt.payload.cash === 0 && receipt.payload.kg === 1,
    "the shared amendment constructor retains incumbent purchase Payment and Receipt as distinct supported movements");
  let refused = 0;
  for (const kind of ["Linked", "Rewarded", "Payment", "Receipt", "unknown"]) {
    try { E.ledgerAmendmentEntry({ row: lot, direction: "SELL", kind, date: "2026-10-02" }); }
    catch (error) { if (error.message === "This amendment kind is retired or unsupported.") refused++; else throw error; }
  }
  ok(refused === 5, "shared amendment construction refuses Linked, Rewarded, unknown kinds and purchase-only movements on sales");
  const { w } = await openMaster();
  try {
    ;
    ;
    ;
    ;
    ;
  } finally { w.close(); }
}
