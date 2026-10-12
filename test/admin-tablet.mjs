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
import { richOwnerPage, byAct } from "./maker-act.mjs";
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

export async function run({ ok, pageWork }) {
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

  /* 4. SHEETS: a centred 560px dialog from 768 to 859px, the 460px drawer from 860px (the system's own from 1080px), placement only */
  {
    const dialog = at("(min-width:768px)and(max-width:859.98px)", ".adm.asheet"), drawer = at("(min-width:860px)and(max-width:1079.98px)", ".adm.asheet");
    ok(/top: 50%/.test(dialog) && /left: 50%/.test(dialog) && /width: min\(560px/.test(dialog) && /transform: translate\(-50%, ?-50%\)/.test(dialog) && /animation-name: salt-sheet-fade/.test(dialog),
      "from 768 to 859px a sheet is a dialog 560px wide in the middle of the screen, arriving by the system's fade: " + dialog);
    ok(/top: 0/.test(drawer) && /left: auto/.test(drawer) && /width: min\(460px, ?100%\)/.test(drawer) && /max-height: none/.test(drawer) && /animation-name: salt-sheet-slide/.test(drawer),
      "from 860px a sheet is the system's drawer, 460px, on the right, arriving by the system's slide: " + drawer);
    const props = new Set([dialog, drawer, at("(min-width:768px)and(max-width:859.98px)", ".adm.asheet .salt-sheet__grab"), at("(min-width:860px)and(max-width:1079.98px)", ".adm.asheet .salt-sheet__grab"),
      at("(min-width:860px)and(max-width:1079.98px)", ".adm.asheet .salt-sheet__head")].join(";").split(";").map((x) => x.split(":")[0].trim()).filter(Boolean));
    const free = ["top", "right", "bottom", "left", "width", "max-height", "transform", "animation-name", "display", "padding-top"];
    const rest = [...props].filter((x) => !free.includes(x));
    ok(props.size >= 9 && !rest.length, "and it writes placement only, no colour, no type and no surface: " + [...props].join() + (rest.length ? " | not placement: " + rest : ""));
    const mine = (h) => new JSDOM(h).window.document;
    const lone = mine(landingPage("", "n", null)).getElementById("lookSheet");
    const own = (e) => !!e && e.classList.contains("adm") && e.classList.contains("asheet");
    ok(own(d.getElementById("lookSheet")) && own(d.getElementById("vaultSheet")) && !!lone && !lone.classList.contains("adm") && !lone.classList.contains("asheet"),
      "the choice and unlock sheets of Salt Account carry .adm and .asheet beside .salt-sheet, and the customer's choice sheet carries neither: " + d.getElementById("lookSheet").className + " | " + (lone && lone.className));
    const p = await richOwnerPage({ pageWork });
    try {
      await p.work.quiet();
      const page = p.d, tap = async (act, key) => { const c = byAct(page, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
      await tap("nav.orders"); await tap("order.open", "ord-p1"); await tap("order.decline", "ord-p1");
      const yn = page.getElementById("ynSheet");
      ok(!!yn && yn.classList.contains("salt-sheet") && own(yn), "the sheet that asks Yes or No on Salt Account carries .adm and .asheet: " + (yn && yn.className));
      await tap("order.ask-keep", "ord-p1");
      await tap("nav.customers"); await tap("part.customers.accounts"); await tap("acct.open", "abcd-efgh"); await tap("acct.show-code");
      const ho = page.querySelector(".salt-sheet.ho");
      ok(own(ho), "so does the sheet that shows a sign-in code: " + (ho && ho.className));
    } catch (e) { ok(false, "the sheets stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }

  /* 5. A PORTRAIT TABLET, 768 to 859px: a 620px column, a form's short fields two up, cards and rows one column */
  {
    const q = "(min-width:768px)and(max-width:859.98px)";
    const col = at(q, ".gate.adm"), grid = at(q, ".adm .maker-input"), full = at(q, ".adm .maker-input>*"), short = at(q, ".adm .maker-input>.maker-field--short");
    ok(/max-width: 620px/.test(col), "from 768 to 859px the column is 620px, centred by the shell's own auto margins: " + col);
    ok(/display: grid/.test(grid) && /grid-template-columns: repeat\(2, ?minmax\(0, ?1fr\)\)/.test(grid) && /grid-column: 1 ?\/ ?-1/.test(full) && /grid-column: auto/.test(short),
      "a form is two columns there, a short field takes one and anything else across both: " + [grid, full, short].join(" | "));
    const rules = media.filter((m) => m.q === q).flatMap((m) => m.rules.map((r) => r.sel));
    ok(!rules.filter((s) => /need|nlist|ordrow|ordlist|makerOrderList|nopen|aopen/.test(s)).length && !at("(min-width:860px)", ".adm .maker-input"),
      "Needs you cards and order rows keep one column there, and a form beside its menu from 860px keeps its own: " + rules.join(" | "));
    const p = await richOwnerPage({ pageWork });
    try {
      await p.work.quiet();
      const page = p.d, tap = async (act, key) => { const c = byAct(page, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
      await tap("nav.record");
      const fields = [];
      for (const [part, slug] of [["entry", "sale-or-purchase"], ["customers", "new-customer"]]) {
        await tap("part.record." + part); await tap("record.form", slug);
        const form = page.querySelector('section.maker-input[data-form="' + slug + '"]');
        if (form) fields.push(...[...form.children].filter((c) => c.matches("label.maker-field")));
      }
      const kind = (f) => (f.querySelector("input,select") || { type: "" }).type, SHORT = ["number", "date", "time"];
      const marked = fields.filter((f) => f.classList.contains("maker-field--short")), others = fields.filter((f) => !f.classList.contains("maker-field--short"));
      ok(marked.length >= 5 && marked.every((f) => SHORT.includes(kind(f))) && others.some((f) => kind(f) === "text") && others.every((f) => !SHORT.includes(kind(f))),
        "the sale and new customer forms mark the short fields, a number, a date or a time, and no text or select field: " + JSON.stringify(fields.map((f) => [kind(f), f.classList.contains("maker-field--short")])));
    } catch (e) { ok(false, "the form stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  }
}
