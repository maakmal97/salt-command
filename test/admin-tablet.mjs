/* test/admin-tablet.mjs: SALT ACCOUNT USES THE WIDTH (12 Oct 2026, Phase 6 of the Salt Account redesign, his decision 9 of 11 Oct: "Tablet: two panes and the drawer from
 * 860 px (a landscape iPad), the app bar kept until 1080, the rail from 1080").
 *
 * jsdom applies no media query, so what is proved here is the page's own stylesheet read as rules, by query and selector, and the owner page's markup. The page's
 * measured behaviour (panes side by side from 860px, the rail from 1080px, a sticky pane's foot above the App bar, 44px targets, no sideways scroll, on both themes) is
 * the Chromium probe's, and its numbers are in the pull request. The stylesheet is the customer's too (stmt/page.js PAGE_CSS), so a rule of this phase that is not under
 * .adm is a rule the customer's page is handed. Every assertion was proved red by its own mutation (test/admin-tablet.mutations.json, run with tools/section.mjs).
 *   1  every rule at 768px, 860px and below them is under .adm
 *   2  Needs you and Customers: the list beside the account from 860px, the account sticky and scrolling inside itself, its foot above the App bar to 1080px
 *   3  nothing opens by itself: the column beside the list says Tap a card, and is drawn only while no account is open
 * Every code, name and amount is invented. */
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";

/* the owner page's own stylesheet, read as rules, by query (spaces taken out) and selector (a list is written "a,b") */
function ownerCss() {
  const html = landingPage("", "tablet-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const sel = (r) => r.selectorText.replace(/\s*,\s*/g, ",");
  const media = [...sheet.cssRules].filter((r) => r.media).map((r) => ({ q: r.media.mediaText.replace(/\s+/g, ""), rules: [...r.cssRules].map((x) => ({ sel: sel(x), css: x.style.cssText })) }));
  const at = (q, s) => media.filter((m) => m.q === q).flatMap((m) => m.rules).filter((r) => r.sel === s).map((r) => r.css).join(" ");
  const top = (s) => [...sheet.cssRules].filter((r) => r.selectorText && sel(r) === s).map((r) => r.style.cssText).join(" ");
  return { html, media, at, top };
}

export async function run({ ok }) {
  const { html, media, at, top } = ownerCss();
  const d = new JSDOM(html).window.document;

  /* 1. EVERY RULE AT THE TABLET WIDTHS IS UNDER .adm */
  {
    const fam = media.filter((m) => /(^|[^0-9.])(768|860)px|(767|859)\.98px/.test(m.q));
    const sels = fam.flatMap((m) => m.rules.map((r) => r.sel));
    const loose = sels.filter((s) => s.split(",").some((x) => !/\.adm\b/.test(x)));
    ok(sels.length >= 26 && !loose.length,
      "every rule at 768px, 860px and the widths below them is under .adm, which the customer's page shares this stylesheet without: " + sels.length + " rules, outside .adm: " + (loose.join(" | ") || "none"));
  }

  /* 2. NEEDS YOU AND CUSTOMERS: A LIST AND A DETAIL FROM 860px */
  {
    const grid = at("(min-width:860px)", ".adm .nsplit,.adm .asplit"), pane = at("(min-width:860px)", ".adm #nopen,.adm #aopen");
    ok(/display: grid/.test(grid) && /grid-template-columns: minmax\(0,1fr\) minmax\(0,440px\)/.test(grid),
      "from 860px Needs you and Customers stand the list and the account side by side, the account up to 440px: " + grid);
    ok(/position: sticky/.test(pane) && /overflow-y: auto/.test(pane) && /max-height: calc[(]100vh - 48px[)]/.test(pane) && !/salt-bar-h/.test(pane),
      "the account is sticky and scrolls inside itself: " + pane);
    const band = at("(min-width:860px)and(max-width:1079.98px)", ".adm #nopen,.adm #aopen");
    ok(/max-height: calc[(]100vh - 48px - var[(]--salt-bar-h[)]/.test(band),
      "between 860 and 1080px, where the App bar is still fixed, the account's height gives up the bar's: " + band);
    const back = at("(min-width:860px)", ".adm #aopen .aback"), phone = at("(max-width:859.98px)", ".adm #nopen"), shut = at("(max-width:859.98px)", ".adm #oAccts.open .afind,.adm #oAccts.open .alist,.adm #oAccts.open #scount");
    ok(/display: none/.test(back) && /display: none/.test(phone) && /display: none/.test(shut),
      "from 860px the way back is not drawn; below it Needs you draws no pane and an account open takes the list's place: " + [back, phone, shut].join(" | "));
    const rail = media.filter((m) => /1080px|1079[.]98px/.test(m.q) && !/860px/.test(m.q)).flatMap((m) => m.rules.map((r) => r.sel)).filter((s) => /nopen|aopen|nsplit|asplit|oAccts/.test(s));
    ok(!rail.length, "none of it waits for the rail's 1080px: " + (rail.join(" | ") || "no rule of the rail's names them"));
  }

  /* 3. NOTHING OPENS BY ITSELF: TAP A CARD */
  {
    const base = top(".adm .panenone"), wide = at("(min-width:860px)", ".adm .panenone"), open = at("(min-width:860px)", ".adm #nopen:not([hidden])~.panenone,.adm #aopen:not([hidden])~.panenone");
    ok(/display: none/.test(base) && /display: block/.test(wide) && /display: none/.test(open),
      "the invitation is not drawn on a phone, drawn beside the list from 860px, and not drawn beside an account that is open: " + [base, wide, open].join(" | "));
    const kids = (id) => [...d.getElementById(id).parentElement.children].map((c) => c.id || c.className).join("|");
    const words = [...d.querySelectorAll(".panenone")].map((p) => p.textContent);
    ok(kids("nopen") === "|nopen|rnone panenone" && kids("aopen") === "rlist|aopen|rnone panenone" && words.length === 2 && words.every((w) => w === "Tap a card"),
      "Needs you's column and Customers' each hold the list, the account's pane and then the invitation, which says Tap a card: " + kids("nopen") + " , " + kids("aopen") + " " + JSON.stringify(words));
  }
}
