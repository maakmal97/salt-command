/* test/admin-open-order.mjs: THE OPEN ORDER, BOTH SIDES, AND THE OPEN ACCOUNT (2 Nov 2026; his Orders canvas, page 2, "The open order, both sides",
 * his answer 4 of 31 Oct 2026 and "accept all asks as recommended" of 2 Nov 2026). What is proved, each check red under its own mutation
 * (test/admin-open-order.mutations.json):
 *   V1  an order opened from To do stands in view: its card is in the row's part, never swept hidden by the stage's name (the fault v1376 shipped)
 *   V2  his card and the customer's draw ONE band and ONE Bill (stmt/page.js oBandOf, oBillOf): the band on the 16px line, the Bill a settings list under
 *       its grey head, the total's row heavier; no glass card around either open order
 *   V3  a placed order: Goods, Delivery and When are rows of one settings list under Agree, and the card holds exactly one filled pill, Agree
 *   V4  what ends the order is the card's last control, an ember row alone in its list, and it still asks on the Sheet before it sends
 *   V5  the thread and its box stand in view on his card: a line he types is sent as the order's move with his message, and an empty one sends nothing
 *   V6  This customer opens their account on Customers
 *   V7  from 1180px two columns, the decision left and the record (the Bill) right; at 1440 still two
 *   V8  the open account holds one filled pill (Send a sign-in link); Copy password and Sign out everywhere are ember rows in the last list, and Sign out
 *       everywhere sends nothing until the Sheet's yes
 *   V9  the customer's still to pay closes their Bill, its figure in ember while anything is owed
 * Drawn by the maker harness (test/maker-act.mjs) and the Counter kit (test/counter-b-kit.mjs). */
import { richOwnerPage, byAct, answerSheets } from "./maker-act.mjs";
import * as K from "./counter-b-kit.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
const at = (w) => (win) => { win.matchMedia = (q) => { let ok = true; for (const m of q.matchAll(/(min|max)-width:\s*([0-9.]+)px/g)) { if (m[1] === "min" && !(w >= +m[2])) ok = false; if (m[1] === "max" && !(w <= +m[2])) ok = false; }
  return { matches: ok, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; }; };

export async function run({ ok, pageWork }) {
  const open = async (width) => {
    const p = await richOwnerPage({ pageWork, ...(width ? { before: at(width) } : {}) });
    await p.work.quiet();
    p.order = async (id, part) => { byAct(p.d, "nav.orders").click(); await p.work.quiet(); byAct(p.d, "part.orders." + part).click(); await p.work.quiet();
      byAct(p.d, "order.open", id).click(); await p.work.quiet(); return p.d.querySelector('#makerReview [data-maker-card="' + id + '"]'); };
    return p;
  };
  /* V1 to V6, on a phone */
  {
    const p = await open(0), d = p.d;
    try {
      const card = await p.order("ord-p1", "todo");
      ok(!!card && shown(card) && card.getAttribute("data-in") === "orders.todo", "V1: an order opened from To do stands in view, in To do's part: " + (card && card.getAttribute("data-in")));
      const band = card.querySelector(":scope > .oband"), bill = card.querySelector(":scope > .obill");
      ok(!!band && band.matches(".salt-band.salt-band--grid.ohead") && !card.classList.contains("salt-glass-card") && !!bill
        && bill.querySelector(":scope > .salt-settings__head") && t(bill.querySelector(".salt-settings__head")) === "Bill" && bill.querySelector(":scope > .salt-settings.ordmoney")
        && bill.querySelector("[data-total]").classList.contains("salt-settings__row--total") && !card.querySelector(".salt-ledger"),
        "V2: his card is the shared band and the Bill as a settings list, no glass card around it and no ledger: " + t(bill));
      const agree = card.querySelector(".oagreesec"), rows = agree ? [...agree.querySelectorAll(".salt-settings > .salt-settings__row .salt-settings__label")].map(t) : [];
      const pills = [...card.querySelectorAll(".salt-pill")].filter((b) => !b.hidden);
      ok(!!agree && t(agree.querySelector(".salt-settings__head")) === "Agree" && J(rows) === J(["Goods, RM"]) && agree.querySelector(".salt-settings [data-act=\"order.total\"]")
        && pills.length === 1 && pills[0].getAttribute("data-act") === "order.accept", "V3: Agree's terms are rows of a settings list and the one filled pill is Agree: " + J([rows, pills.map(t)]));
      /* 5 Nov 2026 (the pane): the pinned foot (Agree) is the card's last child but not its end, so the end is read without it, as without the maker foot */
      const ctl = [...card.querySelectorAll("button,input,select,summary,a[href]")].filter((b) => !b.hidden && !b.closest("[hidden]") && !b.closest(".maker-foot") && !b.closest(".ofoot")).pop();
      const asked = []; answerSheets(p.w, asked, () => false);
      ok(!!ctl && ctl.getAttribute("data-act") === "order.decline" && ctl.matches(".salt-settings__row--action.salt-settings__row--danger") && ctl.parentElement.matches(".salt-settings.ordend")
        && ctl.parentElement.querySelectorAll("button:not([hidden])").length === 1, "V4: Decline the order is the card's last control, an ember row alone in its list: " + t(ctl));
      const before = p.posts.length; ctl.click(); await p.work.quiet();
      ok(asked.length === 1 && /Decline this order/.test(asked[0]) && p.posts.length === before, "V4: and it asks on the Sheet first, sending nothing on Keep: " + J(asked));
      const field = card.querySelector('.omsgs form.salt-composer [data-act="order.reply-text"]'), send = card.querySelector('.omsgs form.salt-composer [data-act="order.reply"]');
      const n0 = p.posts.length; send.click(); await p.work.quiet();
      const empty = p.posts.length === n0;
      field.value = "  On my way  "; send.click(); await p.work.quiet();
      const sent = p.posts.slice(n0).filter((x) => /\/move$/.test(x.route));
      ok(!!field && empty && sent.length === 1 && sent[0].route === "/all/maker/orders/ord-p1/move" && sent[0].body.message === "On my way" && typeof sent[0].body.rid === "string",
        "V5: his box stands in view and sends the line as the order's move with his message, an empty one nothing: " + J(sent.map((x) => x.body)));
    } finally { p.w.close(); }
  }
  {
    const p = await open(0), d = p.d;
    try {
      const card = await p.order("ord-p1", "todo");
      byAct(card, "order.customer", "ord-p1").click(); await p.work.quiet();
      const acct = d.querySelector("#aopen [data-acct]");
      ok(!!acct && acct.getAttribute("data-acct") === "abcd-efgh" && shown(acct), "V6: This customer opens their account on Customers: " + (acct && acct.getAttribute("data-acct")));
      /* V8: the open account */
      const pills = [...acct.querySelectorAll(".salt-pill")].filter((b) => !b.hidden);
      const end = acct.querySelector(":scope > .salt-settings.aend"), acts = end ? [...end.children].map((b) => b.getAttribute("data-act")) : [];
      ok(pills.length === 1 && pills[0].getAttribute("data-act") === "acct.signin-link" && J(acts) === J(["acct.password", "acct.signout-all"])
        && [...end.children].every((b) => b.matches(".salt-settings__row--danger")) /* 5 Nov 2026 (the pane): after the ends' list and its answer comes only the pinned foot, Send a sign-in link */
        && !!end && end.nextElementSibling.matches("p.anote") && end.nextElementSibling.nextElementSibling === acct.lastElementChild && acct.lastElementChild.matches(".salt-pane__foot.afoot"),
        "V8: the account holds one filled pill, Send a sign-in link, and Copy password and Sign out everywhere are ember rows in its last list: " + J([pills.map(t), acts]));
      const asked = []; let yes = false; answerSheets(p.w, asked, () => yes);
      const so = byAct(acct, "acct.signout-all"), n0 = p.posts.length;
      so.click(); await p.work.quiet();
      const kept = p.posts.slice(n0).filter((x) => x.route === "/all/signout").length;
      const ys = d.getElementById("ynSheet"); if (ys) ys.removeAttribute("data-answered"); yes = true;
      so.click(); await p.work.quiet();
      const went = p.posts.slice(n0).filter((x) => x.route === "/all/signout");
      ok(asked.length === 2 && /Sign out everywhere/.test(asked[0]) && kept === 0 && went.length === 1 && went[0].body.u === "abcd-efgh",
        "V8: Sign out everywhere asks on the Sheet and sends only on its yes: " + J([asked.length, kept, went.map((x) => x.body)]));
    } finally { p.w.close(); }
  }
  /* V7: wide */
  for (const w of [1180, 1440]) {
    const p = await open(w);
    try {
      const card = await p.order("ord-p1", "todo"), cols = card && card.querySelector(":scope > .ordcols");
      const sides = cols ? [...cols.children].map((c) => c.getAttribute("data-ocol")) : [];
      ok(!!cols && cols.matches(".ordcols--2") && J(sides) === J(["decision", "record"]) && !!cols.children[0].querySelector(".oband") && !!cols.children[0].querySelector(".oagreesec")
        && !!cols.children[1].querySelector(".obill") && !!cols.children[1].querySelector(".omsgs") && !!cols.children[1].querySelector(".ordend"),
        "V7: at " + w + "px two columns, the decision left and the record right: " + J(sides));
    } finally { p.w.close(); }
  }
  /* V2 and V9: the customer's card */
  {
    const AT = new Date(Date.now() - 3 * 3600e3).toISOString();
    const o = K.ord("cs-1", "acknowledged", AT, { qty: 2, total: 200 });
    const pageWorkC = (win) => { let n = 0; const f = win.fetch; win.fetch = function (...a) { n++; return Promise.resolve(f.apply(this, a)).finally(() => { n--; }); };
      return { quiet: async () => { for (let s = 0; s < 3; s = n ? 0 : s + 1) await new Promise((r) => setTimeout(r, 5)); } }; };
    const c = await K.open({ ok, pageWork: pageWorkC, orders: [o] });
    try {
      c.d.querySelector('[data-row="cs-1"]').click(); await c.settle();
      const scr = c.d.querySelector(".oscreen"), band = scr && scr.querySelector('.oband[data-part="head"]'), bill = scr && scr.querySelector('.obill[data-part="money"]');
      const last = bill && bill.querySelector(".ordmoney > .salt-settings__row:last-child");
      ok(!!scr && !scr.classList.contains("salt-glass-card") && !!band && band.matches(".salt-band.salt-band--grid") && !band.classList.contains("ohead")
        && !!bill && bill.querySelector(":scope > .salt-settings__head") && bill.querySelector(":scope > .salt-settings.ordmoney"),
        "V2: the customer's card draws the same band and Bill, with no card around it: " + t(bill));
      ok(!!last && last.matches(".salt-settings__row--total") && /RM 200\.00/.test(t(last.querySelector(".salt-settings__value"))) && last.querySelector(".salt-settings__value--due"),
        "V9: their still to pay closes the Bill, its figure in ember while owed: " + t(last));
    } finally { c.close(); }
  }
}
