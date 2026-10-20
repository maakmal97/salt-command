/* test/loyalty-verdict.mjs: THE LOYALTY UNIT, P3: THE VERDICT AT ACCEPT AND THE WORD ON THE ORDER (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html).
 * Each check red under its own mutation (test/loyalty-verdict.mutations.json):
 *   1  an order crosses when their paid units and its size reach 20, and not at 19; the verdict reads the walk's PAID units alone
 *   2  not under their card for the size, and not with no card
 *   3  not while they are paused today
 *   4  the drafter marks the Pending row rwdLoyal only on a loyal cross, so a row without it, and its digests, are as they were
 *   5  the return leg keeps cross while it holds, clears it (null) once another order crossed first or a pause began, and given is terminal
 *   6  his preview on the desk's own book: a customer's order that reaches it says cross, its row marked rwdLoyal with no promised step */
import { readBook } from "../tools/book.mjs";
import E from "../engine/position.mjs";
import { rewardCrossOf, rwdOf, loyalReading } from "../engine/stages.mjs";
import { stageDigest, offerDigest, draftRow } from "../src/drafter.js";
import PRICING_ENGINE from "../engine/pricing.mjs";

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const mirror = (state, sales, purchases, ver) => ({ prepare(q) {
  const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? sales : b === "purchases" ? purchases : []).map((r) => ({ doc: JSON.stringify(r) })) }
    : /FROM state/.test(q) ? { results: Object.entries(state).map(([key, v]) => ({ key, doc: JSON.stringify(v) })) } : { results: [] };
  const first = async () => (/FROM snapshot/.test(q) ? { v: ver, stamped: null } : null);
  return { bind: (...a) => ({ all: () => all(a[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
} });
const j = (x) => JSON.stringify(x);

export async function run({ ok }) {
  const ID = "CQ1-ZUL", TODAY = "2026-11-02";
  const scheme = { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" }, loyal: { every: 20, since: "2026-10-21" } } } };
  const row = (rid, q, day, more) => ({ rid, customer: ID, product: "salt", date: day, qty: q, total: 100 * q, cost: 58 * q, listRM: 100 * q, listQty: q,
    deliveredQty: q, deliveredOn: day, cash: 100 * q, paidOn: day, ...more });
  const open = (rid, q, more) => ({ rid, customer: ID, product: "salt", date: "2026-11-01", qty: q, total: 100 * q, cost: 58 * q, listRM: 100 * q, listQty: q,
    deliveredQty: 0, cash: 0, ...more });
  const bk = (sales) => ({ sales, purchases: [], state: { REWARD: scheme, TERMS: { holdDays: 1, lockDays: 4, lateResetRepeat: 3 }, associates: [], partners: [],
    INTRODUCTIONS: [], PEOPLE: { departed: [] }, PRODUCTS: { salt: {} } } });
  const verdict = (b, q, goods, card) => rewardCrossOf(b, ID, q, goods, 58, { card, today: TODAY });
  /* 1: 15 paid; an open order of 3 is not counted ahead */
  const fifteen = bk([row("s301", 15, "2026-10-22"), open("s302", 3)]);
  const five = verdict(fifteen, 5, 500, 500), four = verdict(fifteen, 4, 400, 400);
  ok(five.cross === true && five.loyal === true && five.step === undefined && four.cross === false,
    "an order crosses at 20 of paid units and its own, and not at 19: " + j([five, four]));
  /* 2 */
  const sen = verdict(fifteen, 5, 499.99, 500), nocard = verdict(fifteen, 5, 500, null);
  ok(sen.cross === false && nocard.cross === false && verdict(fifteen, 5, 600, 500).cross === true,
    "not under their card for the size, and not with no card: " + j([sen, nocard]));
  /* 3: goods out on 25 Oct and still unpaid on 2 Nov */
  const late = bk([row("s301", 15, "2026-10-22"), { ...open("s302", 1), date: "2026-10-25", deliveredQty: 1, deliveredOn: "2026-10-25" }]);
  ok(verdict(late, 5, 500, 500).cross === false && loyalReading(late, ID, { today: TODAY }).paused === true,
    "not while they are paused today: " + j(loyalReading(late, ID, { today: TODAY })));
  /* 4: on the desk's own book */
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const book = { version: L.PRICING.v, state: L, sales: L.sales, purchases: L.purchases, pricing: L.PRICING };
  const ent = (more) => ({ at: "2031-01-02T01:00:00.000Z", payload: { mode: "new", product: "salt", direction: "SELL", party: "CQ1-ZUL", date: "2031-01-02", qty: 1, total: 100, cash: 0, kg: 0 }, ...more });
  const d1 = draftRow(ent({ rwd: "cross", rwdLoyal: true }), book), d0 = draftRow(ent({ rwd: "cross" }), book), dn = draftRow(ent({ rwdLoyal: true }), book);
  const h1 = await stageDigest("ack", ent({ rwd: "cross", rwdLoyal: true }), d1, { v: "v1" }), h0 = await stageDigest("ack", ent({ rwd: "cross" }), d0, { v: "v1" });
  const o1 = await offerDigest(ent({ rwd: "cross", rwdLoyal: true }), d1), o0 = await offerDigest(ent({ rwd: "cross" }), d0);
  ok(d1.row && d1.row.rwdLoyal === true && d0.row && !("rwdLoyal" in d0.row) && dn.row && !("rwdLoyal" in dn.row) && h1 !== h0 && o1 !== o0,
    "the drafter marks the row rwdLoyal only on a loyal cross, and both digests name it: " + j([d1.row && d1.row.rwdLoyal, d0.row && d0.row.rwdLoyal, dn.row && dn.row.rwdLoyal]));
  /* 5: s302 of 5, crossed at Accept; then s303 of 5 paid first, so 20 came with s303 */
  const pend = { ...open("s302", 5), rwdLoyal: true };
  const holds = bk([row("s301", 15, "2026-10-22"), pend]);
  const beaten = bk([row("s301", 15, "2026-10-22"), pend, row("s303", 5, "2026-10-30"), { rid: "s304", customer: ID, product: "salt", qty: 1, total: 0, cost: 58, cash: 0,
    goodwill: true, deliveredQty: 0, date: "2026-10-30", rewardOf: "s303", auto: true, loyal: true }]);
  const pausedB = bk([row("s301", 15, "2026-10-22"), pend, { ...open("s305", 1), date: "2026-10-25", deliveredQty: 1, deliveredOn: "2026-10-25" }]);
  const given = bk([row("s301", 15, "2026-10-22"), { ...pend, cash: 500, paidOn: "2026-11-01", deliveredQty: 5, deliveredOn: "2026-11-01" },
    { rid: "s306", customer: ID, product: "salt", qty: 1, total: 0, cost: 58, cash: 0, goodwill: true, deliveredQty: 1, deliveredOn: "2026-11-01", date: "2026-11-01", rewardOf: "s302", auto: true, loyal: true }]);
  const w = [rwdOf(holds, holds.sales[1], "cross", TODAY), rwdOf(beaten, beaten.sales[1], "cross", TODAY), rwdOf(pausedB, pausedB.sales[1], "cross", TODAY),
    rwdOf(given, given.sales[1], "cross", TODAY), rwdOf(given, given.sales[1], "given", TODAY)];
  ok(w[0] === undefined && w[1] === null && w[2] === null && w[3] === "given" && w[4] === undefined,
    "cross holds while it holds, is cleared once another order crossed first or a pause began, and given is terminal: " + j(w.map(String)));
  /* 6: a real customer with a card and nothing open, given 19 paid units at their price since the switch */
  const scheme6 = L.REWARD;
  const cardOf = (c, q) => PRICING_ENGINE.cardAt(L.PRICING, c, "salt", q).card;
  const eb = (sales) => ({ sales, purchases: L.purchases, state: { ...L, REWARD: scheme6 } });
  const prior = (c) => [7, 6, 6].map((q, i) => ({ rid: "s99" + (10 + i), customer: c, product: "salt", date: "2030-12-0" + (i + 1), qty: q, total: cardOf(c, q), cost: 58 * q,
    listRM: cardOf(c, q), listQty: q, cash: cardOf(c, q), paidOn: "2030-12-0" + (i + 1), deliveredQty: q, deliveredOn: "2030-12-0" + (i + 1) }));
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((c) => {
    if ([7, 6, 6, 1].some((q) => !(cardOf(c, q) > 0))) return false;
    const r = loyalReading(eb(L.sales.concat(prior(c))), c, { today: "2031-01-02" });
    return r.walks && !r.paused && r.units === 19;
  });
  const { previewOrder } = await import("../src/orders.js");
  const O = await import("../stmt/orders.js"), stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" }, dkv = new KV();
  await dkv.put("stmt-users", j({ "wxyz-abcd": customer }));
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) },
    SALT_LEDGER: mirror({ ...L, REWARD: scheme6 }, customer ? L.sales.concat(prior(customer)) : L.sales, L.purchases, L.PRICING.v) };
  const pc = customer && (await O.placeOrder(senv, "wxyz-abcd", { product: "salt", qty: 1, mode: "collect", unit: cardOf(customer, 1), total: cardOf(customer, 1), week: "" })).order;
  const vc = pc ? await previewOrder(denv, pc.id, { delivery: 0 }, new Date("2031-01-02T02:00:00Z")) : null;
  ok(!!customer && vc && vc.ok && vc.rwd === "cross" && vc.row.rwdLoyal === true && vc.row.rwdStep === undefined
    && vc.loyal && vc.loyal.walks && vc.loyal.order.reaches === true && vc.reward && vc.reward.associate === false,
    "his preview of a customer's order that reaches it says cross and marks the row rwdLoyal: " + j([!!customer, vc && (vc.ok ? [vc.rwd, vc.row.rwdLoyal, vc.loyal] : vc.error)]));
}
