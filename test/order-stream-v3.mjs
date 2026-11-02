/* test/order-stream-v3.mjs: plan version 3 (03 Nov 2026, Fable's review), AN EQUAL ORDER ROWED TODAY IS REFUSED AT ACCEPT. A row is named by party,
 * date, goods and delivery and book (ovKey), with no order in it, and a key naming two rows sticks every later stage of both; so a site order whose
 * account has ANOTHER order already rowed that Kuala Lumpur day at the same book, size, goods and delivery is refused at the preview, and so at Accept,
 * with the way on (engine/stages.mjs siteTwin, src/orders.js previewAck); never for itself. Invented figures on the frozen book; the preview harness
 * is test/refund-credit-p3.mjs's. */
import { readBook } from "../tools/book.mjs";
import { siteTwin } from "../engine/stages.mjs";
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
  /* T1 to T4: the rule alone */
  const now = new Date("2031-01-02T02:00:00Z"), same = "2031-01-02T01:00:00.000Z", before = "2031-01-01T01:00:00.000Z";
  const a = { id: "o-a", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0 };
  const twin = { id: "o-b", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0, queued: { ack: same } };
  ok(siteTwin(a, [twin], now) === true, "T1 another order of theirs rowed today at the same book, size, goods and delivery is its twin");
  ok(siteTwin(a, [Object.assign({}, twin, { id: "o-a" })], now) === false, "T2 the order itself is never its own twin, so a second queue of it is still a replay");
  ok(siteTwin(a, [Object.assign({}, twin, { queued: { ack: before } })], now) === false && siteTwin(a, [Object.assign({}, twin, { queued: {} })], now) === false,
    "T3 one rowed another day, or not rowed at all, is no twin");
  ok([{ qty: 2 }, { total: 105 }, { product: "oil" }, { delivery: 5 }].every((d) => siteTwin(a, [Object.assign({}, twin, d)], now) === false),
    "T4 another size, figure, book or delivery is not a twin");
  ok(siteTwin(a, [Object.assign({}, twin, { u: "wxyz-wxyz" })], now) === false && siteTwin(a, [Object.assign({}, twin, { forFriend: true })], now) === false,
    "T6 another account's equal order, and a friend's (another bucket, another row), are no twin: the desk reads every order on the site");

  /* T5: the Desk's own preview marks it, on the frozen book */
  const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
  desk.dom.window.close();
  const cardOf = (c, q) => PRICING_ENGINE.cardAt(L.PRICING, c, "salt", q).card;
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((c) => cardOf(c, 1) > 0 && !(L.associates || []).includes(c) && !(L.partners || []).includes(c));
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? L.sales : b === "purchases" ? L.purchases : []).map((r) => ({ doc: J(r) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: J(v) })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : null);
    return { bind: (...x) => ({ all: () => all(x[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const O = await import("../stmt/orders.js");
  const { previewOrder } = await import("../src/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" }, dkv = new KV();
  await dkv.put("stmt-users", J({ "wxyz-abcd": customer }));
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) }, SALT_LEDGER: mirror };
  const body = (n) => ({ product: "salt", qty: 1, mode: "collect", unit: cardOf(customer, 1), total: cardOf(customer, 1), week: "", rid: "v3-twin-order-" + n + "-pad" });
  const first = customer && (await O.placeOrder(senv, "wxyz-abcd", body(1))).order;
  const second = customer && (await O.placeOrder(senv, "wxyz-abcd", body(2))).order;
  const p0 = second ? await previewOrder(denv, second.id, { delivery: 0 }, now) : null;
  /* the first's pending row queued today, as Accept marks it */
  const k1 = "order:wxyz-abcd:" + first.id, o1 = JSON.parse(skv.m.get(k1));
  o1.queued = Object.assign({}, o1.queued, { ack: same }); skv.m.set(k1, J(o1));
  const p1 = await previewOrder(denv, second.id, { delivery: 0 }, now);
  ok(!!customer && p0 && p0.ok && p1 && !p1.ok && p1.status === 409 && p1.twin === true && /change that order to the sum/.test(p1.error),
    "T5 the Desk's preview refuses the second equal order once the first is rowed today, and says the way on: " + J([p0 && (p0.ok || p0.error), p1 && (p1.ok || [p1.status, p1.error])]));
}
