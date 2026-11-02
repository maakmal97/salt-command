/* test/order-stream-v3.mjs: plan version 3 (03 Nov 2026, Fable's review), AN EQUAL ORDER ROWED TODAY IS REFUSED AT ACCEPT. A row is named by party,
 * date, goods and delivery and book (ovKey), with no order in it, and a key naming two rows sticks every later stage of both; so a site order whose
 * account has ANOTHER order already rowed that Kuala Lumpur day at the same book, size, goods and delivery is refused at the preview, and so at Accept,
 * with the way on (engine/stages.mjs siteTwin, src/orders.js previewAck); never for itself. Invented figures on the frozen book; the preview harness
 * is test/refund-credit-p3.mjs's. */
import { readBook } from "../tools/book.mjs";
import { siteTwins } from "../engine/stages.mjs";
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
  /* T1 to T6: the rule alone. `key` is another order whose row would carry this one's key (refused); `fold` one the fold's replay test calls equal
     but keyed apart (marked second) */
  const now = new Date("2031-01-02T02:00:00Z"), same = "2031-01-02T01:00:00.000Z", before = "2031-01-01T01:00:00.000Z";
  const a = { id: "o-a", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0 };
  const twin = { id: "o-b", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0, queued: { ack: same } };
  const T = (x) => { const r = siteTwins(a, [Object.assign({}, twin, x)], now); return (r.key.length ? "key" : "") + (r.fold.length ? "fold" : ""); };
  ok(T({}) === "key", "T1 another order of theirs rowed today at the same book, size and figure carries this one's key");
  ok(T({ id: "o-a" }) === "", "T2 the order itself is never its own twin, so a second queue of it is still a replay");
  ok(T({ queued: { ack: before } }) === "" && T({ queued: {} }) === "", "T3 one rowed another day, or not rowed at all, is no twin");
  ok(T({ qty: 2 }) === "key" && T({ total: 90, delivery: 10 }) === "key" && T({ total: 105 }) === "" && T({ product: "oil" }) === "",
    "T4 the key holds no size and no split of the figure: another size or goods and delivery summing the same is the same key; another figure or book is none");
  ok(T({ delivery: 10 }) === "fold" && T({ qty: 2, delivery: 10 }) === "", "T5 the same size and goods with another delivery charge is keyed apart, but the fold's replay test calls it equal: a second sale; another size too is neither");
  ok(T({ u: "wxyz-wxyz" }) === "" && T({ forFriend: true }) === "", "T6 another account's equal order, and a friend's (another bucket, another row), are no twin: the desk reads every order on the site");

  /* T7 to T10: the Desk's own preview, on the frozen book */
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const cardOf = (c, q) => PRICING_ENGINE.cardAt(L.PRICING, c, "salt", q).card;
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((c) => cardOf(c, 1) > 0 && !(L.associates || []).includes(c) && !(L.partners || []).includes(c));
  let draftStatus = null;   /* what D1 says of the first order's pending draft: null while it is queued and not drafted */
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? L.sales : b === "purchases" ? L.purchases : []).map((r) => ({ doc: J(r) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: J(v) })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : /SELECT status FROM draft WHERE id=/.test(q) && draftStatus ? { status: draftStatus } : null);
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
  /* the first's pending row queued today, as Accept marks it */
  const k1 = "order:wxyz-abcd:" + first.id, set1 = (f) => { const o1 = JSON.parse(skv.m.get(k1)); f(o1); skv.m.set(k1, J(o1)); };
  set1((o) => { o.queued = Object.assign({}, o.queued, { ack: same }); });
  const p1 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  ok(!!customer && p0 && p0.ok && p1 && !p1.ok && p1.status === 409 && p1.twin === true && /change that order to the sum/.test(p1.error),
    "T7 the Desk's preview refuses the second equal order once the first is rowed today, and says the way on: " + J([p0 && (p0.ok || p0.error), p1 && (p1.ok || [p1.status, p1.error])]));
  const p3 = await previewOrder(denv, third.id, { delivery: 10 }, now);
  ok(p3 && p3.ok && p3.second === true, "T8 the same size and goods delivered at a charge is keyed apart and marked a second sale, so the fold takes it: " + J(p3 && (p3.ok ? p3.second : p3.error)));
  draftStatus = "rejected";
  const p4 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  draftStatus = null;
  ok(p4 && p4.ok, "T9 a twin whose pending draft was rejected (withdrawn while it waited) has no row and stands aside: " + J(p4 && (p4.ok || p4.error)));
  set1((o) => { o.status = "cancelled"; });
  const p5 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  ok(p5 && !p5.ok && p5.status === 409 && /ended today keeps its row/.test(p5.error), "T10 against an order that ended today with its row, the refusal says so: " + J(p5 && (p5.ok || p5.error)));
}
