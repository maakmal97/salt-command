/* test/order-told-page.mjs: THE CUSTOMER'S BILL SAYS WHAT WE CHANGED (17 Nov 2026, the order-changes plan's version 1, his answers as recommended).
 * An order whose terms we changed carries `changed` {at, kind, was}; its Bill draws one line, "Changed on" or "Discount on" with the day, and
 * under it what the order was: the size, the goods and the way (delivered for its charge, or to collect).
 *   P1  a discount's line reads Discount on its day and what it was, to collect
 *   P2  a change of way reads Changed on its day and what it was, delivered for its charge
 *   P3  an order we never changed draws no such line
 * Every assertion is red under its own mutation (test/order-told-page.mutations.json). */
import { open, txt, ago, ord } from "./counter-b-kit.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const money = async (p, id) => {
    const row = p.d.querySelector('[data-row="' + id + '"]');
    if (row) { row.click(); await p.settle(); }
    return [...p.d.querySelectorAll('[data-part="money"] .salt-settings__row')].map((r) => [".salt-settings__label", ".salt-settings__value", ".salt-settings__sub"].map((q) => txt(r.querySelector(q))).join(" ").trim());
  };
  try {
    const at = ago(1);
    const disc = ord("20261117000000-td1", "acknowledged", ago(2), { qty: 1, total: 95, changed: { at, kind: "discount", was: { qty: 1, total: 105, delivery: 0, mode: "collect" } } });
    const A = await page({ orders: [disc] }), a = await money(A, "20261117000000-td1");
    const lineA = a.find((r) => /^Discount on /.test(r)) || "";
    ok(/It was 1 unit for RM 105\.00, to collect$/.test(lineA), "P1: a discount's Bill line says Discount on its day and what the order was: " + J(a));
    const moved = ord("20261117000000-td2", "acknowledged", ago(2), { qty: 1, total: 105, mode: "collect", changed: { at, kind: "changed", was: { qty: 1, total: 105, delivery: 15, mode: "deliver" } } });
    const B = await page({ orders: [moved] }), b = await money(B, "20261117000000-td2");
    const lineB = b.find((r) => /^Changed on /.test(r)) || "";
    ok(/It was 1 unit for RM 105\.00, delivered for RM 15\.00$/.test(lineB), "P2: a change of way's Bill line says Changed on its day and what the order was: " + J(b));
    const plain = ord("20261117000000-td3", "acknowledged", ago(2), { qty: 1, total: 105 });
    const C = await page({ orders: [plain] }), c = await money(C, "20261117000000-td3");
    ok(c.length > 0 && !c.some((r) => /^(Changed|Discount) on /.test(r)), "P3: an order we never changed draws no such line: " + J(c));
  } finally { for (const p of pages) p.close(); }
}
