/* test/desk-frame.mjs: SALT DESK IN LAYERS (5 Nov 2026, his word "like Mail or Messages on a Mac", Salt Admin first in v1442, his answer D: the
 * Desk takes the same frame from the recipe). From 1080px the rail and the bar never move and #deskcol, the column under the bar, is the one box
 * that scrolls, so the page itself never does; under 1080px both are plain blocks and the page scrolls as before. The Desk's bar sits right of the
 * rail, over the column alone (his word of 21 Oct 2026), so it wears the recipe's side form, salt-frame--side (salt-ds 1.29.0).
 * jsdom lays nothing out, so the geometry is proved as the master's rules and markup, and the scroll as boxes given a scroll position. The measured
 * page (page scrolls 0px from 1080px, the rail and bar unmoved while the column scrolls, at 390, 1180x820, 1440x900 and 1920x1032) is the
 * Chromium probe's, in the version's notes.
 *   D1  the recipe as carried: the side form keeps the rail the frame's full height, its column the bar over the one scroll box; a frame's bar never sticks
 *   D2  the Desk's shell wears it: the shell the frame, main its column, the bar first in it, then #deskcol holding every page
 *   D3  from 1080px the frame is the screen less the page's 22px top and a 24px foot, so the page never scrolls; nothing of it under 1080px
 *   D4  Back to top reads whichever box scrolls (the column in the frame, the page under it), and the bar's cap reads the page alone
 *   D5  a tab opens at the column's top
 * Every assertion is red under its own mutation (test/desk-frame.mutations.json). */
import { openMaster } from "../tools/payload.mjs";

const J = JSON.stringify;
/* the master's rules, by query (spaces out) and selector (spaces after commas out, one space either side of a child combinator) */
function rules(doc) {
  const sel = (r) => r.selectorText.replace(/\s*,\s*/g, ",").replace(/\s*>\s*/g, " > ");
  const all = [...doc.styleSheets].flatMap((s) => [...s.cssRules]);
  const media = all.filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].filter((x) => x.selectorText) }));
  const at = (q, s) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => sel(r) === s).map((r) => r.style.cssText).join(" ");
  const top = (s) => all.filter((r) => r.selectorText && sel(r) === s).map((r) => r.style.cssText).join(" ");
  const anywhere = (re) => media.filter((m) => m.rules.some((r) => re.test(r.selectorText))).map((m) => m.q);
  return { at, top, anywhere };
}
/* a scroll box of its own: a scrollTop held to its range, and scrollTo recorded */
function scrollBox(node, room) {
  let top = 0; const to = [];
  Object.defineProperty(node, "scrollTop", { configurable: true, get: () => top, set: (v) => { top = Math.max(0, Math.min(+v || 0, room)); } });
  node.scrollTo = (o) => { to.push(o); top = 0; };
  return { to };
}

export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const d = w.document, { at, top, anywhere } = rules(d), Q = "(min-width:1080px)";
    /* D1 */
    const side = at(Q, ".salt-frame--side"), rail = at(Q, ".salt-frame--side > .salt-rail"), col = at(Q, ".salt-frame__col");
    ok(/grid-template-rows: minmax\(0,\s*1fr\)/.test(side) && /grid-row: 1/.test(rail),
      "D1.1 the side form is one row, the rail its full height beside the column, never under a bar's row: " + J([side, rail]));
    ok(/grid-column: 2/.test(col) && /align-self: stretch/.test(col) && /display: flex/.test(col) && /flex-direction: column/.test(col) && /min-height: 0/.test(col),
      "D1.2 the column right of the rail is a flex column the frame's height: " + col);
    ok(/flex: (none|0 0 auto)/.test(at(Q, ".salt-frame__col > .salt-frame__bar")) && /flex: 1 1 auto/.test(at(Q, ".salt-frame__col > .salt-frame__main")),
      "D1.3 in the column the bar keeps its height and the scroll box takes the rest: " + J([at(Q, ".salt-frame__col > .salt-frame__bar"), at(Q, ".salt-frame__col > .salt-frame__main")]));
    const bar = at(Q, ".salt-frame .salt-frame__bar");
    ok(/position: relative/.test(bar) && /top: auto/.test(bar),
      "D1.4 a frame's bar never sticks: the frame is a scroll container, and a sticky bar's top would push it down over the column: " + bar);
    /* D2 */
    const shell = d.querySelector(".wrap > .shell"), main = shell && shell.querySelector(":scope > main"), dbar = d.getElementById("deskbar"), box = d.getElementById("deskcol");
    ok(!!shell && shell.classList.contains("salt-frame") && shell.classList.contains("salt-frame--side") && !!shell.querySelector(":scope > nav.salt-rail#tabs"),
      "D2.1 the Desk's shell is the frame in its side form, the rail its child");
    ok(!!main && main.classList.contains("salt-frame__col") && !!dbar && dbar.parentElement === main && main.firstElementChild === dbar && dbar.classList.contains("salt-frame__bar"),
      "D2.2 main is the frame's column, the bar its first child and the frame's bar");
    const secs = [...d.querySelectorAll(".sec")];
    ok(!!box && box.parentElement === main && box.previousElementSibling === dbar && box.classList.contains("salt-frame__main")
      && secs.length === 6 && secs.every((s) => s.parentElement === box),
      "D2.3 under the bar #deskcol is the frame's one scroll box, holding every page: " + J(secs.map((s) => s.parentElement && s.parentElement.id)));
    /* D3 */
    const pad = top(".wrap"), framed = at(Q, ".shell"), wrapQ = at(Q, ".wrap");
    const topPad = /padding: (\d+)px/.exec(pad), h = /--salt-frame-h: calc\(100dvh - (\d+)px\)/.exec(framed), foot = /padding-bottom: (\d+)px/.exec(wrapQ);
    ok(!!topPad && !!h && !!foot && +topPad[1] + +foot[1] === +h[1] && +foot[1] === 24,
      "D3.1 from 1080px the frame is the screen less the page's top and its 24px foot, so the page is the screen tall: " + J({ pad, framed, wrapQ }));
    ok(/max-height: none/.test(at(Q, ".shell > .rail")), "D3.2 the rail is the frame's height, not its own older screen less 44px: " + at(Q, ".shell > .rail"));
    const where = anywhere(/salt-frame__col|salt-frame--side|salt-frame__bar|--salt-frame-h/);
    ok(where.length > 0 && where.every((q) => q === Q) && !/--salt-frame-h/.test(top(".shell")),
      "D3.3 nothing of the frame binds under 1080px, so a phone and a tablet scroll the page as before: " + J(where));
    /* D4 */
    const orb = d.getElementById("totop"), lit = () => orb.classList.contains("on"), stuck = () => d.body.classList.contains("dbstuck");
    const colBox = scrollBox(box, 4000), winTo = []; w.scrollTo = (o) => { winTo.push(o); };
    let pageY = 0; Object.defineProperty(w, "pageYOffset", { configurable: true, get: () => pageY });
    box.style.overflowY = "auto";
    box.scrollTop = 1500; box.dispatchEvent(new w.Event("scroll"));
    ok(lit(), "D4.1 in the frame, Back to top lights from the column's scroll, the page never moving");
    ok(!stuck(), "D4.2 and the bar casts no cap: in the frame it is outside what scrolls");
    orb.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    ok(colBox.to.length === 1 && colBox.to[0].top === 0 && !winTo.length,
      "D4.3 its tap takes the column to its top, not the page: " + J({ col: colBox.to, page: winTo }));
    box.style.overflowY = ""; box.scrollTop = 0; box.dispatchEvent(new w.Event("scroll"));
    pageY = 1500; w.dispatchEvent(new w.Event("scroll"));
    ok(lit() && stuck(), "D4.4 under 1080px the page is what scrolls: Back to top and the bar's cap read it as before");
    orb.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    ok(winTo.length === 1 && colBox.to.length === 1, "D4.5 and its tap takes the page to its top: " + J({ col: colBox.to.length, page: winTo }));
    pageY = 0; w.dispatchEvent(new w.Event("scroll"));
    /* D5 */
    box.style.overflowY = "auto"; box.scrollTop = 900;
    w.eval("switchTab('money')");
    ok(box.scrollTop === 0, "D5.1 a tab opens at the column's top, not where the last one was left: " + box.scrollTop);
  } finally { try { w.close(); } catch (e) { } }
}
