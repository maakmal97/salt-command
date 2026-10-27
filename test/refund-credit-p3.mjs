/* test/refund-credit-p3.mjs: HIS ACCEPT SPENDS THEIR CREDIT (27 Oct 2026, docs/plan-refund-credit.html P3). The pending row an Accept makes carries
 * their credit as cash already paid (`credit` saying how much), up to goods and delivery together, the price untouched; the drafter books it with
 * no cost while nothing is handed over; paid in advance is judged on what is left; the Counter's order carries the credit as its own field, never
 * in `paid`, so it owes that much less, and the return leg, a settled order's restatement and the tie-out never tell it as a payment of theirs.
 * Each check is proved red by its own mutation (test/refund-credit-p3.mutations.json). Invented figures on the frozen book.
 *   1  withCredit: cash and credit on the payload, capped at goods and delivery, the note and the raw line say it; none on nought
 *   2  the drafter books `credit` with the cash and no cost; refuses credit past the cash, and on a purchase
 *   3  advanceOf judges paid in advance on what is left after the credit
 *   4  the Counter takes the credit on the acknowledgement as its own field, capped, and the order owes that much less; their page sees it
 *   5  the row's paid read for the order is less its credit (return leg, settled restatement)
 *   6  his preview spends their credit; a second Accept before the fold finds it on its way and spends none; a rejected one releases it;
 *      an order for a friend spends none */
import { readBook } from "../tools/book.mjs";
import { pendingEntry, withCredit, rowPaidFor, settledFromRow, advanceOf, cashTap, claimOrderFlight } from "../engine/stages.mjs";
import { draftRow } from "../src/drafter.js";
import PRICING_ENGINE from "../engine/pricing.mjs";

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const J = JSON.stringify;

export async function run({ ok }) {
  /* 1 */
  const order = { id: "ord-cr1", product: "salt", qty: 1, total: 100, delivery: 10, mode: "deliver" };
  const e = withCredit(pendingEntry(order, "CY2-NIL", new Date("2026-10-28T02:00:00Z")), 25);
  ok(e.payload.cash === 25 && e.payload.credit === 25 && e.payload.total === 100 && /RM 25 of it paid by their credit/.test(e.payload.note) && !/Nothing paid/.test(e.payload.note)
    && /RM 25 paid by their credit, nothing moved/.test(e.raw), "the pending row carries RM 25 of their credit as paid, the goods at RM 100 untouched, and says so: " + J(e.payload));
  const big = withCredit(pendingEntry(order, "CY2-NIL", new Date("2026-10-28T02:00:00Z")), 500);
  ok(big.payload.cash === 110 && big.payload.credit === 110, "credit past what the order comes to is taken up to goods and delivery together: " + J(big.payload.credit));
  const none = withCredit(pendingEntry(order, "CY2-NIL", new Date("2026-10-28T02:00:00Z")), 0);
  ok(none.payload.cash === 0 && !("credit" in none.payload) && /Nothing paid and nothing handed over yet\.$/.test(none.payload.note), "no credit leaves the row as it was");

  /* 2 */
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const book = { version: L.PRICING.v, state: L, sales: L.sales, purchases: L.purchases, pricing: L.PRICING };
  const d = draftRow(e, book);
  ok(!d.skip && d.row.cash === 25 && d.row.credit === 25 && !("cost" in d.row) && d.row.deliveredQty === 0 && !d.row.paidOn,
    "the drafter books RM 25 paid, RM 25 of it credit, and no cost while nothing is handed over: " + J(d.skip || d.row));
  const over = JSON.parse(J(e)); over.payload.credit = 30;
  ok(/more than the RM 25 it is booked as paid/.test(draftRow(over, book).skip || ""), "credit past the cash is refused");
  const buy = JSON.parse(J(e)); buy.payload.direction = "BUY"; buy.type = "BUY";
  ok(/credit is a customer's/.test(draftRow(buy, book).skip || ""), "and credit on a purchase");

  /* 3 */
  const terms = { ceiling: 100, holdDays: 1, lockDays: 4, lateResetRepeat: 3 };
  const ab = { sales: [], purchases: [], state: { TERMS: terms } }, ao = { id: "o1", total: 120, delivery: 0, code: "CY2-NIL" };
  const a1 = advanceOf(ab, ao, "CY2-NIL", 0, { orders: [], today: "2026-10-28", credit: 25 }), a0 = advanceOf(ab, ao, "CY2-NIL", 0, { orders: [], today: "2026-10-28" });
  ok(!a1.error && a1.prepay === false && a1.owedWith === 95 && a0.prepay === true, "paid in advance is judged on the RM 95 left after the credit, under the RM 100 ceiling: " + J([a1, a0]));

  const other = { id: "o2", code: "CY2-NIL", status: "acknowledged", total: 60, delivery: 0, paid: 0, credit: 50, ledgerKey: "CY2-NIL|2026-10-28|60" };
  const a2 = advanceOf(ab, { id: "o1", total: 90, delivery: 0, code: "CY2-NIL" }, "CY2-NIL", 0, { orders: [other], today: "2026-10-28" });
  ok(!a2.error && a2.owedWith === 100 && a2.prepay === false, "another agreed order owes what is left after its own credit: " + J(a2));
  const tapO = { id: "ord-ct", u: "1111-2222", code: "CY2-NIL", product: "salt", status: "ready", mode: "collect", qty: 1, total: 100, delivery: 0, paid: 0, credit: 25,
    ledgerKey: "CY2-NIL|2026-10-28|100", payments: [], history: [] };
  const tap = (amount) => cashTap(JSON.parse(J(tapO)), new Date("2026-10-28T03:00:00Z"), { amount }, { rej: null, room: () => ({ owes: 75, on: 0, left: 75 }) });
  const t75 = tap(75), t100 = tap(100);
  ok(t75.entry && !("refund" in t75) && t100.entry && t100.refund === 25, "cash at the counter is measured on the RM 75 the order owes after its credit: " + J([t75.refund, t100.refund, t100.error]));
  /* 4 */
  const O = await import("../stmt/orders.js");
  const placed = { id: "ord-cr4", u: "1111-2222", code: "CY2-NIL", status: "placed", product: "salt", qty: 1, total: 100, mode: "collect", paid: 0, moved: 0, payments: [], history: [] };
  const dv = O.decideDesk(JSON.parse(J(placed)), { status: "acknowledged", delivery: 0, credit: 25 }, "2026-10-28T02:00:00.000Z");
  const dvBig = O.decideDesk(JSON.parse(J(placed)), { status: "acknowledged", delivery: 0, credit: 500 }, "2026-10-28T02:00:00.000Z");
  ok(dv && dv.ev && dv.ev.credit === 25 && dvBig && dvBig.ev && dvBig.ev.credit === 100, "the acknowledgement takes their credit, never past what the order comes to: " + J([dv && dv.ev, dvBig && dvBig.ev && dvBig.ev.credit]));
  const acked = JSON.parse(J(placed)); O.applyEvent(acked, dv.ev);
  ok(acked.credit === 25 && acked.paid === 0 && O.dueOf(acked) === 75, "the order carries RM 25 of credit apart from paid, and owes RM 75: " + J({ credit: acked.credit, paid: acked.paid, due: O.dueOf(acked) }));
  ok(O.CUSTOMER_FIELDS.includes("credit"), "their page is handed the credit");
  const ahead = Object.assign(JSON.parse(J(acked)), { status: "ready", moved: 0.25 });
  ok(O.aheadOnGoods(ahead) === false && O.aheadOnGoods(Object.assign({}, ahead, { moved: 0.5 })) === true,
    "a quarter handed over against a quarter paid by credit is not goods ahead of money; half is");

  /* 5 */
  const row = { rid: "s9001", customer: "CY2-NIL", qty: 1, total: 100, cash: 100, credit: 25, deliveredQty: 1, date: "2026-10-28" };
  ok(rowPaidFor({ credit: 25 }, row) === 75 && rowPaidFor({}, row) === 100 && rowPaidFor({ credit: 25 }, { cash: 10 }) === 0,
    "what the row says the order paid is less the credit the order carries, never under nought");
  const done = { status: "done", qty: 1, total: 100, delivery: 0, paid: 70, moved: 1, credit: 25, payments: [], queued: { paid: 70, moved: 1 }, mode: "collect" };
  const st = settledFromRow(done, row);
  ok(st && st.paid === 75, "a settled order is restated at RM 75 paid, its RM 25 of credit kept apart: " + J(st));

  const fl = claimOrderFlight([{ customer: "CY2-NIL", date: "2026-10-28", qty: 1, total: 100, cash: 25, credit: 25 }],
    [{ id: "o9", u: "1111-2222", status: "ready", ledgerKey: "CY2-NIL|2026-10-28|100", paid: 0, credit: 25, claimed: 20 }], "1111-2222");
  ok(fl.by["CY2-NIL|2026-10-28|100"] === 20, "the RM 20 they say they sent is in flight, the row's RM 25 being their credit (Fable): " + J(fl.by));
  /* 6: his preview on the desk's own book, a customer with a card and an open RM 25 refund */
  const cardOf = (c, q) => PRICING_ENGINE.cardAt(L.PRICING, c, "salt", q).card;
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((c) => cardOf(c, 1) > 0 && !(L.associates || []).includes(c) && !(L.partners || []).includes(c));
  const refunds = [{ party: customer, rid: "s8001", amount: 25, since: "2026-10-27", note: "invented" }];
  const drafts = [];
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? L.sales : b === "purchases" ? L.purchases : b === "customerRefunds" ? refunds : []).map((r) => ({ doc: J(r) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: J(v) })) }
      : /FROM draft WHERE id IN/.test(q) ? { results: [] }
      : /FROM draft/.test(q) ? { results: drafts.filter((x) => x.status === "pending").map((x) => ({ id: x.id, entry: x.entry })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : null);
    return { bind: (...a) => ({ all: () => all(a[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const { previewOrder } = await import("../src/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" }, dkv = new KV();
  await dkv.put("stmt-users", J({ "wxyz-abcd": customer }));
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) }, SALT_LEDGER: mirror };
  const pc = customer && (await O.placeOrder(senv, "wxyz-abcd", { product: "salt", qty: 1, mode: "collect", unit: cardOf(customer, 1), total: cardOf(customer, 1), week: "" })).order;
  const at = new Date("2031-01-02T02:00:00Z");
  const v1 = pc ? await previewOrder(denv, pc.id, { delivery: 0 }, at) : null;
  ok(!!customer && v1 && v1.ok && v1.credit === 25 && v1.row.cash === 25 && v1.row.credit === 25 && v1.row.total === cardOf(customer, 1),
    "his preview spends their RM 25 of credit on the row, the goods at their price: " + J(v1 && (v1.ok ? { credit: v1.credit, row: v1.row } : v1.error)));
  drafts.push({ id: "a1", status: "pending", entry: J({ at: "a1", payload: { mode: "new", direction: "SELL", party: customer, cash: 25, credit: 25 } }) });
  const v2 = pc ? await previewOrder(denv, pc.id, { delivery: 0 }, at) : null;
  ok(v2 && v2.ok && !v2.credit && v2.row.cash === 0 && !("credit" in v2.row), "a second Accept before the fold finds the first on its way and spends none: " + J(v2 && (v2.ok ? v2.credit : v2.error)));
  drafts[0].status = "rejected";
  const v3 = pc ? await previewOrder(denv, pc.id, { delivery: 0 }, at) : null;
  ok(v3 && v3.ok && v3.credit === 25, "the first rejected, its credit is theirs again: " + J(v3 && (v3.ok ? v3.credit : v3.error)));
  /* an order for a friend: the same order, marked so on the site's record */
  for (const k of skv.m.keys()) { const raw = skv.m.get(k); if (typeof raw === "string" && raw.includes(pc.id)) skv.m.set(k, raw.split('"forFriend":false').join('"forFriend":true')); }
  const v4 = pc ? await previewOrder(denv, pc.id, { delivery: 0 }, at) : null;
  ok(v4 && v4.ok && !v4.credit && v4.row.cash === 0, "an order for a friend spends none of it: " + J(v4 && (v4.ok ? v4.credit : v4.error)));
}
