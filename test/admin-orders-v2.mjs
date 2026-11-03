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
    const seg = d.querySelector('.aparts[data-place="orders"]'), tabs = seg ? [...seg.querySelectorAll('[role="tab"]')] : [];
    ok(!!seg && seg.classList.contains("salt-segment") && d.querySelectorAll('.aparts[data-place="orders"]').length === 1 && tabs.length === 4
      && tabs.map((b) => b.firstChild.textContent).join() === "To do,Open,Done,Ended" && tabs.map((b) => b.getAttribute("data-act")).join() === "part.orders.todo,part.orders.open,part.orders.done,part.orders.ended"
      && seg.style.getPropertyValue("--n") === "4" && tabs.every((b) => b.classList.contains("salt-segment__opt")) && t(tabs[0].querySelector(".salt-segment__count")) === "7" && !tabs[1].querySelector(".salt-segment__count"),
    "the parts are one Segment of exactly four tabs in order, To do carrying its count of seven: " + tabs.map((b) => t(b)).join(" | "));
    /* O2 */
    await p.enter("open");
    const heads = [...d.querySelectorAll('#makerOrderList section[data-in="orders.open"]')].map((s) => t(s.querySelector(":scope > h2.salt-settings__head")));
    const lists = [...d.querySelectorAll('#makerOrderList section[data-in="orders.open"]')].map((s) => s.querySelectorAll(":scope > .salt-settings").length);
    ok(J(heads) === J(["Agreed", "Ready", "Out or paid"]) && lists.every((n) => n === 1),
      "Open lists Agreed, Ready and Out or paid each under its own head, and one list a head: " + J([heads, lists]));
    /* O3 */
    const trip = d.querySelector('[data-act="order.open"][data-key="trip:' + TRIP.trip + '"]'), tripRow = trip && trip.closest(".ordcard");
    const tagsIn = trip ? [...trip.querySelectorAll(".salt-producttag:not(.salt-producttag--more)")] : [];
    ok(!!trip && tagsIn.length === 1 && t(tagsIn[0]) === "Salt" && t(trip.querySelector(".salt-producttag--more")) === "+1"
      && /Salt, Rice/.test(tripRow.getAttribute("aria-label")),
    "an order of two books folds to the first tag and a +1, and the row's aria-label reads out both books: " + t(trip) + " | " + (tripRow && tripRow.getAttribute("aria-label")));
    /* O4 */
    const ridSeen = (root) => [...root.querySelectorAll("#makerOrderList *")].filter((x) => shown(x) && [...x.childNodes].some((n) => n.nodeType === 3 && /\bs[0-9]{2,}\b/.test(n.textContent))).map((x) => x.textContent);
    const rowFor = d.querySelector('[data-act="order.open"][data-key="row:s182"]');
    ok(!!rowFor && ridSeen(d).length === 0 && /^Out/.test(t(rowFor.querySelector(".salt-settings__sub"))),
      "no visible text is a row's id: a book row says Out, never s182: " + t(rowFor) + " | " + J(ridSeen(d)));
    /* O5 */
    await p.enter("todo");
    const leadTodo = t(d.getElementById("makerReviewStatus"));
    const mv = byAct(d, "order.move", "ord-p4");
    ok(!!mv && t(mv) === "Withdraw" && ["salt-ghost", "salt-ghost--lit", "salt-ghost--tight"].every((c) => mv.classList.contains(c)) && !mv.classList.contains("salt-pill")
      && d.querySelectorAll("#makerOrderList .salt-pill").length === 0 && mv.getAttribute("data-key") === "ord-p4",
    "a move is a lit ghost and never a filled pill, with its act and key: " + (mv && mv.className));
    mv.click(); await p.work.quiet();
    const ask = d.querySelector('[data-rowof="ord-p4"] .oask'), yes = byAct(d, "order.move-yes", "ord-p4"), no = byAct(d, "order.move-no", "ord-p4");
    ok(!!ask && !!yes && !!no && yes.classList.contains("salt-ghost--lit") && !yes.classList.contains("salt-pill") && /^Take back your offer of RM [0-9,.]+ to /.test(t(ask.querySelector(".oask__q")))
      && p.posts.filter((x) => /withdraw$/.test(x.route)).length === 0,
    "it asks once under its row, in ghosts, and sends nothing yet: " + t(ask));
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
    const none = [...d.querySelectorAll("#makerOrderList .salt-settings__foot")].filter(shown), btns = [...d.querySelectorAll("#makerOrderList button")].filter(shown);
    ok(none.length === 1 && t(none[0]) === "No done orders." && btns.length === 0, "a part with nothing in it is one grey line and no button: " + J(none.map(t)) + " " + btns.length);
    /* a settings list below 1080px, no table */
    ok(!d.querySelector("#makerOrderList table") && d.querySelectorAll("#makerOrderList .salt-settings").length > 0, "below 1080px the list is settings lists, never a table");
  } catch (e) { ok(false, "admin-orders-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* from 1080px: one plain table */
  p = await open({ before: wideAt });
  try {
    const d = p.d;
    await p.enter("open");
    const wrap = d.querySelector('#makerOrderList [data-in="orders.open"].salt-glass-card'), region = wrap && wrap.querySelector(":scope > .salt-table-wrap"), tb = region && region.querySelector("table");
    const cols = tb ? [...tb.querySelectorAll(":scope > colgroup > col")].map((c) => c.style.getPropertyValue("width")) : [];
    const heads = tb ? [...tb.querySelectorAll(":scope > thead th")] : [];
    ok(!!wrap && wrap.classList.contains("salt-glass-card--radius-lg") && wrap.classList.contains("salt-glass-card--pad-none") && region.getAttribute("role") === "region"
      && tb.classList.contains("salt-table") && tb.classList.contains("salt-table--plain") && tb.classList.contains("salt-table--rows") && J(cols) === J(["136px", "140px", "", "104px", "184px", "112px", "140px"]),
    "from 1080px the list is one plain table in a glass card, its colgroup 136, 140, auto, 104, 184, 112 and 140px (2 Nov 2026: Waiting was 136px and cut Offered, their yes and Says sent RM 530): " + J(cols));
    /* O12: the code link fills its cell's height, so the table's link is a 44px target (measured 59x14 before) */
    const link = (pageRules().find((x) => x[0] === ".adm .salt-table--rows tbody th a") || [, null])[1];
    ok(!!link && link.getPropertyValue("display") === "flex" && link.getPropertyValue("align-items") === "center" && link.getPropertyValue("min-height") === "var(--salt-tap)",
      "the code link in a table row fills its cell's height with a 44px minimum: " + (link && link.cssText));
    ok(heads.map((h) => t(h)).join() === "Code,Book,Way,Units,Waiting,Total,Move" && heads.every((h) => h.getAttribute("scope") === "col") && !!heads[6].querySelector(".sr")
      && ["Code", "Book", "Way", "Waiting"].every((w, i) => heads[[0, 1, 2, 4][i]].classList.contains("salt-table__left")),
    "its columns are Code, Book, Way, Units, Waiting, Total and a move with a screen-reader head, the word columns left: " + heads.map((h) => t(h)).join());
    const groups = tb ? [...tb.querySelectorAll("tr.salt-table__group > th")].map((h) => t(h)) : [];
    ok(J(groups) === J(["Agreed", "Ready", "Out or paid"]) && !d.querySelector("#makerOrderList .salt-settings__row") && !!tb.querySelector('tr.salt-table__group > th[colspan="7"] > .salt-settings__head'),
      "its group heads are rows of it, Agreed, Ready and Out or paid, and no settings row stands beside the table: " + J(groups));
    const out1 = byAct(d, "order.open", "ord-out1"), r1 = out1 && out1.closest("tr");
    const cells = r1 ? [...r1.children] : [];
    ok(!!r1 && out1.tagName === "A" && out1.closest("th") === cells[0] && cells[0].getAttribute("scope") === "row" && t(cells[0]) === "CX1-ZED"
      && t(cells[1].querySelector(".salt-table__tags")) === "Salt" && t(cells[2]) === "Out" && t(cells[3]) === "1 unit" && t(cells[4]) === "owes RM 100" && !!cells[4].querySelector(".salt-status--ember")
      && t(cells[5]) === "RM 100" && /^CX1-ZED, Salt, Out, 1 unit, owes RM 100, RM 100$/.test(r1.getAttribute("aria-label")),
    "an order is a row: the code the link that opens it, the book, the way, the units, what is still owed in ember when late, the total: " + cells.map(t).join(" | "));
    const rid = d.querySelector('[data-act="order.open"][data-key="row:s182"]');
    ok(!!rid && t(rid.closest("tr").children[2]) === "Out" && [...d.querySelectorAll("#makerOrderList td, #makerOrderList th")].every((c) => !/^s[0-9]+$/.test(t(c))),
      "no cell is a row's id: the book row's Way reads Out");
    const trip = d.querySelector('[data-act="order.open"][data-key="trip:' + TRIP.trip + '"]').closest("tr");
    ok(t(trip.children[1].querySelector(".salt-table__tags")) === "Salt+1" && /Salt, Rice/.test(trip.getAttribute("aria-label")) && t(trip.children[2]) === "One order",
      "an order of two books folds to Salt and +1 in the table too, its Way One order: " + t(trip.children[1]));
    await p.enter("todo");
    const mvs = [...d.querySelectorAll('#makerOrderList table [data-act="order.move"]')];
    ok(mvs.length > 0 && mvs.every((b) => b.classList.contains("salt-ghost--lit") && b.classList.contains("salt-ghost--tight") && !b.classList.contains("salt-pill") && !!b.closest(".salt-table__act")),
      "and the table's moves are lit ghosts in the last column");
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
    ok(!/Reading/.test(held) && !/Reading/.test(t(d.getElementById("makerDraftStatus"))) && /waiting for your approval/.test(t(d.getElementById("makerDraftStatus"))),
      "Approve's line is not left on Reading while the read is out and Approve is hidden, and says its count once it lands: " + J([held, t(d.getElementById("makerDraftStatus"))]));
  } catch (e) { ok(false, "admin-orders-v2 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
