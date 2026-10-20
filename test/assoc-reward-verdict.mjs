/* test/assoc-reward-verdict.mjs: THE ASSOCIATE REWARD, P5: THE VERDICT AT ACCEPT, THE ONE WORD ON THE ORDER, AND HIS READING (20 Oct 2026).
 * Each check red under its own mutation (test/assoc-reward-verdict.mutations.json):
 *   1  the verdict reads the walk's PAID progress alone: two open orders that each reach it both say cross
 *   2  once the first is paid and earns, the second's cross no longer holds and the return leg clears it (null)
 *   3  an undone payment of theirs clears it too; a new, dearer lot never does (the row's rwdStep holds the promise)
 *   4  given is terminal: a book that has not caught up never takes it back
 *   5  a digest without the word is the digest it was; only "cross" changes it (stageDigest and offerDigest)
 *   6  the drafter puts the promised step on the Pending row only when the entry says cross
 *   7  the order takes the word from his Accept and from the book's mark, the two words only, never a figure; given stays given
 *   8  rwd travels to the customer and nothing of its figures does: no rwdStep, listRM or listQty in CUSTOMER_FIELDS or their view
 *   9  the return leg reaches every order with its row, a finished one too, and writes given once a reward row names its row
 *   10 his preview carries the verdict, his reading (RM, behind Access) and the promised step on the row; a customer gets no word
 *   11 the reading answers only behind both locks: no owner, 403 at the Counter; no bridge key, 404 at the Desk; with the key, his figures
 *   12 his yes, once its row is approved, moves the order with the word it covered */
import { readBook } from "../tools/book.mjs";
import E from "../engine/position.mjs";
import { rewardReading, rewardCrossOf, rwdOf } from "../engine/stages.mjs";
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

export async function run({ ok }) {
  /* an invented associate: share 0.6 of a RM 500 step (RM 50 lots), so RM 300 is carried */
  const lot = (rid, date, total) => ({ rid, product: "salt", date, receivedOn: date, qty: 10, total, cash: total });
  const scheme = { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2, times: 10, since: "2026-10-20" } } } };
  const bk = (sales, purchases, share = 0.6) => ({ sales, purchases: purchases || [lot("p1", "2026-10-01", 500)],
    state: { REWARD: scheme, REWARD_OPEN: { "AX1-ZED": { earned: 0, share, upTo: "s0", on: "2026-10-20" } }, associates: ["AX1-ZED"], roster: ["AX1-ZED"],
      INTRODUCTIONS: [], PEOPLE: { departed: [] }, PRODUCTS: { salt: { reward: true } }, PROD_OPENING: { salt: { qty: 0, costPerKg: null } } } });
  const order = (rid, total, more) => ({ rid, customer: "AX1-ZED", product: "salt", date: "2026-10-21", qty: 10, total, cost: 500, cash: 0, deliveredQty: 0, ...more });
  /* 1 */
  const two = bk([order("s1", 800), order("s2", 800)]);
  const a = rewardCrossOf(two, "AX1-ZED", 10, 800, 50), b = rewardCrossOf(two, "AX1-ZED", 10, 800, 50);
  ok(a.cross && b.cross && a.step === 500 && rwdOf(two, two.sales[1], "cross") === undefined,
    "two open orders that each reach it both say cross: " + JSON.stringify([a, b]));
  /* 2: the first paid, and its reward row raised by the fold */
  const paid = bk([order("s1", 800, { cash: 800 }), order("s2", 800, { rwdStep: 500 }),
    { rid: "s3", customer: "AX1-ZED", product: "salt", qty: 1, total: 50, cost: 50, cash: 0, settledRM: 50, rebate: true, rebateKg: 1, goodwill: true, deliveredQty: 0, date: "2026-10-22", rewardOf: "s1", auto: true }]);
  ok(rwdOf(paid, paid.sales[1], "cross") === null && rwdOf(paid, paid.sales[0], "cross") === "given",
    "once the first is paid and earns, the second's cross is cleared and the first's is given: " + JSON.stringify([rwdOf(paid, paid.sales[1], "cross"), rwdOf(paid, paid.sales[0], "cross")]));
  /* 3: a paid RM 150 margin (s9) carries progress to RM 450; s2's RM 100 crosses; s9's payment undone, it no longer does. A RM 60 lot
     then lifts today's step to RM 600: s2 at RM 250 of margin over RM 300 carried holds at its promised RM 500 */
  const held = bk([order("s9", 650, { cash: 650 }), order("s2", 600, { rwdStep: 500 })], undefined, 0.6);
  const undone = bk([order("s9", 650, { cash: 0 }), order("s2", 600, { rwdStep: 500 })], undefined, 0.6);
  const dearer = bk([order("s2", 750, { rwdStep: 500 })], [lot("p1", "2026-10-01", 500), lot("p2", "2026-10-23", 600)]);
  ok(rwdOf(held, held.sales[1], "cross") === undefined && rwdOf(undone, undone.sales[1], "cross") === null && rwdOf(dearer, dearer.sales[0], "cross") === undefined,
    "an undone payment clears cross, and a dearer lot never does: " + JSON.stringify([rwdOf(held, held.sales[1], "cross"), rwdOf(undone, undone.sales[1], "cross"), rwdOf(dearer, dearer.sales[0], "cross")]));
  /* 4 */
  ok(rwdOf(two, two.sales[0], "given") === undefined, "given is terminal: a book that has not caught up says nothing");
  /* 5 */
  const e0 = { at: "2026-10-21T01:00:00.000Z", payload: { mode: "new", product: "salt", direction: "SELL", party: "AX1-ZED", qty: 1, total: 80 } };
  const d0 = { collection: "sales", row: { customer: "AX1-ZED", qty: 1, total: 80 }, flags: [] };
  const h0 = await stageDigest("ack", e0, d0, { v: "v1" }), hx = await stageDigest("ack", { ...e0, rwd: "nope" }, d0, { v: "v1" }), hc = await stageDigest("ack", { ...e0, rwd: "cross" }, d0, { v: "v1" });
  const o0 = await offerDigest(e0, d0), ox = await offerDigest({ ...e0, rwd: "nope" }, d0), oc = await offerDigest({ ...e0, rwd: "cross" }, d0);
  ok(h0 === hx && h0 !== hc && o0 === ox && o0 !== oc, "a digest without the word is unchanged, and only cross changes it");
  /* 6, on the desk's own book */
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const book = { version: L.PRICING.v, state: L, sales: L.sales, purchases: L.purchases, pricing: L.PRICING };
  const assoc = Object.keys(L.REWARD_OPEN)[0];
  const ent = (more) => ({ at: "2031-01-02T01:00:00.000Z", payload: { mode: "new", product: "salt", direction: "SELL", party: assoc, date: "2031-01-02", qty: 1, total: 500, cash: 0, kg: 0 }, ...more });
  const crossRow = draftRow(ent({ rwd: "cross", rwdStep: 580 }), book).row, plainRow = draftRow(ent({ rwdStep: 580 }), book).row;
  ok(crossRow && crossRow.rwdStep === 580 && plainRow && plainRow.rwdStep === undefined, "the drafter puts the promised step on the row only with cross: " + JSON.stringify([crossRow && crossRow.rwdStep, plainRow && plainRow.rwdStep]));
  /* 7 and 8: the site's own order book, on KV */
  const O = await import("../stmt/orders.js"), stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" };
  const read = async (id) => skv.get("order:abcd-efgh:" + id, "json");
  const placed = (await O.placeOrder(senv, "abcd-efgh", { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" })).order;
  await O.deskMove(senv, "abcd-efgh", placed.id, { status: "acknowledged", mode: "collect", rwd: "cross" });
  const afterAck = await read(placed.id);
  await O.deskMove(senv, "abcd-efgh", placed.id, { mark: { rwd: 580 } });
  const afterNum = await read(placed.id);
  await O.deskMove(senv, "abcd-efgh", placed.id, { mark: { rwd: "given" } });
  await O.deskMove(senv, "abcd-efgh", placed.id, { mark: { rwd: null } });
  const afterGiven = await read(placed.id);
  const p2 = (await O.placeOrder(senv, "abcd-efgh", { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" })).order;
  await O.deskMove(senv, "abcd-efgh", p2.id, { status: "acknowledged", mode: "collect", rwd: "given" });
  const notGiven = await read(p2.id);
  ok(afterAck.rwd === "cross" && afterNum.rwd === "cross" && afterGiven.rwd === "given" && notGiven.rwd === undefined,
    "the order takes cross from his Accept and given from the book, never a figure, and given stays given: " + JSON.stringify([afterAck.rwd, afterNum.rwd, afterGiven.rwd, notGiven.rwd]));
  const view = O.customerView(Object.assign({}, afterGiven, { rwdStep: 580, listRM: 120, listQty: 1 }));
  ok(O.CUSTOMER_FIELDS.includes("rwd") && view.rwd === "given" && !["rwdStep", "listRM", "listQty"].some((k) => O.CUSTOMER_FIELDS.includes(k) || k in view),
    "the word travels to the customer and none of its figures do: " + JSON.stringify(Object.keys(view).filter((k) => /rwd|list/.test(k))));
  /* 9: the return leg, on a mirror whose row is paid, handed over and named by a reward row */
  const { tellSite, previewOrder } = await import("../src/orders.js");
  const dkv = new KV();
  await dkv.put("stmt-users", JSON.stringify({ "abcd-efgh": assoc }));
  const key = (s) => E.ovKey(s);
  const row = { rid: "s9901", customer: assoc, product: "salt", date: "2031-01-02", qty: 1, total: 100, cash: 100, deliveredQty: 1, deliveredOn: "2031-01-02", cost: 58 };
  const unit = { rid: "s9902", customer: assoc, product: "salt", qty: 1, total: 58, cost: 58, cash: 0, settledRM: 58, rebate: true, rebateKg: 1, goodwill: true,
    deliveredQty: 1, date: "2031-01-02", rewardOf: "s9901", auto: true };
  const p3 = (await O.placeOrder(senv, "abcd-efgh", { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" })).order;
  await O.deskMove(senv, "abcd-efgh", p3.id, { status: "acknowledged", mode: "collect", rwd: "cross" });
  await O.deskMove(senv, "abcd-efgh", p3.id, { mark: { ledgerKey: key(row), ack: "2031-01-02T01:00:00.000Z" } });
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) },
    SALT_LEDGER: mirror({ ...L, REWARD: L.REWARD }, [...L.sales, row, unit], L.purchases, "vR1") };
  const ts = await tellSite(denv);
  const told = await read(p3.id);
  ok(ts.ok && told.rwd === "given", "the return leg writes given once a reward row names the order's row: " + JSON.stringify([ts, told.rwd]));
  /* 10: his preview on a placed order, for an associate whose walk an order of some size takes over, and a customer's */
  const pricing = L.PRICING, cogs = E.latestCogs(L.purchases.filter((p) => (p.product || "salt") === "salt")).rate;
  const sizes = [0.5, 1, 2, 3, 4, 5, 6.25, 12.5, 25], cardOf = (c, q) => PRICING_ENGINE.cardAt(pricing, c, "salt", q).card;
  const qx = sizes.find((q) => { const r = cardOf(assoc, q) && rewardReading(book, assoc, { qty: q, goods: cardOf(assoc, q), unitCost: cogs }); return !!(r && r.order && r.order.reaches); });
  const customer = Object.keys(pricing.byProduct.salt.cards || {}).find((c) => !L.REWARD_OPEN[c] && !E.rewardAccount({ sales: L.sales, purchases: L.purchases, state: L }, c).associate);
  await dkv.put("stmt-users", JSON.stringify({ "abcd-efgh": assoc, "wxyz-abcd": customer }));
  const qa = qx || 1, pa = (await O.placeOrder(senv, "abcd-efgh", { product: "salt", qty: qa, mode: "collect", unit: cardOf(assoc, qa) / qa, total: cardOf(assoc, qa), week: "" })).order;
  const pc = (await O.placeOrder(senv, "wxyz-abcd", { product: "salt", qty: 1, mode: "collect", unit: cardOf(customer, 1), total: cardOf(customer, 1), week: "" })).order;
  denv.SALT_LEDGER = mirror(L, L.sales, L.purchases, L.PRICING.v);
  const va = await previewOrder(denv, pa.id, { delivery: 0 }, new Date("2031-01-02T02:00:00Z"));
  const vc = await previewOrder(denv, pc.id, { delivery: 0 }, new Date("2031-01-02T02:00:00Z"));
  const vr = (va && va.reward) || {};
  ok(!!qx && va.ok && va.rwd === "cross" && va.row.rwdStep === (vr.order || {}).step && vr.associate === true && vr.step > 0
    && vc.ok && vc.rwd === null && vc.row.rwdStep === undefined && vc.reward && vc.reward.associate === false,
    "his preview carries the verdict, his reading and the promised step; a customer's none: " + JSON.stringify([qx, va.ok ? [va.rwd, va.row.rwdStep, vr.order] : va.error, vc.ok ? [vc.rwd, vc.reward] : vc.error]));
  /* 11 */
  const { handleMaker } = await import("../stmt/maker.js"), desk2 = (await import("../src/worker.js")).default;
  const rk = encodeURIComponent(assoc + "|2031-01-02|100");
  const r403 = await handleMaker(new Request("https://counter.test/all/maker/reward/" + rk), {}, "/all/maker/reward/" + rk, null);
  const r404 = await desk2.fetch(new Request("https://desk.test/_internal/maker/reward/" + rk), { COUNTER_MAKER_KEY: "k".repeat(40), SALT_LEDGER: denv.SALT_LEDGER }, { waitUntil() {} });
  const r200 = await desk2.fetch(new Request("https://desk.test/_internal/maker/reward/" + rk, { headers: { "X-Counter-Maker-Key": "k".repeat(40) } }),
    { COUNTER_MAKER_KEY: "k".repeat(40), SALT_LEDGER: denv.SALT_LEDGER }, { waitUntil() {} });
  const j200 = r200.status === 200 ? await r200.json() : null;
  ok(r403.status === 403 && r404.status === 404 && j200 && j200.reading.associate === true && j200.reading.step > 0,
    "the reading answers only behind both locks, and with the key gives his figures: " + [r403.status, r404.status, r200.status]);
  /* 12 */
  const { ackOnApproval } = await import("../src/orders.js");
  const p4 = (await O.placeOrder(senv, "abcd-efgh", { product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, week: "" })).order;
  const yes = await ackOnApproval(denv, { id: "pre1", u: "abcd-efgh", order_id: p4.id, shown: { from: "placed" },
    entry: { at: "2031-01-02T03:00:00.000Z", orderKey: assoc + "|2031-01-02|100", rwd: "cross", payload: { product: "salt", delivery: 0 } } });
  const moved = await read(p4.id);
  ok(moved.status === "acknowledged" && moved.rwd === "cross", "his yes moves the order with the word it covered: " + JSON.stringify([yes && yes.ok, moved.status, moved.rwd]));
}
