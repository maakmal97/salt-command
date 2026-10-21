/* test/loyalty-admin.mjs: SALT ADMIN, THIS CUSTOMER (the loyalty plan's P6, canvas V55, his rule of 20 Oct 2026). On a customer's salt order: their last
 * six rates, a unit now, the highest, how often they order and when the next is due, the loyalty meter, and the suggested % with its two halves;
 * Use it sends that % as tier-set. Each check red under its own mutation (test/loyalty-admin.mutations.json):
 *   1  the Desk's reading on an invented book: the suggestion is the pricing snapshot's (the desk's suggestOf), the halves add up at their
 *      median size scaled to 20 units, the unit is today's landed cost, and the meter is the walk's
 *   2  the halves are null when the suggestion is at or under their %; an associate and a partner are no customer here
 *   3  the reading answers only behind both locks: no owner, 403 at the Counter; no bridge key, 404 at the Desk; with the key, the reading
 *   4  his card on an agreed customer order: eyebrow, the line, the figures, the meter with the next order's day, the note, the suggestion and its
 *      two halves; the halves only when paired
 *   5  no card on an oil order, nor for a party the Desk reads as no customer
 *   6  Use it sends one tier-set with the suggested %, and nothing else
 *   7  nothing in the card over the weight of 500 */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const j = (x) => JSON.stringify(x);

export async function run({ ok, pageWork }) {
  /* 1 and 2: the desk's own pricing snapshot, an invented customer given the snapshot's suggestion for a real one's slot */
  const { readBook } = await import("../tools/book.mjs"), M = await import("../src/maker-inputs.js");
  const desk = await readBook(), L = JSON.parse(j(desk.ledger));
  desk.dom.window.close();
  const snap = L.PRICING.byProduct.salt;
  snap.lift = { ...(snap.lift || {}), "CQ1-ZUL": 0, "CQ2-ZUL": 0.2 };
  snap.suggest = { ...(snap.suggest || {}), "CQ1-ZUL": { pct: 0.1, why: "paid late" }, "CQ2-ZUL": { pct: 0.1, why: "paid late" } };
  snap.cards = { ...(snap.cards || {}), "CQ1-ZUL": snap.cards[Object.keys(snap.cards)[0]], "CQ2-ZUL": snap.cards[Object.keys(snap.cards)[0]] };
  L.roster = L.roster.concat(["CQ1-ZUL", "CQ2-ZUL"]);
  const mk = (c, rid, date, q) => ({ rid, customer: c, product: "salt", date, qty: q, total: 100 * q, cost: 58 * q, listRM: 100 * q, listQty: q,
    cash: 100 * q, paidOn: date, deliveredQty: q, deliveredOn: date, note: "test" });
  const rows = [["2031-01-01", 5], ["2031-01-06", 5], ["2031-01-11", 4], ["2031-01-16", 5]].flatMap(([d, q], i) => [mk("CQ1-ZUL", "s9" + (900 + i), d, q), mk("CQ2-ZUL", "s9" + (950 + i), d, q)]);
  const sales = L.sales.concat(rows);
  L.REWARD.stated.salt.loyal = { every: 20, since: "2031-01-01" };
  const book = { version: L.PRICING.v, state: { ...L, sales }, sales, purchases: L.purchases, pricing: L.PRICING };
  const r = M.makerCustomerReading(book, "CQ1-ZUL|2031-01-16|500", "2031-01-19");
  const I = snap.inputs, K = PRICING_ENGINE.costStack(I.cost), at = (d) => PRICING_ENGINE.quoteAt(5, K, I.policy, d);
  const want = +(20 * (at(0.1) - at(0)) / 5).toFixed(2);
  ok(r.customer === true && r.suggest.pct === 0.1 && r.suggest.why === "paid late" && r.gain && r.gain.size === 5 && r.gain.pct === want
    && r.gain.net === +(r.gain.pct - r.gain.unit).toFixed(2) && r.gain.unit === r.cost && r.cost > 0 && r.loyal.units === 19 && r.loyal.every === 20
    && r.cadence.every === 5 && r.dueIn === 2 && r.rates.length === 4 && r.pair === true && r.unitNow > 0,
    "the reading: the snapshot's suggestion, the halves at their median size for 20 units, the walk's meter: " + j([r.suggest, r.gain, want, r.loyal, r.cadence, r.dueIn, r.pair]));
  /* 2 */
  const held = M.makerCustomerReading(book, "CQ2-ZUL|2031-01-16|500", "2031-01-19");
  const assoc = L.associates[0], aRow = L.sales.find((s) => s.customer === assoc && s.rid);
  const ar = M.makerCustomerReading(book, (await import("../engine/position.mjs")).default.ovKey(aRow), "2031-01-19");
  ok(held.customer === true && held.gain === null && held.pair === false && ar.customer === false && ar.rates === undefined,
    "no halves at or under their %, and an associate is no customer here: " + j([held.gain, ar]));
  /* 3 */
  const { handleMaker } = await import("../stmt/maker.js"), deskW = (await import("../src/worker.js")).default;
  const rk = encodeURIComponent("CQ1-ZUL|2031-01-16|500");
  const r403 = await handleMaker(new Request("https://counter.test/all/maker/customer-reading/" + rk), {}, "/all/maker/customer-reading/" + rk, null);
  const r404 = await deskW.fetch(new Request("https://desk.test/_internal/maker/customer-reading/" + rk), { COUNTER_MAKER_KEY: "k".repeat(40) }, { waitUntil() {} });
  const r405 = await deskW.fetch(new Request("https://desk.test/_internal/maker/customer-reading/" + rk, { method: "POST", headers: { "X-Counter-Maker-Key": "k".repeat(40) } }),
    { COUNTER_MAKER_KEY: "k".repeat(40) }, { waitUntil() {} });
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? sales : b === "purchases" ? L.purchases : []).map((x) => ({ doc: j(x) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: j(v) })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : null);
    return { bind: (...a) => ({ all: () => all(a[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const r200 = await deskW.fetch(new Request("https://desk.test/_internal/maker/customer-reading/" + rk, { headers: { "X-Counter-Maker-Key": "k".repeat(40) } }),
    { COUNTER_MAKER_KEY: "k".repeat(40), SALT_LEDGER: mirror }, { waitUntil() {} });
  const j200 = r200.status === 200 ? await r200.json() : null;
  ok(r403.status === 403 && r404.status === 404 && r405.status === 405 && j200 && j200.reading.customer === true && j200.reading.code === "CQ1-ZUL",
    "the reading answers only behind both locks, and only to a GET: " + [r403.status, r404.status, r405.status, r200.status]);
  /* 4 to 7: his page */
  const base = { u: "abcd-efgh", product: "salt", msgs: [], history: [], payments: [], paid: 0, qty: 1, total: 100, delivery: 0, mode: "collect", at: "2026-10-10T02:00:00.000Z" };
  const extra = [{ ...base, id: "ord-c1", status: "acknowledged", ledgerKey: "CQ1-ZUL|2026-10-10|100" },
    { ...base, id: "ord-c2", status: "acknowledged", ledgerKey: "CQ2-ZUL|2026-10-10|100" },
    { ...base, id: "ord-c3", status: "acknowledged", product: "oil", ledgerKey: "CQ1-ZUL|2026-10-10|100|oil" },
    { ...base, id: "ord-c4", status: "acknowledged", ledgerKey: "AX1-ZED|2026-10-10|100" }];
  const reading = (more) => ({ customer: true, code: "CQ1-ZUL", rates: [100, 110, 95, 120, 110, 100].map((rate, i) => ({ date: "2026-10-0" + (i + 1), rate })), unitNow: 120, highest: 120,
    cadence: { every: 8, orders: 6, last: "2026-10-08" }, dueIn: 2, loyal: { units: 14, every: 20, earned: 0, paused: false, why: null, order: null, unit: null }, cost: 7.2, held: 0,
    suggest: { pct: 0.1, why: "paid late" }, gain: { pct: 23.2, unit: 7.2, net: 16, size: 1 }, pair: true, ...more });
  const routes = {
    ["/all/maker/customer-reading/" + encodeURIComponent("CQ1-ZUL|2026-10-10|100")]: { ok: true, reading: reading() },
    ["/all/maker/customer-reading/" + encodeURIComponent("CQ2-ZUL|2026-10-10|100")]: { ok: true, reading: reading({ code: "CQ2-ZUL", pair: false, loyal: { units: 6, every: 20, earned: 1, paused: true, why: "late", order: null, unit: null } }) },
    ["/all/maker/customer-reading/" + encodeURIComponent("CQ1-ZUL|2026-10-10|100|oil")]: { ok: true, reading: reading() },
    ["/all/maker/customer-reading/" + encodeURIComponent("AX1-ZED|2026-10-10|100")]: { ok: true, reading: { customer: false } }
  };
  const p = await richOwnerPage({ pageWork, review: (x) => ({ ...x, orders: (x.orders || []).concat(extra) }), extra: (route) => routes[route] });
  await p.work.quiet();
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const card = (id) => p.card(id) && p.card(id).querySelector("[data-customer]");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-c1"));
    /* 4 */
    const c1 = card("ord-c1"), figs = c1 ? [...c1.querySelectorAll(".salt-ledger__row")].map((n) => [...n.querySelectorAll(".salt-ledger__line > span")].map(t).join(" ")) : [];
    const pts = c1 && c1.querySelector("svg.ocust__spark polyline") ? c1.querySelector("svg.ocust__spark polyline").getAttribute("points").split(" ").length : 0;
    ok(!!c1 && !c1.hidden && t(c1.querySelector(".salt-eyebrow")) === "This customer" && t(c1.querySelector(".ocust__lab")) === "Last 6 orders" && pts === 6
      && j(figs) === j(["A unit now RM 120.00", "Highest RM 120.00", "Orders every 8 days"])
      && [...c1.querySelectorAll(".salt-meter__line > span")].map(t).join(" | ") === "Loyalty 14 of 20 units | Next order due in 2 days" && c1.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") === "70"
      && t(c1.querySelector(".ocust__note")) === "1 unit at cost every 20 at or above their price (RM 7.20 to you). They see 70%. Paused by a late payment or a write-off."
      && t(c1.querySelector(".ocust__sughead")) === "Suggested +10%, paid late"
      && t(c1.querySelector(".ocust__gain")) === "+10%: RM 23.20 more per 20 units · the loyalty unit RM 7.20 · net RM 16.00",
      "his card on a customer's order: " + t(c1) + " " + j(figs));
    await click(byAct(d, "order.open", "ord-c2"));
    const c2 = card("ord-c2");
    ok(!!c2 && !c2.hidden && !c2.querySelector(".ocust__gain") && t(c2.querySelector(".ocust__sughead")) === "Suggested +10%, paid late"
      && [...c2.querySelectorAll(".salt-status")].map(t).includes("Paused: a late payment"),
      "unpaired, the halves are not said and the pause is: " + t(c2));
    /* 5 */
    await click(byAct(d, "order.open", "ord-c3")); const c3 = p.card("ord-c3");
    await click(byAct(d, "order.open", "ord-c4")); const c4 = card("ord-c4");
    ok(!!c3 && !c3.querySelector("[data-customer]") && !!c4 && c4.hidden && !t(c4), "no card on oil, none for a party who is no customer here");
    /* 6 */
    await click(byAct(d, "order.open", "ord-c1"));
    const before = p.posts.length, use = byAct(d, "order.customer.use", "ord-c1");
    await click(use);
    const sent = p.posts.slice(before);
    ok(!!use && sent.length === 1 && sent[0].route === "/all/maker/inputs/tier-set" && sent[0].body.code === "CQ1-ZUL" && sent[0].body.product === "salt"
      && sent[0].body.tier === 0.1 && sent[0].body.unit === "pct" && typeof sent[0].body.at === "string",
      "Use it sends one tier-set with the suggested %: " + j(sent));
    /* 7 */
    const c1b = card("ord-c1");
    const heavy = [...(c1b ? c1b.querySelectorAll("*") : [])].filter((n) => !n.matches("h4.salt-eyebrow")).filter((n) => { const fw = p.w.getComputedStyle(n).fontWeight; return fw && fw !== "normal" && +fw > 500 || fw === "bold"; });
    ok(!!c1b && heavy.length === 0, "nothing in the card over the weight of 500: " + heavy.map((n) => n.tagName + ":" + p.w.getComputedStyle(n).fontWeight).join(" "));
  } finally { p.w.close(); }
}
