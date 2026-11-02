/* test/admin-orders.mjs: ORDERS ARE A LIST AND A DETAIL, AND RECORD IS A MENU (11 Oct 2026, Phase 1c; docs/STATEMENTS.md "His places").
 *
 * Every part of Orders is a list of rows (the system's Inbox row), a row opens that order's card, today's card with every control and
 * request it had, beside the list from 860px and in its place below it; a customer's question on an order is a To do card on Needs you;
 * the 5-second read is silent while an account is viewed as them; one orb opens Record's menu of entries, and Record's forms are a menu of
 * named rows with one form shown at a time. What is proved here, each check red under its own mutation (test/admin-orders.mutations.json):
 *   1  the rows: which orders in which part, each row the mark, who by code, the units, the figure and the age, and nothing read for them
 *   2  a row opens its card: one card, for that order alone, with the controls and the request it had, and a way back
 *   3  back, leaving the part and leaving the place close the card; an order that leaves the part closes it too
 *   4  the split: the list beside the card from 860px, the card in the list's place below it
 *   5  a customer's question on an order is a To do card (the Message kind, who by code, the age; their words in the title's full sentence), counted, opening that
 *      order's card, and a closed one has its reply alone
 *   6  the 5-second read is silent while an account is viewed as them
 * Drawn by the maker harness (test/maker-act.mjs), whose hooks change what each read answers. */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { richOwnerPage, byAct, cardOf } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";

const U1 = "abcd-efgh";
const NOW = Date.now(), ago = (h) => new Date(NOW - h * 3600000).toISOString();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROUTES = { review: "/all/maker/review", claims: "/all/maker/claims", threads: "/all/maker/threads", hours: "/all/maker/hours", bulletin: "/all/maker/bulletin",
  sheet: "/all/sheet", links: "/all/refs", inputs: "/all/maker/inputs" };
/* Record's forms by name, the part each is in, in the order the page draws them */
const MENU = {
  /* 27 Oct 2026: a menu row's name, three words at most; the form keeps its own heading */
  entry: ["Sale or purchase", "Repayment", "Stock count", "Gift", "Loan", "Rewards", "Offsets"],   /* 27 Oct 2026, his word: Correct a row and Reopen are no rows of the menu; the sale form reaches them */
  customers: ["New customer", "Make an associate", "Name or place", "Map point"],
  pricing: ["Printed sizes", "Desk reminders"]   /* 26 Oct 2026: Their % and Partner moved to the account card; his Ask G orders the rest (25 Oct 2026) */
};
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
    if (state.many) for (let i = 1; i <= 55; i++) j.orders.push(order("ord-z" + String(i).padStart(2, "0"), "declined", { at: ago(100 + i) }));
    return j;
  };
}
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
/* the owner page's own stylesheet, read as rules (jsdom applies no media query, so a rule is looked up by its query and selector) */
function ownerCss() {
  const html = landingPage("", "orders-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const media = [...sheet.cssRules].filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].map((x) => x.selectorText + "{" + x.style.cssText + "}") }));
  const at = (q, sel) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => r.startsWith(sel + "{"));
  const top = (sel) => [...sheet.cssRules].filter((r) => r.selectorText === sel).map((r) => r.selectorText + "{" + r.style.cssText + "}");
  return { html, media, at, top };
}

export async function run({ ok, pageWork }) {
  const state = () => ({ asked: false, answered: false, quiet: false, moved: false, many: false });
  const open = async (st = state(), extra = {}) => {
    const p = await richOwnerPage({ pageWork, review: (j) => day(st)(j), ...extra });
    await p.work.quiet();
    const d = p.d;
    p.rowsShown = () => [...d.querySelectorAll("#makerOrderList .ordrow")].filter(shown).map((r) => r.getAttribute("data-order"));
    p.enter = async (part) => { byAct(d, "nav.orders").click(); await p.work.quiet(); if (part) { byAct(d, "part.orders." + part).click(); await p.work.quiet(); } };
    p.cardsIn = () => [...d.querySelectorAll("#makerReview article[data-maker-card]")].map((a) => a.getAttribute("data-maker-card"));
    p.tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.acts = (id) => [...d.querySelectorAll('#makerReview [data-maker-card="' + id + '"] [data-act]')].map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a));
    p.live = () => p.intervals.filter((i) => i.ms === 5000 && !i.off);
    p.tick = async () => { const t = p.live()[0]; if (t) t.f(); await p.work.quiet(); return !!t; };
    p.counts = () => Object.fromEntries([...d.querySelectorAll(".salt-rail [data-count]")].map((e) => [e.getAttribute("data-count"), e.textContent]));
    p.needs = () => [...d.querySelectorAll("#nlist [data-need]")].map((c) => c.getAttribute("data-need"));
    p.menu = () => [...d.querySelectorAll('#makerMenu [data-act="record.form"]')].filter(shown).map((r) => r.querySelector(".salt-settings__label").textContent);   /* 27 Oct 2026 (Record in the language of Shop's This device): a menu row is a settings row, its name the label, three words at most */
    p.formsOpen = () => [...d.querySelectorAll("#makerInputs section.maker-input[data-form]")].filter(shown).map((s) => s.getAttribute("data-form"));
    p.retained = () => [...d.querySelectorAll("#makerInputs section[data-formmenu]")].filter(shown).map((s) => s.querySelector("h3").textContent);
    p.tap = async (act, key) => { const c = byAct(d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.where = () => {
      const place = (d.querySelector('.salt-appbar .place[aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-m");
      /* 2 Nov 2026 (Orders on the canvas): Payments, Group, Ledger and Approve have no tab in the Segment, so their part is the address's */
      const part = (d.querySelector('.aparts[data-place="' + place + '"] [aria-selected="true"]') || { getAttribute: () => (p.w.location.hash.split("/")[1] || "") }).getAttribute("data-part");
      return place + (part ? "/" + part : "");
    };
    return p;
  };

  /* 1. THE ROWS */
  let st = state();
  let p = await open(st);
  try {
    const d = p.d;
    await p.enter();
    const stage = {};
    for (const part of ["todo", "open", "done", "ended"]) { await byAct(d, "part.orders." + part).click(); await p.work.quiet(); stage[part] = p.rowsShown().join(); }
    /* 2 Nov 2026 (Orders on the canvas): To do holds every order that waits on him (a placed one, a payment they say they sent, a stage he rejected, a question, a request to
       send again), so a declined order with such a request stands there; Open holds the live orders that wait on nothing, Done and Ended the closed ones */
    ok(stage.todo === "ord-p1,ord-p2,ord-p3,ord-p4,ord-a1,ord-a2,ord-x1,ex-1" && stage.open === "ord-r1,ord-r2,ord-r3" && stage.done === "" && stage.ended === "",
    "each part of Orders lists a row for the orders that stand in it, what waits on him in To do: " + JSON.stringify(stage));
    const all = Object.values(stage).join().split(",").filter(Boolean);
    ok(all.length === 11 && new Set(all).size === all.length, "and every order is in exactly one part, none in two: " + all.join());
    /* 2 Nov 2026 (his Orders canvas, his answers of 31 Oct 2026): THE PARTS ARE ONE SEGMENT OF FOUR, To do, Open, Done and Ended, To do carrying its count; Payments, Group and
       Ledger are action rows under More; Approve has no control here, the bar's Approve its road */
    const strips = [...d.querySelectorAll('.aparts[data-place="orders"]')], seg = strips[0], tabs = seg ? [...seg.querySelectorAll("[data-part]")] : [];
    ok(strips.length === 1 && seg.classList.contains("salt-segment") && seg.getAttribute("role") === "tablist" && seg.style.getPropertyValue("--n") === "4"
      && tabs.map((b) => b.getAttribute("data-part") + ":" + b.firstChild.textContent).join() === "todo:To do,open:Open,done:Done,ended:Ended"
      && tabs.every((b) => b.classList.contains("salt-segment__opt") && b.getAttribute("role") === "tab" && !b.hidden),
    "Orders draws one Segment of four, To do, Open, Done and Ended, each a tab with its act: " + JSON.stringify(tabs.map((b) => b.getAttribute("data-part"))));
    const more = [...d.querySelectorAll(".amore__list > button")];
    ok(more.map((b) => b.getAttribute("data-part") + ":" + b.querySelector(".salt-settings__label").textContent).join() === "payments:Payments they sent,group:Group orders,ledger:Ledger check"
      && more.every((b) => b.classList.contains("salt-settings__row--action") && /^part[.]orders[.]/.test(b.getAttribute("data-act")) && !!b.querySelector(".salt-settings__mark")),
    "and Payments they sent, Group orders and Ledger check are action rows in a More group at the foot: " + more.map((b) => b.getAttribute("data-part")).join());
    const reach = [];
    for (const part of ["approve", "payments", "group", "ledger", "ended", "open", "todo"]) { await p.tap("part.orders." + part); const w = p.where(); if (w !== "orders/" + part) reach.push(part + ">" + w); }
    ok(reach.length === 0, "and every part is still reached at its own act and address, Approve by the bar: " + JSON.stringify(reach));
    await byAct(d, "part.orders.todo").click(); await p.work.quiet();
    /* 2 Nov 2026 (Orders on the canvas): AN ORDER IS A ROW OF A SETTINGS LIST. The row's link (its act, its key) holds the book's typed tag and the code over what it is and how long,
       copper while it waits on him; the figure beside it, large; the stage's move a lit ghost */
    const cardOf = (id) => { const r = byAct(d, "order.open", id); return r && r.closest(".ordcard"); };
    const part = (id, cls) => { const x = cardOf(id) && cardOf(id).querySelector("." + cls); return x ? x.textContent : null; };
    const pillOf = (id) => { const c = cardOf(id), b = c && c.querySelector('[data-act="order.move"]'); return b ? b.textContent : ""; };
    const subOf = (id) => part(id, "salt-settings__sub");
    const sizeRow = byAct(d, "order.open", "ord-p3"), sizeWords = (sizeRow.textContent.match(/units?/g) || []).length;
    ok(sizeWords === 1 && /collect 1 unit/.test(subOf("ord-p3")),
      "a row says the size once, in its units, under the book and the code: " + sizeRow.textContent);
    const row = byAct(d, "order.open", "ord-p3"), c3 = cardOf("ord-p3");
    ok(row && row.tagName === "A" && row.classList.contains("ordrow") && row.classList.contains("salt-settings__text") && !!c3 && c3.classList.contains("salt-settings__row")
      && !!row.querySelector(".salt-producttag--salt") && /^Salt/.test(row.querySelector(".salt-settings__label").textContent) && !row.querySelector("svg.psym, .mtile")
      && /^CX1-ZED/.test(part("ord-p3", "ocode")) && part("ord-p3", "salt-settings__value--lg") === "RM 100" && subOf("ord-p3") === "Placed · collect 1 unit · 26 h"
      && row.querySelector(".salt-settings__sub").classList.contains("salt-settings__sub--why") && pillOf("ord-p3") === "Agree",
    "a row is the settings list's: the book's typed tag, who by code, what it is and how long in copper while it waits on him, the figure, Agree its move: " + (row && row.textContent) + " " + pillOf("ord-p3"));
    ok(part("ord-p2", "salt-settings__value--lg") === "RM 110" && /^Placed · deliver 1 unit/.test(subOf("ord-p2")) && / 1 h$/.test(subOf("ord-p2")),
      "and the figure is the goods and the delivery, the way says how it goes: " + byAct(d, "order.open", "ord-p2").textContent);
    ok(/^Practice/.test(subOf("ex-1")) && pillOf("ex-1") === "" && !p.rowsShown().some((id) => /Waiting on you/.test(byAct(d, "order.open", id).textContent)),
      "a practice order says practice and carries no move: " + JSON.stringify(["ord-p3", "ex-1"].map((id) => [subOf(id), pillOf(id)])));
    /* every row is the one shape: the link, the figure, then the move when it has one */
    const shape = (id) => [...cardOf(id).children].map((x) => x.tagName + "." + (x.className.split(" ").filter((k) => /^(ordrow|salt-settings__value|salt-ghost)$/.test(k)).join("") || "-")).join();
    const shapes = p.rowsShown().map(shape);
    ok(shapes.length === 8 && shapes.every((x) => /^A[.]ordrow,SPAN[.]salt-settings__value(,BUTTON[.]salt-ghost)?$/.test(x)),
      "every row has the same parts in the same order: " + JSON.stringify(shapes));
    await byAct(d, "part.orders.todo").click(); await p.work.quiet();
    const why = (id) => { const n = byAct(d, "order.open", id).querySelector(".salt-settings__sub"); return n.textContent.split(" · ")[0] + (n.classList.contains("salt-settings__sub--why") ? " (copper)" : ""); };
    ok(why("ord-a1") === "Says sent RM 530 (copper)" && why("ord-a2") === "Send again (copper)" && pillOf("ord-a1") === "Received",
      "a payment they say they sent and a stage he rejected say which in copper, and a payment's move is Received: " + JSON.stringify(["ord-a1", "ord-a2"].map((id) => [why(id), pillOf(id)])));
    await byAct(d, "part.orders.open").click(); await p.work.quiet();
    ok(["ord-r2", "ord-r3"].every((id) => !byAct(d, "order.open", id).querySelector(".salt-settings__sub--why") && ["Handed", "Message", ""].includes(pillOf(id))),
      "and an order that waits on nothing is a quiet row, its move the goods' next step: " + JSON.stringify(["ord-r2", "ord-r3"].map((id) => [why(id), pillOf(id)])));
    await byAct(d, "part.orders.todo").click(); await p.work.quiet();
    ok(p.posts.length === 0 && !p.reads.some((r) => /preview/.test(r)),
      "listing the orders sends nothing and previews nothing: a row has no preview, which costs a read: " + JSON.stringify(p.posts));
    ok(["makerReview", "makerClaims", "makerPools", "makerOrderList"].every((id) => !!d.getElementById(id)),
      "the containers the maker tests and the map find are still there: #makerReview, #makerClaims, #makerPools");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 1b. A LONG CLOSED LIST: fifty closed orders with nothing else asked of him, and one that is also Waiting on you is never dropped, so the note
     counts what Closed shows against every closed order (fifty-one of fifty-six here, not fifty of fifty-five) */
  st = state(); st.many = true;
  p = await open(st);
  try {
    const d = p.d;
    await p.enter("ended");
    const shownClosed = p.rowsShown(), note = [...d.querySelectorAll("#makerOrderList .salt-settings__foot")].filter(shown).map((e) => e.textContent);
    /* 2 Nov 2026: the one that also waits on him stands in To do, so Ended lists the fifty and the note still counts all fifty-one against every closed order */
    ok(shownClosed.length === 50 && !shownClosed.includes("ord-x1") && !shownClosed.includes("ord-z55") && same(note, ["51 of 56 closed orders are shown."]),
      "Ended lists fifty ended orders, the one that also waits on you standing in To do, and its note counts what it shows against every closed order: " + shownClosed.length + " " + JSON.stringify(note));
    await p.tap("part.orders.done");
    ok(p.rowsShown().length === 0 && !p.rowsShown().some((id) => /^ord-z/.test(id)), "and Done lists none of them: " + p.rowsShown().join());
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 1c. THE STAGE PILLS (14 Oct 2026): a count on the pill of each stage that has an order waiting on him, Payments counted by the claims, the place opening on the first
     stage with something waiting, and from 860px the first order of a stage open in the detail column; no heading repeats the place and no placeholder floats */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    /* 2 Nov 2026: To do carries the count of the orders that wait on him (practice not counted), Payments they sent the claims, and no other part a count */
    const pill = (part) => { const b = byAct(d, "part.orders." + part); const c = b.querySelector(".salt-segment__count, [data-n]"); return (b.firstChild.textContent || b.querySelector(".salt-settings__label").textContent) + ":" + (c && !c.hidden ? c.textContent : ""); };
    ok(same(["todo", "open", "done", "ended", "payments", "group"].map(pill), ["To do:7", "Open:", "Done:", "Ended:", "Payments they sent:2", "Group orders:"]),
      "To do carries the count of the orders that wait on him (practice not counted), Payments they sent the claims, and the rest none: " + JSON.stringify(["todo", "open", "done", "ended", "payments", "group"].map(pill)));
    ok(p.where() === "orders/todo" && !d.getElementById("makerReviewTitle") && !/Choose an order to see it here/.test(d.getElementById("oOrders").textContent)
      && !d.querySelector("#oSplit > h2") && d.getElementById("oSplit").getAttribute("aria-label") === "Orders",
    "the page opens on To do, where orders wait, with no repeated Orders heading and no floating placeholder: " + p.where());
    ok(!(d.getElementById("makerReview").textContent), "and the detail column is empty, not an invitation, until an order is chosen");
    /* 2 Nov 2026: from 860px and under 1080px, where the list stands beside the card (from 1080px the list is a table and an open order fills the page) */
    p.w.matchMedia = (q) => ({ matches: /min-width:860px/.test(q) && !/min-width:1[0-9]{3}px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    await p.tap("part.orders.open");
    ok(same(p.cardsIn(), ["ord-r1"]) && byAct(d, "order.open", "ord-r1").getAttribute("aria-current") === "true",
      "from 860px the first order of the part opens in the detail column by itself: " + JSON.stringify(p.cardsIn()));
    await p.tap("part.orders.todo");
    ok(same(p.cardsIn(), ["ord-p1"]), "and so does the first of the next part he moves to: " + JSON.stringify(p.cardsIn()));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  p = await open(state(), { review: (j) => { day(state())(j); j.orders = j.orders.filter((o) => o.status !== "placed"); return j; } });
  try {
    await p.enter();
    ok(p.where() === "orders/todo", "with nothing placed, the page opens on To do, where the payments they sent and the stage he rejected wait: " + p.where());
    await p.tap("part.orders.open");
    await p.tap("nav.customers"); await p.tap("nav.orders");
    ok(p.where() === "orders/todo", "and a place he comes back to opens there again, not on a part he last chose: " + p.where());
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  p = await open(state(), { review: (j) => { day(state())(j); j.orders = j.orders.filter((o) => o.id !== "ord-a1" && o.id !== "ord-a2" && o.id !== "ord-x1" && o.status !== "placed" && o.status !== "ready"); return j; } });
  try {
    await p.enter();
    ok(p.where() === "orders/todo", "with nothing waiting anywhere the page opens on To do: " + p.where());
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

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
    /* 25 Oct 2026 (Ask E): the terms in view lead, then Agree and Decline in one row; Change terms and its fold are gone */
    const want = ["order.total", "order.accept", "order.decline", "order.answer", "order.reply-text", "order.quick-reply",
      "order.quick-reply", "order.quick-keep", "order.reply", "order.no-reply"];
    const got = p.acts("ord-p1");
    ok(same(got, want), "the card has the controls it had, less the reason, which is asked on the Decline's Sheet, and Details for its reference: " + JSON.stringify(got));
    /* his decision 6 of 11 Oct 2026: the card reads its own preview on opening, once, and has no Preview button */
    const pv = p.posts.filter((x) => /preview$/.test(x.route));
    ok(pv.length === 1 && pv[0].route === "/all/maker/orders/ord-p1/preview" && same(pv[0].body, { total: 200, delivery: 0 }) && !!d.querySelector("#makerReview [data-accept]")
      && !p.acts("ord-p1").includes("order.preview"),
      "and opening it sends the request the Preview button sent, the same route and body, once, and then offers Accept, with no Preview button: " + JSON.stringify(pv));
    await p.tick();
    ok(p.posts.filter((x) => /preview$/.test(x.route)).length === 1 && !!d.querySelector("#makerReview [data-accept]"), "and a read that finds the order the same reads nothing again, and keeps Accept");
    await p.tapRow("ord-p3");
    ok(same(p.cardsIn(), ["ord-p3"]) && byAct(d, "order.open", "ord-p3").getAttribute("aria-current") === "true" && !byAct(d, "order.open", "ord-p1").hasAttribute("aria-current"),
      "another row replaces the card: only the order opened has one: " + JSON.stringify(p.cardsIn()));
    await byAct(d, "part.orders.todo").click(); await p.work.quiet();
    await p.tapRow("ord-a1");
    const a1 = p.acts("ord-a1");
    ok(a1.filter((x) => x === "order.claim-received").length === 2 && a1.includes("order.claim-not-found") && a1.includes("order.pay") && a1.includes("order.amend")
      && a1.includes("order.cancel") && !a1.includes("order.preview") && !a1.includes("order.handed"),
    "an agreed order's card keeps its claims, Received, Amend and Cancel: " + JSON.stringify(a1));
    await byAct(d, "part.orders.open").click(); await p.work.quiet();
    await p.tapRow("ord-r1");
    const r1 = p.acts("ord-r1");
    ok(r1.includes("order.handed") && r1.includes("order.handed-rest") && r1.includes("order.pay") && r1.includes("order.cancel") && !r1.includes("order.preview"),
      "a ready order's card keeps the handover, the close and the cash: " + JSON.stringify(r1));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3. BACK, AND WHAT CLOSES A CARD */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    await p.tapRow("ord-p2");
    /* 20 Oct 2026 (canvas V35): no back link; a tap on Orders in the rail or the app bar closes the card */
    ok(!byAct(d, "order.back") && !d.querySelector("#makerReview [data-back]"), "a card has no back link of its own");
    byAct(d, "nav.orders").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !d.getElementById("oSplit").classList.contains("open") && !byAct(d, "order.open", "ord-p2").hasAttribute("aria-current")
      && d.activeElement === byAct(d, "order.open", "ord-p2") && p.rowsShown().length === 8,
    "Back closes the card, unmarks the row and puts him on the row he came from, the list whole: " + JSON.stringify([p.cardsIn(), d.activeElement && d.activeElement.getAttribute("data-key")]));
    await p.tapRow("ord-p2");
    await byAct(d, "part.orders.open").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !d.getElementById("oSplit").classList.contains("open"), "leaving the part closes the card: " + JSON.stringify(p.cardsIn()));
    await byAct(d, "part.orders.todo").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0, "and it is not there when he comes back");
    await p.tapRow("ord-p2");
    byAct(d, "nav.customers").click(); await p.work.quiet();
    byAct(d, "nav.orders").click(); await p.work.quiet();
    ok(p.cardsIn().length === 0 && !d.getElementById("oSplit").classList.contains("open"), "leaving the place closes it too: " + JSON.stringify(p.cardsIn()));
    /* the same part tapped again leaves a card he is typing in alone */
    await p.tapRow("ord-p1");
    const field = d.querySelector('#makerReview [data-act="order.total"]');
    field.value = "250"; field.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    byAct(d, "part.orders.todo").click(); await p.work.quiet();
    ok(d.querySelector('#makerReview [data-act="order.total"]') === field && field.value === "250", "tapping the part he is in again does not redraw the card he is typing in");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

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
    await p.tick();   /* 2 Nov 2026: the list has no Refresh; the 5-second read is the one that finds the order moved */
    ok(p.cardsIn().length === 0 && !p.rowsShown().includes("ord-p1") && !d.getElementById("oSplit").classList.contains("open"),
      "an order that has left the part (agreed since) closes its card and its row goes from the list: " + JSON.stringify([p.cardsIn(), p.rowsShown()]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3b. SCROLLING: a tap on a row takes him to the top only while the card's way back shows (below 860px, where the card takes the list's place);
     from 860px the list is the page's scroll and the card stands beside it, so the page stays where it is and the card is brought into view */
  p = await open();
  try {
    const d = p.d, w = p.w, tops = [], into = [];
    w.scrollTo = (x, y) => tops.push([x, y]);
    w.HTMLElement.prototype.scrollIntoView = function (o) { into.push([this.id, JSON.stringify(o)]); };
    await p.enter();
    tops.length = 0;
    await p.tapRow("ord-p3");
    ok(same(tops, [[0, 0]]) && into.length === 0, "below 860px a row tap takes him to the top of the card, its way back showing: " + JSON.stringify([tops, into]));
    byAct(d, "nav.orders").click(); await p.work.quiet();
    tops.length = 0; into.length = 0;
    w.matchMedia = (q) => ({ matches: /min-width:860px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    await p.tapRow("ord-p3");
    ok(tops.length === 0 && same(into, [["makerReview", '{"block":"nearest"}']]),
      "from 860px a tap on a low row leaves the page where it is and brings the card into view: " + JSON.stringify([tops, into]));
  } catch (e) { ok(false, "scrolling stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 4. THE SPLIT, from 860px */
  {
    const { html, media, at } = ownerCss();
    /* 21 Oct 2026 (canvas V39, his answer (a)): side by side from 860 to 1080px only; from 1080 an open order takes the list's place, as below 860 */
    const split = at("(min-width:860px)and(max-width:1079.98px)", ".adm .ordgrid")[0] || "";
    ok(/max-width: none/.test(at("(min-width:860px)", ".adm #oOrders")[0] || ""), "from 860px Orders takes the page's whole width, so the list and the card have room: " + at("(min-width:860px)", ".adm #oOrders")[0]);
    const phone = at("(max-width:859.98px)", ".adm #oSplit.open .ordlist,.adm #oSplit:not(.open) #makerReview,.adm #oSplit.open #makerReviewStatus")[0] || "";
    const phoneAny = media.filter((m) => m.q === "(max-width:859.98px),(min-width:1080px)").flatMap((m) => m.rules).join(" ");
    ok(/display: grid/.test(split) && /grid-template-columns: minmax\(280px,360px\) minmax\(0,1fr\)/.test(split),
      "from 860 to 1080px the list and the card stand side by side, the list 280 to 360px: " + split);
    ok(/\.adm #oSplit\.open \.ordlist/.test(phoneAny) && /display: none/.test(phoneAny) && /#makerReview/.test(phoneAny),
      "below 860px and from 1080px an open card takes the list's place, and with none open the card's place is not shown: " + phoneAny.slice(0, 200));
    /* the App bar stays fixed along the foot until 1080px, so in that band the sticky card's foot is kept above it: its height gives up the bar's */
    const inBand = at("(min-width:860px)and(max-width:1079.98px)", ".adm #makerReview"), band = inBand.find((r) => /salt-bar-h/.test(r)) || "", plain = inBand.find((r) => /position: sticky/.test(r)) || "";
    ok(/max-height: calc[(]100vh - 48px - var[(]--salt-bar-h[)]/.test(band) && /max-height: calc[(]100vh - 48px[)]/.test(plain) && at("(min-width:860px)", ".adm #makerReview").every((r) => !/sticky/.test(r)),
      "between 860 and 1080px, where the App bar is still fixed, the sticky card's height gives up the bar's, and from 1080px the card is the page, never sticky: " + band + " | " + plain);
    const d = new JSDOM(html).window.document;
    const grid = d.querySelector("#oSplit .ordgrid");
    ok(!!grid && [...grid.children].map((c) => c.id).join() === "makerOrderList,makerReview" && !!d.querySelector("#oOrders #oSplit"),
      "the list comes first in the markup and the card second, in the section that Orders' four stages show: " + (grid && [...grid.children].map((c) => c.id).join()));
  }

  /* 4b. RECORD'S FORM IS A PANE (Phase 4a): the menu and a retained input one column, the forms the pane beside it from 860px and in the menu's place below it */
  {
    const { html, media, at } = ownerCss();
    const split = at("(min-width:860px)", ".adm .recgrid")[0] || "";
    const phoneAny = media.filter((m) => m.q === "(max-width:859.98px)").flatMap((m) => m.rules).join(" ");
    const phone = at("(max-width:859.98px)", ".adm .recgrid.open .reclist,.adm .recnone")[0] || "";
    ok(/display: grid/.test(split) && /grid-template-columns: minmax\(280px,360px\) minmax\(0,1fr\)/.test(split),
      "from 860px Record's menu and the form open stand side by side, the menu 280 to 360px: " + split);
    ok(/display: none/.test(phone) && /\.adm \.recgrid\.open \.reclist/.test(phoneAny) && /\.adm \.recnone/.test(phoneAny),
      "below 860px a form open takes the menu's place, and the pane's invitation to choose one is not drawn: " + phoneAny.slice(0, 240));
    const pane = at("(min-width:860px)", ".adm .recpane")[0] || "", band = at("(min-width:860px)and(max-width:1079.98px)", ".adm .recpane")[0] || "";
    ok(/position: sticky/.test(pane) && /overflow-y: auto/.test(pane) && /max-height: calc[(]100vh - 48px[)]/.test(pane) && !/salt-bar-h/.test(pane) && /salt-bar-h/.test(band),
      "the pane is sticky and scrolls inside itself, and between 860 and 1080px its height gives up the App bar's: " + pane + " | " + band);
    const back = at("(min-width:860px)", ".adm #makerFormBack")[0] || "", wide = at("(min-width:860px)", ".adm #oRecord")[0] || "";
    const approve = at("(min-width:860px)", ".adm #oOrders>.abody>#oApprove")[0] || "";
    ok(/display: none/.test(back) && /max-width: none/.test(wide) && /max-width: 600px/.test(approve),
      "from 860px the way back is not drawn (the menu is beside the form), Record widens for its forms and the rows to approve keep their column: " + [back, wide, approve].join(" | "));
    const d = new JSDOM(html).window.document;
    ok(!!d.querySelector("#makerInputs") && d.querySelector("#makerInputs").getAttribute("data-in") === "record.entry record.customers record.pricing",
      "the forms stand in Record's one section, which Entry, Customers and Pricing show");
  }
  p = await open();
  try {
    await p.tap("nav.record");
    const grid = p.d.getElementById("makerFormGrid"), list = grid && grid.querySelector(".reclist"), pane = grid && grid.querySelector(".recpane");
    ok(!!grid && !!list && !!pane && [...grid.children].map((c) => c.className).join() === "reclist,recpane" && grid.classList.contains("recgrid") && !grid.classList.contains("open")
      && !!list.querySelector("#makerMenu") && !!list.querySelector("section[data-formmenu]") && pane.querySelectorAll("section.maker-input[data-form]").length === 15
      && !list.querySelector("section[data-form]") && !!pane.querySelector(".recnone"),
    "the menu and the retained input stand in one column and the 15 forms in the pane beside it, with an invitation to choose one: " + (grid && [...grid.children].map((c) => c.className).join()));
    /* a sweep (every move to a place or a part) puts the menu back whatever hid it */
    const menu0 = p.d.getElementById("makerMenu"); menu0.hidden = true;
    await p.tap("nav.shop"); await p.tap("nav.record");
    ok(menu0.hidden === false, "a menu hidden by anything is drawn again the next time Record is entered");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 5. A CUSTOMER'S QUESTION ON AN ORDER is a To do card on Needs you, counted as an account thread's is */
  const base = await open(state());
  const baseCount = { needs: +base.counts().needs, orders: +base.counts().orders, customers: base.counts().customers };
  /* the To do cards on the page (the count since 22 Oct 2026: the cards themselves, the lead no longer counting), practice apart */
  const nowOf = (d) => [...d.querySelectorAll('#nlist section[data-sev="now"] [data-need]')].filter((c) => !c.hasAttribute("data-practice")).length;
  const baseNow = nowOf(base.d);
  base.w.close();
  st = state(); st.asked = true;
  p = await open(st);
  try {
    const d = p.d, card = (k) => d.querySelector('#nlist [data-need="' + k + '"]'), said = (c) => { const b = c && c.querySelector(".need-tap"); return b ? b.getAttribute("aria-label") : ""; };
    const c1 = card("om:ord-r1"), c9 = card("om:ord-c9"), ex = card("om:ex-2");
    ok(!!c1 && c1.getAttribute("data-sev") === "now" && c1.getAttribute("data-kind") === "messages" && c1.querySelector(".nkind").firstChild.textContent === "Message"
      && c1.querySelector(".need-who").textContent === "CX1-ZED" && said(c1) === "Message: Reply to CX1-ZED, Can it be before three?"
      && !!c1.closest('section.ngroup[data-sev="now"]') && c1.querySelector(".nage").textContent === "2 h" && !c1.querySelector(".salt-action__why, .need-what"),
    "a question of theirs on an order, unanswered, is a To do card: the Message kind and how long, who by code, their words in the title's full sentence, no why line: " + (c1 && c1.textContent));
    ok(!!c9 && c9.getAttribute("data-sev") === "now" && /Why was it declined[?]/.test(said(c9)) && c9.querySelector(".nage").textContent === "1 h",
      "and so is one on an order that is closed: " + (c9 && c9.textContent));
    ok(!!ex && ex.hasAttribute("data-practice") && !!ex.closest('details[data-sev="practice"]') && /^Practice: [0-9]+$/.test(ex.closest("details").querySelector("summary").textContent.trim()),
      "and a practice account's is drawn under the Practice fold, not among To do");
    const now = p.counts();
    ok(+now.needs === baseCount.needs + 2 && +now.orders === baseCount.orders && now.customers === baseCount.customers,
      "it is counted on Needs you, the two real ones and not the practice one; Orders counts open orders, so a question on an order changes nothing there; Customers (the threads) is as it was: " + JSON.stringify([baseCount, now]));
    ok(nowOf(d) === baseNow + 2 && /on your tap now/.test(d.getElementById("nCount").textContent),
      "the To do cards count it (two more, the practice one apart) and the lead still says what waits on his tap: " + baseNow + " then " + nowOf(d) + " " + d.getElementById("nCount").textContent);
    await p.tap("need.kind.messages");
    ok(["om:ord-r1", "om:ord-c9", "om:ex-2"].every((k) => !!card(k)) && p.needs().every((k) => /^(m|om):/.test(k)), "the Messages chip shows it beside the account threads: " + p.needs().join());
    await p.tap("need.kind.all");
    ok(!!card("om:ord-r1"), "and All shows it again");
    await p.tap("need.open", "om:ord-r1");
    ok(p.where() === "orders/todo" && same(p.cardsIn(), ["ord-r1"]) && byAct(d, "order.open", "ord-r1").getAttribute("aria-current") === "true" && d.getElementById("oSplit").classList.contains("open"),
      "its Open goes to Orders, To do where it waits on him, with that order's card open and its row marked: " + p.where() + " " + JSON.stringify(p.cardsIn()));
    /* 2 Nov 2026 (Orders on the canvas): an order with a question of theirs waits on him wherever it stands, so To do lists it, its second line copper and saying asked, the practice one saying practice, and the declined one too */
    const sub = (id) => byAct(d, "order.open", id).querySelector(".salt-settings__sub");
    ok(p.rowsShown().includes("ord-r1") && p.rowsShown().includes("ex-2") && /^Asked a question/.test(sub("ord-r1").textContent) && sub("ord-r1").classList.contains("salt-settings__sub--why")
      && /^Practice/.test(sub("ex-2").textContent),
    "To do lists the order with its question, its second line copper and saying asked, and the practice one saying practice: " + p.rowsShown().join());
    ok(p.rowsShown().includes("ord-c9") && /^Asked a question/.test(sub("ord-c9").textContent) && sub("ord-c9").classList.contains("salt-settings__sub--why"),
      "and so does the declined one with its question, marked as well: " + p.rowsShown().join());
    await p.tap("nav.needs");
    await p.tap("need.open", "om:ord-c9");
    const reply = p.acts("ord-c9");
    ok(p.where() === "orders/todo" && same(p.cardsIn(), ["ord-c9"]) && ["order.reply-text", "order.quick-keep", "order.reply", "order.no-reply"].every((a) => reply.includes(a))
      && !reply.some((a) => ["order.reason", "order.decline", "order.cancel", "order.pay", "order.amend", "order.handed", "order.handed-rest", "order.pay-by"].includes(a)),
    "a closed order's card is his reply and No reply needed alone, nothing to decline, cancel or move: " + JSON.stringify(reply));
    p.posts.length = 0;
    byAct(d, "order.no-reply", "ord-c9").click(); await p.work.quiet();
    const moves = p.posts.filter((x) => /orders[/]ord-c9[/]move$/.test(x.route));
    ok(moves.length === 1 && moves[0].body.noReply === true && /^[0-9a-f]{32}$/.test(moves[0].body.rid),
      "and No reply needed sends the move it sent, under a request id: " + JSON.stringify(moves));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  for (const [name, patch] of [["he has answered it", { answered: true }], ["he has marked it as needing no reply", { quiet: true }]]) {
    st = state(); Object.assign(st, patch);
    p = await open(st);
    try {
      const c = p.counts();
      ok(!p.d.querySelector('#nlist [data-need="om:ord-r1"]') && +c.needs === baseCount.needs && +c.orders === baseCount.orders,
        "no question is asked of him once " + name + ": no card, and no count (" + JSON.stringify(c) + ")");
    } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }

  /* 6. THE 5-SECOND READ IS SILENT WHILE AN ACCOUNT IS VIEWED AS THEM: the page hides his own (stmt/page.js show()) and nobody is looking at it */
  for (const place of ["needs", "orders"]) {
    p = await open();
    try {
      const d = p.d, roster = d.getElementById("roster");
      if (place === "orders") await p.enter();
      ok(p.where().split("/")[0] === place && p.live().length === 1, place + " sets the one 5-second read: " + p.where());
      p.reads.length = 0;
      roster.hidden = true;
      await p.tick(); await p.tick();
      ok(p.reads.length === 0 && p.posts.length === 0, "while an account is viewed as them a tick on " + place + " reads nothing: " + JSON.stringify(p.reads));
      roster.hidden = false;
      await p.tick();
      ok(p.reads.includes(ROUTES.review) && p.reads.includes(ROUTES.claims), "and it reads again the moment his page is back: " + JSON.stringify(p.reads));
    } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }

  /* 7. THE + ORB opens Record's menu of entries */
  p = await open();
  try {
    const d = p.d, add = d.getElementById("oAdd"), { at, top } = ownerCss();
    ok(!!add && add.tagName === "BUTTON" && add.classList.contains("salt-orb") && add.getAttribute("data-act") === "nav.add" && add.getAttribute("aria-label") === "Record an entry"
      && !!add.querySelector("svg") && d.getElementById("roster").contains(add) && !add.hasAttribute("data-m") && !add.hasAttribute("data-part") && byAct(d, "nav.add") === add,
    "one + orb stands on Salt Admin, found by its act and named by a label: " + (add && add.outerHTML.slice(0, 200)));
    const there = [];
    for (const place of ["needs", "orders", "customers", "shop"]) { await p.tap("nav." + place); there.push(shown(add)); }
    ok(there.length === 4 && there.every(Boolean), "it stands on Needs you, Orders, Customers and Shop: " + there.join());
    await p.tap("nav.record");
    ok(!shown(add), "and not on Record, where the parts are one tap away");
    await p.tap("nav.needs");
    p.posts.length = 0;
    await p.tap("nav.add");
    ok(p.where() === "record/entry" && same(p.menu(), MENU.entry) && p.formsOpen().length === 0 && !shown(add) && p.posts.length === 0 && p.reads.includes(ROUTES.inputs),
      "it opens Record on Entry, the menu of entries with no form open, sending nothing: " + p.where() + " " + JSON.stringify(p.menu()));
    await p.tap("record.form", "gift");
    await p.tap("nav.shop"); await p.tap("nav.add");
    ok(p.where() === "record/entry" && p.formsOpen().length === 0 && same(p.menu(), MENU.entry), "and a form left open comes back as the menu: " + p.where() + JSON.stringify([p.formsOpen(), p.menu()]));
    const orb = top(".adm #oAdd")[0] || "", wide = at("(min-width:1080px)", ".adm #oAdd")[0] || "", room = at("(max-width:1079.98px)", ".adm .amain")[0] || "";
    ok(/position: fixed/.test(orb) && /right: 16px/.test(orb) && /z-index: 40/.test(orb) && /bottom: calc[(]var[(]--salt-bar-h[)] [+] 16px/.test(orb) && /display: none/.test(wide) && /padding-bottom: 72px/.test(room),
      "the orb stands 16px above the App bar on a phone, gives way to the rail's + from 1080px (P10, 21 Oct 2026), under the bar and the sheets, and the room under the last section clears it: " + [orb, wide, room].join(" "));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 8. RECORD'S FORMS ARE A MENU: a row for each form, one form at a time, the form itself moved and never drawn again */
  p = await open();
  try {
    const d = p.d, LABEL = { entry: "Entry", customers: "Customers", pricing: "Pricing" };
    await p.tap("nav.record");
    const seen = {};
    for (const part of ["entry", "customers", "pricing"]) { await p.tap("part.record." + part); seen[part] = [p.menu(), p.formsOpen(), p.retained()]; }
    ok(same(seen, { entry: [MENU.entry, [], ["Unsent entry"]], customers: [MENU.customers, [], []], pricing: [MENU.pricing, [], []] }),
      "Entry, Customers and Pricing are each a menu of their forms by name, no form shown, and the retained input kept on Entry: " + JSON.stringify(seen));
    /* 18 Oct 2026 (clarity part 4): Entry's forms stand in three groups by how often they are used, each under a small eyebrow, and every row keeps its slug */
    const lst = d.querySelector('#makerMenu .formlist[data-in="record.entry"]');
    /* 27 Oct 2026: each group is a settings head over its own settings list, the rows inside it */
    const groups = lst ? [...lst.children].flatMap((n) => n.classList.contains("salt-settings__head") ? ["# " + n.textContent]
      : n.classList.contains("salt-settings") ? [...n.children].map((r) => r.querySelector(".salt-settings__label").textContent + "=" + r.getAttribute("data-key")) : ["? " + n.className]) : [];
    ok(same(groups, ["# Everyday", "Sale or purchase=sale-or-purchase", "Repayment=repayment", "Stock count=stock-count", "# Now and then", "Gift=gift", "Loan=loan", "Rewards=rewards", "Offsets=offsets"]),   /* 27 Oct 2026, his word: Fixing is gone, and Correct a row and Reopen are no rows of the menu (the sale form reaches them) */
    "Entry's menu is Everyday and Now and then, each a settings head over its own list of forms in that order, every row keeping its slug: " + JSON.stringify(groups));
    const rows = [...d.querySelectorAll('#makerMenu [data-act="record.form"]')], kept = d.querySelector("#makerInputs section[data-formmenu]"), menuEl = d.getElementById("makerMenu");
    ok(rows.length === 13 && rows.every((r) => r.tagName === "BUTTON" && r.classList.contains("salt-settings__row--action") && r.parentElement.classList.contains("salt-settings") && /^[a-z0-9-]+$/.test(r.getAttribute("data-key")) && !/Open/.test(r.textContent))
      && new Set(rows.map((r) => r.getAttribute("data-key"))).size === 13 && !!kept && !!(kept.compareDocumentPosition(menuEl) & 4),
    "a row is the system's settings row in a settings list (27 Oct 2026; it was the Inbox row), named by its act and a key of its own, below the retained input: " + rows.map((r) => r.getAttribute("data-key")).join());
    /* 14 Oct 2026 (Record): the title and its lead stand once; Offsets are two lists, never one, each offer one row with one Add */
    ok(d.querySelectorAll("#oRecord h1").length === 1 && (d.getElementById("oRecord").textContent.match(/Each waits for your approval under Orders > Approve/g) || []).length === 1
      && !d.querySelector("#makerInputs > h2") && !d.querySelector('#oApprove > h2') && !/Rows to approve/.test(d.getElementById("oRecord").textContent),
    "Record's title and lead are drawn once: no second Record heading over the forms, no Rows to approve heading under the part strip");
    await p.tap("record.form", "offsets");
    const offs = d.querySelector('#makerInputs [data-form="offsets"]'), lists = offs ? [...offs.querySelectorAll("[data-offers]")] : [];
    const kinds = Object.fromEntries(lists.map((l) => [l.getAttribute("data-offers"), [...l.querySelectorAll(".maker-offer")].length]));
    const oneRow = offs && offs.querySelector(".maker-offer");
    ok(!!offs && same(kinds, { customer: 0, reward: 1 }) && same([...offs.querySelectorAll("h4")].map((h) => h.textContent), ["Customer offsets", "Associate reward offsets"])
      && !/One unit off the oldest unpaid order/.test(offs.textContent) && !!oneRow && oneRow.closest('[data-offers="reward"]') && /AX1-ZED/.test(oneRow.textContent)
      && same([...oneRow.querySelectorAll("button")].filter((b) => !b.hidden).map((b) => b.textContent), ["Add"]) && oneRow.querySelector("button").getAttribute("data-act") === "record.offset.send"
      && !/Send the offset/.test(offs.textContent) && !!offs.querySelector('[data-offers="customer"] .rnone'),
    "Offsets are two lists, customer and associate reward, with no instruction paragraph; the Counter's offers (all rewards) stand in the reward list as one row with one Add, and the customer list says none: " + JSON.stringify(kinds));
    await p.tap("record.form-back");
    const bad = [], gridOpen = () => d.getElementById("makerFormGrid").classList.contains("open");
    for (const part of ["entry", "customers", "pricing"]) {
      await p.tap("part.record." + part);
      for (const name of MENU[part]) {
        /* 27 Oct 2026: the row is a settings row named in three words at most; three forms keep a longer heading of their own */
        const row = [...d.querySelectorAll('#makerMenu [data-act="record.form"]')].filter(shown).find((r) => r.querySelector(".salt-settings__label").textContent === name);
        if (!row) { bad.push(name + " (no row: " + p.where() + " " + JSON.stringify(p.menu()) + ")"); continue; }
        const slug = row.getAttribute("data-key");
        p.posts.length = 0; p.reads.length = 0;
        row.click(); await p.work.quiet();
        const back = d.getElementById("makerFormBack"), form = d.querySelector('#makerInputs [data-form="' + slug + '"]');
        if (!(same(p.formsOpen(), [slug]) && form.querySelector("h3").textContent === ({ "Reopen an order": "Reopen a cancelled order", "Name or place": "Change a name or place", "Map point": "Place on the map" }[name] || name) && same(p.menu(), MENU[part]) && gridOpen() && row.getAttribute("aria-current") === "true"
          && d.querySelectorAll('#makerMenu [aria-current="true"]').length === 1 && shown(back)
          && back.textContent === "← " + LABEL[part] && back.getAttribute("data-act") === "record.form-back" && p.posts.length === 0 && p.reads.length === 0 && d.activeElement === back)) bad.push(name);
        back.click(); await p.work.quiet();
        if (!(p.formsOpen().length === 0 && same(p.menu(), MENU[part]) && !gridOpen() && !row.hasAttribute("aria-current") && !shown(back) && d.activeElement === row)) bad.push(name + " (back)");
      }
    }
    ok(bad.length === 0, "each of the 13 forms on a menu opens alone from its row and no other form shows, its row marked and the grid open, a way back named for the part, nothing read or sent, and Back returns him to the row: " + JSON.stringify(bad));
    await p.tap("part.record.entry");
    await p.tap("record.form", "sale-or-purchase");
    const units = byAct(d, "record.trade.units"), form = units.closest("section");
    units.value = "7"; units.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    await p.tap("record.form-back");
    await p.tap("record.form", "sale-or-purchase");
    ok(byAct(d, "record.trade.units") === units && units.closest("section") === form && units.value === "7" && form.getAttribute("data-form") === "sale-or-purchase",
      "a form is the same node when opened again, what was typed in it kept: " + units.value);
    /* from 860px the menu stands beside the form, so another form is opened straight from its row, with no Back between: the first is hidden, not drawn again */
    await p.tap("record.form", "gift");
    ok(same(p.formsOpen(), ["gift"]) && gridOpen() && byAct(d, "record.form", "gift").getAttribute("aria-current") === "true" && !byAct(d, "record.form", "sale-or-purchase").hasAttribute("aria-current")
      && form.hidden && units.value === "7", "another form opens straight from the menu, the first held as it was: " + JSON.stringify(p.formsOpen()) + " " + units.value);
    await p.tap("record.form", "sale-or-purchase");
    ok(byAct(d, "record.trade.units") === units && units.closest("section") === form && units.value === "7" && same(p.formsOpen(), ["sale-or-purchase"]),
      "and coming back to the first finds the same node with what was typed in it: " + units.value);
    ok(!!byAct(d, "record.count.send").closest('section[data-form="stock-count"]') && !!byAct(d, "record.retained.retry").closest("section[data-formmenu]"),
      "the stock count's controls stand in a form of their own and a retained input's in its section, moved and not rebuilt");
    await p.tap("record.form-back");
    await p.tap("record.form", "gift");
    await p.tap("part.record.customers"); await p.tap("part.record.entry");
    ok(p.formsOpen().length === 0 && same(p.menu(), MENU.entry) && !shown(d.getElementById("makerFormBack")), "leaving the part closes the form open: " + JSON.stringify(p.formsOpen()));
    await p.tap("record.form", "gift");
    await p.tap("nav.orders"); await p.tap("nav.record"); await p.tap("part.record.entry");
    ok(p.formsOpen().length === 0 && same(p.menu(), MENU.entry), "so does leaving the place: " + JSON.stringify(p.formsOpen()));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 9. THE OWNER'S SCRIPT IS SPLICED INTO THE CUSTOMER PAGE'S SCOPE (stmt/page.js splices it in at the end of the page script): a name it declares at the top is a name the
     customer's code must not declare, or his page overwrites theirs and "View as them" meets oOpen is not a function. A top-level statement is read
     whole: every declarator of a var, let or const list, split at the commas that stand outside any bracket, string, comment or regular expression,
     on the line or on those that follow it (the owner's `HOW`, which overwrote the customer's pay ways, is `HOW_IN` now). */
  {
    const declared = (src) => {
      const out = new Set();
      for (const m of src.matchAll(/^  (?:async )?function ([A-Za-z_$][\w$]*)\(/gm)) out.add(m[1]);
      for (const m of src.matchAll(/^  (?:var|let|const) /gm)) {
        let i = m.index + m[0].length, depth = 0, start = i;
        const parts = [];
        for (; i < src.length && i - start < 4000; i++) {
          const c = src[i];
          if (c === "'" || c === '"') { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++; continue; }
          if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
          if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i) - 1; continue; }
          if (c === "/" && /[=(,:[!&|?{;]\s*$/.test(src.slice(Math.max(start, i - 8), i))) {
            for (i++; i < src.length && src[i] !== "/"; i++) { if (src[i] === "\\") i++; else if (src[i] === "[") for (i++; i < src.length && src[i] !== "]"; i++) if (src[i] === "\\") i++; }
            continue;
          }
          if ("([{".includes(c)) depth++;
          else if (")]}".includes(c)) depth--;
          else if (c === "," && depth === 0) { parts.push(src.slice(start, i)); start = i + 1; }
          else if (c === ";" && depth === 0) break;
        }
        parts.push(src.slice(start, i));
        for (const part of parts) { const n = /^\s*([A-Za-z_$][\w$]*)/.exec(part); if (n) out.add(n[1]); }
      }
      return out;
    };
    const mine = declared(readFileSync(new URL("../stmt/owner.js", import.meta.url), "utf8")), theirs = declared(readFileSync(new URL("../stmt/page.js", import.meta.url), "utf8"));
    const both = [...mine].filter((n) => theirs.has(n));
    ok(mine.size > 280 && theirs.size > 600 && mine.has("fOpen") && mine.has("PARTS") && mine.has("HOW_IN") && both.length === 0,
      "no name the owner's script declares, in any declarator of a list, is one the customer page declares: " + both.join());
  }
}
