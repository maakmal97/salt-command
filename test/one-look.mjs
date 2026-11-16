/* test/one-look.mjs: ONE LOOK ON EVERY SALT SURFACE (16 Nov 2026, his word: "consistent across all apps", "layering, scrolling, visual", and
 * his four answers: slide under the bar, the bar beside the rail on Salt Admin, the lighter shadow everywhere, the bar of places on the Desk).
 * His report: no space between cards and a black shadow behind them on the Desk and Salt Admin, never on the Counter. Measured: on the Desk's
 * To do the book table and its Cover chart touched (0px), every pane inside a pane and every tile cast the 40px drop shadow, which showed through
 * the glass under it; in the two frames what scrolled was cut at a line under the bar and a pane's shadow cut flat at the column's sides.
 * jsdom lays nothing out, so the rules are proved as each surface's served stylesheets and markup, and two behaviours (the bar of places, the cap)
 * by driving the page. The measured pages (the bar and the rail at one place on all three at 1180, 1440 and 1920, 16px down on a phone; panes 14px
 * apart; one drop shadow on a page's own panes, none inside one) are the Chromium probe's, in the version's notes.
 *   O1  the recipe: a glass card casts the lighter desk shadow, a card inside a card none
 *   O2  the recipe's side frame: the bar laid over the column's one cell, the column one bar and a gap down, room for a shadow at each side, drawn
 *       from the bar's middle, running to the frame's foot with the rail --salt-frame-foot above it
 *   O3  the Desk: panes one under another 14px apart (not inside a grid that spaces them); a tile, and a pane inside a pane, no drop shadow; the
 *       Counter's 16px padding; a phone's 16px gutter and bar
 *   O4  the Desk: the frame to the screen's foot; under 1080px the rail floats from the orb at every pointer
 *   O5  the Desk: the six places a bar at the foot under 1080px, in the rail's order, the place showing marked, a tap the rail's road, its counts
 *   O6  Salt Admin: the side frame (the rail full height, the bar over the column right of it), to the screen's foot at the page's edge
 *   O7  Salt Admin and the Counter: once the page has moved, the bar casts the Desk's cap
 *   O8  the Counter: its rail 20px from its column, as the Desk's and Salt Admin's
 * Every assertion is red under its own mutation (test/one-look.mutations.json). */
import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { openMaster } from "../tools/payload.mjs";
import { landingPage } from "../stmt/page.js";
import { SITE_RECIPES } from "../stmt/statement-css.js";

const J = JSON.stringify;
const sel = (r) => r.selectorText.replace(/\s*,\s*/g, ",").replace(/\s*>\s*/g, " > ").replace(/\s*\+\s*/g, " + ").replace(/\s+/g, " ").trim();
function rulesOf(sheets) {
  const all = [...sheets].flatMap((s) => [...s.cssRules]);
  const media = all.filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].filter((x) => x.selectorText) }));
  const at = (q, s) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => sel(r) === s).map((r) => r.style.cssText).join(" ");
  const top = (s) => all.filter((r) => r.selectorText && sel(r) === s).map((r) => r.style.cssText).join(" ");
  return { at, top };
}
const sheetsOf = (html) => new JSDOM("<!doctype html><html><head>" + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => "<style>" + m[1] + "</style>").join("") + "</head></html>",
  { virtualConsole: new VirtualConsole() }).window.document.styleSheets;

export async function run({ ok }) {
  const Q = "(min-width:1080px)", U = "(max-width:1079.98px)";
  /* O1, O2: the recipes as carried to the Counter and Salt Admin (the Desk carries the same file, design/salt-ds.css) */
  {
    const { at, top } = rulesOf(new JSDOM("<style>" + SITE_RECIPES + "</style>").window.document.styleSheets);
    const card = top(".salt-glass-card"), inner = top(".salt-glass-card .salt-glass-card");
    ok(/box-shadow: var\(--salt-shadow-desk\)/.test(card) && !/var\(--salt-shadow\)/.test(card), "O1.1 a glass card casts the lighter desk shadow on every surface: " + card.slice(0, 200));
    ok(/box-shadow: inset 0(px)? 1px 0(px)? var\(--salt-highlight\)/.test(inner) && !/--salt-shadow/.test(inner), "O1.2 a card inside a card casts no drop shadow, its highlight alone: " + inner);
    const col = at(Q, ".salt-frame__col"), bar = at(Q, ".salt-frame__col > .salt-frame__bar"), main = at(Q, ".salt-frame__col > .salt-frame__main"),
      pane = at(Q, ".salt-frame__col > .salt-frame__main .salt-pane"), rail = at(Q, ".salt-frame--side > .salt-rail");
    ok(/display: grid/.test(col) && /grid-area: 1 \/ 1/.test(bar) && /grid-area: 1 \/ 1/.test(main) && /z-index: 3/.test(bar) && /align-self: start/.test(bar),
      "O2.1 the side frame's bar lies over the column's one cell, above what scrolls: " + J([col, bar]));
    ok(/padding: calc\(var\(--salt-frame-bar-h, 64px\) \+ var\(--salt-frame-gap, 20px\)\) var\(--salt-frame-room, 20px\) calc\(var\(--salt-frame-room, 20px\) \+ var\(--salt-frame-foot, 24px\)\)/.test(main)
      && /margin: 0(px)? calc\(-1 \* var\(--salt-frame-room, 20px\)\)/.test(main),
      "O2.2 the column opens one bar and a gap down and reaches past its sides and over its foot, so no shadow is cut flat: " + main);
    ok(/clip-path: inset\(calc\(var\(--salt-frame-bar-h, 64px\) \/ 2\) 0(px)? 0(px)? 0(px)?\)/.test(main), "O2.3 what slides under the bar is drawn from its middle down, nothing at its rounded corners: " + main);
    ok(/top: calc\(var\(--salt-frame-bar-h, 64px\) \+ var\(--salt-frame-gap, 20px\)\)/.test(pane) && /margin-bottom: var\(--salt-frame-foot, 24px\)/.test(rail),
      "O2.4 a pane holds under the bar, and the rail stands its foot above the screen's: " + J([pane, rail]));
  }
  /* O3, O4, O5: the Desk */
  const { w } = await openMaster();
  try {
    const d = w.document, { at, top } = rulesOf(d.styleSheets);
    const STACK = ":is(.card,.chartbox,.quotecard,.pend,.ledsum,.updbox) + :is(.card,.chartbox,.quotecard,.pend,.ledsum,.updbox)";
    ok(/margin-top: 14px/.test(top(STACK)) && /margin-top: 0(px)?/.test(top(":is(.two,.kpis) > :is(.card,.chartbox,.quotecard,.pend)")),
      "O3.1 the Desk's panes one under another stand 14px apart, as the Counter's, and a grid's own gap is left alone: " + J([top(STACK), top(":is(.two,.kpis) > :is(.card,.chartbox,.quotecard,.pend)")]));
    const flat = (s) => d.styleSheets && [...d.styleSheets].flatMap((x) => [...x.cssRules]).filter((r) => r.selectorText && sel(r).split(",").map((x) => x.trim()).includes(s) && !r.media).map((r) => r.style.cssText).pop() || "";
    const tile = flat(".kpi"), nested = [...d.styleSheets].flatMap((x) => [...x.cssRules]).filter((r) => r.selectorText && /\) :is\(\.kpi,\.card/.test(sel(r))).map((r) => r.style.cssText).pop() || "";
    ok(/^box-shadow: inset 0(px)? 1px 0(px)? var\(--salt-highlight\);?$/.test(tile) && /^box-shadow: inset 0(px)? 1px 0(px)? var\(--salt-highlight\);?$/.test(nested),
      "O3.2 a tile, and a pane inside a pane, cast no drop shadow on the Desk, as on Salt Admin and the Counter: " + J([tile, nested]));
    ok(/padding: 16px 18px/.test(top(".card,.pend,.quotecard")) && /padding: 16px/.test(at("(max-width:860px)", ".card,.pend,.quotecard"))
      /* jsdom drops a max() declaration, so the phone's gutter is read off the rule as the page serves it */
      && /@media\(max-width:560px\)\{\s*\.wrap\{padding-top:calc\(16px \+ var\(--safetop\)\);padding-left:max\(16px,var\(--safeleft\)\);padding-right:max\(16px,var\(--saferight\)\);\}/.test([...d.querySelectorAll("style")].map((x) => x.textContent).join("")) && /--dbtop: 16px/.test(at("(max-width:560px)", ":root")),
      "O3.3 the Counter's 16px: a card's padding, a phone's gutter and its bar's top: " + J([top(".card,.pend,.quotecard"), at("(max-width:560px)", ".wrap"), at("(max-width:560px)", ":root")]));
    ok(/--salt-frame-h: calc\(100dvh - 22px\)/.test(at(Q, ".shell")) && /padding-bottom: 0(px)?/.test(at(Q, ".wrap")),
      "O4.1 the Desk's frame runs to the screen's foot: " + J([at(Q, ".shell"), at(Q, ".wrap")]));
    ok(/position: fixed/.test(at(U, ".shell > .rail.salt-rail")) && /display: grid/.test(at(U, ".navbtn,.navbtn.salt-orb")) && !/pointer/.test(d.documentElement.outerHTML.match(/@media[^{]*\{\s*\.navbtn,\.navbtn\.salt-orb\{display:grid;\}/)?.[0] || "pointer"),
      "O4.2 under 1080px, at every pointer, the rail floats from the orb: " + J([at(U, ".shell > .rail.salt-rail"), at(U, ".navbtn,.navbtn.salt-orb")]));
    const app = d.getElementById("deskApp"), items = app ? [...app.querySelectorAll(".salt-appbar__item[data-s]")] : [];
    const railOrder = [...d.querySelectorAll("#tabs .tab[data-s]")].map((b) => b.dataset.s);
    ok(!!app && app.classList.contains("salt-appbar") && J(items.map((b) => b.dataset.s)) === J(railOrder) && railOrder.length === 6
      && items.every((b) => b.querySelector(".salt-appbar__icon svg") && b.querySelector(".salt-appbar__label")),
      "O5.1 the Desk's six places are the system's bar of places, in the rail's order, each an icon and its word: " + J([items.map((b) => b.dataset.s), railOrder]));
    items[1].click();
    const cur = items.filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.dataset.s);
    ok(d.body.getAttribute("data-sec") === "money" && J(cur) === J(["money"]) && d.querySelector('#tabs .tab.on').dataset.s === "money",
      "O5.2 a tap on the bar is the rail's road: the place opens, and the bar and the rail both mark it: " + J([d.body.getAttribute("data-sec"), cur]));
    items[0].click();
    w.navCounts();
    const railToday = (d.querySelector('#tabs .tab[data-s="today"] .navct') || {}).textContent || "", barToday = (app.querySelector('[data-count="today"]') || {}).textContent;
    ok(railToday !== "" && barToday === railToday, "O5.3 the bar carries the rail's counts: " + J([railToday, barToday]));
  } finally { w.close(); }
  /* O6, O7, O8: 16 Nov 2026, THE MOVE TO AMBIENT (0.7.9). Salt Admin and the Counter are Ambient work screens, so his answers are Ambient's own rules and tokens:
     the bar beside the rail over what scrolls, to the screen's foot, the rail --amb-rail-foot (24px) above it and --amb-rail-gap (20px) from its column, and the
     cap once the screen has moved (ambient.js marks the shell data-amb-moved; what scrolls is then drawn from the bar's middle down). jsdom lays nothing out and
     drops container rules, so they are read as the served text; the measured figures are the probe's. The site's own layer restates none of it. */
  {
    const { AMB_CSS, AMB_TOKENS, AMB_JS, SITE_CSS } = await import("../stmt/statement-css.js");
    const flat = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ");
    const amb = flat(AMB_CSS), tok = flat(AMB_TOKENS + AMB_CSS), site = flat(SITE_CSS);
    const shellOf = (html, id) => { const d = new JSDOM(html, { virtualConsole: new VirtualConsole() }).window.document, g = d.getElementById(id); return { d, g, kids: g ? [...g.children].map((k) => k.tagName.toLowerCase() + "." + [...k.classList].join(".")) : [] }; };
    const A = shellOf(landingPage("", "ol-nonce", { master: "fixture-master", accounts: [] }), "roster"), C = shellOf(landingPage("0000-0000", "ol-nonce"), "tabs");
    const work = (x) => !!x.g && x.g.matches(".amb-shell.amb-shell--rail") && x.kids[0] === "div.amb-appbar" && /^main\.amb-screen\.amb-screen--docked/.test(x.kids[1]) && /^div\.amb-dock/.test(x.kids[2] || "");
    ok(work(A) && /\.amb-shell--rail > \.amb-appbar \{ left: calc\(var\(--amb-rail-w\) \+ var\(--amb-dock-inset\) \+ var\(--amb-rail-gap\)\); \}/.test(amb)
      && !/(\.amb-appbar|\.amb-screen|\.amb-dock)[^{,]*\{[^}]*(left|right|inset|position|top|bottom|padding|margin|width)\s*:/.test(site),
      "O6.1 Salt Admin is Ambient's work screen: the app bar beside the rail, not across it, over the screen that scrolls under it; the site's layer restates none of it: " + J(A.kids));
    ok(/--amb-rail-foot: 24px;/.test(tok) && /\.amb-shell--rail > \.amb-dock \{ inset: calc\(var\(--amb-dock-inset\) \+ var\(--amb-safe-top\)\) auto calc\(var\(--amb-rail-foot\) \+ var\(--amb-safe-bottom\)\)/.test(amb)
      && /--amb-pane-room: 20px;/.test(tok) && !/--amb-rail-foot|--amb-pane-room|--amb-dock-inset/.test(site),
      "O6.2 what scrolls runs to the screen's foot with 20px of room at a pane's sides, the rail 24px above the foot, by Ambient's tokens alone");
    ok(work(A) && work(C) && AMB_JS.includes('shell.toggleAttribute("data-amb-moved", moved)') && /\.amb-shell\[data-amb-moved\] > \.amb-screen--docked \{ clip-path: inset\(calc\(var\(--amb-bar-h\) - var\(--amb-tap\) \/ 2\) 0 0 0\); \}/.test(amb)
      && [A, C].every((x) => [...x.d.querySelectorAll("script")].some((s) => s.textContent.includes('toggleAttribute("data-amb-moved"'))) && !/data-amb-moved|clip-path|salt-stuck/.test(site),
      "O7 on Salt Admin and the Counter, once the screen has moved the shell is marked and what scrolls is drawn from the bar's middle down, Ambient's cap, not the page's");
    ok(work(C) && /--amb-rail-gap: 20px;/.test(tok) && /\.amb-shell--rail > \.amb-screen \{ --amb-inset-l: calc\(var\(--amb-rail-w\) \+ var\(--amb-dock-inset\) \+ var\(--amb-rail-gap\)/.test(amb) && !/--amb-inset-l|--amb-rail-gap/.test(site),
      "O8 the Counter's rail stands 20px from its column, as Salt Admin's, by Ambient's --amb-rail-gap: " + J(C.kids));
  }
}
