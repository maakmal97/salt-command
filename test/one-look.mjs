/* test/one-look.mjs: ONE LOOK ON EVERY SALT SURFACE (16 Nov 2026, his word: "consistent across all apps", "layering, scrolling, visual", and
 * his four answers: slide under the bar, the bar beside the rail on Salt Admin, the lighter shadow everywhere, the bar of places on the Desk).
 * His report: no space between cards and a black shadow behind them on the Desk and Salt Admin, never on the Counter. Measured: on the Desk's
 * To do the book table and its Cover chart touched (0px), every pane inside a pane and every tile cast the 40px drop shadow, which showed through
 * the glass under it; in the two frames what scrolled was cut at a line under the bar and a pane's shadow cut flat at the column's sides.
 * jsdom lays nothing out, so the rules are proved as each surface's served stylesheets and markup, and two behaviours (the bar of places, the cap)
 * by driving the page. The measured pages (the bar and the rail at one place on all three at 1180, 1440 and 1920, 16px down on a phone; panes 14px
 * apart; one drop shadow on a page's own panes, none inside one) are the Chromium probe's, in the version's notes.
 *   O1  the recipe: a glass card casts no drop shadow (16 Nov 2026, his "you can still see the shadow"), a card inside a card none
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
    ok(/box-shadow: inset 0(px)? 1px 0(px)? var\(--salt-highlight\)/.test(card) && !/--salt-shadow/.test(card), "O1.1 a glass card casts no drop shadow on any surface, its highlight alone: " + card.slice(0, 200));
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
    /* 16 Nov 2026, his "you can still see the shadow": no pane casts one, so every box-shadow a .kpi or .card rule sets is the highlight alone */
    const casts = [...d.styleSheets].flatMap((x) => [...x.cssRules]).filter((r) => r.selectorText && !r.media && sel(r).split(",").map((x) => x.trim()).some((s) => s === ".kpi" || s === ".card") && r.style.boxShadow).map((r) => r.style.boxShadow);
    ok(casts.length > 0 && casts.every((b) => /^inset 0(px)? 1px 0(px)? var\(--salt-highlight\)$/.test(b)),
      "O3.2 a tile and a pane cast no drop shadow on the Desk, as on Salt Admin and the Counter: " + J(casts));
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
  /* O6, O8: Salt Admin's and the Counter's markup and rules */
  {
    const html = landingPage("", "ol-nonce", { master: "fixture-master", accounts: [] });
    const d = new JSDOM(html, { virtualConsole: new VirtualConsole() }).window.document, { at } = rulesOf(d.styleSheets);
    const g = d.getElementById("roster"), kids = g ? [...g.children] : [], col = kids.find((k) => k.classList.contains("salt-frame__col"));
    ok(!!g && g.classList.contains("salt-frame--side") && kids[0] && kids[0].classList.contains("salt-rail") && !!col
      && col.firstElementChild && col.firstElementChild.matches("header.abar.salt-frame__bar") && !!col.querySelector(":scope > .amain.salt-frame__main")
      && !kids.some((k) => k.matches("header")),
      "O6.1 Salt Admin wears the side frame: the rail its full height, then a column of the bar over what scrolls: " + J(kids.map((k) => k.tagName + "." + k.className)));
    const gate = at(Q, ".gate.adm");
    ok(/--salt-frame-h: calc\(100dvh - 22px\)/.test(gate) && /margin-bottom: -60px/.test(gate) && /padding: 0(px)?/.test(gate),
      "O6.2 Salt Admin's frame runs to the screen's foot at the page's own edge, as the Desk's: " + gate);
    const counter = landingPage("0000-0000", "ol-nonce"), { at: cat } = rulesOf(sheetsOf(counter));
    ok(/gap: 20px/.test(cat(Q, ".cshell")), "O8 the Counter's rail stands 20px from its column, as the Desk's and Salt Admin's: " + cat(Q, ".cshell"));
  }
  /* O7: the cap, driven on the Counter's page and Salt Admin's */
  for (const [who, html] of [["the Counter", landingPage("0000-0000", "ol-nonce")], ["Salt Admin", landingPage("", "ol-nonce", { master: "fixture-master", accounts: [] })]]) {
    const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://counter.fixture.test/", virtualConsole: new VirtualConsole(),
      beforeParse(win) { win.fetch = () => new Promise(() => {}); win.scrollTo = () => {}; win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); } });
    const win = dom.window, b = win.document.body;
    const move = (y) => { Object.defineProperty(win, "pageYOffset", { configurable: true, value: y }); win.dispatchEvent(new win.Event("scroll")); return b.classList.contains("salt-stuck"); };
    const still = move(0), moved = move(120), back = move(2);
    const rule = rulesOf(win.document.styleSheets).top(who === "Salt Admin" ? ".adm:where(.salt-stuck *) .abar" : "body.salt-stuck .chead.salt-deskbar");
    ok(!still && moved && !back && [24, 48, 72, 96].every((y) => new RegExp("0(px)? -" + y + "px 0(px)? 0(px)? var\\(--salt-obsidian\\)").test(rule)),
      "O7 on " + who + ", once the page has moved the bar casts the Desk's cap, and not before: " + J([still, moved, back, rule.slice(0, 80)]));
    win.close();
  }
}
