/* test/order-stream-v3.mjs: plan version 3 (03 Nov 2026, Fable's reviews, his answer: refuse it, say why), AN EQUAL ORDER ROWED TODAY. A row is named
 * by its key: party, day, goods and delivery together, book (ovKey; no size, no order), and a key naming two rows sticks every later stage of both, so
 * another order of the same account and row whose pending row is dated today under this order's key is refused at the preview, and so at Accept,
 * with the way on; one equal only under the fold's replay test (size and goods, the delivery apart) is keyed apart and marked second. The desk finds
 * each twin's pending row (queued, or waiting under Approve after his yes) and reads the day it is dated; a rejected one stands aside
 * (engine/stages.mjs twinCandidates, siteTwins; src/orders.js previewAck). Invented figures on the frozen book; the preview harness is
 * test/refund-credit-p3.mjs's. */
import { readBook } from "../tools/book.mjs";
import { siteTwins, twinCandidates } from "../engine/stages.mjs";
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
  /* T1 to T6: the rules alone. `key` is a row today under this order's key (refused); `fold` one the fold's replay test calls equal but keyed apart */
  const today = "2031-01-02";
  const a = { id: "o-a", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0 };
  const twin = { id: "o-b", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0 };
  const T = (x, day = today) => { const r = siteTwins(a, [{ order: Object.assign({}, twin, x), day }], today); return (r.key.length ? "key" : "") + (r.fold.length ? "fold" : ""); };
  ok(T({}) === "key", "T1 another order of theirs with a row dated today at the same book and figure carries this one's key");
  ok(twinCandidates(a, [Object.assign({}, twin, { id: "o-a" })]).length === 0 && twinCandidates(a, [twin]).length === 1,
    "T2 the order itself is never its own twin, so a second queue of it is still a replay");
  ok(T({}, "2031-01-01") === "", "T3 a row dated another day is no twin");
  ok(T({ qty: 2 }) === "key" && T({ total: 90, delivery: 10 }) === "key" && T({ total: 105 }) === "",
    "T4 the key holds no size and no split of the figure: another size or goods and delivery summing the same is the same key; another figure is none");
  ok(T({ delivery: 10 }) === "fold" && T({ qty: 2, delivery: 10 }) === "",
    "T5 the same size and goods with another delivery charge is keyed apart, but the fold's replay test calls it equal: a second sale; another size too is neither");
  ok(twinCandidates(a, [Object.assign({}, twin, { u: "wxyz-wxyz" }), Object.assign({}, twin, { forFriend: true }), Object.assign({}, twin, { product: "oil" })]).length === 0,
    "T6 another account's order, a friend's (another bucket, another row) and another book's are no candidates: the desk reads every order on the site");
  ok(twinCandidates(a, [Object.assign({}, twin, { total: 105 }), Object.assign({}, twin, { qty: 3, total: 300 })]).length === 0
    && twinCandidates(a, [Object.assign({}, twin, { qty: 2 }), Object.assign({}, twin, { delivery: 10 })]).length === 2,
    "T6b only an order whose own figures could be a twin is a candidate, so no other order costs a read of D1");

  /* T7 to T12: the Desk's own preview, on the frozen book */
  const now = new Date("2031-01-02T02:00:00Z"), same = "2031-01-02T01:00:00.000Z";
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const cardOf = (c, q) => PRICING_ENGINE.cardAt(L.PRICING, c, "salt", q).card;
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((c) => cardOf(c, 1) > 0 && !(L.associates || []).includes(c) && !(L.partners || []).includes(c));
  /* what D1 says of the first order's pending row: its draft (null while queued and not drafted) and a yes of his waiting on it */
  let draft = null, pre = null;
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? L.sales : b === "purchases" ? L.purchases : []).map((r) => ({ doc: J(r) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: J(v) })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : /SELECT status, entry FROM draft WHERE id=/.test(q) ? draft
      : /FROM preapproval WHERE order_id=/.test(q) ? pre : null);
    return { bind: (...x) => ({ all: () => all(x[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const O = await import("../stmt/orders.js");
  const { previewOrder } = await import("../src/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" }, dkv = new KV();
  await dkv.put("stmt-users", J({ "wxyz-abcd": customer }));
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) }, SALT_LEDGER: mirror };
  const body = (n, extra) => Object.assign({ product: "salt", qty: 1, mode: "collect", unit: cardOf(customer, 1), total: cardOf(customer, 1), week: "", rid: "v3-twin-order-" + n + "-pad" }, extra || {});
  const first = customer && (await O.placeOrder(senv, "wxyz-abcd", body(1))).order;
  const second = customer && (await O.placeOrder(senv, "wxyz-abcd", body(2))).order;
  const third = customer && (await O.placeOrder(senv, "wxyz-abcd", body(3, { mode: "deliver", place: "Taman Rekaan" }))).order;
  const p0 = second ? await previewOrder(denv, second.id, { delivery: 0 }, now) : null;
  const k1 = "order:wxyz-abcd:" + first.id, set1 = (f) => { const o1 = JSON.parse(skv.m.get(k1)); f(o1); skv.m.set(k1, J(o1)); };
  /* N5: the first's row waits under Approve after his yes (its row differed): no queued mark, a live pre-approval naming its draft */
  pre = { id: "pre-1", order_id: first.id, stage: "ack", status: "differs", entry_at: same };
  const p11 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  pre = null;
  ok(!!customer && p0 && p0.ok && p11 && !p11.ok && p11.twin === true,
    "T11 a twin whose row waits under Approve after his yes is found by that yes, and refused: " + J([p0 && (p0.ok || p0.error), p11 && (p11.ok || p11.error)]));
  /* the first's pending row queued today, as Accept marks it */
  set1((o) => { o.queued = Object.assign({}, o.queued, { ack: same }); });
  const p1 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  ok(p1 && !p1.ok && p1.status === 409 && p1.twin === true && /change that order to the sum/.test(p1.error),
    "T7 the Desk's preview refuses the second equal order once the first is rowed today, and says the way on: " + J(p1 && (p1.ok || [p1.status, p1.error])));
  const p3 = await previewOrder(denv, third.id, { delivery: 10 }, now);
  ok(p3 && p3.ok && p3.second === true, "T8 the same size and goods delivered at a charge is keyed apart and marked a second sale, so the fold takes it: " + J(p3 && (p3.ok ? p3.second : p3.error)));
  draft = { status: "rejected", entry: J({ at: same, payload: { date: today } }) };
  const p4 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  ok(p4 && p4.ok, "T9 a twin whose pending draft was rejected (withdrawn while it waited) has no row and stands aside: " + J(p4 && (p4.ok || p4.error)));
  /* N6: a row offered again keeps its first day: queued today, dated yesterday */
  draft = { status: "pending", entry: J({ at: same, payload: { date: "2031-01-01" } }) };
  const p12 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  draft = null;
  ok(p12 && p12.ok, "T12 a twin's row is read for the day it is dated, never the moment it was queued: a row dated yesterday is no twin today: " + J(p12 && (p12.ok || p12.error)));
  set1((o) => { o.status = "cancelled"; });
  const p5 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  ok(p5 && !p5.ok && p5.status === 409 && /ended today keeps its row/.test(p5.error), "T10 against an order that ended today with its row, the refusal says so: " + J(p5 && (p5.ok || p5.error)));
}
