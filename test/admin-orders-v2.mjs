/* test/admin-orders-v2.mjs: SALT ADMIN'S ORDERS LIST ON HIS CANVAS (2 Nov 2026; his four answers of 31 Oct 2026, canvas Salt Admin Orders, phone and 1180).
 * Display and markup only: no route, request body, price, booking or stored shape changes. What is proved here, each check red under its own mutation
 * (test/admin-orders-v2.mutations.json):
 *   O1  the parts are ONE Segment of exactly four tabs in order, To do, Open, Done, Ended, each with its act, To do carrying its count
 *   O2  Open lists Agreed, Ready and Out or paid each under its own head, one list a head
 *   O3  an order of several books folds to its first tag and a +N, and its row's aria-label reads out every book
 *   O4  no visible text on the list is a row's id (a book row's Way is a word, Out, never s182), on a phone and in the table
 *   O5  a move is a lit ghost and never a filled pill, still asks once and sends exactly what it sent (the body, the request id)
 *   O6  from 1080px one plain table: its colgroup, its rows class, its seven columns named, its group heads rows of it, the code the link that opens the order,
 *       what is owed in the Waiting cell (ember when late); below 1080px a settings list and no table
 *   O7  the list has no Refresh and no line under it
 *   O8  #orders/approve still opens Approve, and so does the bar's Approve, with no tab of its own in the Segment
 *   O9  the lead over the list is one sentence, money first, and Open's names what is late
 *   O10 a part with nothing in it is one grey line, no button
 *   O11 Approve's status line is never left on Reading while it is hidden
 *   O12 (2 Nov 2026) the Waiting column is 184px so the longest chip fits at 1180, and the code link in a table row is a 44px target
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";
import { JSDOM } from "jsdom";

const NOW = Date.now(), ago = (h) => new Date(NOW - h * 3600000).toISOString();
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const U = "abcd-efgh";
const base = { u: U, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], mode: "collect", qty: 1, total: 100, at: ago(3) };
const EXTRA = [
  { ...base, id: "ord-ag1", status: "acknowledged", mode: "deliver", qty: 3, total: 300, at: ago(26) },
  { ...base, id: "ord-out1", status: "ready", qty: 1, moved: 1, total: 100, at: ago(60) }
];
const D = "2026-10-14";
const TRIP = { trip: "t1791900000001", party: "CX9-ZED", date: D, owed: 271, paid: 0, handedLines: 0, waiting: 0, stage: "confirmed", lines: [
  { rid: "zt1", product: "salt", qty: 1, total: 110, delivery: 10, paid: 0, owed: 120, handed: 0, left: 1, waiting: 0, open: true },
  { rid: "zt2", product: "rice", qty: 2, total: 141, delivery: 0, paid: 0, owed: 141, handed: 0, left: 2, waiting: 0, open: true }] };
const ROW = { rid: "s182", party: "CX2-ZED", product: "oil", date: "2026-10-06", key: "k182", qty: 2, total: 80, delivery: 0, paid: 0, owed: 80, handed: 2, left: 0, waiting: 0, open: true, stage: "paid" };
const owedLate = { party: "CX1-ZED", rm: 100, since: "2026-10-01", due: ago(72), rows: [{ rid: "s1", key: "k1", product: "salt" }] };
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
/* a width of 1100px: the table is drawn, an open order fills the page */
/* the owner page's own stylesheet read as rules, by selector (jsdom applies no layout, so a width is proved as the rule that sets it) */
function pageRules() {
  const html = landingPage("", "ord2-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0], out = [];
  const walk = (rules) => { for (const r of rules) { if (r.selectorText) out.push([r.selectorText, r.style]); if (r.cssRules) walk(r.cssRules); } };
  walk(sheet.cssRules);
  return out;
}
const wideAt = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*(860|1080)px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };

export async function run({ ok, pageWork }) {
  const open = async (extraOpts = {}) => {
    const { review, ...rest } = extraOpts;
    const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(EXTRA), trips: [TRIP], rows: [ROW], ...(review ? review(j) : {}) }),
      inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [owedLate], owedGoods: [] } }), ...rest });
    await p.work.quiet();
    p.enter = async (part) => { byAct(p.d, "nav.orders").click(); await p.work.quiet(); if (part) { byAct(p.d, "part.orders." + part).click(); await p.work.quiet(); } };
    p.visibleRows = () => [...p.d.querySelectorAll("#makerOrderList .ordcard")].filter(shown);
    return p;
  };

  /* below 1080px */
  let p = await open();
  try {
    const d = p.d;
    await p.enter();
    /* O1 */
    /* 16 Nov 2026, the move to Ambient (place G): the parts are Ambient's Segment, a part pressed not selected, each with its count, one with none dimmed (aria-disabled, its count 0) and never the one in use */
    const seg = d.querySelector('.aparts[data-place="orders"]'), tabs = seg ? [...seg.querySelectorAll("[data-part]")] : [];
    ok(!!seg && seg.classList.contains("amb-segment") && d.querySelectorAll('.aparts[data-place="orders"]').length === 1 && tabs.length === 4
      && tabs.map((b) => b.firstChild.textContent.trim()).join() === "To do,Open,Done,Ended" && tabs.map((b) => b.getAttribute("data-act")).join() === "part.orders.todo,part.orders.open,part.orders.done,part.orders.ended"
      && tabs.every((b) => b.classList.contains("amb-segment__opt") && !!b.querySelector(".amb-segment__count")) && t(tabs[0].querySelector(".amb-segment__count")) === "7"
      && tabs[0].getAttribute("aria-pressed") === "true" && !tabs[0].hasAttribute("aria-disabled")
      && tabs[2].getAttribute("aria-disabled") === "true" && t(tabs[2].querySelector(".amb-segment__count")) === "0" && !tabs[1].hasAttribute("aria-disabled"),
    "the parts are one Segment of exactly four in order, To do carrying its count of seven and Done dimmed at 0: " + tabs.map((b) => t(b)).join(" | "));
    /* O2 */
    await p.enter("open");
    const heads = [...d.querySelectorAll('#makerOrderList section[data-in="orders.open"]')].map((s) => t(s.querySelector(":scope > h2.amb-section")));
    const lists = [...d.querySelectorAll('#makerOrderList section[data-in="orders.open"]')].map((s) => s.querySelectorAll(":scope > ul.amb-list").length);
    ok(J(heads) === J(["Agreed", "Ready", "Out or paid"]) && lists.every((n) => n === 1),
      "Open lists Agreed, Ready and Out or paid each under its own head, and one list a head: " + J([heads, lists]));
    /* O3 */
    const trip = d.querySelector('[data-act="order.open"][data-key="trip:' + TRIP.trip + '"]'), tripRow = trip && trip.closest(".ordcard");
    ok(!!trip && trip.querySelectorAll(".amb-thumb").length === 1 && t(trip.querySelector(".omore")) === "+1"
      && /Salt, Rice/.test(trip.getAttribute("aria-label")),
    "an order of two books folds to the first book's thumb and a +1, and the row's aria-label reads out both books: " + t(trip) + " | " + (trip && trip.getAttribute("aria-label")));
    /* O4 */
    const ridSeen = (root) => [...root.querySelectorAll("#makerOrderList *")].filter((x) => shown(x) && [...x.childNodes].some((n) => n.nodeType === 3 && /\bs[0-9]{2,}\b/.test(n.textContent))).map((x) => x.textContent);
    const rowFor = d.querySelector('[data-act="order.open"][data-key="row:s182"]');
    ok(!!rowFor && ridSeen(d).length === 0 && /^Out/.test(t(rowFor.querySelector(".amb-row__sub"))),
      "no visible text is a row's id: a book row says Out, never s182: " + t(rowFor) + " | " + J(ridSeen(d)));
    /* O5 */
    await p.enter("todo");
    const leadTodo = t(d.getElementById("makerReviewStatus"));
    const mv = byAct(d, "order.move", "ord-p4");
    ok(!!mv && t(mv) === "Withdraw" && ["amb-pill", "amb-pill--sm"].every((c) => mv.classList.contains(c)) && mv.classList.contains("amb-pill--quiet")
      /* 17 Nov 2026, the move to Ambient (Fable's review, item 5): a row's move is a small QUIET pill, so the record's foot is the one filled pill on screen */
      && d.querySelectorAll("#makerOrderList [class*='salt-']").length === 0 && mv.getAttribute("data-key") === "ord-p4",
    "a move is Ambient's small pill, with its act and key, and no salt class stands in the list: " + (mv && mv.className));
    mv.click(); await p.work.quiet();
    const ask = d.querySelector('.oask[data-rowof="ord-p4"]'), yes = byAct(d, "order.move-yes", "ord-p4"), no = byAct(d, "order.move-no", "ord-p4");
    ok(!!ask && !!yes && !!no && yes.classList.contains("amb-pill") && no.classList.contains("amb-pill--quiet") && /^Take back your offer of RM [0-9,.]+ to /.test(t(ask.querySelector(".oask__q")))
      && p.posts.filter((x) => /withdraw$/.test(x.route)).length === 0,
    "it asks once under its row, in pills, and sends nothing yet: " + t(ask));
    yes.click(); await p.work.quiet();
    const sent = p.posts.filter((x) => x.route === "/all/maker/orders/ord-p4/withdraw");
    ok(sent.length === 1 && J(Object.keys(sent[0].body)) === J(["rid"]) && /^[0-9a-f]{32}$/.test(sent[0].body.rid),
      "and Yes sends what the move always sent, once, under a request id: " + J(sent.map((x) => x.body)));
    /* O9 */
    await p.enter("open");
    const leadOpen = t(d.getElementById("makerReviewStatus"));
    ok(leadTodo === "RM 930 waits on you, RM 110 more on their yes.",
      "To do's lead is one sentence, money first: " + leadTodo);
    ok(/^RM [0-9,.]+ owed on [0-9]+ open orders?, RM 100 of it late[.]$/.test(leadOpen), "Open's lead is one sentence, money first, and names what is late: " + leadOpen);
    /* O7 */
    ok(!byAct(d, "maker.refresh") && !d.getElementById("makerRefreshSaid") && ![...d.querySelectorAll("#makerOrderList button")].some((b) => /Refresh/.test(b.textContent)),
      "the list has no Refresh and no line under it");
    /* O10 */
    await p.enter("done");
    const none = [...d.querySelectorAll("#makerOrderList .amb-empty")].filter(shown), btns = [...d.querySelectorAll("#makerOrderList button")].filter(shown);
    ok(none.length === 1 && t(none[0]) === "No done orders." && btns.length === 0, "a part with nothing in it is one grey line and no button: " + J(none.map(t)) + " " + btns.length);
    /* a settings list below 1080px, no table */
ok(!d.querySelector("#makerOrderList table") && d.querySelectorAll("#makerOrderList ul.amb-list").length > 0, "below 960px the list is Ambient's rows, never a table");
  } catch (e) { ok(false, "admin-orders-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* from 960px: the same rows, the queue beside the record, never a table */
  p = await open({ before: wideAt });
  try {
    const d = p.d;
    await p.enter("open");
    const split = d.getElementById("oSplit");
    ok(!d.querySelector("#makerOrderList table") && !!split && split.classList.contains("amb-split") && split.classList.contains("amb-split--panes") && split.children.length === 2
      && split.children[0].contains(d.getElementById("makerOrderList")) && split.children[1].contains(d.getElementById("makerReview")) && !!d.getElementById("ordnone"),
    "from 960px the list is the same rows and the open order the second pane of one split, never a table");
    const groups = [...d.querySelectorAll('#makerOrderList section[data-in="orders.open"] > h2.amb-section')].map((h) => t(h));
    ok(J(groups) === J(["Agreed", "Ready", "Out or paid"]) && !d.querySelector("#makerOrderList [class*='salt-']"),
      "its group heads are Agreed, Ready and Out or paid, each over its own list: " + J(groups));
    const out1 = byAct(d, "order.open", "ord-out1"), r1 = out1 && out1.closest(".ordcard");
    ok(!!r1 && out1.tagName === "A" && out1.classList.contains("amb-row__main") && r1.classList.contains("amb-row") && t(out1.querySelector(".ocode")) === "CX1-ZED"
      && /^Out · 1 unit · /.test(t(out1.querySelector(".amb-row__sub"))) && out1.querySelector(".amb-row__sub").classList.contains("amb-neg") && t(r1.querySelector(".amb-row__amount")) === "RM 100"
      && /^CX1-ZED, Salt, Out, 1 unit, owes RM 100, RM 100$/.test(out1.getAttribute("aria-label")),
    "an order is a row: the code the link that opens it, its way and units and what is still owed in the loss colour when late, the total: " + (r1 && t(r1)));
    const rid = d.querySelector('[data-act="order.open"][data-key="row:s182"]');
    ok(!!rid && /^Out/.test(t(rid.querySelector(".amb-row__sub"))) && [...d.querySelectorAll("#makerOrderList .ordcard")].every((c) => !/\bs[0-9]{3}\b/.test(t(c))),
      "no row says a book row's id: its way reads Out");
    const trip = d.querySelector('[data-act="order.open"][data-key="trip:' + TRIP.trip + '"]');
    ok(t(trip.querySelector(".omore")) === "+1" && /Salt, Rice/.test(trip.getAttribute("aria-label")) && /^One order/.test(t(trip.querySelector(".amb-row__sub"))),
      "an order of two books folds to its first book and a +1 here too, its way One order: " + t(trip));
    await p.enter("todo");
    const mvs = [...d.querySelectorAll('#makerOrderList [data-act="order.move"]')];
    ok(mvs.length > 0 && mvs.every((b) => b.classList.contains("amb-pill") && b.classList.contains("amb-pill--sm") && !!b.closest(".amb-row__trail")),
      "and the moves are small pills at the row's trail");
  } catch (e) { ok(false, "admin-orders-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* O8 Approve is reached by its address and by the bar */
  p = await open({ hash: "#orders/approve" });
  try {
    const d = p.d, ap = d.getElementById("oApprove");
    ok(shown(ap) && !d.querySelector('.aparts[data-place="orders"] [data-part="approve"]') && [...d.querySelectorAll('.aparts[data-place="orders"] [aria-selected="true"]')].length === 0 && !shown(d.getElementById("oSplit")),
      "#orders/approve opens Approve, which has no tab in the Segment, with the list shut");
    byAct(d, "nav.needs").click(); await p.work.quiet();
    const bar = d.querySelector('[data-act="bar.approve"]');
    bar.click(); await p.work.quiet();
    ok(shown(d.getElementById("oApprove")) && p.w.location.hash === "#orders/approve", "and the bar's Approve lands on it, writing the same address: " + p.w.location.hash);
  } catch (e) { ok(false, "admin-orders-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* O11 Approve's line is never left on Reading while Approve is hidden */
  p = await open();
  try {
    const d = p.d;
    const release = p.hold("/all/maker/review");
    byAct(d, "nav.orders").click();
    for (let i = 0; i < 20; i++) await Promise.resolve();
    const held = t(d.getElementById("makerDraftStatus"));
    release(); await p.work.quiet();
    ok(!/Reading/.test(held) && !/Reading/.test(t(d.getElementById("makerDraftStatus"))) && t(d.getElementById("makerDraftStatus")) === "" && /to decide/.test(t(d.querySelector("#makerDrafts > .aphead"))),
      "Approve's line is not left on Reading while the read is out and Approve is hidden, and once it lands is empty, the list's head counting the cards (12 Nov 2026): " + J([held, t(d.getElementById("makerDraftStatus"))]));
  } catch (e) { ok(false, "admin-orders-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
