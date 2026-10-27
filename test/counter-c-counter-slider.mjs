/* test/counter-c-counter-slider.mjs: THE SLIDER ON THE COUNTER (Counter Batch C, P11, item 21; his word of 20 Oct 2026).
 *
 * The Counter's choices of two to six that fit a phone are the system's slider, .salt-segment: the Look row (the customer's and Salt
 * Admin's) and the Orders tabs; Salt Admin's Record strip was one until 25 Oct 2026, when it became the Nav bar's text tabs (his Ask A). Measured in Chromium at 358px, Customers' and Shop's four, the six kinds of
 * Needs you and the months stay strips of pills, as do the stage arrows and Orders' second strip, which can stand with none chosen.
 * The page's style-src refuses a style attribute, so segSync sets --n and --i from the script in each handler that moves a choice.
 * Every check observes the page in jsdom or the stylesheet it carries; each was proved red by its own mutation
 * (test/counter-c-counter-slider.mutations.json, tools/section.mjs).
 *   1  the recipe is carried in SITE_RECIPES, with its 44px option, its reduced-motion rule and its greyed option
 *   2  the customer's Look row is a slider of two, Night chosen and marked, the thumb at it, Tide greyed and inert
 *   3  the Orders tabs are a slider of four with their counts, and a tap moves the thumb and aria-selected together
 *   4  Salt Admin's Record strip is the Nav bar's tabs, never the slider, the part entered selected; Customers' is the tight slider, its thumb following each part entered, a hidden option taking no column\n *   5  the strips that do not fit stay pills: the stages' arrows, Orders' second strip, the months; the kinds, Shop's and Orders' parts are the Nav bar's text tabs\n *   6  no rule of the page lowers a slider's option under 44px */
import { JSDOM, VirtualConsole } from "jsdom";
import { webcrypto } from "node:crypto";
import { open, ord, ago } from "./counter-b-kit.mjs";

const EMPTY = { ok: true, accounts: [], refs: [], tiers: [], claims: [], threads: [], pools: [], lines: [], orders: [], drafts: [], refused: [], queue: [] };
const J = (o) => JSON.stringify(o);
const seg = (g) => g && { cls: g.className, n: g.style.getPropertyValue("--n"), i: g.style.getPropertyValue("--i"),
  on: [...g.querySelectorAll("button")].map((b) => (b.classList.contains("salt-segment__opt--active") ? 1 : 0)).join("") };

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js?" + Date.now());
  const { SITE_RECIPES } = await import("../stmt/statement-css.js?" + Date.now());
  const wins = [];
  try {
    /* ---- 1 ---- */
    const R = SITE_RECIPES.replace(/\/\*[\s\S]*?\*\//g, "");
    ok(/\.salt-segment \{[^}]*grid-template-columns: repeat\(var\(--n\)/.test(R) && /\.salt-segment__opt \{[^}]*min-height: 44px/.test(R)
      && /@media \(prefers-reduced-motion: reduce\) \{\s*\.salt-segment::before \{ transition: none; \}/.test(R) && /\.salt-segment__opt:disabled[^{]*\{[^}]*opacity/.test(R),
      "the Counter carries the slider: equal columns, 44px options, still under reduced motion, a greyed option");

    /* ---- 2 and 3: the customer's page ---- */
    const A = await open({ pageWork, orders: [ord("c1", "done", ago(300), { paid: 100, moved: 1 }), ord("c2", "placed", ago(100)), ord("c3", "acknowledged", ago(50))] });
    wins.push(A);
    /* 26 Oct 2026, his word ("like settings on an iPhone"): the customer's Look is one Switch, Tide off and greyed while Tide is off */
    const tide = A.d.querySelector('#lookRow [data-look="tide"]');
    ok(!!tide && tide.classList.contains("salt-switch") && tide.getAttribute("role") === "switch" && tide.getAttribute("aria-checked") === "false" && tide.disabled && !A.d.querySelector("#lookRow .lookset"),
      "the Look row is a switch, Tide off and greyed");
    tide.disabled = false; tide.click(); await A.settle();
    ok(A.d.documentElement.getAttribute("data-theme") === "night" && tide.getAttribute("aria-checked") === "false", "and a forced tap on Tide moves nothing");
    /* 26 Oct 2026, his word: the customer's This device is a list of settings too; a browser that cannot take notifications says Not here in
       its row and why on the one line under the list */
    const devList = A.d.querySelector("#thisDevice .salt-settings"), devLabels = devList ? [...devList.querySelectorAll(".salt-settings__label")].filter((n) => n.id !== "lockT").map((n) => n.textContent) : [];
    const pushRow = devList && [...devList.querySelectorAll(".salt-settings__row")].find((r) => r.querySelector(".salt-settings__label").textContent === "Notifications");
    ok(!!devList && J(devLabels) === J(["Notifications", "Tide theme"]) && !!pushRow && (pushRow.querySelector(".salt-settings__value") || {}).textContent === "Not here"
      && /cannot receive notifications/.test(A.d.getElementById("devNote").textContent),
      "This device is a list of settings, Notifications and Tide theme; with none on this browser its row says Not here and the line under the list says why: " + J(devLabels));
    const row = () => A.d.querySelector("#pOrder .otabs");
    const r1 = seg(row());
    ok(row() && row().classList.contains("salt-segment") && r1.n === "4" && r1.i === "0" && r1.on === "1000" && row().querySelectorAll(".salt-segment__count").length === 4
      && [...row().querySelectorAll("button")].every((b) => b.classList.contains("salt-segment__opt")),
      "the Orders tabs are a slider of four, each with its count, the thumb on All: " + J(r1));
    row().querySelector('[data-otab="pay"]').click(); await A.settle();
    const r2 = seg(row()), sel = [...row().querySelectorAll("button")].map((b) => b.getAttribute("aria-selected") === "true" ? 1 : 0).join("");
    ok(r2.i === "2" && r2.on === "0010" && sel === "0010", "a tap on To pay moves the thumb, the active mark and aria-selected together: " + J([r2, sel]));
    const mf = A.d.getElementById("mfil");
    ok(mf && mf.classList.contains("salt-settings") && !mf.classList.contains("salt-segment") && !mf.classList.contains("salt-tabs"), "the months are a select in a settings row (28 Oct 2026), never a strip of pills");

    /* ---- 4 and 5: Salt Admin ---- */
    const errs = [], vc = new VirtualConsole(); vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
    let work;
    const dom = new JSDOM(P.landingPage("", "nco", { master: "fixture-master", accounts: [] }), { url: "https://counter.fixture.test/all", runScripts: "dangerously",
      pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
        Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
        w.scrollTo = () => {}; w.confirm = () => true; w.setTimeout = () => 0; w.clearTimeout = () => {}; w.setInterval = () => 0; w.clearInterval = () => {};
        w.localStorage.setItem("salt-look", "night");
        w.fetch = async () => ({ ok: true, status: 200, type: "basic", json: async () => EMPTY });
        work = pageWork(w);
      } });
    wins.push({ close: () => dom.window.close() });
    const d = dom.window.document;
    await work.quiet();
    /* 25 Oct 2026 (Record redesign P1, his Ask A): Record's three left the slider for the Nav bar's text tabs (test/admin-record-menu.mjs) */
    const rec = d.querySelector('.aparts[data-place="record"]');
    const picked = () => [...rec.querySelectorAll("button")].map((b) => (b.getAttribute("aria-selected") === "true" ? 1 : 0)).join("");
    ok(rec && !rec.classList.contains("salt-segment") && !rec.classList.contains("salt-tabs") && [...rec.querySelectorAll("button")].every((b) => b.classList.contains("salt-nav__link") && !b.classList.contains("salt-segment__opt")),
      "Salt Admin's Record strip is the Nav bar's tabs, never the slider or pills: " + (rec && rec.className));
    const go = async (h) => { dom.window.location.hash = h; dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange")); await work.quiet(); };
    await go("#record/pricing");
    const g1 = picked();
    await go("#record/customers");
    const g2 = picked();
    ok(g1 === "001" && g2 === "010", "and the part entered is the tab selected, Pricing then Customers: " + J([g1, g2]));
    /* 25 Oct 2026 (canvas Salt Admin Customers): Customers' parts are the slider, the tight one; its thumb follows a part, and a hidden option takes no column */
    const cu = d.querySelector('.aparts[data-place="customers"]');
    ok(!!cu && cu.classList.contains("salt-segment") && cu.classList.contains("salt-segment--tight") && !cu.classList.contains("salt-tabs")
      && Number(seg(cu).n) >= 2 && [...cu.querySelectorAll("button")].every((b) => b.classList.contains("salt-segment__opt")),
      "Salt Admin's Customers strip is a tight slider: " + J(cu && seg(cu)));
    const firstPart = cu.querySelector("button[data-part]");
    firstPart.hidden = true;
    await go("#customers/links");
    const g3 = seg(cu), shown = [...cu.querySelectorAll("button")].filter((b) => !b.hidden).length;
    ok(g3.n === String(shown) && g3.i === "1", "an option hidden leaves the columns: the thumb on Links, the second shown: " + J(g3));
    firstPart.hidden = false;
    /* 22 Oct 2026 (canvas Needs you): Needs you's kinds left the pills for the Nav bar's text tabs (test/admin-ac-glance.mjs), so they are neither pills nor the slider */
    /* 25 Oct 2026 (Salt Admin Shop and Orders): Shop's parts and Orders' two rows left the pills for the Nav bar's text tabs too */
    const kinds = d.querySelector(".nchips"), navs = ['.aparts[data-place="shop"]', ".oparts--stages .aparts", ".oparts--minor .aparts"].map((s) => [s, d.querySelector(s)]);
    const navOk = navs.map(([s, g]) => [s, !!g && !g.classList.contains("salt-segment") && [...g.querySelectorAll("button")].every((b) => b.classList.contains("salt-nav__link"))]);
    ok(!!kinds && !kinds.classList.contains("salt-segment") && [...kinds.querySelectorAll("button")].every((b) => b.classList.contains("salt-nav__link")) && navOk.every((x) => x[1]),
      "the kinds, Shop's parts and Orders' two rows are the Nav bar's tabs, never the slider: " + J(navOk));
    /* 26 Oct 2026, his word: Salt Admin's look is one Switch now, Tide on or off */
    const al = d.querySelector("#lookRow .salt-switch");
    ok(!!al && al.getAttribute("role") === "switch" && !d.querySelector("#lookRow .lookset"), "Salt Admin's Look row is a switch, not the slider");
    ok(errs.length === 0, "and his page drew without an error: " + J(errs.slice(0, 2)));

    /* ---- 6 ---- */
    const own = P.landingPage("abcd-efgh", "nxx", null).replace(/\/\*[\s\S]*?\*\//g, "");
    const low = [...own.matchAll(/([^{}]*(?:\.otabs|\.lookset|\.salt-segment)[^{}]*)\{([^}]*)\}/g)].filter((m) => /min-height\s*:\s*(?!\s)(?!44px|var\(--salt-tap\))/.test(m[2]) || /(?:^|;)\s*height\s*:/.test(m[2]));
    ok(low.length === 0, "no rule of the page lowers a slider's option under 44px: " + J(low.map((m) => m[0].slice(-80))));
  } finally {
    for (const w of wins) try { w.close(); } catch (e) { /* closed */ }
  }
}
