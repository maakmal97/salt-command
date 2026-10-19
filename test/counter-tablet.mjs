/* test/counter-tablet.mjs: THE COUNTER ON A TABLET (12 Oct 2026, Phase 7d of the Counter redesign, his yes of 11 Oct 2026, item 9: "768 to 1079 is tidied: sheets as centred 560px
 * dialogs below 860, the drawer from 860, list beside order from 860 (the same breakpoints as /all); 2-up tiles in the order sheet at 768").
 *
 * jsdom applies no media query, so this reads the page's own stylesheet as rules, by query and selector, and the cascade at a width by rewriting each query that holds there to
 * `all`. The stylesheet is Salt Admin's too (stmt/page.js PAGE_CSS), whose own tablet rules are all under .adm (test/admin-tablet.mjs): the customer's carry none, and name only
 * what the customer's page draws. Where a rule lands on screen (a dialog 560px wide and centred at 768, the drawer from 861, the list beside the order, the open order's foot above
 * the App bar at 1024x768, no sideways scroll, 44px targets) is the Chromium probe's, and its numbers are in the pull request. Each assertion was proved red by its own mutations
 * (test/counter-tablet.mutations.json, run with tools/section.mjs).
 *   1  the customer's tablet rules exist at their widths, the script's own width follows them, and none is under .adm
 *   2  a sheet of the customer's and one of Salt Admin's are placed alike at 375, 768, 861, 1000 and 1280px
 *   3  the order sheet's tiles are two columns, in the 560px dialog at 768px (not the 364px each had in a sheet as wide as the screen) and in the drawer at 861px
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

  /* THE CASCADE A WIDTH READS. jsdom applies no width query, so a page's html is rewritten so that every query that holds at a width reads `all` (the phone frame's section does the same),
     and the cascade jsdom runs is then the page's own at that width: a rule, its specificity and the system's rule it beats. */
  const holds = (q, px) => q.split(",").some((one) => { const fs = one.split(/\band\b/).map((s) => s.trim()).filter(Boolean);
    return fs.length > 0 && fs.every((f) => { const x = /^\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)$/.exec(f); return !!x && (x[1] === "min" ? px >= +x[2] : px <= +x[2]); }); });
  const atWidth = (h, px) => h.replace(/@media\s*([^{]+)\{/g, (m, q) => (holds(q, px) ? "@media all{" : m));
  const PLACE = ["position", "top", "right", "bottom", "left", "width", "max-height", "transform", "animation-name", "border-radius"];
  const placed = (win, el) => { const c = win.getComputedStyle(el); return PLACE.map((p) => p + ":" + c.getPropertyValue(p)).join(" "); };

  /* THE TWO PAGES PLACE A SHEET ALIKE: a sheet of the customer's and a sheet of his read the same placement at a phone, a portrait tablet, a landscape tablet and a laptop */
  {
    const WIDTHS = [375, 768, 861, 1000, 1280], owner = landingPage("", "tablet-nonce", { master: "fixture-master", accounts: [] });
    const rows = WIDTHS.map((px) => {
      const a = new JSDOM(atWidth(html, px)), b = new JSDOM(atWidth(owner, px));
      const r = { px, customer: placed(a.window, a.window.document.getElementById("paySheet")), his: placed(b.window, b.window.document.getElementById("lookSheet")) };
      a.window.close(); b.window.close();
      return r;
    });
    const at768 = rows.find((r) => r.px === 768).customer, at861 = rows.find((r) => r.px === 861).customer;
    ok(rows.every((r) => r.customer === r.his) && /top:50%/.test(at768) && /width:min\(560px/.test(at768) && /top:0px/.test(at861) && /width:min\(460px/.test(at861),
      "a sheet of the customer's and one of his are placed alike at 375, 768, 861, 1000 and 1280px, a dialog 560px wide at 768 and the 460px drawer from 861: " + JSON.stringify(rows.filter((r) => r.customer !== r.his)));
  }

  /* THE ORDER SHEET'S TILES ARE TWO UP, and at 768px a dialog holds them: in a sheet as wide as the screen each was 364px, in a dialog of 560px each is 280px at most */
  {
    const C = await import("../tools/stmt-crypto.mjs"), { webcrypto } = await import("node:crypto");
    const u = "abcd-efgh", pass = "fixture-pass-7d3", ck = await C.contentKey("test-secret", u);
    const prices = { week: { label: "21 to 27 Sep 2026", monday: "2026-09-21" }, soon: [],
      products: [{ product: "salt", unit: "unit", basis: "tier", tier: "Gold", sizes: [{ q: 0.5, price: 60 }, { q: 1, price: 110 }, { q: 2.5, price: 250 }] },
        { product: "oil", unit: "unit", basis: "board", tier: null, sizes: [{ q: 1, price: 45 }, { q: 2, price: 85 }] }] };
    const body = { ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-7d3",
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
      prices: await C.encryptWith(ck, JSON.stringify(prices)) };
    const read = async (px) => {
      const dom = new JSDOM(atWidth(html, px), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
        try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
        if (!win.TextEncoder) win.TextEncoder = TextEncoder;
        if (!win.TextDecoder) win.TextDecoder = TextDecoder;
        win.scrollTo = () => {};
        try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the look is kept, so its Sheet does not stand over the page this reads */ }
        win.fetch = async (path, init) => {
          const p = String(path), m = (init && init.method) || "GET";
          const j = p === "/open" ? body : (p === "/orders" && m === "GET") ? { ok: true, orders: [], claims: [] } : null;
          return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
        };
      } });
      const w = dom.window, d = w.document;
      try {
        d.getElementById("un").value = u; d.getElementById("pw").value = pass;
        d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
        for (let i = 0; i < 200 && !d.getElementById("oNew"); i++) await new Promise((r) => setTimeout(r, 15));
        const go = d.getElementById("oNew"); if (go) go.click();
        const box = d.querySelector("#osheet .salt-sheet"), grids = [...d.querySelectorAll("#osheet .salt-options__grid")].filter((g) => g.children.length > 1);
        return { box: box ? placed(w, box) : "", grids: grids.map((g) => ({ kids: g.children.length, cols: w.getComputedStyle(g).getPropertyValue("grid-template-columns") })) };
      } finally { w.close(); }
    };
    const a = await read(768), b = await read(861);
    const two = (r) => r.grids.length >= 3 && r.grids.every((g) => /^repeat\(2, ?minmax\(0, ?1fr\)\)$/.test(g.cols));
    ok(two(a) && two(b) && /top:50%/.test(a.box) && /width:min\(560px/.test(a.box) && /top:0px/.test(b.box) && /width:min\(460px/.test(b.box),
      "the order sheet's size tiles and its two ways are two columns, in the 560px dialog at 768px and in the drawer at 861px: " + JSON.stringify({ a, b }));
  }
}
