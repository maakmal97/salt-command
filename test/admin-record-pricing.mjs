/* test/admin-record-pricing.mjs: SALT ADMIN RECORD, P8, PRICING IN HIS ORDER (25 Oct 2026; his canvas Salt Admin Record and his Ask G). What is proved here, red under its
 * own mutation (test/admin-record-pricing.mutations.json):
 *   1  Pricing's menu leads with the form he uses most: Their %, Partner, Printed sizes, Desk reminders; a form it does not name keeps its place after them
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
    ok(J(order.filter((k) => ["their", "partner", "printed-sizes", "desk-reminders"].includes(k))) === J(["their", "partner", "printed-sizes", "desk-reminders"]) && order[0] === "their",
      "Pricing leads with Their %, then Partner, Printed sizes and Desk reminders: " + J(order));
  } finally { p.w.close(); }
}
