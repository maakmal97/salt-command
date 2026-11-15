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
 * 15 NOV 2026, THE MOVE TO AMBIENT: the salt-ds frame and pane are gone, and his page is one Ambient shell: the shell the screen's height, never
 * scrolling; its screen the one box that scrolls; the dock (the rail from 960px) standing still over it; from 960px a split of panes
 * (amb-split--panes) holding the screen still while each stack scrolls by itself, its one main action an amb-foot. F1 to F4 and F6 are re-aimed at
 * that: Ambient's rules as carried, his shell wearing it, and nothing of the old frame left (paneFit, --salt-pane-h, --salt-frame-h, the foot's
 * place under 1080px, data-footed). The places' records keep their present markup (F2.2, F5, F7 to F10) until their builders draw the splits.
 * Every assertion is red under its own mutation (test/admin-frame.mutations.json). Every code and word is invented. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import { ownerCss } from "./admin-tablet.mjs";
import { JSDOM } from "jsdom";
import { AMB_CSS } from "../stmt/statement-css.js";

const J = JSON.stringify;
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
  /* F1: Ambient as carried */
  {
    const amb = AMB_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (sel) => (new RegExp("(^|[}\\s])" + sel.replace(/[.*+?^${}()|[\]\\>]/g, "\\$&") + " \\{([^}]*)\\}").exec(amb) || [, , ""])[2];
    ok(/height: 100dvh;/.test(rule(".amb-shell")) && /overflow: hidden;/.test(rule(".amb-shell")),
      "F1.1 his shell is the screen's height and never scrolls: " + rule(".amb-shell").replace(/\s+/g, " "));
    ok(/position: absolute;/.test(rule(".amb-screen")) && /overflow-y: auto;/.test(rule(".amb-screen")) && /position: absolute;/.test(rule(".amb-dock")),
      "F1.2 its screen is the one box that scrolls, and the dock (the rail from 960px) stands still over it");
    ok(/\.amb-screen:has\(> \.amb-split--panes\) \{ display: flex; flex-direction: column; overflow-y: hidden; \}/.test(amb) && /overflow-y: auto;/.test(rule(".amb-split--panes > .amb-stack")),
      "F1.3 from 960px a split of panes holds the screen still and each stack scrolls by itself: " + rule(".amb-split--panes > .amb-stack").replace(/\s+/g, " "));
    ok(/position: sticky;/.test(rule(".amb-foot")) && /background: linear-gradient\(to bottom, transparent, var\(--amb-base\)/.test(rule(".amb-foot")) && !/border|backdrop-filter/.test(rule(".amb-foot")),
      "F1.4 a record's foot is held at its foot over a fade of the ground, seamless: no box and no edge behind the pill");
    const { top: ptop } = ownerCss();
    ok(!ptop(".adm .athrow > .salt-ghost") && !ptop("#roster .amb-setting"), "F1.5 the page's own rule for a thread's Reply is gone, and none sizes an Ambient setting row");
  }
  /* F2, F3, F4: his shell wears it, and nothing of the old frame is left */
  {
    const { html, at, top } = ownerCss(), d = new JSDOM(html).window.document;
    const has = (s, c) => !!d.querySelector(s) && d.querySelector(s).classList.contains(c);
    ok(has("#roster", "amb-shell") && has("#roster", "amb-shell--rail") && has("#roster > main", "amb-screen") && has("#roster > main", "amb-screen--docked")
      && !d.querySelector("#roster.salt-frame, .salt-frame__main, .salt-frame__bar") && d.querySelector("#roster > .amb-dock > nav.amb-tabbar") !== null,
      "F2.1 his shell is Ambient's: its screen the one scroll box, docked, and its dock the places; no salt-ds frame");
    /* 16 Nov 2026, the move to Ambient (place F): Needs you's card (#nopen) is drawn in Ambient's split (the record's column #nrecord), so it no longer carries salt-pane */
    const panes = ["#aopen", "#makerReview", "#makerChatOpen", "#makerDayPane"].filter((s) => !has(s, "salt-pane"));
    ok(!panes.length && has("#nrecord", "amb-stack") && !!d.querySelector(".amb-split > #nrecord"), "F2.2 every record that opens beside a list keeps its place (an account, an order, a thread, Shop's open day) for its builder's split, and Needs you's card has its column in Ambient's split; not: " + J(panes));
    const css = html.replace(/<script[\s\S]*?<\/script>/g, "");
    ok(!/--salt-frame-h|salt-frame__main|\.gate\.adm/.test(css),
      "F3.1 nothing sizes a frame any more: no --salt-frame-h, no frame column, no .gate.adm");
    ok(!/--salt-pane-h/.test(html) && !/function paneFit|fitSoon/.test(html),
      "F3.2 no script measures a pane's height: paneFit and --salt-pane-h are gone, the split holding its panes by itself");
    const N = "(max-width:1079.98px)";
    ok(!at(N, ".gate.adm") && !/--salt-pane-foot-at/.test(css),
      "F4.1 nothing places a foot by hand: the foot rides the screen's foot over the dock by Ambient's own rule");
    ok(!/data-footed/.test(html) && !at(N, ".adm[data-footed] #oAdd"),
      "F4.2 the + never stands down for a foot: it is the app bar's circle, never the foot's");
  }
  /* F5, F6 on a phone (the page scrolls) */
  {
    let n = 12;
    const p = await richOwnerPage({ pageWork, threads: () => ({ ok: true, threads: [{ u: "tvwx-yz23", msgs: lines(n), quiet: null }] }) });
    try {
      const d = p.d; await p.work.quiet();
      /* 15 Nov 2026: his shell's screen is what scrolls */
      const box = scrollBox(d.querySelector("#roster > .amb-screen"), d, 400, 2000);
      enter(d, "customers", "messages"); await p.work.quiet(); await p.work.quiet();
      d.querySelector('#makerChatList [data-thread="tvwx-yz23"] a').click(); await p.work.quiet();
      const pane = d.getElementById("makerChatOpen"), kids = [...pane.children];
      const head = kids[0], foot = kids[kids.length - 1];
      ok(head.classList.contains("salt-pane__head") && !!head.querySelector('[data-act="chat.close"]') && kids[1].id === "makerChatLines"
        && foot.classList.contains("salt-pane__foot") && !!foot.querySelector('textarea[data-act="chat.reply"]') && !!foot.querySelector('[data-act="chat.send"].salt-pill')
        && !foot.querySelector('[data-act="chat.no-reply"]') && !!kids[kids.length - 2].querySelector('[data-act="chat.no-reply"]'),
        "F5 an open thread: its head with Close, its lines, then No reply needed, then the foot, last, his box and Send: " + J(kids.map((k) => k.className || k.id)));
      ok(box.at() === box.end() && box.end() > 0, "F6.1 on a phone a thread opens at its newest line (the screen scrolled to its end): " + J([box.at(), box.end()]));
      const poll = async () => { const f = p.intervals.filter((x) => x.ms === 2000 && !x.off).pop(); if (f) f.f(); await p.work.quiet(); await p.work.quiet(); };
      box.set(100); n = 13; await poll();
      ok(d.querySelectorAll("#makerChatLines > *").length === 13 && box.at() === 100, "F6.2 a line that lands while he has scrolled up to read leaves him where he is: " + box.at());
      box.set(box.end()); n = 14; await poll();
      ok(d.querySelectorAll("#makerChatLines > *").length === 14 && box.at() === box.end(), "F6.3 a line that lands while he reads the newest keeps him at the newest: " + J([box.at(), box.end()]));
    } finally { p.w.close(); }
  }
  /* F6 from 1180px: until its builder's split makes the thread's pane scroll by itself, the screen is the scroll, and the window never moves */
  {
    const p = await richOwnerPage({ pageWork, before: width(1180), threads: () => ({ ok: true, threads: [{ u: "tvwx-yz23", msgs: lines(12), quiet: null }] }) });
    try {
      const d = p.d; await p.work.quiet();
      const page = scrollBox(d.documentElement, d, 400), box = scrollBox(d.querySelector("#roster > .amb-screen"), d, 300);
      enter(d, "customers", "messages"); await p.work.quiet(); await p.work.quiet();
      d.querySelector('#makerChatList [data-thread="tvwx-yz23"] a').click(); await p.work.quiet();
      ok(box.at() === box.end() && box.end() > 0 && page.at() === 0, "F6.4 from 1180px a thread opens at its newest line in his screen, the window unmoved: " + J([box.at(), box.end(), page.at()]));
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
      const go = d.querySelector("#nrecord > .npane__go");
      ok(!!of2 && of2.classList.contains("salt-pane__foot") && !!of2.querySelector(".salt-pill") && !!go && go.classList.contains("amb-foot") && go.parentElement.lastElementChild === go,
        "F10.2 Needs you's open card: an order's stage pill is its card's foot, and a card with ways of its own has them as its foot, last: " + J([!!of2, mine, go && go.className]));
    } finally { p.w.close(); }
  }
}
