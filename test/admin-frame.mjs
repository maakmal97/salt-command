/* test/admin-frame.mjs: SALT ADMIN IN LAYERS (5 Nov 2026, his word: "like Mail or Messages on a Mac"; his four answers, all as recommended).
 * Level 0, the bar and the rail, never moves; level 1, a place's list, scrolls in the column right of the rail; level 2, an open record, scrolls
 * inside itself with its ONE main action in a foot pinned at its foot; a thread opens at its newest line. salt-ds 1.28.0 holds the frame and the pane.
 * jsdom lays nothing out, so the geometry is proved as the stylesheet's rules (the way test/admin-tablet.mjs reads them) and as the markup each record
 * draws, and the thread's place by giving its scroll box a height. The measured page (page scrolls 0px from 1080px, the rail and bar unmoved, every
 * main action and the newest line in view on open, at 390, 1180x820, 1440x900 and 1920x1032) is the Chromium probe's, in the version's notes.
 *   F1  the recipe as carried: from 1080px the frame a grid the screen tall that never scrolls, its column the one scroll box, the rail static in it,
 *       a pane sticky at the column's top up to --salt-pane-h; the pane's foot sticky at --salt-pane-foot-at; a control in a settings row keeps its width
 *   F2  his shell wears it: the frame, its bar and its column, and every record that opens beside a list a pane
 *   F3  from 1080px the frame is the screen less the body's top, nothing under it, the page itself never scrolls, a pane holds to the column's top
 *   F4  under 1080px a foot rides the screen's foot over the bar of places (the panes that scroll inside themselves at 860 to 1080, the pane's foot),
 *       the + orb stands down while a foot shows, and the head scrolls with the page under the sticky bar
 *   F5  an open thread: its head (the code, what they owe, Close), its lines, then what else he may do, then the foot, last, his box and Send
 *   F6  a thread opens at its newest line; a line that lands while he reads the newest keeps him there, one that lands while he has scrolled up
 *       leaves him where he is; on a phone the page is the scroll, in the frame the pane
 *   F7  an account: Send a sign-in link and its answer are the card's foot, last; Copy password and Sign out everywhere stay in the ends' list
 *   F8  an order: the stage's pill is the card's foot, last, outside the two columns; Decline the order stays in the ends
 *   F9  a Record form: its one pill (and Discard) are its foot, a child of the form; Other fields and Cancel stay rows
 *   F10 Shop: Set the notice, Save the points and Set it are feet; Needs you's open card's ways are its foot
 * Every assertion is red under its own mutation (test/admin-frame.mutations.json). Every code and word is invented. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import { ownerCss } from "./admin-tablet.mjs";
import { JSDOM } from "jsdom";
import { SITE_RECIPES } from "../stmt/statement-css.js";

const J = JSON.stringify;
/* the carried recipes, read as rules by query (spaces out) and selector, as ownerCss reads the page's own */
function recipeCss() {
  const sheet = new JSDOM("<style>" + SITE_RECIPES + "</style>").window.document.styleSheets[0];
  const sel = (r) => r.selectorText.replace(/\s*,\s*/g, ",");
  const media = [...sheet.cssRules].filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].map((x) => ({ sel: sel(x), css: x.style.cssText })) }));
  const at = (q, s) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => r.sel === s).map((r) => r.css).join(" ");
  const top = (s) => [...sheet.cssRules].filter((r) => r.selectorText && sel(r) === s).map((r) => r.style.cssText).join(" ");
  return { at, top };
}
/* a window that answers matchMedia as a screen of this width would */
const width = (px) => (w) => { w.matchMedia = (mq) => ({ matches: [...String(mq).matchAll(/(min|max)-width:\s*([0-9.]+)px/g)].every((m) => (m[1] === "min" ? px >= +m[2] : px <= +m[2])),
  media: mq, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); };
/* a scroll box of its own: a fixed clientHeight, a scrollHeight of 100px a line of the thread over what else it holds (base: a phone's page holds the list above
   the thread too), a scrollTop held to its range as a browser holds it */
function scrollBox(node, d, client, base = 200) {
  let top = 0;
  const height = () => 100 * d.querySelectorAll("#makerChatLines > *").length + base;
  Object.defineProperty(node, "clientHeight", { configurable: true, get: () => client });
  Object.defineProperty(node, "scrollHeight", { configurable: true, get: height });
  Object.defineProperty(node, "scrollTop", { configurable: true, get: () => top, set: (v) => { top = Math.max(0, Math.min(+v || 0, height() - client)); } });
  return { at: () => top, end: () => height() - client, set: (v) => { node.scrollTop = v; } };
}
const lines = (n) => Array.from({ length: n }, (_, i) => ({ by: i % 2 ? "desk" : "customer", at: new Date(Date.UTC(2026, 9, 1, 8, i)).toISOString(), text: "Line " + (i + 1) }));

export async function run({ ok, pageWork }) {
  /* F1 */
  {
    const { at, top } = recipeCss(), Q = "(min-width:1080px)";
    const frame = at(Q, ".salt-frame"), main = at(Q, ".salt-frame__main"), rail = at(Q, ".salt-frame > .salt-rail"), pane = at(Q, ".salt-frame__main .salt-pane"), foot = top(".salt-pane__foot");
    ok(/display: grid/.test(frame) && /grid-template-rows: auto minmax\(0,\s*1fr\)/.test(frame) && /height: var\(--salt-frame-h,\s*100dvh\)/.test(frame) && /overflow: hidden/.test(frame),
      "F1.1 from 1080px the frame is a grid the screen tall that never scrolls, the bar's row over the rail and the column: " + frame);
    ok(/overflow-y: auto/.test(main) && /min-height: 0/.test(main) && /align-self: stretch/.test(main) && /position: static/.test(rail) && /align-self: stretch/.test(rail),
      "F1.2 the column right of the rail is the one box that scrolls, and the rail stands still beside it, the row's height: " + J([main, rail]));
    ok(/position: sticky/.test(pane) && /top: 0/.test(pane) && /max-height: var\(--salt-pane-h/.test(pane) && /overflow-y: auto/.test(pane),
      "F1.3 a pane holds to the column's top and scrolls inside itself, up to the height the page gives it: " + pane);
    ok(/position: sticky/.test(foot) && /bottom: var\(--salt-pane-foot-at,\s*0px\)/.test(foot) && /margin-top: auto/.test(foot) && /background: var\(--salt-veil\)/.test(foot),
      "F1.4 a pane's foot is held at its foot (or the screen's, a set distance above it), veiled so nothing reads through: " + foot);
    const keep = top(".salt-settings__row > .salt-ghost,.salt-settings__row > .salt-switch,.salt-settings__row > .salt-orb,.salt-settings__row > .salt-status");
    const { top: ptop } = ownerCss();
    ok(/flex: (none|0 0 auto)/.test(keep) && !ptop(".adm .athrow > .salt-ghost"), "F1.5 a control in a settings row keeps its own width, from the recipe, and the page's own rule for a thread's Reply is gone: " + keep);
  }
  /* F2, F3, F4 */
  {
    const { html, at, top } = ownerCss(), d = new JSDOM(html).window.document;
    const has = (s, c) => !!d.querySelector(s) && d.querySelector(s).classList.contains(c);
    ok(has("#roster", "salt-frame") && has("#roster > header.abar", "salt-frame__bar") && has("#roster .amain", "salt-frame__main")
      && d.querySelector("#roster .amain").parentElement.id === "roster",
      "F2.1 his shell is the frame: the bar its bar, the column right of the rail its one scroll box");
    const panes = ["#nopen", "#aopen", "#makerReview", "#makerChatOpen", "#makerDayPane"].filter((s) => !has(s, "salt-pane"));
    ok(!panes.length, "F2.2 every record that opens beside a list is a pane (Needs you's card, an account, an order, a thread, Shop's open day); not: " + J(panes));
    const Q = "(min-width:1080px)", gate = at(Q, ".gate.adm"), held = at(Q, ".adm .salt-frame__main .salt-pane");
    ok(/--salt-frame-h: calc\(100dvh - 46px\)/.test(gate) && /padding-bottom: 0/.test(gate) && /margin-bottom: -36px/.test(gate) && /padding-bottom: 24px/.test(at(Q, ".adm .amain")),
      "F3.1 from 1080px the frame is the screen less the body's 22px top and a 24px margin, taking back 36px of the body's 60px foot, so the page is the screen tall and never scrolls; the column keeps 24px under its last line: " + gate);
    ok(/top: 0/.test(held) && !/position: sticky/.test(at("(min-width:860px)", ".adm #nopen,.adm #aopen")) && !/position: sticky/.test(at("(min-width:860px)", ".adm .recpane"))
      && !at(Q, ".adm #makerChatOpen"),
      "F3.2 a pane holds to the column's very top; the 24px sticky panes of 860px stand only to 1080px: " + J([held, at("(min-width:860px)", ".adm #nopen,.adm #aopen")]));
    const N = "(max-width:1079.98px)", T = "(min-width:860px)and(max-width:1079.98px)";
    ok(/--salt-pane-foot-at: calc\(var\(--salt-bar-h\)/.test(at(N, ".gate.adm")) && /--salt-pane-foot-at: 0px/.test(at(T, ".adm #nopen,.adm #aopen,.adm #makerReview,.adm .recpane"))
      && /position: sticky/.test(at(T, ".adm #nopen,.adm #aopen")) && /position: sticky/.test(at(T, ".adm .recpane")),
      "F4.1 under 1080px a foot rides the screen's foot over the bar of places, and in a pane that scrolls inside itself (860 to 1080px) the pane's own foot: " + at(N, ".gate.adm"));
    ok(/display: none/.test(at(N, ".adm[data-footed] #oAdd")) && /position: static/.test(at(N, ".adm .salt-pane__head")),
      "F4.2 under 1080px the + orb stands down while a foot shows, and a pane's head scrolls with the page under the sticky bar");
  }
  /* F5, F6 on a phone (the page scrolls) */
  {
    let n = 12;
    const p = await richOwnerPage({ pageWork, threads: () => ({ ok: true, threads: [{ u: "tvwx-yz23", msgs: lines(n), quiet: null }] }) });
    try {
      const d = p.d; await p.work.quiet();
      const box = scrollBox(d.documentElement, d, 400, 2000);
      enter(d, "customers", "messages"); await p.work.quiet(); await p.work.quiet();
      d.querySelector('#makerChatList [data-thread="tvwx-yz23"] a').click(); await p.work.quiet();
      const pane = d.getElementById("makerChatOpen"), kids = [...pane.children];
      const head = kids[0], foot = kids[kids.length - 1];
      ok(head.classList.contains("salt-pane__head") && !!head.querySelector('[data-act="chat.close"]') && kids[1].id === "makerChatLines"
        && foot.classList.contains("salt-pane__foot") && !!foot.querySelector('textarea[data-act="chat.reply"]') && !!foot.querySelector('[data-act="chat.send"].salt-pill')
        && !foot.querySelector('[data-act="chat.no-reply"]') && !!kids[kids.length - 2].querySelector('[data-act="chat.no-reply"]'),
        "F5 an open thread: its head with Close, its lines, then No reply needed, then the foot, last, his box and Send: " + J(kids.map((k) => k.className || k.id)));
      ok(box.at() === box.end() && box.end() > 0, "F6.1 on a phone a thread opens at its newest line (the page scrolled to its end): " + J([box.at(), box.end()]));
      const poll = async () => { const f = p.intervals.filter((x) => x.ms === 2000 && !x.off).pop(); if (f) f.f(); await p.work.quiet(); await p.work.quiet(); };
      box.set(100); n = 13; await poll();
      ok(d.querySelectorAll("#makerChatLines > *").length === 13 && box.at() === 100, "F6.2 a line that lands while he has scrolled up to read leaves him where he is: " + box.at());
      box.set(box.end()); n = 14; await poll();
      ok(d.querySelectorAll("#makerChatLines > *").length === 14 && box.at() === box.end(), "F6.3 a line that lands while he reads the newest keeps him at the newest: " + J([box.at(), box.end()]));
    } finally { p.w.close(); }
  }
  /* F6 in the frame: the pane is the scroll, the page never moves */
  {
    const p = await richOwnerPage({ pageWork, before: width(1180), threads: () => ({ ok: true, threads: [{ u: "tvwx-yz23", msgs: lines(12), quiet: null }] }) });
    try {
      const d = p.d; await p.work.quiet();
      const page = scrollBox(d.documentElement, d, 400), box = scrollBox(d.getElementById("makerChatOpen"), d, 300);
      enter(d, "customers", "messages"); await p.work.quiet(); await p.work.quiet();
      d.querySelector('#makerChatList [data-thread="tvwx-yz23"] a').click(); await p.work.quiet();
      ok(box.at() === box.end() && box.end() > 0 && page.at() === 0, "F6.4 from 1080px a thread opens at its newest line inside its pane, the page unmoved: " + J([box.at(), box.end(), page.at()]));
    } finally { p.w.close(); }
  }
  /* F7 to F10 */
  {
    const p = await richOwnerPage({ pageWork, before: width(1180) });
    try {
      const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); await p.work.quiet(); };
      await p.work.quiet();
      enter(d, "customers", "accounts"); await p.work.quiet();
      await click(d.querySelector('#rlist [data-act="acct.open"]'));
      const card = d.querySelector("#aopen > *:not([data-back])"), afoot = card && card.lastElementChild;
      ok(!!afoot && afoot.classList.contains("salt-pane__foot") && !!afoot.querySelector('[data-act="acct.signin-link"].salt-pill') && !!afoot.querySelector('[role="status"]')
        && !afoot.querySelector('[data-act="acct.signout-all"]') && !!card.querySelector('.aend [data-act="acct.signout-all"]'),
        "F7 an account's Send a sign-in link and its answer are the card's foot, last; Sign out everywhere stays in the ends: " + (afoot ? afoot.className : "no card"));
      enter(d, "orders", "todo"); await p.work.quiet();
      await click(d.querySelector('#makerOrderList [data-act="order.open"]'));
      const oc = d.querySelector("#makerReview > .maker-card"), of = oc && oc.lastElementChild;
      ok(!!of && of.classList.contains("salt-pane__foot") && !!of.querySelector(".ordlead > .salt-pill") && !of.closest(".ordcols")
        && !!oc.querySelector(".ordcols--2") && !of.querySelector('[data-act="order.decline"]') && !!oc.querySelector('.ordend [data-act="order.decline"]'),
        "F8 an order's stage pill is the card's foot, last and outside the two columns; Decline the order stays in the ends: " + (of ? of.className + " " + of.textContent.slice(0, 40) : "no card"));
      enter(d, "record", "entry"); await p.work.quiet();
      await click(byAct(d, "record.form", "sale-or-purchase"));
      const send = byAct(d, "record.trade.send"), mf = send && send.parentElement;
      ok(!!mf && mf.classList.contains("salt-pane__foot") && mf.parentElement.matches("section.maker-input") && mf.parentElement.closest(".recpane.salt-pane") !== null,
        "F9.1 a Record form's one pill is its foot, a child of the form, in the pane: " + (mf ? mf.className : "none"));
      const loan = byAct(d, "record.loan.send");
      ok(!!loan && loan.parentElement.classList.contains("salt-pane__foot") && [...d.querySelectorAll(".mfoot .salt-ghost:not([hidden])")].length === 0,
        "F9.2 every form's pill is its foot (the loan's too), and no ghost but a half-sent Discard stands in a foot");
      enter(d, "shop", "notice"); await p.work.quiet();
      const set = byAct(d, "notice.set");
      enter(d, "shop", "hours"); await p.work.quiet();
      const save = byAct(d, "points.save");
      ok(!!set && set.parentElement.classList.contains("salt-pane__foot") && !!save && save.parentElement.classList.contains("salt-pane__foot"),
        "F10.1 Shop's Set the notice and Save the points are feet: " + J([set && set.parentElement.className, save && save.parentElement.className]));
      enter(d, "needs"); await p.work.quiet();
      /* an order's open card draws no ways of its own: the order's card under it carries them, its stage pill in its foot */
      await click(d.querySelector("#nlist [data-need=\"o:ord-p1\"] .need-tap"));
      const of2 = d.querySelector("#nopen .maker-card > .ofoot");
      const keys = [...d.querySelectorAll("#nlist [data-need]")].map((x) => x.getAttribute("data-need")), mine = keys.filter((k) => !/^[op]:/.test(k))[0];
      if (mine) await click(d.querySelector('#nlist [data-need="' + mine + '"] .need-tap'));
      const go = d.querySelector("#nopen .npane__go");
      ok(!!of2 && of2.classList.contains("salt-pane__foot") && !!of2.querySelector(".salt-pill") && !!go && go.classList.contains("salt-pane__foot") && go.parentElement.lastElementChild === go,
        "F10.2 Needs you's open card: an order's stage pill is its card's foot, and a card with ways of its own has them as its foot, last: " + J([!!of2, mine, go && go.className]));
    } finally { p.w.close(); }
  }
}
