import { readFileSync } from "node:fs";
import { join } from "node:path";
import { draftRow } from "../src/drafter.js";
import { readBook } from "../tools/book.mjs";
import { apply as foldApply } from "../tools/fold.mjs";

const REPO = join(import.meta.dirname, "..");

export async function run({ ok }) {
  const src = await readBook();
  const fresh = () => JSON.parse(JSON.stringify(src.ledger));
  const entry = (rid) => ({ at: "2026-10-06T01:00:00Z", type: "SELL", party: "CY2-NIL", qty: 0, total: 0, status: "Cancellation", raw: "x",
    payload: { mode: "amend", kind: "Cancellation", direction: "SELL", party: "CY2-NIL", rid, date: "2026-10-06", qty: 0, total: 0, cash: 0, kg: 0 } });
  const withRow = (row) => { const c = fresh(); c.sales.push(row); return { c, book: { sales: c.sales, purchases: c.purchases, state: c, version: "v1", pricing: c.PRICING } }; };
  const base = { date: "2026-10-01", customer: "CY2-NIL", qty: 2, total: 200, cost: 50, deliveredQty: 0 };

  const paid = withRow({ ...base, rid: "pc-paid", cash: 80 });
  const d = draftRow(entry("pc-paid"), paid.book);
  ok(d.flags.some((f) => /Cancels with RM 80 paid/.test(f) && /refund payable/.test(f) && /paidOn/.test(f)),
    "the approver's card says a paid cancel raises a refund payable, with the sum: " + JSON.stringify(d.flags));
  const unpaid = withRow({ ...base, rid: "pc-free", cash: 0 });
  ok(!draftRow(entry("pc-free"), unpaid.book).flags.some((f) => /refund payable/.test(f)), "an unpaid cancel carries no refund flag");
  const moved = withRow({ ...base, rid: "pc-out", cash: 80, deliveredQty: 1 });
  ok(!draftRow(entry("pc-out"), moved.book).flags.some((f) => /refund payable/.test(f)), "a paid row with goods out carries the moved warning, not the refund flag");

  const fold = withRow({ ...base, rid: "pc-fold", cash: 80 });
  const n = (fold.c.customerRefunds || []).length;
  const staged = { approved: [{ id: "x1", amends: "pc-fold", amendKind: "Cancellation", collection: "sales",
    entry: { payload: { direction: "SELL", kind: "Cancellation", date: "2026-10-06" } },
    row: fold.c.sales.at(-1), pay: { kind: "Cancellation", date: "2026-10-06" } }] };
  const notes = { version: "v9999", title: "t", notes: ["n"], rows: { x1: { note: "cancelled" } } };
  const res = foldApply(fold.c, staged, notes, readFileSync(join(REPO, "master", "salt_command.html"), "utf8"));
  const rows = (fold.c.customerRefunds || []).slice(n);
  ok(res && res.ok !== false && rows.length === 1 && rows[0].rid === "pc-fold" && rows[0].amount === 80 && !rows[0].paidOn,
    "the fold of a paid Counter cancel opens exactly one refund for what was paid, with no paidOn: " + JSON.stringify(rows));
}
