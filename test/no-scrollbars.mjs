/* test/no-scrollbars.mjs: NO SCROLLBAR ON ANY SALT SURFACE (9 Nov 2026, his word: a page that scrolled drew a classic scrollbar about 15px wide on
 * Windows and read narrower than one that did not; "I do not want to see any scrolling bar at all"). salt-ds 1.30.0 holds the rule, every element and
 * !important: no scrollbar width and no WebKit scrollbar, so every page is the same width whether it scrolls or not, and only the bar goes, never the scroll.
 * jsdom lays nothing out, so the rule is proved as each surface's served stylesheets, read as rules. The measured pages (no bar drawn, the content as wide
 * on a page that scrolls as on one that does not, the wheel still scrolling, at 390, 1180 and 1440 on the Desk, Salt Admin and the Counter) are the
 * Chromium probe's, in the version's notes.
 *   B1  the Desk carries the rule: every element, no scrollbar width, !important; the WebKit bar not displayed
 *   B2  the Counter's page, a guest board and Salt Admin's page carry it the same way
 *   B3  no surface draws a bar back: no rule but the system's sets a scrollbar width, a scrollbar colour or a WebKit scrollbar part
 *   B4  the boxes that scroll still scroll: the Desk's rail and its sliding tables, Salt Admin's frame column
 * Every assertion is red under its own mutation (test/no-scrollbars.mutations.json). */
import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { landingPage, boardPage } from "../stmt/page.js";

const J = JSON.stringify;
/* the master as a suite run reads it: SALT_MASTER when a mutation copy is set, as tools/payload.mjs openMaster reads it */
/* every rule of a set of stylesheets, those inside an at-rule included, with the at-rule's condition */
function flat(sheets) {
  const out = [];
  const walk = (rules, q) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules, (r.media && r.media.mediaText) || q); else if (r.selectorText) out.push({ sel: r.selectorText.trim(), style: r.style, q }); } };
  for (const s of sheets) walk(s.cssRules, "");
  return out;
}
const sheetsOf = (html) => new JSDOM("<!doctype html><html><head>" + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => "<style>" + m[1] + "</style>").join("") + "</head></html>", { virtualConsole: new VirtualConsole() }).window.document.styleSheets;
/* the system's rule, as carried: the universal selector at the top level, none and important */
function carries(rules) {
  const all = rules.filter((r) => !r.q && r.sel === "*" && r.style.getPropertyValue("scrollbar-width") === "none" && r.style.getPropertyPriority("scrollbar-width") === "important");
  const kit = rules.filter((r) => !r.q && r.sel === "::-webkit-scrollbar" && r.style.getPropertyValue("display") === "none" && r.style.getPropertyPriority("display") === "important");
  return { all: all.length, kit: kit.length };
}
/* any rule that sets a scrollbar back, the system's own two excepted */
function drawsBack(rules) {
  return rules.filter((r) => {
    const own = !r.q && ((r.sel === "*" && r.style.length === 1) || (r.sel === "::-webkit-scrollbar"));
    if (own) return false;
    const w = r.style.getPropertyValue("scrollbar-width");
    return (w && w !== "none") || r.style.getPropertyValue("scrollbar-color") || r.style.getPropertyValue("scrollbar-gutter") || /::-webkit-scrollbar/.test(r.sel) && !/display:\s*none/.test(r.style.cssText);
  }).map((r) => r.sel + "{" + r.style.cssText + "}");
}

export async function run({ ok }) {
  const desk = flat(sheetsOf(readFileSync(process.env.SALT_MASTER || new URL("../master/salt_command.html", import.meta.url), "utf8")));
  const counter = flat(sheetsOf(landingPage("0000-0000", "nb-nonce")));
  const board = flat(sheetsOf(boardPage({ id: "nbguest", list: null }, "nb-nonce")));
  const admin = flat(sheetsOf(landingPage("", "nb-nonce", { master: "fixture-master", accounts: [] })));
  /* B1 */
  const d = carries(desk);
  ok(d.all >= 1, "B1.1 the Desk sets no scrollbar width on every element, important, at the top level: " + d.all);
  ok(d.kit >= 1, "B1.2 the Desk displays no WebKit scrollbar, important: " + d.kit);
  /* B2 */
  const c = carries(counter), b = carries(board), a = carries(admin);
  ok(c.all >= 1 && b.all >= 1 && a.all >= 1, "B2.1 the Counter's page, a guest board and Salt Admin set no scrollbar width on every element: " + J([c.all, b.all, a.all]));
  ok(c.kit >= 1 && b.kit >= 1 && a.kit >= 1, "B2.2 the Counter's page, a guest board and Salt Admin display no WebKit scrollbar: " + J([c.kit, b.kit, a.kit]));
  /* B3 */
  ok(drawsBack(desk).length === 0, "B3.1 nothing on the Desk draws a bar back: " + J(drawsBack(desk)));
  ok(drawsBack(counter).length === 0 && drawsBack(admin).length === 0, "B3.2 nothing on the Counter or Salt Admin draws a bar back: " + J(drawsBack(counter).concat(drawsBack(admin))));
  /* B4 */
  const css = (rules, s) => rules.filter((r) => r.sel === s).map((r) => r.style.cssText).join(" ");
  ok(/overflow-y: auto/.test(css(desk, ".rail")) && /overflow-x: auto/.test(css(desk, ".tscroll")),
    "B4.1 the Desk's rail and its sliding tables still scroll: " + J([css(desk, ".rail"), css(desk, ".tscroll")]));
  const col = admin.filter((r) => r.sel === ".salt-frame__main" && /min-width:\s*1080px/.test(r.q)).map((r) => r.style.cssText).join(" ");
  ok(/overflow-y: auto/.test(col), "B4.2 from 1080px Salt Admin's frame column still scrolls: " + col);
}
