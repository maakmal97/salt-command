/* test/admin-ac-sheet.mjs: SALT ADMIN A TO C, P5 (20 Oct 2026; docs/plan-counter-admin-ac.html; his answer: a basket shown grouped, each agreed alone).
 * What is proved here, each check red under its own mutation (test/admin-ac-sheet.mutations.json):
 *   1  on Orders a sheet's orders at one stage stand in one group card, each its own row, under them the sheet's delivery on its first order and
 *      the goods of all of them; an order alone stands alone
 *   2  an order of a sheet says which of it in its band ("Sheet 2 of 2"), a link that closes the order and goes back to the sheet's group
 *   3  Needs you shows one card for a sheet's placed orders, saying how many (in the title's full sentence, a reader's; the card draws no why or what line since
 *      22 Oct 2026) and drawing the sum of all of them as its figure, and none for the others
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const base = { u: "abcd-efgh", product: "salt", msgs: [], history: [], payments: [], paid: 0, status: "placed", qty: 1, at: "2026-10-10T02:00:00.000Z" };
const extra = [
  { ...base, id: "ord-s1", mode: "deliver", place: "Lirau", total: 100, delivery: 10, sheet: "sh-9" },
  { ...base, id: "ord-s2", mode: "deliver", place: "Lirau", total: 50, delivery: 0, sheet: "sh-9", product: "oil" },
  { ...base, id: "ord-s3", mode: "collect", total: 70, delivery: 0 },
  /* a sheet whose orders have parted: one agreed, one still placed */
  { ...base, id: "ord-s4", mode: "collect", total: 40, delivery: 0, sheet: "sh-8" },
  { ...base, id: "ord-s5", mode: "collect", total: 40, delivery: 0, sheet: "sh-8", status: "acknowledged" }
];

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    /* 3 */
    await click(byAct(d, "nav.needs"));
    const n1 = d.querySelector('#nlist [data-need="o:ord-s1"]');
    const said = n1 && n1.querySelector(".need-tap") ? n1.querySelector(".need-tap").getAttribute("aria-label") : "", fig = n1 ? t(n1.querySelector(".nfig")) : "";
    ok(!!n1 && /2 orders on one sheet/.test(said) && fig === "RM 150" && !d.querySelector('#nlist [data-need="o:ord-s2"]') && !!d.querySelector('#nlist [data-need="o:ord-s3"]'),
      "Needs you shows one card for the sheet, saying how many and the sum of both orders, none for its second order, and the lone order its own: " + said + " | " + fig);
    /* 1 */
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.placed"));
    const g = d.querySelector('#makerOrderList .ordsheet[data-sheet="sh-9"]'), rows = g ? [...g.querySelectorAll("[data-order]")].map((r) => r.getAttribute("data-order")) : [];
    const lines = g ? [t(g.querySelector(".ordsheet__ref")), t(g.querySelector(".ordsheet__sum"))] : [];
    /* 25 Oct 2026 (Ask I): the sheet is headed by its first order's reference, the delivery charge on the right; each order its own card */
    ok(!!g && JSON.stringify(rows.sort()) === JSON.stringify(["ord-s1", "ord-s2"]) && /^Sheet [A-Z0-9]{4}-[A-Z0-9]{3}$/.test(lines[0] || "") && lines[1] === "RM 10 delivery"
      && g.querySelectorAll(":scope > .ordcard").length === 2
      && !d.querySelector('#makerOrderList [data-order="ord-s3"]').closest(".ordsheet") && !d.querySelector('#makerOrderList [data-order="ord-s4"]').closest(".ordsheet"),
      "a sheet's orders stand in one group under its reference, each its own card, the sheet's delivery on the right; a lone order, or one whose sheet has moved on, stands alone: " + JSON.stringify([rows, lines]));
    /* 2 */
    await click(byAct(d, "order.open", "ord-s2"));
    const link = byAct(d, "order.sheet", "ord-s2");
    ok(!!link && link.tagName === "BUTTON" && t(link) === "Sheet 2 of 2" && !!link.closest(".ohead"), "an order of a sheet says which of it in its band: " + t(link));
    await click(link);
    ok(!d.querySelector("#makerReview .ohead") && !!d.querySelector('#makerOrderList .ordsheet[data-sheet="sh-9"]'), "and the link closes the order, back to the sheet's group: " + t(d.querySelector("#makerReview")).slice(0, 80));
  } finally { p.w.close(); }
}
