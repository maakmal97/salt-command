/* test/admin-record-pricing.mjs: SALT ADMIN RECORD, P8, PRICING IN HIS ORDER (25 Oct 2026; his canvas Salt Admin Record and his Ask G). What is proved here, red under its
 * own mutation (test/admin-record-pricing.mutations.json):
 *   1  Pricing's menu stands in his order: Printed sizes, then Desk reminders (Their % and Partner moved to the account card on 26 Oct 2026), and draws no row for either
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d;
    enter(d, "record", "pricing"); await p.work.quiet();
    const order = [...d.querySelectorAll('#makerMenu .formlist[data-in="record.pricing"] [data-act="record.form"]')].map((r) => r.getAttribute("data-key"));
    ok(J(order) === J(["printed-sizes", "desk-reminders"]), "Pricing stands as Printed sizes, then Desk reminders, and draws no row for Their % or Partner: " + J(order));
  } finally { p.w.close(); }
}
