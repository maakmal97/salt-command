/* test/admin-ac-card.mjs: SALT ADMIN A TO C, P1 AND P2 (20 Oct 2026; docs/plan-counter-admin-ac.html). His order card in the Counter's language.
 * What is proved here, each check red under its own mutation (test/admin-ac-card.mutations.json):
 *   1  the head is the band (canvas V11): the action as a chip by the short reference, the units as the heading over the buyer's code, the
 *      goods' total, and the way ("<place> · ASAP · +RM n delivery" or "Collect at <code>")
 *   2  a collection waiting at one of his points is itself the link to the maps app, read off the order's own snapshot, and plain text once
 *      the goods are all handed over
 *   3  the receipt: each payment received with its way and its day where they add up to what is paid; Owed stands in the due row only while
 *      something is owed; Settled when nothing is
 *   4  Details carries the area and the sheet an order belongs to
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const base = { u: "abcd-efgh", product: "salt", delivery: 0, msgs: [], history: [], at: "2026-10-10T02:00:00.000Z" };
const extra = [
  { ...base, id: "ord-rz", status: "ready", mode: "collect", qty: 2, total: 100, paid: 100, moved: 0, point: "Z9", pointAt: { lat: 3.14786, lng: 101.69369 },
    payments: [{ at: "2026-10-10T03:00:00.000Z", amount: 40, method: "transfer" }, { at: "2026-10-10T04:00:00.000Z", amount: 60, method: "cod" }] },
  { ...base, id: "ord-ry", status: "ready", mode: "collect", qty: 1, total: 100, paid: 0, moved: 1, point: "Z9", pointAt: { lat: 3.14786, lng: 101.69369 }, payments: [] },
  { ...base, id: "ord-ad", status: "acknowledged", mode: "deliver", place: "Lirau", qty: 1, total: 100, delivery: 10, paid: 40, sheet: "sh-1",
    payments: [{ at: "2026-10-10T03:00:00.000Z", amount: 40, method: "transfer" }] },
  { ...base, id: "ord-ae", status: "acknowledged", mode: "deliver", place: "Lirau", qty: 1, total: 50, delivery: 0, paid: 0, sheet: "sh-1", product: "oil", payments: [] }
];

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }) });
  try {
    await p.work.quiet();
    const d = p.d, go = async (part) => { byAct(d, "nav.orders").click(); await p.work.quiet(); byAct(d, "part.orders." + part).click(); await p.work.quiet(); };
    const tap = async (id) => { byAct(d, "order.open", id).click(); await p.work.quiet(); return p.card(id); };
    await go("ready");
    const R = await tap("ord-rz"), head = R && R.querySelector(".ohead");
    /* 1 */
    /* 20 Oct 2026 (canvas V11): the action as a chip by the reference, the units as the heading over the buyer's code, the goods' total beside */
    ok(!!head && head.classList.contains("salt-band") && t(head.querySelector(".salt-band__head .salt-status")) === "To hand over"
      && /^[A-Z0-9]{4}-[A-Z0-9]{3}$/.test(t(head.querySelector(".salt-band__ref[data-ref]"))) && t(head.querySelector("h3.ostate")) === "2 units"
      && t(head.querySelector(".ogoods__who")) === "CX1-ZED" && t(head.querySelector(".ogoods__total")) === "RM 100.00",
      "his order's head is the band: the action as a chip by the short reference, the units as the heading over the buyer, the goods' total: " + t(head));
    ok(t(head.querySelector(".oway")) === "Collect at Z9", "a collection says where: " + t(head && head.querySelector(".oway")));
    /* 2 */
    const pin = head && head.querySelector("a.oway--link");
    ok(!!pin && /3\.14786,101\.69369/.test(pin.getAttribute("href")) && pin.getAttribute("aria-label") === "Point Z9 in maps",
      "a collection waiting at his point is itself the link to the maps app, at the point's own place: " + (pin && pin.getAttribute("href")));
    /* 3 */
    const pays = [...R.querySelectorAll(".ordmoney [data-pay]")].map((r) => [t(r.querySelector(".salt-ledger__sub")), t(r.querySelector(".salt-ledger__value"))]);
    ok(pays.length === 2 && /^DuitNow Transfer, /.test(pays[0][0]) && /^RM 40/.test(pays[0][1]) && /, /.test(pays[1][0]) && /^RM 60/.test(pays[1][1]),
      "each payment received stands on its own line with its way and its day: " + JSON.stringify(pays));
    const settled = [...R.querySelectorAll(".ordmoney .salt-ledger__row")].find((r) => /^Settled/.test(t(r)));
    ok(!!settled && !!settled.querySelector(".osettled") && !R.querySelector(".ordmoney .salt-ledger__row--due"),
      "paid in full, the card says Settled and draws no due row");
    const Y = await tap("ord-ry");
    ok(!!Y && !Y.querySelector(".ohead a.oway--link") && t(Y.querySelector(".ohead .oway")) === "Collect at Z9", "all handed over, the way is no longer a link");
    await go("confirmed");
    const A = await tap("ord-ad"), due = A && A.querySelector(".ordmoney .salt-ledger__row--due");
    ok(!!due && /^Owed/.test(t(due)) && /RM 70/.test(t(due)) && t(A.querySelector(".ohead .oway")) === "Lirau · ASAP · +RM 10.00 delivery"
      && t(A.querySelector(".ohead .salt-band__head .salt-status")) === "To make ready",
      "something owed stands in the due row, and a delivery says where to and when, as the customer reads it: " + t(due) + " / " + t(A && A.querySelector(".oway")));
    /* 4 */
    const rows = [...A.querySelectorAll("details .salt-ledger__row")].map((r) => t(r));
    ok(rows.some((x) => /^Area\s*Lirau/.test(x)) && rows.some((x) => /^Sheet\s*1 of 2/.test(x)),
      "Details says the area and which of a sheet's orders it is: " + JSON.stringify(rows));
  } finally { p.w.close(); }
}
