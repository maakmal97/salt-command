/* 16 Nov 2026, the move to Ambient: the filters are the system's counted Filters (aria-pressed, no tablist), an order is the system's Row (hRow, as Home's),
 * an empty view is one sentence and one way on, and from 960px the list and the open order are the shell's two panes: the list is the same list at any
 * width, the lead and New order stand in the second pane until an order is tapped. Each re-aimed check says what it now holds; none was dropped.
 *
 * test/counter-orders-cards.mjs: YOUR ORDERS AS CARDS, FILTERED ON A PHONE, IN TWO COLUMNS ON A DESK (Counter Batch A, P5, his decisions of
 * 18 Oct 2026).
 * 22 Nov 2026 (the place head): the four views are the head's first row (#cHead > .otabs, the slide of Ambient's tabs, never wrapping) on Orders alone, over
 * both panes, and the shell says whose account it is in its status row, under the title (his answer 3: a place with one view has no row 1). With the reviewer's findings
 * of the same day the row is static markup, drawn once: each list draw repaints its counts, the pressed one and the dimmed in place (the buttons are never replaced),
 * a view with nothing in it is dimmed and its tap ignored, and on a phone the row stands down while an order is open, as its list does.
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
 *   5  from 860px: no filter row, two columns, what is to pay over Open, and nothing opened by itself
 *   6  (P6) the rail names whose account it is by the username, and Salt Counter is the only brand drawn */
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
    const polls = [];
    const dom = new JSDOM(P.landingPage(u, "np5", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      /* 22 Nov 2026 (the place head): the poll's timer is captured and fired by the check, so a view can be seen to empty under an unchanged tap */
      const si = win.setInterval.bind(win); win.setInterval = (f, ms) => { if (ms === P.POLL_MS) { polls.push(f); return 700 + polls.length; } return si(f, ms); };
      if (wide) win.matchMedia = (q) => ({ matches: /min-width: 960px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
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
    return { w, d, polls };
  };
  const ids = (root) => [...root.querySelectorAll("[data-row]")].map((r) => r.getAttribute("data-row")).sort();
  const want = (list) => list.map((o) => o.id).sort();
  /* 22 Nov 2026 (the place head): the views stand in the head, not in the list */
  const tabOf = (pg, k) => pg.d.querySelector('#cHead > .otabs [data-otab="' + k + '"]');
  const pick = async (pg, k) => { tabOf(pg, k).click(); await until(() => tabOf(pg, k) && tabOf(pg, k).getAttribute("aria-pressed") === "true"); };
  const list = (pg) => pg.d.querySelector("#pOrder [data-olist]");

  try {
    /* ---- 0 (22 Nov 2026, the place head): the views are static markup, drawn once in the head, hidden, All pressed, no count yet ---- */
    const st = new JSDOM(P.landingPage(u, "np5s", null)).window.document, sr = st.querySelector("#cHead > .otabs"), sb = sr ? [...sr.querySelectorAll("button")] : [];
    ok(!!sr && sr.hidden && sr === st.querySelector("#cHead").firstElementChild && sr.getAttribute("role") === "group" && sr.getAttribute("aria-label") === "Show orders"
      && sb.map((b) => b.getAttribute("data-otab")).join() === "all,open,pay,done" && sb.map((b) => b.getAttribute("aria-pressed")).join() === "true,false,false,false"
      && sb.every((b) => b.classList.contains("amb-segment__opt") && t(b.querySelector(".amb-segment__count")) === "") && sb.map((b) => b.firstChild.textContent.trim()).join("|") === "All|Open|To pay|Done",
      "the four views are in the page as it is served, hidden, first in the head, All pressed and no count before the orders are read: " + sb.map((b) => t(b)).join("|"));
    /* ---- 1 and 2: the counts, and each tab its own orders ---- */
    const S = await open({ orders: ALL });
    const counts = Object.fromEntries(["all", "open", "pay", "done"].map((k) => [k, tabOf(S, k) ? t(tabOf(S, k).querySelector(".amb-segment__count")) : null]));
    ok(JSON.stringify(counts) === JSON.stringify({ all: "6", open: "3", pay: "2", done: "3" }),
      "All counts every order, Open the three not done, To pay the two owing, Done the complete, declined and cancelled: " + JSON.stringify(counts));
    /* 22 Nov 2026 (the place head): in the head, one slide of four views that never wraps, shown on Orders, hidden on Home, and not drawn inside the list */
    const row = S.d.querySelector("#cHead > .otabs"), tabs = row ? [...row.querySelectorAll(".amb-segment__opt")] : [];
    ok(!!row && row === S.d.querySelector("#cHead").firstElementChild && row.classList.contains("amb-segment--tabs") && row.classList.contains("amb-segment--slide") && !row.classList.contains("amb-segment--wrap")
      && !row.hidden && !S.d.querySelector("#pOrder .otabs") && tabs.length === 4 && tabs.filter((b) => b.getAttribute("aria-pressed") === "true").length === 1
      && tabs.map((b) => b.firstChild.textContent.trim()).join("|") === "All|Open|To pay|Done",
      "the views are the head's four counted tabs, All, Open, To pay and Done, one pressed, none wrapping nor inside the list: " + tabs.map((b) => t(b) + (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join(", "));
    S.d.querySelector('button[data-t="home"]').click();
    ok(S.d.querySelector("#cHead > .otabs").hidden, "and on Home the views are hidden, to stand on Orders alone");
    S.d.querySelector('button[data-t="order"]').click();
    const btn = tabOf(S, "pay");
    await pick(S, "pay"); const pay = ids(list(S));
    await pick(S, "done"); const done = ids(list(S));
    await pick(S, "open"); const opn = ids(list(S));
    ok(JSON.stringify(pay) === JSON.stringify(want([B, R])) && JSON.stringify(done) === JSON.stringify(want([D, E, F])) && JSON.stringify(opn) === JSON.stringify(want([A, B, R])),
      "a tab shows its own orders and no other: " + JSON.stringify({ pay, done, opn }));
    /* 22 Nov 2026 (the place head): drawn once and repainted in place: the row and its buttons are the very nodes after every view, and with every view full none is dimmed */
    ok(S.d.querySelector("#cHead > .otabs") === row && tabOf(S, "pay") === btn && [...row.querySelectorAll("button")].every((b, i) => b === tabs[i] && b.getAttribute("aria-disabled") !== "true")
      && [...row.querySelectorAll("button")].map((b) => b.getAttribute("aria-pressed")).join() === "false,true,false,false",
      "a tap repaints the pressed one where it stands, the buttons never replaced, and none is dimmed while every view holds an order");

    /* ---- 6 (P6): the shell names whose account it is by the username, and Salt Counter is the one brand on the page. 15 Nov 2026, the move to
       Ambient: the rail's brand went with the rail; the hero's line under the place says it, at every width ---- */
    /* 22 Nov 2026 (the place head): the hero is the title alone; whose account it is stands in the status row beside it, at every width */
    const who = S.d.querySelector("#tabs > .amb-screen > #cHead > .amb-status > .amb-status__text[data-wholine] > [data-whoname]"), brand = who && who.closest("[data-wholine]");
    ok(S.d.querySelectorAll("#tabs > .amb-screen > header.amb-hero > *").length === 1 && !S.d.querySelector("#tabs .amb-hero__sub") && !S.d.querySelector("#tabs > .amb-appbar"),
      "the hero holds the title alone, no line stands under it and no app bar stands over it");
    const seen = (() => { const out = [], w = S.d.createTreeWalker(S.d.body, 4); while (w.nextNode()) { const n = w.currentNode; if (!/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) out.push(n.nodeValue); } return out.join(" "); })();
    const brands = (seen.match(/Salt [A-Z][a-z]+/g) || []).filter((x, i, l) => l.indexOf(x) === i);
    ok(!!who && who.textContent === u && !brand.hidden && JSON.stringify(brands) === JSON.stringify(["Salt Counter"]),
      "the status row says the username beside the title, and the only brand the page draws is Salt Counter: " + JSON.stringify({ who: who && who.textContent, brands }));
    /* ---- 3: the card ---- */
    await pick(S, "all");
    S.d.querySelector("#pOrder .olater").click(); await until(() => ids(list(S)).length === 6);
    const card = (o) => list(S).querySelector('[data-row="' + o.id + '"]');
    const cR = card(R);
    ok(!!cR && cR.tagName === "BUTTON" && cR.classList.contains("amb-row") && !cR.querySelector("button, a, input")
      && /^Order of \d\d \w{3} \d{4}, 2\.5 units, Ready to collect, RM 55\.00 to pay$/.test(cR.getAttribute("aria-label") || ""),
      "an order is one Row, the whole row one control named by its day, size, state and what it waits on: " + (cR && cR.getAttribute("aria-label")));
    ok(!!cR && /^Ready to collect, RM 55\.00 to pay$/.test(t(cR.querySelector(".amb-row__sub"))) && t(cR.querySelector(".amb-row__amount")) === "RM 95.00"
      && /^\d\d \w{3} \d{4}$/.test(t(cR.querySelector(".amb-row__age"))) && !cR.querySelector(".salt-status, .amb-chip"),
      "its day stands at its side, its state is a word of the second line with what it waits on, never a chip, and the figure is the whole order: " + t(cR));
    ok(/paid in full$/i.test(t(card(D).querySelector(".amb-row__sub"))) && /nothing was paid$/i.test(t(card(E).querySelector(".amb-row__sub"))) && /^Cancelled by you/.test(t(card(F).querySelector(".amb-row__sub"))),
      "a finished order says it was paid in full, an ended one that nothing was paid: " + JSON.stringify([t(card(D)), t(card(E))]));
    const drawn = ALL.map((o) => t(card(o)).toLowerCase()).join(" ");
    const said = SO.PRODUCT_WORDS.filter((w) => new RegExp("\\b" + w + "\\b").test(drawn));
    ok(said.length === 0, "no card draws a product's word: " + JSON.stringify(said));
    card(R).click(); await until(() => S.d.querySelector('#pOrder .oscreen[data-order="' + R.id + '"]'));
    ok(!!S.d.querySelector('#pOrder .oscreen[data-order="' + R.id + '"]'), "and a tap anywhere on the card opens that order");
    /* 22 Nov 2026 (the place head, the reviewer's findings): on a phone an open order is the whole tab and its list stands down, so the views over it stand down too (their tap would change a list nobody can see) */
    ok(row.hidden && list(S).closest(".olistcol").hidden, "on a phone, with an order open, the list and the views over it are hidden together");
    S.d.querySelector("#pOrder .oback").click(); await until(() => !row.hidden);
    ok(!row.hidden && !S.d.querySelector("#pOrder .oscreen") && !list(S).closest(".olistcol").hidden && S.d.querySelector("#cHead > .otabs") === row, "and shut again the views come back, the same row");

    /* ---- 4: the empty views ---- */
    const N = await open({ orders: [] });
    const eN = N.d.querySelector("#pOrder .oempty"), gN = eN ? [...eN.querySelectorAll("button, a")] : [];
    ok(!!eN && t(eN.querySelector(".amb-empty")) === "No orders yet. Your orders show here once you place one." && gN.length === 1 && t(gN[0]) === "Place an order"
      && !N.d.querySelector("#pOrder .otabs"),
      "with no orders the page draws one empty view, one sentence (No orders yet) and one way on, and no filter row of the list's own: " + t(eN));
    /* 22 Nov 2026 (the place head, the reviewer's findings): with none, the head's views stand on Orders, every count 0 and the three but All dimmed */
    const nr = N.d.querySelector("#cHead > .otabs"), nb = nr ? [...nr.querySelectorAll("button")] : [];
    ok(!!nr && !nr.hidden && nb.map((b) => t(b.querySelector(".amb-segment__count"))).join() === "0,0,0,0" && nb.map((b) => b.getAttribute("aria-disabled") === "true").join() === "false,true,true,true",
      "and the head's four views stand there with every count 0, the three but All dimmed: " + nb.map((b) => t(b) + (b.getAttribute("aria-disabled") === "true" ? "(dim)" : "")).join(", "));
    /* a view with nothing in it is dimmed and its tap changes nothing */
    const Dn = await open({ orders: [D, E] });
    const dn = ["all", "open", "pay", "done"].map((k) => tabOf(Dn, k));
    ok(dn.map((b) => t(b.querySelector(".amb-segment__count"))).join() === "2,0,0,2" && dn.map((b) => b.getAttribute("aria-disabled") === "true").join() === "false,true,true,false",
      "with every order done the views Open and To pay hold none and are dimmed, All and Done are not: " + dn.map((b) => t(b)).join(", "));
    const before = JSON.stringify(ids(list(Dn)));
    tabOf(Dn, "pay").click(); tabOf(Dn, "open").click(); await new Promise((r) => setTimeout(r, 60));
    ok(tabOf(Dn, "all").getAttribute("aria-pressed") === "true" && tabOf(Dn, "pay").getAttribute("aria-pressed") === "false" && JSON.stringify(ids(list(Dn))) === before,
      "a tap on a dimmed view is ignored: All stays pressed and the list is as it was");
    /* the empty views a poll leaves behind: the view chosen when it held an order, emptied while it stands (a payment, an order opened again) */
    const Rc = { ...R }, Dc = { ...D };
    const Pn = await open({ orders: [Rc, Dc] });
    await pick(Pn, "pay");
    Object.assign(Rc, { paid: 95, moved: 2.5, status: "done" }); Pn.polls[0]();
    await until(() => list(Pn).querySelector(".oempty"));
    const eP = list(Pn).querySelector(".oempty"), gP = eP ? [...eP.querySelectorAll("button, a")] : [];
    ok(!!eP && /^Nothing to pay\./.test(t(eP.querySelector(".amb-empty"))) && gP.length === 1 && t(gP[0]) === "See all orders"
      && tabOf(Pn, "pay").getAttribute("aria-pressed") === "true" && tabOf(Pn, "pay").getAttribute("aria-disabled") === "true" && t(tabOf(Pn, "pay").querySelector(".amb-segment__count")) === "0",
      "To pay with nothing owing says so, with one way on, its view pressed, dimmed and counting 0: " + t(eP));
    gP[0].click(); await until(() => tabOf(Pn, "all").getAttribute("aria-pressed") === "true");
    list(Pn).querySelector(".olater").click(); await until(() => ids(list(Pn)).length === 2);
    ok(tabOf(Pn, "all").getAttribute("aria-pressed") === "true" && JSON.stringify(ids(list(Pn))) === JSON.stringify(want([Rc, Dc])), "and its one way on is every order (both are done now, under the fold)");
    const Ao = { ...A }, Dd = { ...D };
    const Op = await open({ orders: [Ao, Dd] });
    await pick(Op, "done");
    Object.assign(Dd, { status: "ready", moved: 0 }); Op.polls[0]();
    await until(() => list(Op).querySelector(".oempty"));
    const eD = list(Op).querySelector(".oempty"), gD = eD ? [...eD.querySelectorAll("button, a")] : [];
    ok(!!eD && /^No completed orders yet\./.test(t(eD.querySelector(".amb-empty"))) && gD.length === 1 && t(gD[0]) === "See open orders" && tabOf(Op, "done").getAttribute("aria-disabled") === "true", "Done with nothing done says so: " + t(eD));
    gD[0].click(); await until(() => tabOf(Op, "open") && tabOf(Op, "open").getAttribute("aria-pressed") === "true");
    ok(tabOf(Op, "open").getAttribute("aria-pressed") === "true" && JSON.stringify(ids(list(Op))) === JSON.stringify(want([Ao, Dd])), "and its one way on is the open orders");

    /* ---- 5: from 960px, the shell's two panes: the same list at any width, and nothing opens by itself ---- */
    const W = await open({ orders: ALL, wide: true });
    const po = W.d.getElementById("oPanes");
    ok(po.classList.contains("amb-split") && po.classList.contains("amb-split--panes") && !!W.d.querySelector("#oPanes > .olistcol.amb-stack") && !W.d.querySelector("#pOrder .ocols"),
      "from 960px the place holds the system's split of panes with the list as its first stack, and no columns of its own");
    /* 16 Nov 2026, the move to Ambient (0.7.5): the place is one of the screen's places, straight in the screen, its split its last child, so the panes stand as the screen's own and scroll apart */
    const pl = W.d.getElementById("pOrder");
    ok(pl.classList.contains("amb-place") && pl.parentElement.classList.contains("amb-screen") && pl.lastElementChild === po && [...pl.parentElement.querySelectorAll(":scope > .amb-place")].every((p) => p === pl ? !p.hidden : p.hidden),
      "Orders is one of the screen's places, straight in the screen with its split last, and it alone is shown");
    ok(!!W.d.querySelector("#cHead > .otabs") && !W.d.querySelector("#pOrder .otabs") && !!W.d.querySelector("#pOrder .ocol__pay") && t(W.d.querySelector("#pOrder .ocol__pay")) === "RM 95.00 to pay"
      && JSON.stringify(ids(list(W))) === JSON.stringify(want([A, B, R])),
      "the filters stand there too and say what is to pay across the orders, the list holding the open orders under the folded earlier ones: " + JSON.stringify({ pay: t(W.d.querySelector("#pOrder .ocol__pay")), ids: ids(list(W)) }));
    ok(!W.d.querySelector("#pOrder .oscreen") && !!W.d.querySelector("#oPanes > .orecord #oNew"), "and no order opens by itself: the second pane holds New order until one is tapped");
    /* 22 Nov 2026 (the place head, the reviewer's findings): from 960px an open order stands beside the list, so the views over both panes stay */
    const wr = W.d.querySelector("#cHead > .otabs");
    W.d.querySelector('#oPanes [data-row="' + R.id + '"]').click(); await until(() => W.d.querySelector("#pOrder .oscreen"));
    ok(!!W.d.querySelector('#pOrder .oscreen[data-order="' + R.id + '"]') && !wr.hidden && !W.d.querySelector("#oPanes > .olistcol").hidden && W.d.querySelector("#cHead > .otabs") === wr,
      "from 960px an open order leaves the views standing over both panes, the same row");
  } catch (e) { ok(false, "counter-orders-cards stopped on an error: " + (e && e.stack)); }
  finally { wins.forEach((w) => w.close()); }
}
