/* test/counter-orders-cards.mjs: YOUR ORDERS AS CARDS, FILTERED ON A PHONE, IN TWO COLUMNS ON A DESK (Counter Batch A, P5, his decisions of
 * 18 Oct 2026).
 *
 * An order is one card, the whole card one control whose name says the day, the size, the state and what it waits on. On a phone one row of
 * filters stands over them: All, Open, To pay and Done, each with its count; from 860px there is no filter row and Open and Done stand as two
 * columns, the Open one saying what is to pay, and no order opens by itself. Each empty view is a mark, a heading, a sentence and one way on.
 * Every assertion observes the generated page in jsdom; each was proved red by its own mutation (test/counter-orders-cards.mutations.json, run
 * with tools/section.mjs). Every code, name and password is invented.
 *   1  the counts: All is every order, Open every order not done, To pay the ones owing, Done the ones complete, declined or cancelled
 *   2  a tab shows only its orders, and the row is one tablist with one tab selected
 *   3  the card: one control, a link card, named in one sentence, owing in ember, nothing else to press inside it, no product word
 *   4  the empty views: none yet, nothing to pay, nothing done, each with its one way on
 *   5  from 860px: no filter row, two columns, what is to pay over Open, and nothing opened by itself */
import { webcrypto } from "node:crypto";

export async function run({ ok }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const SO = await import("../src/orders.js");
  const { JSDOM } = await import("jsdom");

  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(300), history: [{ at: iso(300), status: "placed", by: "customer" }], msgs: [] }, x);
  const A = ord("20261010090001-oc01");
  const B = ord("20261010090002-oc02", { product: "oil", unit: 40, total: 40, status: "acknowledged" });
  const R = ord("20261010090003-oc03", { qty: 2.5, unit: 38, total: 95, paid: 40, status: "ready" });
  const D = ord("20261009090004-oc04", { product: "candy", unit: 12, total: 12, paid: 12, moved: 1, status: "done", at: iso(3000) });
  const E = ord("20261009090005-oc05", { product: "rice", unit: 9, total: 9, status: "declined", at: iso(3500) });
  const F = ord("20261009090006-oc06", { status: "cancelled", at: iso(4000) });
  const ALL = [A, B, R, D, E, F];

  const u = "abcd-efgh", pass = "fixture-pass-p5", ck = await C.contentKey("test-secret", u);
  const prices = { at: new Date().toISOString(), week: { monday: "2026-10-12", label: "12 to 18 Oct 2026" }, soon: [], products: ["salt", "oil", "candy", "rice"].map((p) =>
    ({ product: p, unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] })) };
  const opened = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-p5-abcdefghij",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: await C.encryptWith(ck, JSON.stringify(prices)) };
  const wins = [];
  const open = async ({ orders, wide = false }) => {
    const dom = new JSDOM(P.landingPage(u, "np5", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      if (wide) win.matchMedia = (q) => ({ matches: /min-width: 860px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, opened);
        if (p === "/orders" && m === "GET") return answer(200, { ok: true, orders: JSON.parse(JSON.stringify(orders)), claims: [] });
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => d.querySelector("#pPrices .pmark"));
    d.querySelector('button[data-t="order"]').click();
    await until(() => d.querySelector("#pOrder [data-olist]") && (!orders.length || d.querySelector("#pOrder [data-row], #pOrder .olater")));
    return { w, d };
  };
  const ids = (root) => [...root.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row")).sort();
  const want = (list) => list.map((o) => o.id).sort();
  const tabOf = (pg, k) => pg.d.querySelector('#pOrder [data-otab="' + k + '"]');
  const pick = async (pg, k) => { tabOf(pg, k).click(); await until(() => tabOf(pg, k) && tabOf(pg, k).getAttribute("aria-selected") === "true"); };
  const list = (pg) => pg.d.querySelector("#pOrder [data-olist]");

  try {
    /* ---- 1 and 2: the counts, and each tab its own orders ---- */
    const S = await open({ orders: ALL });
    const counts = Object.fromEntries(["all", "open", "pay", "done"].map((k) => [k, tabOf(S, k) ? t(tabOf(S, k).querySelector(".salt-tabs__count")) : null]));
    ok(JSON.stringify(counts) === JSON.stringify({ all: "6", open: "3", pay: "2", done: "3" }),
      "All counts every order, Open the three not done, To pay the two owing, Done the complete, declined and cancelled: " + JSON.stringify(counts));
    const row = S.d.querySelector("#pOrder .otabs"), tabs = row ? [...row.querySelectorAll('[role="tab"]')] : [];
    ok(!!row && row.getAttribute("role") === "tablist" && tabs.length === 4 && tabs.filter((b) => b.getAttribute("aria-selected") === "true").length === 1
      && tabs.map((b) => b.firstChild.nodeValue).join("|") === "All|Open|To pay|Done",
      "the filter row is one tablist of four, All, Open, To pay and Done, one selected: " + tabs.map((b) => t(b) + (b.getAttribute("aria-selected") === "true" ? "*" : "")).join(", "));
    await pick(S, "pay"); const pay = ids(list(S));
    await pick(S, "done"); const done = ids(list(S));
    await pick(S, "open"); const opn = ids(list(S));
    ok(JSON.stringify(pay) === JSON.stringify(want([B, R])) && JSON.stringify(done) === JSON.stringify(want([D, E, F])) && JSON.stringify(opn) === JSON.stringify(want([A, B, R])),
      "a tab shows its own orders and no other: " + JSON.stringify({ pay, done, opn }));

    /* ---- 3: the card ---- */
    await pick(S, "all");
    S.d.querySelector("#pOrder .olater").click(); await until(() => ids(list(S)).length === 6);
    const card = (o) => list(S).querySelector('[data-row="' + o.id + '"]');
    const cR = card(R);
    ok(!!cR && cR.tagName === "BUTTON" && cR.classList.contains("salt-glass-card--link") && !cR.querySelector("button, a, input")
      && /^Order of \d\d \w{3} \d{4}, 2\.5 units, Ready to collect, RM 55\.00 to pay$/.test(cR.getAttribute("aria-label") || ""),
      "an order is one card, the whole card one control named by its day, size, state and what it waits on: " + (cR && cR.getAttribute("aria-label")));
    ok(!!cR && cR.querySelector(".ocard__what").classList.contains("odue") && t(cR.querySelector(".ocard__total")) === "RM 95.00"
      && /^\d\d \w{3} \d{4}, \d\d:\d\d$/.test(t(cR.querySelector(".ocard__when"))) && cR.querySelector(".ocard__top .salt-status") !== null,
      "its day and time stand over it with its state, what is owed is in ember and the figure is the whole order: " + t(cR));
    ok(t(card(D).querySelector(".ocard__what")) === "Paid in full" && t(card(E).querySelector(".ocard__what")) === "Nothing was paid" && card(F).classList.contains("ocard--ended"),
      "a finished order says it was paid in full, an ended one that nothing was paid: " + JSON.stringify([t(card(D)), t(card(E))]));
    const drawn = ALL.map((o) => t(card(o)).toLowerCase()).join(" ");
    const said = SO.PRODUCT_WORDS.filter((w) => new RegExp("\\b" + w + "\\b").test(drawn));
    ok(said.length === 0, "no card draws a product's word: " + JSON.stringify(said));
    card(R).click(); await until(() => S.d.querySelector('#pOrder .oscreen[data-order="' + R.id + '"]'));
    ok(!!S.d.querySelector('#pOrder .oscreen[data-order="' + R.id + '"]'), "and a tap anywhere on the card opens that order");

    /* ---- 4: the empty views ---- */
    const N = await open({ orders: [] });
    const eN = N.d.querySelector("#pOrder .salt-empty"), gN = eN ? [...eN.querySelectorAll("button, a")] : [];
    ok(!!eN && t(eN.querySelector(".salt-empty__title")) === "No orders yet" && gN.length === 1 && t(gN[0]) === "Place an order" && !!eN.querySelector(".salt-empty__mark svg")
      && !N.d.querySelector("#pOrder .otabs"),
      "with no orders the page draws one empty view, its mark, No orders yet and one way on, and no filter row: " + t(eN));
    const Dn = await open({ orders: [D, E] });
    await pick(Dn, "pay");
    const eP = list(Dn).querySelector(".salt-empty"), gP = eP ? [...eP.querySelectorAll("button, a")] : [];
    ok(!!eP && t(eP.querySelector(".salt-empty__title")) === "Nothing to pay" && gP.length === 1 && t(gP[0]) === "See all orders", "To pay with nothing owing says so, with one way on: " + t(eP));
    const Op = await open({ orders: [A, B] });
    await pick(Op, "done");
    const eD = list(Op).querySelector(".salt-empty"), gD = eD ? [...eD.querySelectorAll("button, a")] : [];
    ok(!!eD && t(eD.querySelector(".salt-empty__title")) === "No completed orders yet" && gD.length === 1 && t(gD[0]) === "See open orders", "Done with nothing done says so: " + t(eD));
    gD[0].click(); await until(() => tabOf(Op, "open") && tabOf(Op, "open").getAttribute("aria-selected") === "true");
    ok(tabOf(Op, "open").getAttribute("aria-selected") === "true" && JSON.stringify(ids(list(Op))) === JSON.stringify(want([A, B])), "and its one way on is the open orders");

    /* ---- 5: from 860px ---- */
    const W = await open({ orders: ALL, wide: true });
    const cols = W.d.querySelectorAll("#pOrder .ocols > .ocol"), oc = W.d.querySelector("#pOrder .ocol--open"), dc = W.d.querySelector("#pOrder .ocol--done");
    ok(!W.d.querySelector("#pOrder .otabs") && cols.length === 2 && !!oc && !!dc && JSON.stringify(ids(oc)) === JSON.stringify(want([A, B, R]))
      && JSON.stringify(ids(dc)) === JSON.stringify(want([D, E, F])),
      "from 860px there is no filter row, and Open and Done stand as two columns of their own orders: " + JSON.stringify({ open: oc && ids(oc), done: dc && ids(dc) }));
    ok(!!oc && t(oc.querySelector(".ocol__pay")) === "RM 95.00 to pay" && t(oc.querySelector(".ocol__n")) === "3" && t(dc.querySelector(".ocol__n")) === "3" && !dc.querySelector(".ocol__pay"),
      "Open says what is to pay across it, and each column its count: " + JSON.stringify([oc && t(oc.querySelector(".ocol__head")), dc && t(dc.querySelector(".ocol__head"))]));
    ok(!W.d.querySelector("#pOrder .oscreen"), "and no order opens by itself: the desk opens on the columns");
  } catch (e) { ok(false, "counter-orders-cards stopped on an error: " + (e && e.stack)); }
  finally { wins.forEach((w) => w.close()); }
}
