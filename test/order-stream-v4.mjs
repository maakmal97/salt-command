/* test/order-stream-v4.mjs: plan version 4 (parts 3c and 3e, Fable's F2, 03 Nov 2026). HIS DAY OF THE SALE: on his road alone and only with
 * Handed over and paid now, one day rides the pending row, the handover (on the Desk and on the Counter, movedOn) and the payment, bounded
 * (not after today, at most 30 days back, not before 21 Oct 2026, not before the book's newest lot of it). HIS END BUYER: on an associate's
 * order for a friend, a code on the roster noted on the row as downstream and credited nothing. Engine (engine/stages.mjs onFault, dayOf,
 * pendingEntry, payEntry, handoverTap), the Counter (stmt/orders.js decidePlace, applyEvent), his route (stmt/maker.js) and the Desk's
 * preview (src/orders.js previewAck) on the frozen book. Every username and code is invented, the roster's own read off the frozen book. */
import { readBook } from "../tools/book.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";
import { onFault, dayOf, ON_SINCE, ON_DAYS, pendingEntry, payEntry, handoverTap, klDate } from "../engine/stages.mjs";
import { rateDue } from "../stmt/orders.js";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const J = JSON.stringify;

export async function run({ ok }) {
  /* D1 to D6: the rule and the stages, alone */
  const today = "2026-11-20";
  ok(onFault("2026-11-20", today, null) === "" && onFault("2026-11-19", today, "2026-11-10") === "" && onFault("2026-11-10", today, "2026-11-10") === "",
    "D1 today, or a day back on or after the newest lot, is a day of the sale");
  ok(/after today/.test(onFault("2026-11-21", today, null)) && /30 days/.test(onFault("2026-10-20", "2026-11-20", null)) && /21 Oct 2026/.test(onFault("2026-10-20", "2026-11-03", null))
    && /newest lot/.test(onFault("2026-11-09", today, "2026-11-10")) && /a date/.test(onFault("2026-02-30", today, null)) && /a date/.test(onFault("20261119", today, null)),
    "D2 a day after today, more than 30 days back, before 21 Oct 2026, before the newest lot, or no date, is refused, each in its words");
  const { onFaultSite, ON_SINCE: S2, ON_DAYS: D2 } = await import("../stmt/orders.js");
  const grid = ["2026-02-30", "2026-10-20", "2026-10-21", "2026-10-25", "2026-11-03", "2026-11-04", "2026-12-04", "2026-12-05", "x"];
  ok(S2 === ON_SINCE && D2 === ON_DAYS && ["2026-11-03", "2026-12-04"].every((t) => grid.every((on) => !onFaultSite(on, t) === !onFault(on, t, null))),
    "D3 the Counter bounds the day as the engine does, the newest lot left to the Desk");
  const at = new Date("2026-11-20T03:00:00Z");
  const o = { id: "o-1", at: "2026-11-20T01:00:00.000Z", qty: 2, total: 200, delivery: 0, mode: "collect", product: "salt", ledgerKey: "CX1-AB|2026-11-18|200" };
  const e0 = pendingEntry(o, "CX1-AB", at), e1 = pendingEntry(Object.assign({}, o, { on: "2026-11-18" }), "CX1-AB", at);
  ok(e0.payload.date === "2026-11-20" && e1.payload.date === "2026-11-18" && e1.orderKey.split("|")[1] === "2026-11-18" && dayOf({}, at) === klDate(at),
    "D4 the pending row and its key take the day of the sale he set, else the day he agreed it: " + J([e0.payload.date, e1.payload.date, e1.orderKey]));
  const pay = payEntry(Object.assign({}, o, { on: "2026-11-18" }), "CX1-AB", 200, at, true);
  const hand = handoverTap(Object.assign({}, o, { on: "2026-11-18", code: "CX1-AB", moved: 0 }), { qty: 2 }, at, null);
  const hand0 = handoverTap(Object.assign({}, o, { code: "CX1-AB", moved: 0 }), { qty: 2 }, at, null);
  ok(pay.payload.date === "2026-11-18" && hand.entry.payload.date === "2026-11-18" && hand.entry.payload.fields.deliveredOn === "2026-11-18" && hand0.entry.payload.fields.deliveredOn === "2026-11-20",
    "D5 its payment and its handover are dated that day too, so nothing reads late; an order with none is handed over the day of the tap: " + J([pay.payload.date, hand.entry.payload.fields, hand0.entry.payload.fields.deliveredOn]));
  const later = new Date("2026-11-21T03:00:00Z"), onO = Object.assign({}, o, { on: "2026-11-18" });
  ok(dayOf(onO, at) === "2026-11-18" && dayOf(onO, later) === "2026-11-21" && pendingEntry(onO, "CX1-AB", later).payload.date === "2026-11-21"
    && payEntry(onO, "CX1-AB", 200, later, true).payload.date === "2026-11-21" && /their newest salt sale is dated 2026-11-19/.test(onFault("2026-11-18", today, "2026-11-10", "2026-11-19")),
    "D7 his day holds only on the day he placed it: agreed, paid or handed over on a later day, each is dated that day; and not before their newest salt sale (Fable's review)");
  const f = Object.assign({}, o, { forFriend: true, buyer: "CY2-CD" });
  const pf = pendingEntry(f, "CX1-AB", at), pm = pendingEntry(Object.assign({}, o, { buyer: "CY2-CD" }), "CX1-AB", at), pn = pendingEntry(Object.assign({}, f, { buyer: undefined }), "CX1-AB", at);
  ok(pf.payload.downstream === "CY2-CD" && pf.payload.stream === "R2" && /their customer CY2-CD/.test(pf.payload.note) && pm.payload.downstream === null && pn.payload.downstream === null,
    "D6 an order for a friend names their customer on the row as downstream; one for themselves, or with none named, names nobody: " + J([pf.payload.downstream, pm.payload.downstream, pn.payload.downstream]));

  /* C1 to C4: the Counter keeps both on his road alone, and hands over on the day */
  const { decidePlace, applyEvent } = await import("../stmt/orders.js");
  const now = new Date(), kl = klDate(now), back = (n) => { const d = new Date(kl + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const body = (x) => Object.assign({ product: "salt", qty: 1, mode: "collect", unit: 100, total: 100, place: "", forFriend: false, rid: "v4-place-rid-0001-pad", week: "", digest: "dg" }, x || {});
  const nowIso = now.toISOString();
  const c1 = decidePlace("abcd-efgh", body({ on: back(1) }), [], nowIso, "dg", "customer"), c1b = decidePlace("abcd-efgh", body({ forFriend: true, buyer: "CY2-CD" }), [], nowIso, "dg", "customer");
  ok(!!c1.error && !!c1b.error, "C1 a customer's own Place naming a day of the sale or an end buyer is refused: " + J([c1.error, c1b.error]));
  const c2 = decidePlace("abcd-efgh", body({ on: back(1) }), [], nowIso, "dg", "desk"), c2b = decidePlace("abcd-efgh", body({ on: back(31) }), [], nowIso, "dg", "desk");
  const c2c = decidePlace("abcd-efgh", body({ on: back(-1) }), [], nowIso, "dg", "desk");
  ok(c2.ev && c2.ev.order.on === back(1) && !!c2b.error && !!c2c.error, "C2 his Place keeps a day within the bounds and refuses one outside: " + J([c2.ev && c2.ev.order.on, c2b.error, c2c.error]));
  const c3 = decidePlace("abcd-efgh", body({ forFriend: true, buyer: "CY2-CD" }), [], nowIso, "dg", "desk"), c3b = decidePlace("abcd-efgh", body({ buyer: "CY2-CD" }), [], nowIso, "dg", "desk");
  const c3c = decidePlace("abcd-efgh", body({ forFriend: true, buyer: "CY2-CD-R" }), [], nowIso, "dg", "desk");
  ok(c3.ev && c3.ev.order.buyer === "CY2-CD" && !!c3b.error && !!c3c.error, "C3 his end buyer is kept on an order for a friend, by a code's shape, never a resale account: " + J([c3.ev && c3.ev.order.buyer, c3b.error, c3c.error]));
  const placed = applyEvent(null, c2.ev).order;
  const handed = applyEvent(JSON.parse(J(placed)), { kind: "handover", at: nowIso, units: 1 }).order;
  const told = applyEvent(JSON.parse(J(placed)), { kind: "ledger", at: nowIso, moved: 1 }).order;
  const plain = applyEvent(applyEvent(null, decidePlace("abcd-efgh", body(), [], nowIso, "dg", "desk").ev).order, { kind: "handover", at: nowIso, units: 1 }).order;
  const placedEarlier = Object.assign(JSON.parse(J(placed)), { at: new Date(Date.parse(nowIso) - 86400e3).toISOString() });
  const handedLater = applyEvent(placedEarlier, { kind: "handover", at: nowIso, units: 1 }).order;
  ok(handedLater.movedOn === kl, "C5 an order with his day handed over on a later day than he placed it is handed over that day: " + handedLater.movedOn);
  const rated = (atIso, on) => rateDue({ status: "done", qty: 1, moved: 1, at: atIso, on, movedOn: on || "2026-11-10" }, new Date("2026-11-13T03:00:00Z"));
  ok(rated("2026-11-01T03:00:00.000Z", undefined) === true && rated("2026-11-12T03:00:00.000Z", "2026-11-10") === false && rated("2026-11-11T03:00:00.000Z", "2026-11-10") === true,
    "C6 a sale he dated back is asked how it went two days after he placed it, never at once (Fable's review): " + J([rated("2026-11-01T03:00:00.000Z"), rated("2026-11-12T03:00:00.000Z", "2026-11-10")]));
  ok(handed.movedOn === back(1) && told.movedOn === back(1) && plain.movedOn === kl,
    "C4 the Counter hands an order with a day of the sale over on that day, by his tap or the book's word; one with none on the day it moved: " + J([handed.movedOn, told.movedOn, plain.movedOn]));

  /* M1 to M3: his route takes the day only with Handed over and paid now, and keeps both on the order */
  const { handleMaker } = await import("../stmt/maker.js");
  const kv = new Store(), env = { STMT: kv, ORDER_STORE: "object" };
  const ob = orderBook(env); env.ORDERBOOK = ob.ns;
  const U = "oatf-five", OWNER = { email: "maakmal97@icloud.com" };
  await kv.put("u:" + U, J({ prices: { digest: "dg" } }));
  Object.assign(env, { COUNTER_MAKER_KEY: "k".repeat(32), DESK_MAKER: { fetch: async (req) => {
    const path = new URL(req.url).pathname;
    const out = /\/preview$/.test(path) ? { ok: true, hash: "h".repeat(64), flags: [] } : { ok: true, approved: true };
    return new Response(J(out), { status: 200 });
  } } });
  const realF = globalThis.fetch;
  const call = async (b) => { globalThis.fetch = async () => new Response("", { status: 201 });
    try { const r = await handleMaker(new Request("https://counter.test/all/maker/customers/" + U + "/orders", { method: "POST", body: J(b) }), env, "/all/maker/customers/" + U + "/orders", OWNER, {});
      return { status: r.status, j: await r.json() }; } finally { globalThis.fetch = realF; } };
  const docOf = (id) => { const r = ob.db.prepare("SELECT doc FROM ord WHERE oid=?").get(id); return r ? JSON.parse(r.doc) : null; };
  const m1 = await call(body({ on: back(1), rid: "v4-maker-rid-0001-pad" }));
  ok(m1.status === 400 && /handed over and paid now/.test(m1.j.error) && !ob.db.prepare("SELECT COUNT(*) AS n FROM ord").get().n,
    "M1 his route refuses a day of the sale without Handed over and paid now, writing nothing: " + J([m1.status, m1.j.error]));
  const m2 = await call(body({ on: back(1), now: true, rid: "v4-maker-rid-0002-pad" }));
  ok(m2.status === 200 && docOf(m2.j.order.id).on === back(1) && m2.j.order.on === undefined,
    "M2 with it, the order keeps the day, and their own view of the order carries none: " + J([m2.status, m2.j.error, m2.j.order && docOf(m2.j.order.id).on]));
  const m3 = await call(body({ forFriend: true, buyer: "CY2-CD", rid: "v4-maker-rid-0003-pad" }));
  ok(m3.status === 200 && docOf(m3.j.order.id).buyer === "CY2-CD" && m3.j.order.buyer === undefined,
    "M3 an order for a friend keeps the end buyer he named, never shown on their view: " + J([m3.status, m3.j.error]));

  /* P1 to P5: the Desk's preview on the frozen book, a lot of salt added the day before the order */
  const nowD = new Date("2031-01-05T02:00:00Z"), lotDay = "2031-01-01";
  const desk = await readBook(), L = JSON.parse(J(desk.ledger));
  desk.dom.window.close();
  const saltLots = (L.purchases || []).filter((x) => (x.product || "salt") === "salt" && x.date);
  L.purchases.push(Object.assign({}, saltLots[saltLots.length - 1], { date: lotDay, receivedOn: lotDay, rid: "p-v4-lot" }));
  const cardOf = (c, q) => PRICING_ENGINE.cardAt(L.PRICING, c, "salt", q).card;
  const roster = L.roster || [];
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((c) => cardOf(c, 1) > 0 && !(L.associates || []).includes(c) && !(L.partners || []).includes(c));
  const assoc = (L.associates || []).find((c) => roster.includes(c + "-R") && !(L.partners || []).includes(c) && cardOf(c, 1) > 0);
  const other = roster.find((c) => c !== customer && c !== assoc && !/-R$/.test(c));
  let draft = null;
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? L.sales : b === "purchases" ? L.purchases : []).map((r) => ({ doc: J(r) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: J(v) })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : /SELECT status, entry FROM draft WHERE id=/.test(q) ? draft : null);
    return { bind: (...x) => ({ all: () => all(x[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const O = await import("../stmt/orders.js");
  const { previewOrder } = await import("../src/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" }, dkv = new KV();
  await dkv.put("stmt-users", J({ "wxyz-abcd": customer, "wxyz-ijkl": customer, "wxyz-efgh": assoc }));
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) }, SALT_LEDGER: mirror };
  /* the order book is the KV road here, so an order is written as his road would leave it: placed now, then its day set */
  let k = 0;
  const put = async (u, x) => { const r = await O.placeOrder(senv, u, Object.assign({ product: "salt", qty: 1, mode: "collect", unit: cardOf(u === "wxyz-efgh" ? assoc : customer, 1),
      total: cardOf(u === "wxyz-efgh" ? assoc : customer, 1), place: "", forFriend: false, week: "", rid: "v4-desk-order-" + String(++k).padStart(4, "0") + "-pad" }, x.body || {}), "desk");
    const key = "order:" + u + ":" + r.order.id, d = JSON.parse(skv.m.get(key)); Object.assign(d, x.set || {}); skv.m.set(key, J(d)); return d; };
  const AT = "2031-01-05T01:00:00.000Z";
  const before = await put("wxyz-abcd", { set: { on: "2030-12-31", at: AT } });
  const p1 = await previewOrder(denv, before.id, { delivery: 0 }, nowD);
  ok(p1 && !p1.ok && p1.status === 409 && /newest lot of it came in on 2031-01-01/.test(p1.error),
    "P1 a day of the sale before the book's newest lot of it is refused at the preview, so at Accept, the cost on that day being another: " + J(p1 && (p1.ok || p1.error)));
  const onDay = await put("wxyz-abcd", { set: { on: "2031-01-02", at: AT }, body: { qty: 2, total: 2 * cardOf(customer, 1), unit: cardOf(customer, 1) } });
  const p2 = await previewOrder(denv, onDay.id, { delivery: 0 }, nowD);
  ok(p2 && p2.ok && p2.row.date === "2031-01-02",
    "P2 a day on or after it drafts the row on that day: " + J(p2 && (p2.ok ? p2.row.date : p2.error)));
  /* the day of the sale is the day twins are read on: an equal order rowed that day is one, rowed today is none */
  const twin = await put("wxyz-abcd", { set: { at: AT, queued: { ack: "2031-01-05T01:00:00.000Z" } }, body: { qty: 3, total: 2 * cardOf(customer, 1), unit: +(2 * cardOf(customer, 1) / 3).toFixed(2) } });
  draft = { status: "pending", entry: J({ at: "2031-01-05T01:00:00.000Z", payload: { date: "2031-01-02" } }) };
  const p3 = await previewOrder(denv, onDay.id, { delivery: 0 }, nowD);
  draft = { status: "pending", entry: J({ at: "2031-01-05T01:00:00.000Z", payload: { date: "2031-01-05" } }) };
  const p3b = await previewOrder(denv, onDay.id, { delivery: 0 }, nowD);
  draft = null;
  ok(twin && p3 && !p3.ok && p3.twin === true && /rowed on 2031-01-02 at this figure/.test(p3.error) && p3b && p3b.ok,
    "P3 an equal order rowed on his day of the sale is its twin and refused, naming that day; one rowed today is none: " + J([p3 && (p3.ok || p3.error), p3b && (p3b.ok || p3b.error)]));
  const fr = (buyer) => put("wxyz-efgh", { body: { forFriend: true }, set: { buyer } });
  const p4 = await previewOrder(denv, (await fr(other)).id, { delivery: 0 }, nowD);
  ok(!!assoc && !!other && p4 && p4.ok && p4.row.downstream === other && p4.row.customer === assoc + "-R",
    "P4 an associate's order for a friend with their customer named books to the resale account with the customer as downstream: " + J(p4 && (p4.ok ? [p4.row.customer, p4.row.downstream] : p4.error)));
  const bad = [];
  for (const b of ["ZZ9-NOPE", assoc, assoc + "-R"]) { const p = await previewOrder(denv, (await fr(b)).id, { delivery: 0 }, nowD); bad.push(p && !p.ok && p.status === 409 && /not a customer on the roster apart from them/.test(p.error)); }
  ok(bad.every(Boolean), "P5 a customer off the roster, the associate themself or their resale account is refused as their customer: " + J(bad));
  /* P6 to P8, Fable's review: a day that no longer holds, twins on the book itself, their newest salt sale */
  const stale = await put("wxyz-abcd", { set: { on: "2030-12-31", at: "2031-01-04T01:00:00.000Z" }, body: { qty: 4, total: 4 * cardOf(customer, 1), unit: cardOf(customer, 1) } });
  const p6 = await previewOrder(denv, stale.id, { delivery: 0 }, nowD);
  ok(p6 && p6.ok && p6.row.date === "2031-01-05", "P6 an order he placed on an earlier day is agreed as today's, his day of the sale no longer holding: " + J(p6 && (p6.ok ? p6.row.date : p6.error)));
  const g5 = 5 * cardOf(customer, 1);
  L.sales.push({ rid: "s-v4-twin", customer, product: "salt", date: "2031-01-05", qty: 5, total: g5, delivery: 0, cash: 0, deliveredQty: 0 });
  const k7 = await put("wxyz-ijkl", { set: { at: AT }, body: { qty: 6, total: g5, unit: +(g5 / 6).toFixed(2) } });
  const p7 = await previewOrder(denv, k7.id, { delivery: 0 }, nowD);
  L.sales[L.sales.length - 1].delivery = 10;
  const p7b = await previewOrder(denv, (await put("wxyz-ijkl", { set: { at: AT }, body: { qty: 5, total: g5, unit: cardOf(customer, 1) } })).id, { delivery: 0 }, nowD);
  L.sales[L.sales.length - 1].delivery = 0; L.sales[L.sales.length - 1].date = "2031-01-04";
  const p7c = await previewOrder(denv, (await put("wxyz-ijkl", { set: { at: AT }, body: { qty: 5, total: g5, unit: cardOf(customer, 1) } })).id, { delivery: 0 }, nowD);
  L.sales.pop();
  ok(p7c && p7c.ok && !p7c.second, "P7b an equal sale of theirs on the book on another day is neither a twin nor a second sale: " + J(p7c && (p7c.ok ? !!p7c.second : p7c.error)));
  ok(p7 && !p7.ok && p7.twin === true && /on the book today, s-v4-twin, is at this figure/.test(p7.error) && p7b && p7b.ok && p7b.second === true,
    "P7 a sale of theirs on the book that day under this row's key is a twin, refused with the way on; one equal in size and goods with another delivery is a second sale: " + J([p7 && (p7.ok || p7.error), p7b && (p7b.ok ? p7b.second : p7b.error)]));
  L.sales.push({ rid: "s-v4-late", customer, product: "salt", date: "2031-01-03", qty: 1, total: 100, delivery: 0, cash: 100, paidOn: "2031-01-03", deliveredQty: 1 });
  const p8 = await previewOrder(denv, (await put("wxyz-ijkl", { set: { on: "2031-01-02", at: AT }, body: { qty: 7, total: 7 * cardOf(customer, 1), unit: cardOf(customer, 1) } })).id, { delivery: 0 }, nowD);
  L.sales.pop();
  L.sales.push({ rid: "s-v4-paidlater", customer, product: "salt", date: "2031-01-01", qty: 1, total: 100, delivery: 0, cash: 100, deliveredQty: 1,
    amend: [{ kind: "Fulfilment", date: "2031-01-03", cash: 100, kg: 0 }] });
  const p9 = await previewOrder(denv, (await put("wxyz-ijkl", { set: { on: "2031-01-02", at: AT }, body: { qty: 8, total: 8 * cardOf(customer, 1), unit: cardOf(customer, 1) } })).id, { delivery: 0 }, nowD);
  L.sales.pop();
  ok(p9 && !p9.ok && /their newest salt sale is dated 2031-01-03/.test(p9.error), "P9 a row of theirs paid in full by a later Fulfilment bounds the day by that payment's day, as the walks read it (Fable's re-check): " + J(p9 && (p9.ok || p9.error)));
  ok(p8 && !p8.ok && /their newest salt sale is dated 2031-01-03/.test(p8.error), "P8 a day before their newest salt sale is refused, the reward and loyalty walks reading their rows in the order paid: " + J(p8 && (p8.ok || p8.error)));
}
