/* test/counter-tablet.mjs: THE COUNTER ON A TABLET (12 Oct 2026, Phase 7d of the Counter redesign, his yes of 11 Oct 2026, item 9: "768 to 1079 is tidied: sheets as centred 560px
 * dialogs below 860, the drawer from 860, list beside order from 860 (the same breakpoints as /all); 2-up tiles in the order sheet at 768").
 *
 * jsdom applies no media query, so this reads the page's own stylesheet as rules, by query and selector. The stylesheet is Salt Account's too (stmt/page.js PAGE_CSS), whose own
 * tablet rules are all under .adm (test/admin-tablet.mjs): the customer's carry none, and name only what the customer's page draws. Where a rule lands on screen (a dialog 560px wide
 * and centred at 768, the drawer from 861, the list beside the order, the open order's foot above the App bar at 1024x768, no sideways scroll, 44px targets) is the Chromium
 * probe's, and its numbers are in the pull request. Each assertion was proved red by its own mutations (test/counter-tablet.mutations.json, run with tools/section.mjs).
 * Every code, name and amount is invented. */
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";

export async function run({ ok }) {
  const html = landingPage("abcd-efgh", "tablet-nonce", null);
  const all = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + all + "</style>").window.document.styleSheets[0];
  const sel = (r) => r.selectorText.replace(/\s*,\s*/g, ",");
  const media = [...sheet.cssRules].filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].map((x) => ({ sel: sel(x), css: x.style.cssText })) }));
  const at = (q, s) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => r.sel === s).map((r) => r.css).join(" ");

  const DIALOG = "(min-width:768px)and(max-width:859.98px)", DRAWER = "(min-width:860px)and(max-width:1079.98px)", FROM = "(min-width:860px)", BELOW = "(max-width:859.98px)", SHEET = ".salt-sheet:not(.adm)";

  /* THE CUSTOMER'S TABLET RULES EXIST, EACH AT ITS WIDTH, AND NONE IS UNDER .adm */
  const WANT = [
    ["a sheet is a dialog in the middle of the screen from 768 to 859px", DIALOG, SHEET, [/top: 50%/, /left: 50%/, /width: min\(560px/, /max-height: calc\(100% - 64px\)/, /transform: translate\(-50%, ?-50%\)/, /animation-name: salt-sheet-fade/]],
    ["the dialog draws no grabber", DIALOG, SHEET + " .salt-sheet__grab", [/display: none/]],
    ["from 860px a sheet is the 460px drawer on the right", DRAWER, SHEET, [/top: 0/, /left: auto/, /width: min\(460px, ?100%\)/, /max-height: none/, /animation-name: salt-sheet-slide/]],
    ["the drawer draws no grabber", DRAWER, SHEET + " .salt-sheet__grab", [/display: none/]],
    ["the drawer's head is spaced as the system's own drawer is", DRAWER, SHEET + " .salt-sheet__head", [/padding-top: var\(--salt-space-5\)/]],
    /* Orders: the list beside the open order from 860px, as on his page, and not from the rail's 1080px */
    ["from 860px the list and the open order are two columns", FROM, ".oplace", [/display: grid/, /grid-template-columns: minmax\(0, ?5fr\) minmax\(0, ?6fr\)/]],
    ["the open order is sticky and scrolls inside itself from 860px", FROM, ".oscreen", [/position: sticky/, /top: 24px/, /overflow-y: auto/, /max-height: calc\(100vh - 48px\)/]],
    ["its way back is not drawn from 860px", FROM, ".oback", [/display: none/]],
    ["below 860px the open order is the whole tab and takes the list's place", BELOW, "#pOrder.o-open>:not(.oplace)", [/display: none/]],
    ["and the list is not drawn beside it", BELOW, ".oplace.o-open>.olistcol", [/display: none/]],
    ["between 860 and 1080px, where the App bar is still fixed, the order's height gives up the bar's", DRAWER, ".oscreen", [/max-height: calc\(100vh - 48px - var\(--salt-bar-h\)/, /env\(safe-area-inset-bottom/]],
    ["and Orders alone takes the page's width there, its heading with it", DRAWER, "#pOrder,.cshell[data-place=order] .chead", [/max-width: none/]]
  ];
  const missing = WANT.filter(([, q, s, res]) => { const css = at(q, s); return !css || !res.every((re) => re.test(css)); }).map((w) => w[0]);
  /* the page's own script follows the style: the list is beside an order from 860px, so one is open by itself from there (it was 1080px), and the shell says which place it shows */
  const SCRIPT = [
    ["the script asks for 860px to open an order beside the list", /function oWide\(\)\{ try\{ return !!\(window\.matchMedia&&window\.matchMedia\('\(min-width: 860px\)'\)\.matches\)/],
    ["and drops it when the width falls below 860px", /var oMq=window\.matchMedia&&window\.matchMedia\('\(min-width: 860px\)'\);/],
    ["the shell names the place it shows", /tab=t; tabs\.setAttribute\('data-place',t\);/]
  ];
  missing.push(...SCRIPT.filter(([, re]) => !re.test(html)).map((s) => s[0]));
  /* none of Orders waits for the rail's 1080px */
  const rail = media.filter((m) => /1080px|1079[.]98px/.test(m.q) && !/860px/.test(m.q)).flatMap((m) => m.rules.map((r) => r.sel)).filter((s) => /oplace|oscreen|olistcol|oback|pOrder/.test(s));
  /* every rule of the stylesheet at the tablet widths that names a thing the customer's page draws: not one is under .adm (the :not(.adm) that keeps his page's sheets out is the one mention) */
  const OURS = /\.salt-sheet\b|\.oplace|\.oscreen|\.olistcol|\.oback|#pOrder|data-place/;
  const fam = media.filter((m) => /(^|[^0-9.])(768|860)px|(767|859)[.]98px/.test(m.q)).flatMap((m) => m.rules.map((r) => r.sel));
  const ours = fam.flatMap((s) => s.split(",")).filter((s) => OURS.test(s) && !/\.adm\.asheet/.test(s));
  const under = ours.filter((s) => /\.adm\b/.test(s.replace(/:not\(\.adm\)/g, "")));
  ok(!missing.length && !rail.length && ours.length >= 12 && !under.length,
    "the customer's tablet rules are there, a centred 560px dialog from 768 to 859px, the 460px drawer and the list beside the open order from 860px, and none is under .adm (" + ours.length
      + " rules; missing: " + (missing.join(" | ") || "none") + "; waiting for the rail: " + (rail.join(" | ") || "none") + "; under .adm: " + (under.join(" | ") || "none") + ")");
}
