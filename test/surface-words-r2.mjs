/* 1 Nov 2026 (the surfaces pass, round 2, his word: one consistent design across Salt Desk, Salt Admin and Salt Counter): the words rule of the one language
 * (the salt-design-language skill, craft.md section 3: a grey line or an Insight is one sentence, a button four words at most with a verb first) on what a person
 * reads, taken off each page as it draws or as it is served, as test/surface-words.mjs does for the round before. Each check is red under its own mutation
 * (test/surface-words-r2.mutations.json):
 *   W1   the Counter's Insights are one sentence of twenty words at most: Negotiate's hint, the prepay line, the amendment line and the open-order limit
 *   W2   the Counter's grey lines are one sentence of fourteen words at most: Prices with no list, the link line, the slip's why, the overdue page, the part
 *        amount and the claim waiting
 *   W3   every armed button on the Counter reads Tap again to confirm: Sign out, Sign out other devices and Remove this passkey
 *   W4   the pay buttons are four words at most: cash on arrival, cash on collection and Show account number again
 *   W5   Salt Admin's leads on Group orders and Guest links are one sentence of twenty words at most
 *   W6   Salt Admin's armed buttons read Tap again to confirm: a refund's Mark paid today and Remove as stale; Sign out everywhere (2 Nov 2026, his
 *        Orders canvas, page 2) is an ember row that asks on the Sheet instead
 *   W7   a refund's grey line is its figure and what Paid does, with no second explanation
 *   W8   the thread's No reply needed reads Send it again after a send that failed
 *   W9   the trip card's button reads Hand over all, and Hand over as typed once a line holds a part
 *   W10  the Agree card's Insight on the window they chose is one sentence
 *   W11  an order's card and a row's card say the refund the book owes in one sentence
 *   W12  a row's stage chip is its tab's word: Out or paid, Done
 *   W13  the refusal for a size to hide that is not on the board is a sentence with its apostrophe
 *   W14  the Desk's empty Associates Insight is one sentence
 *   W15  the Desk's unsent-entries grey line is one sentence in both of its states
 *   W16  the Desk's Their % Insight is one sentence
 *   W17  (1 Nov 2026, the pass's leftovers) the test surface's armed Reset reads Tap again to confirm, like every armed button
 *   W18  a guest link waiting on him says so in one sentence of fourteen words at most
 *   W19  Salt Admin's vault sheet leads with one sentence of fourteen words at most
 * Salt Admin is drawn by the maker harness (test/maker-act.mjs), the Desk by its own master (tools/payload.mjs). */
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { EN, TS, fill } from "../stmt/words.js";
import { openMaster } from "../tools/payload.mjs";
import { richOwnerPage, byAct, enter, cardOf, answerSheets } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");
const one = (s) => !!s && !/[.!?] [A-Z]/.test(s) && /[.]$/.test(s);
const nw = (s) => String(s).trim().split(/ +/).length;
const sentence = (s, most) => one(s) && nw(s) <= most;
const said = (k, v) => fill(EN[k], v || {}, "en");
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function run({ ok, pageWork }) {
  /* ---- the Counter's words: the table the page is served with ---- */
  const insights = [["sh.askHint", {}], ["sh.prepayP", {}], ["ord.amendAsk", {}], ["sh.limit", { n: EN["num.5"] }]].map(([k, v]) => [k, said(k, v)]);
  ok(insights.every(([, s]) => sentence(s, 20)), "W1: the Counter's Insights are one sentence of twenty words at most: " + J(insights.filter(([, s]) => !sentence(s, 20))));
  const greys = [["pr.none", {}], ["lnk.next", {}], ["pay.slipWhy", {}], ["ord.holdP", {}], ["pay.upTo", { rm: "RM 90.00" }], ["of.checking", { rm: "RM 90.00" }]].map(([k, v]) => [k, said(k, v)]);
  ok(greys.every(([, s]) => sentence(s, 14)), "W2: the Counter's grey lines are one sentence of fourteen words at most: " + J(greys.filter(([, s]) => !sentence(s, 14))));
  const armed = ["dev.outAsk", "dev.outAgain", "dev.pkAgain"].map((k) => [k, EN[k]]);
  ok(armed.every(([, s]) => s === "Tap again to confirm"), "W3: every armed button on the Counter reads Tap again to confirm: " + J(armed));
  const pay = ["pay.cashGoArrives", "pay.cashGoCollect", "pay.againAcct"].map((k) => [k, EN[k]]);
  ok(J(pay.map(([, s]) => s)) === J(["Pay cash on arrival", "Pay cash on collection", "Show account number again"]) && pay.every(([, s]) => nw(s) <= 4),
    "W4: the pay buttons are four words at most: " + J(pay));
  ok(TS["ts.ask"] === "Tap again to confirm", "W17: the test surface's armed Reset reads Tap again to confirm: " + J(TS["ts.ask"]));
  const waiting = said("lnk.lineWaiting");
  ok(/^Shut until we approve it/.test(waiting) && sentence(waiting, 14), "W18: a guest link waiting on him says so in one sentence of fourteen words at most: " + J(waiting));

  /* ---- Salt Admin's two leads, written in the page ---- */
  const page = new JSDOM(landingPage("", "r2-nonce", { master: "fixture-master", accounts: [] })).window.document;
  const group = t(page.querySelector('[data-in="orders.group"] .lead')), links = t(page.querySelector("#oLinks .lead"));
  ok(sentence(group, 20) && sentence(links, 20), "W5: Salt Admin's leads on Group orders and Guest links are one sentence of twenty words at most: " + J([group, links]));
  const vaultLead = t(page.querySelector("#vaultSheet .lead"));
  ok(/^One password/.test(vaultLead) && sentence(vaultLead, 14), "W19: Salt Admin's vault sheet leads with one sentence of fourteen words at most: " + J(vaultLead));

  /* ---- Salt Admin, drawn ---- */
  const D = "2026-10-14", SINCE = "2026-10-01", T = "t1791900000001";
  const TRIP = { trip: T, party: "CX9-ZED", date: D, owed: 236, paid: 0, handedLines: 0, waiting: 0, lines: [
    { rid: "zt1", product: "salt", qty: 1, total: 110, delivery: 10, paid: 0, owed: 120, handed: 0, left: 1, waiting: 0, open: true },
    { rid: "zt2", product: "oil", qty: 10, total: 116, delivery: 0, paid: 0, owed: 116, handed: 0, left: 10, waiting: 0, open: true }] };
  const ROWS = [
    { rid: "fp1", party: "CQ9-ZED", product: "salt", date: D, key: "k2", qty: 1, total: 110, delivery: 0, paid: 110, owed: 0, handed: 0, left: 1, waiting: 0, stage: "paid", refund: 25 },
    { rid: "fz1", party: "CQ9-ZED", product: "salt", date: D, key: "kz1", qty: 1, total: 110, delivery: 0, paid: 110, owed: 0, handed: 1, left: 0, waiting: 0, stage: "done" }];
  const OWED = { id: "20261014010008-flowai", u: "u-flow-9", status: "acknowledged", ledgerKey: "CQ3-ZED|2026-10-14|110", qty: 1, total: 110, delivery: 0, paid: 0, moved: 0,
    product: "salt", mode: "collect", at: D + "T01:00:00.000Z", payments: [], msgs: [], history: [] };
  const p = await richOwnerPage({ pageWork, probe: true,
    review: (j) => ({ ...j, orders: j.orders.concat([OWED]), refunds: { [OWED.ledgerKey]: 25 }, trips: [TRIP], sameDay: [], rows: ROWS }),
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, openRefunds: [{ party: "CX1-ZED", since: SINCE, amount: 40 }], editWaiting: [] } }) });
  const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
  try {
    await p.work.quiet();
    /* the account card: a refund's two buttons and its line, then Sign out everywhere */
    enter(d, "customers", "accounts"); await p.work.quiet();
    /* 2 Nov 2026 (Customers on the canvas): an account is a settings row, its code the .acode */
    const acct = (code) => [...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".acode")) === code);
    await click(acct("CX1-ZED"));
    const a = d.querySelector("#aopen .oacct"), key = "CX1-ZED:" + SINCE + ":40:";
    const paid = byAct(a, "acct.refund", key + "refundPaid"), stale = byAct(a, "acct.refund", key + "refundRemove"), out = byAct(a, "acct.signout-all");
    const named = [t(paid), t(stale), t(out)];
    const asked = []; answerSheets(p.w, asked, () => false);
    await click(paid); await click(stale); await click(out);
    ok(J(named) === J(["Mark paid today", "Remove as stale", "Sign out everywhere"]) && [paid, stale].every((b) => t(b) === "Tap again to confirm")
      && asked.length === 1 && /^Sign out everywhere\?/.test(asked[0]) && t(out) === "Sign out everywhere",
      "W6: a refund's two buttons read Tap again to confirm once tapped, and Sign out everywhere asks on the Sheet: " + J({ named, armed: [t(paid), t(stale), t(out)], asked }));
    /* 3 Nov 2026 (the account on Shop's grid): the refund's line is the text row of its own list */
    const note = t(a.querySelector(".arefund__row .salt-settings__row--text .salt-settings__label"));
    ok(/^RM 40[.]00 to CX1-ZED, .*Paid marks it returned[.]$/.test(note) && nw(note) <= 14 && !/Remove as stale|money received/.test(note),
      "W7: a refund's line is its figure and what Paid does, with no second explanation: " + J(note));

    /* the account thread: a No reply needed that did not go through */
    enter(d, "customers", "messages"); await p.work.quiet();
    await click(d.querySelector('[data-thread="abcd-efgh"]'));
    p.fail.add("/all/maker/threads/abcd-efgh");
    const chat = d.getElementById("makerChatOpen"), chatBtn = (label) => [...chat.querySelectorAll("button")].find((b) => t(b) === label);
    const before = !!chatBtn("No reply needed");
    await click(chatBtn("No reply needed"));
    ok(before && !!chatBtn("Send it again") && !chatBtn("Send No reply needed again"),
      "W8: after a send that failed, the thread's No reply needed reads Send it again: " + J([...chat.querySelectorAll("button")].map(t)));

    /* Orders: the trip's button, the window they chose, the refund on an order and on a row, and a row's chip beside its tab */
    await click(byAct(d, "nav.orders"));
    const trip = cardOf(d, "trip:" + T);
    await p.work.quiet();
    const all = t(byAct(trip, "trip.handover", T));
    p.type(byAct(trip, "trip.hand-units", "zt2"), "4");
    const part = t(byAct(trip, "trip.handover", T));
    p.type(byAct(trip, "trip.hand-units", "zt2"), "10");
    const whole = t(byAct(trip, "trip.handover", T));
    ok(all === "Hand over all" && part === "Hand over as typed" && whole === "Hand over all", "W9: the trip card's button reads Hand over all, and Hand over as typed once a line holds a part: " + J([all, part, whole]));
    const agree = cardOf(d, "ord-p2");
    await p.work.quiet();
    /* 2 Nov 2026 (his Orders canvas, page 2): the line is the grey line under Agree's settings list */
    const chosen = t(agree && agree.querySelector(".oagree > .salt-settings__foot"));
    ok(/^They chose 08:00 to 12:00/.test(chosen) && sentence(chosen, 14), "W10: the Agree card's line on the window they chose is one sentence: " + J(chosen));
    const refundLine = (card) => [...(card ? card.querySelectorAll(".salt-insight") : [])].map(t).find((s) => / refund (here|on this order) /.test(s)) || "";
    const rowFp = cardOf(d, "row:fp1");
    await p.work.quiet();
    const forRow = refundLine(rowFp), chipFp = t(rowFp && rowFp.querySelector("p.lead"));
    const rowFz = cardOf(d, "row:fz1");
    await p.work.quiet();
    const chipFz = t(rowFz && rowFz.querySelector("p.lead"));
    const order = cardOf(d, OWED.id);
    await p.work.quiet();
    const lines = [forRow, refundLine(order)];
    /* 1 Nov 2026: and in twenty words at most (it ran to 22: refund on this order ... or paid back by hand on the Desk) */
    ok(lines.every((s) => /^RM 25[.]00 refund here is their credit/.test(s) && sentence(s, 20)), "W11: an order's card and a row's card say the refund the book owes in one sentence of twenty words at most: " + J(lines));
    /* 2 Nov 2026 (Orders on the canvas): Out or paid is Open's head now, Done still its tab */
    const tab = (id) => t(d.querySelector('[data-part="' + id + '"]')), chips = [chipFp, chipFz];
    const heads = [...d.querySelectorAll('#makerOrderList section[data-in="orders.open"] > h2')].map(t);
    ok(J(chips) === J(["Out or paid", "Done"]) && heads.includes(chips[0]) && tab("done").startsWith(chips[1]),
      "W12: a row's stage chip is its head's or tab's word: " + J({ chips, heads, tabs: [tab("done")] }));
    const refusal = p.w.__owner("plainRefusal")("A size to hide must be one of this book's board sizes.");
    ok(refusal === "Choose sizes from this book's printed list.", "W13: the refusal for a size to hide that is not on the board is a sentence with its apostrophe: " + J(refusal));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* ---- the Desk, on its own master ---- */
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  try {
    w.Element.prototype.scrollIntoView = () => { }; w.open = () => null;
    w.eval("setProd('salt');recompute();");
    const insightOf = (html) => plain((String(html).match(/<div class="insight salt-insight">([\s\S]*?)<\/div>/) || [, ""])[1]);
    w.eval("globalThis.__ns=networkStats;networkStats=function(){return [];};");
    const empty = insightOf(w.eval("tabNetwork()"));
    w.eval("networkStats=globalThis.__ns;");
    ok(/^No associates yet/.test(empty) && sentence(empty, 20), "W14: the Desk's empty Associates Insight is one sentence: " + J(empty));
    const loss = { at: "2099-01-01T00:00:01.000Z", type: "LOSS", party: null, qty: 2, total: null, status: "unpaid", raw: "Self-use 2 units", payload: { mode: "loss", date: "2026-10-01", product: "salt", kg: 2, why: "other", note: "" } };
    w.eval("globalThis.__un=qIsUnsent;queue=" + J([loss]) + ";qIsUnsent=function(){return true;};qRecMsg='';");
    const grey = (on) => { w.eval("OVERLAY_UNSENT=" + on + ";"); return plain((String(w.eval("renderRecovery()")).match(/<div class="dsc"[^>]*>([\s\S]*?)<\/div>/) || [, ""])[1]); };
    const both = [grey(true), grey(false)];
    w.eval("qIsUnsent=globalThis.__un;queue=[];OVERLAY_UNSENT=false;");
    ok(both.every((s) => /^Held in this browser only/.test(s) && sentence(s, 20)), "W15: the Desk's unsent-entries grey line is one sentence in both of its states: " + J(both));
    const pct = insightOf(w.eval("driftCard()"));
    ok(/^[0-9]+ of [0-9]+ are set by you/.test(pct) && one(pct), "W16: the Desk's Their % Insight is one sentence: " + J(pct));
  } finally { w.close(); }
}
