/* test/refund-credit-p4.mjs: THEIR CREDIT ON THE COUNTER (27 Oct 2026, docs/plan-refund-credit.html P4, his answers). The publish seals their credit
 * beside the price list, outside its stamp, with the rows that spent some; Prices keeps its prices and says the credit once at the top; the basket's
 * bar, the sheet's foot and the check read the goods, then the credit, then what they pay, never under RM 0; an order whose credit the sealed figure
 * does not hold yet is taken off it; the order card says what their credit paid and owes that much less. Every assertion observes the signed-in page
 * in jsdom (test/counter-b-kit.mjs) or the publish's own function; each is proved red by its own mutation (test/refund-credit-p4.mutations.json).
 *   1  the seal: their open refunds as credit, and the rows that spent some, nothing else of a refund
 *   2  Prices: one line at the top, the prices unchanged; none with no credit
 *   3  the bar and the sheet's foot: credit off, what they pay, never under RM 0
 *   4  the check: Your credit, then You pay
 *   5  an order of theirs carrying credit the sealed figure does not hold yet is taken off; one it holds is not
 *   6  the order card: Paid by your credit, and still to pay less it */
import { open, txt, ago, kl, LIST, ord } from "./counter-b-kit.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  /* 1 */
  const { creditSealOf } = await import("../tools/make_statements.mjs");
  const seal = creditSealOf([{ rid: "s1", customer: "CY2-NIL", date: "2026-10-28", product: "salt", qty: 1, total: 100, cash: 25, credit: 25 },
    { rid: "s2", customer: "CY2-NIL", date: "2026-10-29", qty: 1, total: 100, cash: 0, credit: 10, cancelled: true }, { rid: "s3", customer: "CY9-OTH", date: "2026-10-28", credit: 5, cash: 5 }],
    [{ party: "CY2-NIL", rid: "s0", amount: 40, since: "2026-10-27", note: "order s0 paid RM 140" }, { party: "CY2-NIL", amount: 5, paidOn: "2026-10-01" }], "CY2-NIL");
  ok(J(seal) === J({ credit: 40, creditRows: [{ d: "2026-10-28", p: "salt", rm: 25 }] }), "the seal is their RM 40 open and the one live row that spent some, no rid, note or other party: " + J(seal));
  ok(creditSealOf([], [], "CY2-NIL") === null, "with nothing open and nothing spent, nothing is sealed");

  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const withCredit = (c, rows) => Object.assign(LIST(), { credit: c, creditRows: rows || [] });
  const pane = (p, i) => p.d.querySelectorAll("#pPrices .pgrid > .pane")[i];
  const plus = (p, i, q) => pane(p, i).querySelector('[data-add="' + q + '"]');
  const note = (p) => txt(p.d.querySelector("#bkBar .salt-kpi__note"));
  const firstPrice = (p) => txt(pane(p, 0).querySelector(".salt-ledger__value"));
  try {
    /* 2 */
    const A = await page({ list: withCredit(25) }), N = await page({});
    ok(txt(A.d.getElementById("prCredit")) === "RM 25.00 credit comes off your next order" && firstPrice(A) === firstPrice(N) && !txt(N.d.getElementById("prCredit")),
      "Prices says RM 25.00 credit once at the top, every price as it was, and nothing with no credit: " + J([txt(A.d.getElementById("prCredit")), firstPrice(A), firstPrice(N)]));
    /* 3 */
    plus(A, 0, 1).click();
    const B = await page({ list: withCredit(250) });
    plus(B, 0, 1).click();
    ok(note(A) === "RM 25.00 credit off, you pay RM 75.00" && note(B) === "RM 100.00 credit off, you pay RM 0.00",
      "the bar takes the credit off the goods, what they pay never under RM 0: " + J([note(A), note(B)]));
    /* 4 */
    A.d.getElementById("bkGo").click(); await A.settle();
    const rows = [...A.d.querySelectorAll("#osheet .salt-ledger__row")].map((r) => txt(r));
    ok(rows.some((r) => /^Your credit\s*- RM 25\.00/.test(r)) && rows.some((r) => /^You pay\s*RM 75\.00/.test(r)), "the check reads Your credit, then You pay: " + J(rows));
    /* 5 */
    const acked = ord("20261027000000-cr1", "acknowledged", ago(2), { credit: 25, rowOn: kl(0) });
    const C = await page({ list: withCredit(25), orders: [acked] }), D = await page({ list: withCredit(25, [{ d: kl(0), p: "salt", rm: 25 }]), orders: [acked] });
    ok(!txt(C.d.getElementById("prCredit")) && txt(D.d.getElementById("prCredit")) === "RM 25.00 credit comes off your next order",
      "an order's RM 25 the sealed figure does not hold yet is taken off it; once its row is among the sealed rows it is not taken twice: " + J([txt(C.d.getElementById("prCredit")), txt(D.d.getElementById("prCredit"))]));
    /* 6 */
    const row = D.d.querySelector('[data-row="20261027000000-cr1"]');
    if (row) { row.click(); await D.settle(); }
    const money = [...D.d.querySelectorAll(".salt-ledger__row")].map((r) => txt(r));
    ok(money.some((r) => /^Paid by your credit\s*RM 25\.00/.test(r)) && money.some((r) => /^Still to pay\s*RM 75\.00/.test(r)),
      "the order card says what their credit paid, and RM 75.00 still to pay: " + J(money.filter((r) => /credit|Still/.test(r))));
  } finally { for (const p of pages) p.close(); }
}
