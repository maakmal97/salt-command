/* test/admin-orders.mjs: ORDERS ARE A LIST AND A DETAIL, AND RECORD IS A MENU (11 Oct 2026, Phase 1c; docs/STATEMENTS.md "His places").
 *
 * Every part of Orders is a list of rows (the system's Inbox row), a row opens that order's card, today's card with every control and
 * request it had, beside the list from 860px and in its place below it; a customer's question on an order is a Now card on Needs you;
 * the 30-second read is silent while an account is viewed as them; one orb opens Record's menu of entries, and Record's forms are a menu of
 * named rows with one form shown at a time. What is proved here, each check red under its own mutation (test/admin-orders.mutations.json):
 *   1  the rows: which orders in which part, each row the mark, who by code, the units, the figure and the age, and nothing read for them
 *   2  a row opens its card: one card, for that order alone, with the controls and the request it had, and a way back
 *   3  back, leaving the part and leaving the place close the card; an order that leaves the part closes it too
 *   4  the split: the list beside the card from 860px, the card in the list's place below it
 *   5  a customer's question on an order is a Now card, counted, opening that order's card, and a closed one has its reply alone
 *   6  the 30-second read is silent while an account is viewed as them
 * Drawn by the maker harness (test/maker-act.mjs), whose hooks change what each read answers. */
import { JSDOM } from "jsdom";
import { richOwnerPage, byAct, cardOf } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";

const U1 = "abcd-efgh";
const NOW = Date.now(), ago = (h) => new Date(NOW - h * 3600000).toISOString();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROUTES = { review: "/all/maker/review", claims: "/all/maker/claims", threads: "/all/maker/threads", hours: "/all/maker/hours", bulletin: "/all/maker/bulletin",
  sheet: "/all/sheet", links: "/all/refs" };
const order = (id, status, patch = {}) => ({ id, u: U1, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], mode: "collect", qty: 1, total: 100, status, ...patch });

/* the busy day, with an age on each order, a practice order, a question on an agreed-and-ready order and one on a closed order */
function day(state) {
  return (j) => {
    const age = { "ord-p1": 5, "ord-p2": 1, "ord-p3": 26, "ord-p4": 3, "ord-a1": 8, "ord-a2": 30, "ord-r1": 12 };
    for (const o of j.orders) if (age[o.id]) o.at = ago(age[o.id]);
    j.orders.find((o) => o.id === "ord-p2").delivery = 10;
    j.orders.push(order("ex-1", "placed", { u: "0000-0000", test: true, at: ago(40) }));
    if (state.asked) {
      const r1 = j.orders.find((o) => o.id === "ord-r1");
      r1.msgs = [{ by: "customer", at: ago(2), text: "Can it be before three?" }];
      j.orders.push(order("ord-c9", "declined", { at: ago(60), msgs: [{ by: "customer", at: ago(1), text: "Why was it declined?" }] }));
      j.orders.push(order("ex-2", "ready", { u: "0000-0000", test: true, at: ago(50), msgs: [{ by: "customer", at: ago(3), text: "Practice question" }] }));
    }
    if (state.answered) {
      const r1 = j.orders.find((o) => o.id === "ord-r1");
      r1.msgs = [{ by: "customer", at: ago(2), text: "Can it be before three?" }, { by: "desk", at: ago(1), text: "Yes" }];
    }
    if (state.quiet) {
      const r1 = j.orders.find((o) => o.id === "ord-r1");
      r1.msgs = [{ by: "customer", at: ago(2), text: "Thanks" }]; r1.quiet = ago(2);
    }
    if (state.moved) { const p1 = j.orders.find((o) => o.id === "ord-p1"); p1.status = "acknowledged"; }
    return j;
  };
}
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  const state = () => ({ asked: false, answered: false, quiet: false, moved: false });
  const open = async (st = state(), extra = {}) => {
    const p = await richOwnerPage({ pageWork, review: (j) => day(st)(j), ...extra });
    await p.work.quiet();
    const d = p.d;
    p.rowsShown = () => [...d.querySelectorAll("#makerOrderList .ordrow")].filter(shown).map((r) => r.getAttribute("data-order"));
    p.enter = async (part) => { byAct(d, "nav.orders").click(); await p.work.quiet(); if (part) { byAct(d, "part.orders." + part).click(); await p.work.quiet(); } };
    p.cardsIn = () => [...d.querySelectorAll("#makerReview article[data-maker-card]")].map((a) => a.getAttribute("data-maker-card"));
    p.tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.acts = (id) => [...d.querySelectorAll('#makerReview [data-maker-card="' + id + '"] [data-act]')].map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a));
    p.live = () => p.intervals.filter((i) => i.ms === 30000 && !i.off);
    p.tick = async () => { const t = p.live()[0]; if (t) t.f(); await p.work.quiet(); return !!t; };
    p.counts = () => Object.fromEntries([...d.querySelectorAll(".salt-rail [data-count]")].map((e) => [e.getAttribute("data-count"), e.textContent]));
    p.needs = () => [...d.querySelectorAll("#nlist [data-need]")].map((c) => c.getAttribute("data-need"));
    return p;
  };

  /* 1. THE ROWS */
  let st = state();
  let p = await open(st);
  try {
    const d = p.d;
    await p.enter();
    const stage = {};
    for (const part of ["waiting", "agreed", "ready", "closed"]) { await byAct(d, "part.orders." + part).click(); await p.work.quiet(); stage[part] = p.rowsShown().join(); }
    ok(stage.waiting === "ord-p1,ord-p2,ord-p3,ord-p4,ord-a1,ord-a2,ord-x1,ex-1" && stage.agreed === "ord-a1,ord-a2" && stage.ready === "ord-r1,ord-r2,ord-r3"
      && stage.closed === "ord-x1",
    "each part of Orders lists a row for the orders that stand in it, a stage rejected under Approve in Closed as well: " + JSON.stringify(stage));
    await byAct(d, "part.orders.waiting").click(); await p.work.quiet();
    const row = byAct(d, "order.open", "ord-p3"), mark = row && row.querySelector(".mtile"), main = row && row.querySelector(".salt-inbox-row__main");
    ok(row && row.tagName === "BUTTON" && row.classList.contains("salt-inbox-row") && !!mark && !!mark.querySelector("svg.psym") && /^CX1-ZED/.test(main.querySelector(".salt-inbox-row__title").textContent)
      && /1 unit/.test(main.querySelector(".salt-inbox-row__what").textContent) && row.querySelector(".salt-inbox-row__action").textContent === "RM 100.00"
      && (row.querySelector(".salt-inbox-row__age") || {}).textContent === "26 h",
    "a row is the system's Inbox row: the mark, who by code, the stage, the units, the figure and the age: " + (row && row.textContent));
    const p2 = byAct(d, "order.open", "ord-p2");
    ok(p2.querySelector(".salt-inbox-row__action").textContent === "RM 110.00" && /deliver/.test(p2.querySelector(".salt-inbox-row__what").textContent) && (p2.querySelector(".salt-inbox-row__age") || {}).textContent === "1 h",
      "and the figure is the goods and the delivery, the units say how it goes: " + p2.textContent);
    const chips = (id) => [...byAct(d, "order.open", id).querySelectorAll(".salt-status")].map((c) => c.textContent).join();
    ok(chips("ord-p3") === "Placed" && chips("ord-a1") === "Agreed,Says sent" && chips("ord-a2") === "Agreed,Offer again" && chips("ex-1") === "Placed,Practice",
      "and says what stands on it: a stage, a payment they say they sent, a stage he rejected, a practice order: " + JSON.stringify(["ord-p3", "ord-a1", "ord-a2", "ex-1"].map(chips)));
    ok(p.posts.length === 0 && !p.reads.some((r) => /preview/.test(r)),
      "listing the orders sends nothing and previews nothing: a row has no preview, which costs a read: " + JSON.stringify(p.posts));
    ok(["makerReview", "makerClaims", "makerPools", "makerOrderList"].every((id) => !!d.getElementById(id)),
      "the containers the maker tests and the map find are still there: #makerReview, #makerClaims, #makerPools");
  } finally { p.w.close(); }

  /* 2. A ROW OPENS ITS CARD */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    ok(p.cardsIn().length === 0, "no card is drawn until a row is tapped: " + JSON.stringify(p.cardsIn()));
    await p.tapRow("ord-p1");
    ok(same(p.cardsIn(), ["ord-p1"]) && byAct(d, "order.open", "ord-p1").getAttribute("aria-current") === "true" && d.getElementById("oSplit").classList.contains("open")
      && !byAct(d, "order.open", "ord-p2").hasAttribute("aria-current"),
    "a row opens that order's card alone, marks itself current and stands the list and the card side by side: " + JSON.stringify(p.cardsIn()));
    const want = ["order.total", "order.preview", "order.reason", "order.reason-stock", "order.reason-price", "order.reply-text", "order.quick-reply", "order.quick-reply", "order.quick-keep",
      "order.reply", "order.no-reply", "order.decline"];
    const got = p.acts("ord-p1");
    ok(same(got, want), "the card has the controls it had: " + JSON.stringify(got));
    p.reads.length = 0;
    byAct(d, "order.preview", "ord-p1").click(); await p.work.quiet();
    const pv = p.posts.filter((x) => /preview$/.test(x.route));
    ok(pv.length === 1 && pv[0].route === "/all/maker/orders/ord-p1/preview" && same(pv[0].body, { total: 200, delivery: 0 }) && !!d.querySelector("#makerReview [data-accept]"),
      "and sends the request it sent, the same route and body, and then offers Accept: " + JSON.stringify(pv));
    await p.tapRow("ord-p3");
    ok(same(p.cardsIn(), ["ord-p3"]) && byAct(d, "order.open", "ord-p3").getAttribute("aria-current") === "true" && !byAct(d, "order.open", "ord-p1").hasAttribute("aria-current"),
      "another row replaces the card: only the order opened has one: " + JSON.stringify(p.cardsIn()));
    await byAct(d, "part.orders.agreed").click(); await p.work.quiet();
    await p.tapRow("ord-a1");
    const a1 = p.acts("ord-a1");
    ok(a1.filter((x) => x === "order.claim-received").length === 2 && a1.includes("order.claim-not-found") && a1.includes("order.received") && a1.includes("order.amend")
      && a1.includes("order.cancel") && !a1.includes("order.preview") && !a1.includes("order.handed"),
    "an agreed order's card keeps its claims, Received, Amend and Cancel: " + JSON.stringify(a1));
    await byAct(d, "part.orders.ready").click(); await p.work.quiet();
    await p.tapRow("ord-r1");
    const r1 = p.acts("ord-r1");
    ok(r1.includes("order.handed") && r1.includes("order.close") && r1.includes("order.cash") && r1.includes("order.cancel") && !r1.includes("order.preview"),
      "a ready order's card keeps the handover, the close and the cash: " + JSON.stringify(r1));
  } finally { p.w.close(); }

  /* 3. BACK, AND WHAT CLOSES A CARD */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    await p.tapRow("ord-p2");
    const back = byAct(d, "order.back");
    ok(!!back && back.getAttribute("data-back") === "orders" && back.classList.contains("aback") && /Orders/.test(back.textContent) && d.querySelector("#makerReview").contains(back),
      "a card has a way back at its head, named by its act: " + (back && back.outerHTML));
    back.click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !d.getElementById("oSplit").classList.contains("open") && !byAct(d, "order.open", "ord-p2").hasAttribute("aria-current")
      && d.activeElement === byAct(d, "order.open", "ord-p2") && p.rowsShown().length === 8,
    "Back closes the card, unmarks the row and puts him on the row he came from, the list whole: " + JSON.stringify([p.cardsIn(), d.activeElement && d.activeElement.getAttribute("data-key")]));
    await p.tapRow("ord-p2");
    await byAct(d, "part.orders.agreed").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !d.getElementById("oSplit").classList.contains("open"), "leaving the part closes the card: " + JSON.stringify(p.cardsIn()));
    await byAct(d, "part.orders.waiting").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0, "and it is not there when he comes back");
    await p.tapRow("ord-p2");
    byAct(d, "nav.customers").click(); await p.work.quiet();
    byAct(d, "nav.orders").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !d.getElementById("oSplit").classList.contains("open"), "leaving the place closes it too: " + JSON.stringify(p.cardsIn()));
    /* the same part tapped again leaves a card he is typing in alone */
    await p.tapRow("ord-p1");
    const field = d.querySelector('#makerReview [data-act="order.total"]');
    field.value = "250"; field.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    byAct(d, "part.orders.waiting").click(); await p.work.quiet();
    ok(d.querySelector('#makerReview [data-act="order.total"]') === field && field.value === "250", "tapping the part he is in again does not redraw the card he is typing in");
  } finally { p.w.close(); }

  /* an order that leaves the part closes its card, and a read that finds the same keeps it */
  st = state();
  p = await open(st);
  try {
    const d = p.d;
    await p.enter();
    await p.tapRow("ord-p1");
    const card = cardOf(d, "ord-p1");
    await p.tick();
    ok(cardOf(d, "ord-p1") === card, "a read that finds the same leaves the card as it was");
    st.moved = true;
    byAct(d, "maker.refresh").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !p.rowsShown().includes("ord-p1") && !d.getElementById("oSplit").classList.contains("open"),
      "an order that has left the part (agreed since) closes its card and its row goes from the list: " + JSON.stringify([p.cardsIn(), p.rowsShown()]));
  } finally { p.w.close(); }

  /* 4. THE SPLIT, from 860px */
  {
    const html = landingPage("", "orders-nonce", { master: "fixture-master", accounts: [] });
    const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
    const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
    const media = [...sheet.cssRules].filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].map((x) => x.selectorText + "{" + x.style.cssText + "}") }));
    const at = (q, sel) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => r.startsWith(sel + "{"));
    const split = at("(min-width:860px)", ".adm .ordgrid")[0] || "";
    const phone = at("(max-width:859.98px)", ".adm #oSplit.open .ordlist,.adm #oSplit:not(.open) #makerReview,.adm #oSplit.open #makerReviewStatus")[0] || "";
    const phoneAny = media.filter((m) => m.q === "(max-width:859.98px)").flatMap((m) => m.rules).join(" ");
    ok(/display: grid/.test(split) && /grid-template-columns: minmax\(280px,360px\) minmax\(0,1fr\)/.test(split),
      "from 860px the list and the card stand side by side, the list 280 to 360px: " + split);
    ok(/\.adm #oSplit\.open \.ordlist/.test(phoneAny) && /display: none/.test(phoneAny) && /#makerReview/.test(phoneAny),
      "below 860px an open card takes the list's place, and with none open the card's place is not shown: " + phoneAny.slice(0, 200));
    const d = new JSDOM(html).window.document;
    const grid = d.querySelector("#oSplit .ordgrid");
    ok(!!grid && [...grid.children].map((c) => c.id).join() === "makerOrderList,makerReview" && !!d.querySelector("#oOrders #oSplit"),
      "the list comes first in the markup and the card second, in the section that Orders' four stages show: " + (grid && [...grid.children].map((c) => c.id).join()));
  }
}
