/* test/admin-bar-foot.mjs: THE PLACES STAND ON THE SCREEN'S FOOT (12 Oct 2026, his iPhone report that on Record they did not).
 *
 * From 12 Oct 2026 the bar of five places was salt-ds's fixed recipe, and in the iPhone's saved app a head script made the document the screen's
 * height (--app-h). 15 Nov 2026, THE MOVE TO AMBIENT: both faces are one Ambient shell, which is the screen's height by itself (100dvh) and never
 * scrolls; its screen scrolls inside it and its dock floats over the screen's foot, the tab bar standing up as the rail from 960px. So the head
 * script and its rule are gone, and what the suite holds is that the page leaves the shell to Ambient. Each check red under its own mutation
 * (test/admin-bar-foot.mutations.json, run with tools/section.mjs):
 *   1  his places are one dock, the shell's last child, holding the tab bar of his places, and nothing else of his page is a bar of places
 *   2  nothing re-frames or re-sizes the shell: no rule of the page's own layer (PAGE_CSS, the site's layer) touches the shell, its screen,
 *      its dock, the body or the root, past the site layer's body ground
 *   3  Ambient holds the shell to the screen's height (100dvh) and the screen scrolls inside it
 *   4  no head script marks the root or sets a height, on his page or the customer's, which stand in the same shell */
import { richOwnerPage } from "./maker-act.mjs";
import { landingPage, SITE_STYLE, AMB_STYLE } from "../stmt/page.js";
import { AMB_CSS, SITE_CSS } from "../stmt/statement-css.js";

const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, roster = d.getElementById("roster"), dock = roster && roster.lastElementChild;
    /* 1 */
    /* 16 Nov 2026, the move to Ambient (end pass): the dock also holds Approve's save bar (#apBar, hidden until a card is ticked), so the tab bar is its one nav and its last child */
    ok(!!dock && dock.classList.contains("amb-dock") && dock.lastElementChild.matches("nav.amb-tabbar") && dock.querySelectorAll(":scope > nav").length === 1 && [...dock.children].every((c) => c === dock.lastElementChild || c.id === "apBar")
      && dock.querySelectorAll(".amb-tab.place").length === 5 && !d.querySelector(".salt-appbar, .salt-rail"),
      "his places are one Ambient dock, the shell's last child, its tab bar the five places, and no other bar of places stands");
    /* 2: the page's own layers, read as served after Ambient */
    const html = landingPage("", "nfoot", { master: "", accounts: [] });
    const style = (/<style nonce="nfoot">([\s\S]*?)<\/style>/.exec(html) || [, ""])[1], own = strip(style.slice(AMB_STYLE.length));
    const shellSel = /(^|[\s,>+~])(html|body|:root|\.amb-shell|\.amb-screen|\.amb-dock|\.amb-tabbar|\.amb-tab|#roster|#tabs)(?=[\s,{.:[#>]|$)/;
    const hits = [...own.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((sel) => sel.split(",").some((x) => shellSel.test(" " + x.trim())))
      /* the site ground, the ended page and print (which hides the dock and the app bar) are the page's to say */
      /* 16 Nov 2026, the move to Ambient (end pass): the selectors are the site layer's, spaced as written; the hero's time line on Home and a late age's colour frame nothing */
      .map((sel) => sel.replace(/\s*([>,+~])\s*/g, "$1"))
      .filter((sel) => sel !== "body.amb" && sel !== "body.ended>*:not(#aEnded)" && sel !== ".mos,.amb-dock,.amb-appbar" && !/^#roster \.(abarlive|salt-orb|ntask)/.test(sel) && !/amb-hero__time$/.test(sel));
    ok(own.length > 1000 && hits.length === 0, "nothing of the page's own layer re-frames or re-sizes the shell, its screen, its dock, the body or the root: " + JSON.stringify(hits.slice(0, 6)));
    /* 3 */
    const amb = strip(AMB_CSS);
    ok(/\.amb-shell \{[^}]*height: 100dvh;[^}]*overflow: hidden;/.test(amb) && /\.amb-screen \{[^}]*position: absolute;[^}]*overflow-y: auto;/.test(amb)
      && roster.classList.contains("amb-shell") && roster.querySelector(":scope > main.amb-screen"),
      "Ambient holds his shell to the screen's height, and its screen scrolls inside it");
    /* 4 */
    const cust = landingPage("abcd-efgh", "nfootc", null);
    ok([html, cust].every((h) => !/data-app|--app-h|navigator\.standalone===true\)\{var r=document\.documentElement/.test(h)) && (cust.match(/<div id="tabs" class="amb-shell/g) || []).length === 1,
      "no head script marks the root or sets a height, on his page or the customer's, whose places stand in the same Ambient shell");
  } finally { p.w.close(); }
}
