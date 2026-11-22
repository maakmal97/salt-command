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
 *   3  the Orders tabs are the system's four counted Filters (16 Nov 2026), and a tap presses the chosen one and lets the others go
 *   4  (16 Nov 2026, the move to Ambient) Salt Admin's Record and Customers strips are Ambient's Segment, the part entered the option pressed, a hidden option never the one pressed\n *   5  the strips that do not fit stay pills: the stages' arrows, Orders' second strip, the months; the kinds, Shop's and Orders' parts are Ambient's Segments, counted where they carry a count (16 Nov 2026)\n *   6  no rule of the page lowers a slider's option under 44px */
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
    /* 26 Oct 2026, his word: the customer's Look was one Switch; 15 Nov 2026, the move to Ambient: there is none, light and dark following the device */
    ok(!A.d.getElementById("lookRow") && !A.d.querySelector("[data-look]") && !A.d.querySelector(".lookset"),
      "no Look row is drawn: the device chooses light or dark");
    ok(!A.d.documentElement.hasAttribute("data-theme"), "and no theme is set on the page, signed in");
    /* 26 Oct 2026, his word: the customer's This device is a list of settings too; a browser that cannot take notifications says Not here in
       its row and why on the one line under the list */
    /* 16 Nov 2026, the move to Ambient (place D): This device is the system's settings group, a row a name and one control or value */
    const devList = A.d.querySelector("#thisDevice .amb-settings #devRows"), devLabels = devList ? [...devList.querySelectorAll('li[data-dev="own"] .amb-setting__name')].map((n) => n.textContent) : [];   /* 17 Nov 2026, the move to Ambient (Fable's review): This device is one list, the other devices' rows in it after these */
    const pushRow = devList && [...devList.querySelectorAll(".amb-setting")].find((r) => r.querySelector(".amb-setting__name").textContent === "Notifications");
    ok(!!devList && J(devLabels) === J(["Notifications"]) && !!pushRow && (pushRow.querySelector(".amb-setting__value") || {}).textContent === "Not here"
      && /cannot receive notifications/.test(A.d.getElementById("devNote").textContent),
      "This device is a list of settings, Notifications (Tide theme gone, 15 Nov 2026, the move to Ambient); with none on this browser its row says Not here and the line under the list says why: " + J(devLabels));
    const row = () => A.d.querySelector("#pOrder .otabs");
    /* 16 Nov 2026, the move to Ambient: the Orders tabs are the system's counted Filters (amb-segment--wrap, aria-pressed), no slider and no thumb */
    const on = () => [...row().querySelectorAll("button")].map((b) => (b.getAttribute("aria-pressed") === "true" ? 1 : 0)).join("");
    ok(row() && row().classList.contains("amb-segment") && row().classList.contains("amb-segment--wrap") && !row().classList.contains("salt-segment") && on() === "1000"
      && row().querySelectorAll(".amb-segment__count").length === 4 && [...row().querySelectorAll("button")].every((b) => b.classList.contains("amb-segment__opt")),
      "the Orders tabs are the system's four Filters, each with its count, All pressed: " + on());
    row().querySelector('[data-otab="pay"]').click(); await A.settle();
    ok(on() === "0010", "a tap on To pay presses it and lets go of All: " + on());
    const mf = A.d.getElementById("mfil");
    ok(mf && mf.classList.contains("mfil") && !mf.classList.contains("amb-segment") && !mf.querySelector(".amb-segment, .salt-tabs, .salt-segment"), "the months are a select (the system's Select, 16 Nov 2026), never a strip of pills");

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
    /* 16 Nov 2026, the move to Ambient (the red fix): every strip of Salt Admin is Ambient's Segment (amb-segment, its options amb-segment__opt, the chosen one aria-pressed); there is no thumb, no --n and no --i,
       and no salt-ds slider, tab bar or pill left */
    const pressedOf = (g) => [...g.querySelectorAll("button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-part") || b.getAttribute("data-chip"));
    const ambSeg = (g) => !!g && g.classList.contains("amb-segment") && !/salt-/.test(g.className) && [...g.querySelectorAll("button")].every((b) => b.classList.contains("amb-segment__opt") && !/salt-/.test(b.className));
    const picked = () => pressedOf(rec).join();
    ok(ambSeg(rec) && rec.querySelectorAll("button").length >= 3,
      "Salt Admin's Record strip is Ambient's Segment, never the slider or pills: " + (rec && rec.className));
    const go = async (h) => { dom.window.location.hash = h; dom.window.dispatchEvent(new dom.window.HashChangeEvent("hashchange")); await work.quiet(); };
    await go("#record/pricing");
    const g1 = picked();
    await go("#record/customers");
    const g2 = picked();
    ok(g1 === "pricing" && g2 === "customers", "and the part entered is the option pressed, Pricing then Customers: " + J([g1, g2]));
    /* 25 Oct 2026 (canvas Salt Admin Customers): Customers' parts are the slider, the tight one; its thumb follows a part, and a hidden option takes no column */
    const cu = d.querySelector('.aparts[data-place="customers"]');
    ok(ambSeg(cu) && cu.querySelectorAll("button").length >= 2,
      "Salt Admin's Customers strip is Ambient's Segment: " + J(cu && cu.className));
    const firstPart = cu.querySelector("button[data-part]");
    firstPart.hidden = true;
    await go("#customers/links");
    const g3 = pressedOf(cu), hiddenOnes = [...cu.querySelectorAll("button")].filter((b) => b.hidden);
    ok(hiddenOnes.length === 1 && hiddenOnes[0] === firstPart && g3.join() === "links" && firstPart.getAttribute("aria-pressed") !== "true",
      "an option hidden leaves the strip: it is not the one pressed, and Links, entered by its address, is the one marked: " + J(g3));
    firstPart.hidden = false;
    /* 22 Oct 2026 (canvas Needs you): Needs you's kinds left the pills for the Nav bar's text tabs (test/admin-ac-glance.mjs), so they are neither pills nor the slider */
    /* 25 Oct 2026 (Salt Admin Shop and Orders): Shop's parts and Orders' two rows left the pills for the Nav bar's text tabs too */
    /* 22 Nov 2026 (the place head): Settings' parts slide on one row and never wrap, and Needs you's kinds left the navigation for a pull-down menu of counted choices (#nKinds), so neither is a wrapping Segment */
    const kinds = d.getElementById("nKinds"), navs = ['.aparts[data-place="shop"]'].map((s) => [s, d.querySelector(s)]);
    const navOk = navs.map(([s, g]) => [s, ambSeg(g) && g.classList.contains("amb-segment--slide") && !g.classList.contains("amb-segment--wrap")]);
    ok(!!kinds && kinds.classList.contains("amb-filter__menu") && !/salt-|amb-segment/.test(kinds.className) && [...kinds.querySelectorAll(".amb-segment__count")].length > 0 && navOk.every((x) => x[1]),
      "the kinds (counted) are a pull-down menu and Settings' parts Ambient's sliding Segment, never wrapping and never the slider: " + J(navOk));
    const ordSeg = d.querySelector('.aparts[data-place="orders"]');
    ok(ambSeg(ordSeg) && [...ordSeg.querySelectorAll("button")].length >= 4 && [...ordSeg.querySelectorAll(".amb-segment__count")].length >= 4,
      "and Orders' parts are Ambient's Segment, each counted");
    /* 26 Oct 2026, his word: Salt Admin's look was one Switch; 15 Nov 2026, the move to Ambient: there is none */
    ok(!d.getElementById("lookRow") && !d.querySelector(".lookset"), "Salt Admin draws no Look row, the device choosing light or dark");
    ok(errs.length === 0, "and his page drew without an error: " + J(errs.slice(0, 2)));

    /* ---- 6 ---- */
    const own = P.landingPage("abcd-efgh", "nxx", null).replace(/\/\*[\s\S]*?\*\//g, "");
    const low = [...own.matchAll(/([^{}]*(?:\.otabs|\.lookset|\.salt-segment)[^{}]*)\{([^}]*)\}/g)].filter((m) => /min-height\s*:\s*(?!\s)(?!44px|var\(--salt-tap\))/.test(m[2]) || /(?:^|;)\s*height\s*:/.test(m[2]));
    ok(low.length === 0, "no rule of the page lowers a slider's option under 44px: " + J(low.map((m) => m[0].slice(-80))));
  } finally {
    for (const w of wins) try { w.close(); } catch (e) { /* closed */ }
  }
}
