/* test/order-stream-v5.mjs: plan version 3, part 3d (03 Nov 2026), ONE SHEET, ONE TRIP. The delivered lines of one sheet of theirs are one trip, its id
 * named by the Desk from the sheet (engine/stages.mjs tripOf), its one delivery riding the first line still standing (tripCarrier), a line joining
 * it only on the day its siblings' rows are dated (src/orders.js previewAck), and his Agree on the first line agreeing the others in the same
 * request at no delivery (stmt/maker.js sheetFollow). Invented figures on the frozen book; every username is invented. */
import { readBook } from "../tools/book.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { tripOf, tripLines, tripCarrier } from "../engine/stages.mjs";
import { tripCheck } from "../src/drafter.js";
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
  /* E1 to E2: the trip, alone */
  const sh = "0123456789abcdef0123456789abcdef", sh2 = "fedcba9876543210fedcba9876543210";
  const a = { id: "20310105010000-aaaa", u: "wxyz-abcd", sheet: sh, mode: "deliver", status: "placed" };
  const b = Object.assign({}, a, { id: "20310105010001-bbbb" }), c = Object.assign({}, a, { id: "20310105010002-cccc" });
  ok(tripOf(a) === tripOf(b) && POSITION_ENGINE.TRIP_RE.test(tripOf(a)) && tripOf(Object.assign({}, a, { sheet: sh2 })) !== tripOf(a)
    && tripOf(Object.assign({}, a, { mode: "collect" })) === null && tripOf(Object.assign({}, a, { sheet: undefined })) === null,
    "E1 a delivered sheet's lines name one trip the engine takes, another sheet another; a collection or a lone order none: " + tripOf(a));
  const others = [c, b, Object.assign({}, a, { id: "20310105005959-zzzz", status: "cancelled" }), Object.assign({}, a, { id: "20310105005958-yyyy", u: "wxyz-efgh" }),
    Object.assign({}, a, { id: "20310105005957-xxxx", mode: "collect" })];
  ok(tripLines(c, others.concat([a])).map((x) => x.id).join() === [a.id, b.id, c.id].join() && tripCarrier(c, others.concat([a])).id === a.id
    && tripCarrier(c, [b, Object.assign({}, a, { status: "declined" })]).id === b.id,
    "E2 the delivery rides the sheet's first delivered line still standing, by id: a line cancelled or declined passes it on, another account's or a collection never takes it");

  /* P1 to P6: the Desk's preview on the frozen book */
  const nowD = new Date("2031-01-05T02:00:00Z"), AT = "2031-01-05T01:00:00.000Z";
  const desk = await readBook(), L = JSON.parse(J(desk.ledger));
  desk.dom.window.close();
  const cardOf = (cd, p, q) => PRICING_ENGINE.cardAt(L.PRICING, cd, p, q).card;
  const customer = Object.keys(L.PRICING.byProduct.salt.cards || {}).find((cd) => cardOf(cd, "salt", 1) > 0 && cardOf(cd, "oil", 1) > 0 && cardOf(cd, "rice", 1) > 0
    && !(L.associates || []).includes(cd) && !(L.partners || []).includes(cd));
  let drafts = {};
  const mirror = { prepare(q) {
    const all = async (x) => /FROM entry/.test(q) ? { results: (x === "sales" ? L.sales : x === "purchases" ? L.purchases : []).map((r) => ({ doc: J(r) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: J(v) })) } : { results: [] };
    let args = [];
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : /SELECT status, entry FROM draft WHERE id=/.test(q) ? (drafts[args[0]] || null) : null);
    return { bind: (...x) => { args = x; return { all: () => all(x[0]), first, run: async () => ({ meta: { changes: 0 } }) }; }, all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const O = await import("../stmt/orders.js");
  const { previewOrder } = await import("../src/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default;
  const skv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" }, dkv = new KV();
  await dkv.put("stmt-users", J({ "wxyz-abcd": customer, "wxyz-ijkl": customer }));
  const denv = { SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) }, SALT_LEDGER: mirror };
  let k = 0;
  const put = async (u, p, sheet, set) => { const r = await O.placeOrder(senv, u, { product: p, qty: 1, mode: "deliver", place: "Taman Rekaan", unit: cardOf(customer, p, 1), total: cardOf(customer, p, 1),
      forFriend: false, week: "", sheet, rid: "v5-desk-order-" + String(++k).padStart(4, "0") + "-pad" }, "desk");
    if (!r.order) throw new Error(J(r));
    const key = "order:" + u + ":" + r.order.id, d = JSON.parse(skv.m.get(key)); Object.assign(d, { at: AT }, set || {}); skv.m.set(key, J(d)); return d; };
  /* the first line is the first by id, as the Desk reads it: two placed in one second sort by their ids' own tails */
  const sorted = (xs) => xs.slice().sort((x, y) => String(x.id).localeCompare(String(y.id)));
  const [first, second] = sorted([await put("wxyz-abcd", "salt", sh), await put("wxyz-abcd", "oil", sh)]);
  const trip = tripOf(first);
  const p1 = await previewOrder(denv, first.id, { delivery: 10 }, nowD);
  ok(p1 && p1.ok && /approved on its own/.test(J(p1.reasoning)) && !/approves every row of the trip/.test(J(p1.reasoning)),
    "P8 a site order's row on a trip is said to be approved on its own, as Approve takes it (Fable's review): " + J(p1 && p1.reasoning));
  const nodb = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) }, fl1 = [], fl2 = [];
  await tripCheck(nodb, { sales: [] }, { trip, customer: "CX1-AB", date: "2031-01-05", product: "salt", delivery: 0 }, [], fl1, true);
  await tripCheck(nodb, { sales: [] }, { trip, customer: "CX1-AB", date: "2031-01-05", product: "salt", delivery: 0 }, [], fl2, false);
  ok(fl1.length === 0 && fl2.length === 1, "D1 a site sheet's trip agreed at no delivery raises no flag, so its rows equal their previews; a hand trip with none still does: " + J([fl1, fl2]));
  ok(p1 && p1.ok && p1.row.trip === trip && +p1.row.delivery === 10, "P1 the sheet's first line carries the trip's one delivery and names the trip: " + J(p1 && (p1.ok ? [p1.row.trip, p1.row.delivery] : p1.error)));
  const p2 = await previewOrder(denv, second.id, { delivery: 10 }, nowD);
  ok(p2 && !p2.ok && p2.status === 409 && /this sheet's one delivery rides its first order/.test(p2.error), "P2 a charge on another line of it is refused, with the way on: " + J(p2 && (p2.ok || p2.error)));
  const p3 = await previewOrder(denv, second.id, { delivery: 0 }, nowD);
  ok(p3 && p3.ok && p3.row.trip === trip && !(+p3.row.delivery > 0), "P3 at no delivery it joins the trip: " + J(p3 && (p3.ok ? [p3.row.trip, p3.row.delivery] : p3.error)));
  /* the first line's row waits dated the day before: the second cannot be one day's trip with it, so it stands alone */
  const key1 = "order:wxyz-abcd:" + first.id, d1 = JSON.parse(skv.m.get(key1)); d1.queued = { ack: "2031-01-04T03:00:00.000Z" }; d1.status = "acknowledged"; skv.m.set(key1, J(d1));
  drafts["2031-01-04T03:00:00.000Z"] = { status: "pending", entry: J({ at: "2031-01-04T03:00:00.000Z", payload: { date: "2031-01-04" } }) };
  const p4 = await previewOrder(denv, second.id, { delivery: 0 }, nowD);
  const p4c = await previewOrder(denv, second.id, { delivery: 10 }, nowD);
  drafts["2031-01-04T03:00:00.000Z"].entry = J({ at: "2031-01-04T03:00:00.000Z", payload: { date: "2031-01-05" } });
  const p4b = await previewOrder(denv, second.id, { delivery: 0 }, nowD);
  drafts["2031-01-04T03:00:00.000Z"].status = "rejected";
  const p9 = await previewOrder(denv, second.id, { delivery: 10 }, nowD);
  drafts = {};
  ok(p9 && p9.ok && !p9.row.trip && +p9.row.delivery === 10,
    "P9 a first line agreed on another day whose row was rejected carries nothing here: this line takes its own charge, off the trip (Fable's re-check): " + J(p9 && (p9.ok ? [p9.row.trip || null, p9.row.delivery] : p9.error)));
  ok(p4c && p4c.ok && !p4c.row.trip && +p4c.row.delivery === 10,
    "P7 a line kept off the trip by another day's row is a delivery of its own, and its charge is taken (Fable's review): " + J(p4c && (p4c.ok ? [p4c.row.trip || null, p4c.row.delivery] : p4c.error)));
  ok(p4 && p4.ok && !p4.row.trip && p4b && p4b.ok && p4b.row.trip === trip,
    "P4 a line whose sibling's row is dated another day stands as a row of its own; dated this day it joins the trip: " + J([p4 && (p4.ok ? p4.row.trip || null : p4.error), p4b && (p4b.ok ? p4b.row.trip : p4b.error)]));
  /* a row of the trip already on the book on another day keeps this line off it */
  const [third, fourth] = sorted([await put("wxyz-ijkl", "salt", sh2), await put("wxyz-ijkl", "oil", sh2)]);
  L.sales.push({ rid: "s-v5-trip", customer, product: "rice", date: "2031-01-03", qty: 1, total: 50, delivery: 0, cash: 0, deliveredQty: 0, trip: tripOf(third) });
  const p5 = await previewOrder(denv, fourth.id, { delivery: 0 }, nowD);
  L.sales.pop();
  ok(p5 && p5.ok && !p5.row.trip, "P5 a row of the trip on the book on another day keeps this line off it: " + J(p5 && (p5.ok ? p5.row.trip || null : p5.error)));
  /* P10: the first line's row is today's, but a second line's is another day's: the third cannot be one day's trip with them, so it takes its own charge */
  const sh4 = "a1b2a1b2a1b2a1b2a1b2a1b2a1b2a1b";
  const [g1, g2, g3] = sorted([await put("wxyz-abcd", "salt", sh4 + "a"), await put("wxyz-abcd", "oil", sh4 + "a"), await put("wxyz-abcd", "rice", sh4 + "a")]);
  const ackOf = (o, at) => { const kk = "order:wxyz-abcd:" + o.id, d = JSON.parse(skv.m.get(kk)); d.queued = { ack: at }; d.status = "acknowledged"; skv.m.set(kk, J(d)); };
  ackOf(g1, "2031-01-05T01:30:00.000Z"); ackOf(g2, "2031-01-04T01:30:00.000Z");
  drafts["2031-01-05T01:30:00.000Z"] = { status: "pending", entry: J({ at: "2031-01-05T01:30:00.000Z", payload: { date: "2031-01-05" } }) };
  drafts["2031-01-04T01:30:00.000Z"] = { status: "pending", entry: J({ at: "2031-01-04T01:30:00.000Z", payload: { date: "2031-01-04" } }) };
  const p10 = await previewOrder(denv, g3.id, { delivery: 10 }, nowD);
  drafts = {};
  ok(p10 && p10.ok && !p10.row.trip && +p10.row.delivery === 10,
    "P10 with the first line's row today's but another line's another day's, a third line is no trip and takes its own charge: " + J(p10 && (p10.ok ? [p10.row.trip || null, p10.row.delivery] : p10.error)));
  /* the first line cancelled, the next carries the delivery */
  const key3 = "order:wxyz-ijkl:" + third.id, d3 = JSON.parse(skv.m.get(key3)); d3.status = "cancelled"; skv.m.set(key3, J(d3));
  const p6 = await previewOrder(denv, fourth.id, { delivery: 10 }, nowD);
  ok(p6 && p6.ok && +p6.row.delivery === 10 && p6.row.trip === tripOf(fourth), "P6 with the first line cancelled, the next carries the delivery: " + J(p6 && (p6.ok ? [p6.row.trip, p6.row.delivery] : p6.error)));

  /* M1 to M4: his Agree on the first line agrees the others in the same request */
  const { handleMaker } = await import("../stmt/maker.js");
  const kv = new Store(), env = { STMT: kv, ORDER_STORE: "object" };
  const ob = orderBook(env); env.ORDERBOOK = ob.ns;
  const U = "oatg-trip", OWNER = { email: "maakmal97@icloud.com" };
  await kv.put("u:" + U, J({ prices: { digest: "dg" } }));
  const calls = [];
  let refuse = null;
  Object.assign(env, { COUNTER_MAKER_KEY: "k".repeat(32), DESK_MAKER: { fetch: async (req) => {
    const path = new URL(req.url).pathname, body = req.method === "POST" ? await req.json() : null, id = path.split("/")[4], verb = path.split("/").pop();
    calls.push([verb, id, body]);
    if (refuse && refuse === id && verb === "accept") return new Response(J({ ok: false, error: "The Desk refused it. More words." }), { status: 409 });
    return new Response(J(verb === "preview" ? { ok: true, hash: "h-" + id, flags: [] } : { ok: true, approved: true }), { status: 200 });
  } } });
  const realF = globalThis.fetch;
  const call = async (path, b) => { globalThis.fetch = async () => new Response("", { status: 201 });
    try { const r = await handleMaker(new Request("https://counter.test" + path, { method: "POST", body: J(b) }), env, path, OWNER, {}); return { status: r.status, j: await r.json() }; }
    finally { globalThis.fetch = realF; } };
  let n = 0;
  const line = (p, x) => Object.assign({ product: p, qty: 1, total: 100, unit: 100, mode: "deliver", place: "Taman Rekaan", forFriend: false, week: "", digest: "dg", rid: "v5-maker-rid-" + String(++n).padStart(4, "0") + "-pad" }, x || {});
  const S = "aaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb", S2 = "ccccccccccccccccdddddddddddddddd";
  const l1 = (await call("/all/maker/customers/" + U + "/orders", line("salt", { sheet: S }))).j.order;
  const l2 = (await call("/all/maker/customers/" + U + "/orders", line("oil", { sheet: S }))).j.order;
  const l3 = (await call("/all/maker/customers/" + U + "/orders", line("rice", { sheet: S, slot: undefined }))).j.order;
  /* the first line is the first by id, as the Desk and Salt Admin read it: lines placed in one second sort by their ids' own tails */
  const byId = (xs) => xs.slice().sort((x, y) => String(x.id).localeCompare(String(y.id)));
  const [s1, s2, s3] = byId([l1, l2, l3]);
  calls.length = 0;
  const slot = "2031-01-06T08";
  const m1 = await call("/all/maker/orders/" + s1.id + "/accept", { total: 100, delivery: 15, hash: "h-first", slot });
  const steps = calls.map((x) => x[0] + ":" + x[1]);
  ok(m1.status === 200 && J(steps) === J(["accept:" + s1.id, "preview:" + s2.id, "accept:" + s2.id, "preview:" + s3.id, "accept:" + s3.id])
    && calls[1][2].delivery === 0 && calls[1][2].total === 100 && calls[1][2].slot === slot && calls[2][2].hash === "h-" + s2.id && calls[2][2].delivery === 0
    && m1.j.sheet && m1.j.sheet.length === 2 && m1.j.sheet.every((x) => x.accepted),
    "M1 his Agree on a delivered sheet's first line agrees its other lines in the same request, each previewed and agreed at no delivery in the window he chose: " + J([steps, m1.j.sheet]));
  calls.length = 0;
  const m2 = await call("/all/maker/orders/" + s2.id + "/accept", { total: 100, delivery: 0, hash: "h-x" });
  ok(m2.status === 200 && calls.length === 1 && !m2.j.sheet, "M2 Agree on another line agrees that line alone: " + J(calls.map((x) => x[0])));
  const c0 = (await call("/all/maker/customers/" + U + "/orders", line("salt", { sheet: S2, mode: "collect", place: "" }))).j.order;
  const c1 = byId([c0, (await call("/all/maker/customers/" + U + "/orders", line("oil", { sheet: S2, mode: "collect", place: "" }))).j.order])[0];
  calls.length = 0;
  const m3 = await call("/all/maker/orders/" + c1.id + "/accept", { total: 100, delivery: 0, hash: "h-c" });
  ok(m3.status === 200 && calls.length === 1 && !m3.j.sheet, "M3 a collected sheet is no trip, and its first line's Agree agrees it alone: " + J(calls.map((x) => x[0])));
  const U2 = "oath-trip";
  await kv.put("u:" + U2, J({ prices: { digest: "dg" } }));
  const S3 = "eeeeeeeeeeeeeeeeffffffffffffffff";
  const [f1, f2] = byId([(await call("/all/maker/customers/" + U2 + "/orders", line("salt", { sheet: S3 }))).j.order,
    (await call("/all/maker/customers/" + U2 + "/orders", line("oil", { sheet: S3 }))).j.order]);
  refuse = f2.id;
  const m4 = await call("/all/maker/orders/" + f1.id + "/accept", { total: 100, delivery: 15, hash: "h-f" });
  refuse = null;
  ok(m4.status === 200 && m4.j.approved === true && m4.j.sheet && m4.j.sheet[0].accepted === false && m4.j.sheet[0].why === "The Desk refused it.",
    "M4 a line the Desk refuses says why in one sentence, and the first line's Agree stands: " + J(m4.j.sheet));
}
