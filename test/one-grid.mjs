/* test/one-grid.mjs: ONE GRID ON SALT COUNTER, AND HIS FIFTH PLACE IS SETTINGS (18 Nov 2026, Ambient 0.7.17, his two answers).
 * Display and one name only: no route, request body, price or booking changes; the place's id, hash and acts stay "shop".
 *   G1  the carried Ambient gives a working shell's plain split the panes' own columns, from 960px and nowhere under it
 *   G2  Account's side column is that track mirrored, the page no longer capped at 1060px, and Shop's prose runs no wider than Ambient's measure
 *   G3  Salt Admin's fifth place reads Settings on its tab and its hero, still addressed as shop; Shop hours keeps its name
 *   G4  the Counter's buying place still reads Shop
 * Geometry is measured in Chromium (the session's measures at 390, 1180, 1536 and 1920); jsdom lays nothing out, so these read markup and rules.
 * Each check is red under its own mutation (test/one-grid.mutations.json). */
import { JSDOM } from "jsdom";
import { landingPage, SITE_STYLE } from "../stmt/page.js";

export async function run({ ok }) {
  const css = SITE_STYLE.replace(/\s+/g, " ");
  const t = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg, .amb-tab__count").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
  /* G1 */
  const rule = ".amb-shell--work :is(.amb-screen, .amb-place) > .amb-split:not(.amb-split--panes) { grid-template-columns: minmax(280px, min(440px, 40%)) minmax(0, 1fr); }";
  const at = css.indexOf(rule), open = css.lastIndexOf("@container amb (min-width: 960px) {", at), shut = css.indexOf(".amb-tabbar__foot { display: none; }");
  ok(at > 0 && css.indexOf(rule, at + 1) < 0 && open > shut && shut > 0 && !/@container amb \(min-width: (?!960px)/.test(css.slice(open, at)),
    "a working shell's plain split takes the panes' columns, written once, inside the 960px container");
  /* G2 */
  ok(/#acct \{ max-width: none; grid-template-columns: minmax\(0, 1fr\) minmax\(280px, min\(440px, 40%\)\); align-items: start; column-gap: var\(--amb-space-6\); \}/.test(css),
    "Account's side column is the panes' track mirrored, and the page is not capped short of Home's right edge");
  ok(/#pPrices \.amb-notice, #pPrices p \{ max-width: var\(--amb-measure\); \}/.test(css), "Shop's notices and prose run no wider than Ambient's measure");
  /* G3, G4 */
  const od = new JSDOM(landingPage("", "ogrid", { master: "", accounts: [] })), o = od.window.document;
  const tab = o.querySelector('#roster nav.amb-tabbar button[data-m="shop"]'), hero = o.querySelector("#mShop .amb-hero__title, [data-place-of='shop'] .amb-hero__title");
  const heroes = [...o.querySelectorAll("#roster .amb-hero__title")].map(t);
  ok(!!tab && t(tab) === "Settings" && heroes.includes("Settings") && !heroes.includes("Shop") && ![...o.querySelectorAll("#roster nav.amb-tabbar button[data-m]")].some((b) => t(b) === "Shop"),
    "his fifth place reads Settings on its tab and its hero, still addressed as shop: " + JSON.stringify([tab && t(tab), heroes, !!hero]));
  ok(t(o.getElementById("makerHoursTitle")) === "Shop hours", "and Shop hours keeps its name, the shop's own hours");
  od.window.close();
  const cd = new JSDOM(landingPage("abcd-efgh", "ogridc", null)), c = cd.window.document;
  const ctabs = [...c.querySelectorAll("#tabs nav.amb-tabbar button")].map(t);
  ok(ctabs.includes("Shop") && !ctabs.includes("Settings"), "the Counter's buying place still reads Shop: " + JSON.stringify(ctabs));
  cd.window.close();
}
