/* test/admin-look.mjs: SALT ACCOUNT WEARS NIGHT OR TIDE, CHOSEN ON ITS OWN (his word of 11 Oct 2026; docs/STATEMENTS.md "His look").
 *
 * Two themes, kept per device (localStorage salt-look on the Counter's origin), Tide until one is chosen. Salt Account (`/all`, built by
 * landingPage with an owner, its script stmt/owner.js) opens in the stored theme from the head script it shares with the customer's
 * page; this adds what the customer's page already has: the choice Sheet over the page on a first open, and a Look row to change it
 * later, here in a fourth part of Shop, This device. Every assertion observes the page's window, a sign-in's worth of reads stubbed.
 * What is proved, each check red under its own mutation (test/admin-look.mutations.json, run with tools/section.mjs):
 *   1  the markup: the part, the row and the Sheet, each control with its act, in the places they belong, each id once
 *   2  a first open with nothing kept: Tide, the Sheet over it, nothing yet stored, focus in the Sheet, Tab kept inside it
 *   3  a choice kept: Night or Tide as kept, no Sheet, the row marked; a value that is no theme counts as nothing
 *   4  a store that throws: Tide, no Sheet, no error, and the row still changes the visit
 *   5  choosing on the Sheet: applied at once with the bar, stored, closed with its scrim, no reload, and not asked again
 *   6  leaving the Sheet without choosing (Escape, Close, the scrim): Tide kept, nothing stored, asked again on the next open
 *   7  Shop > This device > Look: the part shows only the row, and a tap changes data-theme, the browser bar and storage, no reload
 *   8  an Access lapse wins: the Sheet comes down and the lapse screen is what is left
 *   9  the customer's page is drawn as it was: no act, no Shop wording, no owner call, the same stylesheet as his
 *  10  every tap target is 44px, read off the page's own rules */
import { JSDOM, VirtualConsole } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";
import { STATEMENT_CSS } from "../stmt/statement-css.js";
import { EN } from "../stmt/words.js";
import { byAct } from "./maker-act.mjs";

const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");
const toks = (css, re) => Object.fromEntries([...((strip(css).match(re) || ["", ""])[1]).matchAll(/--salt-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
const NIGHT = toks(STATEMENT_CSS, /:root\s*\{([^}]*)\}/), TIDE = { ...NIGHT, ...toks(STATEMENT_CSS, /:root\[data-theme="tide"\]\s*\{([^}]*)\}/) };
/* what every read on his page is answered with: empty lists, enough for it to draw */
const EMPTY = { ok: true, accounts: [], refs: [], tiers: [], claims: [], threads: [], pools: [], lines: [], orders: [], drafts: [], refused: [], queue: [] };
/* an element shows when nothing from it up to his page's root is hidden (jsdom's click() and querySelector ignore the attribute) */
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  const wins = [];
  /* his page in a window: a store seeded, or made to throw; reads answered with nothing, or with the Access login's 401 */
  const open = async ({ store, throws, lapse = false, hash = "" } = {}) => {
    const errs = [], vc = new VirtualConsole(); vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
    let work;
    const dom = new JSDOM(landingPage("", "nco", { master: "fixture-master", accounts: [] }), { url: "https://counter.fixture.test/all" + hash,
      runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
        Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
        w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {}; w.confirm = () => true;
        w.setTimeout = () => 0; w.clearTimeout = () => {}; w.setInterval = () => 0; w.clearInterval = () => {};
        w.addEventListener("error", (e) => errs.push(String(e.message)));
        if (throws) Object.defineProperty(w, "localStorage", { configurable: true, get() { throw new Error("SecurityError"); } });
        else for (const [k, v] of Object.entries(store || {})) w.localStorage.setItem(k, v);
        w.fetch = async () => (lapse ? { ok: false, status: 401, type: "basic", json: async () => ({}) } : { ok: true, status: 200, type: "basic", json: async () => EMPTY });
        work = pageWork(w);
      } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    await work.quiet();
    const state = () => {
      const sh = d.getElementById("lookSheet"), sc = d.getElementById("lookScrim");
      return { theme: d.documentElement.getAttribute("data-theme"), bar: d.querySelector('meta[name="theme-color"]').getAttribute("content"),
        sheet: !!sh && !sh.hidden, scrim: !!sc && !sc.hidden, kept: throws ? "(unreadable)" : w.localStorage.getItem("salt-look"),
        held: [...d.querySelectorAll("#lookRow [data-look]")].filter((x) => x.getAttribute("aria-pressed") === "true").map((x) => x.dataset.look).join("+") };
    };
    /* the device's look as this window holds it, to open the next window as the same device */
    const snap = () => (w.localStorage.getItem("salt-look") === null ? {} : { "salt-look": w.localStorage.getItem("salt-look") });
    const tap = async (act) => { const c = byAct(d, act); if (c) c.click(); await work.quiet(); return !!c; };   /* a missing control is a failed check, not a crash */
    return { w, d, errs, work, state, snap, tap };
  };
  const press = (w, key, o = {}) => w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...o }));
  const J = (o) => JSON.stringify(o);

  try {
    /* 1. THE MARKUP */
    const html = landingPage("", "look-nonce", { master: "fixture-master", accounts: [] });
    const p = await open({});
    const strip$ = p.d.querySelector('.aparts[data-place="shop"]');
    const pills = strip$ ? [...strip$.querySelectorAll("button")].map((b) => b.getAttribute("data-part") + ":" + b.textContent + ":" + b.getAttribute("data-act")) : [];
    ok(J(pills) === J(["hours:Hours:part.shop.hours", "notice:Notice:part.shop.notice", "practice:Practice:part.shop.practice", "device:This device:part.shop.device"]),
      "Shop has a fourth part, This device, after Hours, Notice and Practice, its tab with the act part.shop.device: " + J(pills));
    const once = (id) => p.d.querySelectorAll('[id="' + id + '"]').length;
    const row = p.d.getElementById("lookRow"), sec = p.d.getElementById("oLook");
    const rb = row ? [...row.querySelectorAll("[data-look]")] : [];
    ok(sec && sec.getAttribute("data-in") === "shop.device" && sec.closest("#oShop") && row && row.closest("#oLook") && once("lookRow") === 1
      && sec.querySelector("h2").textContent === "This device"
      && J(rb.map((b) => [b.dataset.look, b.textContent, b.getAttribute("data-act"), b.type])) === J([["night", EN["look.night"], "look.night", "button"], ["tide", EN["look.tide"], "look.tide", "button"]])
      && row.textContent.includes(EN["look.h"]),
      "its section holds the customer's Look row, Night and Tide, each button with its act, once on the page, named Look: " + J(rb.map((b) => b.getAttribute("data-act"))));
    const lead = sec && sec.querySelector("p.lead");
    ok(lead && lead.textContent === "Night or Tide for Salt Account on this device. Kept on this device; the Desk keeps its own.",
      "its lead says the choice is kept on this device and that the Desk keeps its own, not the Counter, whose pages on this device read the same key: " + J(lead && lead.textContent));
    const grp = row && row.querySelector('[role="group"]');
    ok(grp && p.d.getElementById(grp.getAttribute("aria-labelledby")).textContent.trim() === EN["look.h"], "the pair is grouped and named Look");
    const sh = p.d.getElementById("lookSheet"), tiles = sh ? [...sh.querySelectorAll("[data-look]")] : [];
    ok(sh && once("lookSheet") === 1 && once("lookScrim") === 1 && sh.parentElement === p.d.body && sh.previousElementSibling === p.d.getElementById("lookScrim")
      && p.d.getElementById("aEnded").nextElementSibling === p.d.getElementById("lookScrim"),
    "the Sheet and its scrim are drawn once, as children of the body beside the Access lapse screen, so the lapse can take the page from under them");
    ok(sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && p.d.getElementById(sh.getAttribute("aria-labelledby")).textContent.trim() === EN["look.sheetH"]
      && J(tiles.map((b) => [b.dataset.look, b.getAttribute("data-act")])) === J([["night", "look.sheet-night"], ["tide", "look.sheet-tide"]])
      && tiles.every((b) => b.classList.contains("salt-option__face--tap")) && sh.querySelector(".look-swatch--night") && sh.querySelector(".look-swatch--tide")
      && sh.querySelector("#lookX") && sh.querySelector("#lookX").getAttribute("data-act") === "look.sheet-close",
    "the Sheet is a modal dialog headed as the customer's is, with a tile for Night and one for Tide (the system's Option face as a tap, each with its swatch) and a Close, each with its act");
    const note = sh && sh.querySelector(".look-note");
    ok(note && /Shop/.test(note.textContent) && /This device/.test(note.textContent) && !/Account/.test(note.textContent) && note.textContent !== EN["look.note"],
      "and its line says where he changes it, Shop and This device, not the customer's Account: " + (note && J(note.textContent)));
    ok(p.errs.length === 0, "no error is raised opening his page (" + (p.errs.join(" | ") || "none") + ")");

    /* 2. A FIRST OPEN, NOTHING KEPT */
    const f = await open({});
    const s0 = f.state();
    ok(s0.theme === "tide" && s0.bar === TIDE.obsidian && s0.sheet && s0.scrim && s0.kept === null && s0.held === "tide",
      "on a device that has chosen nothing Salt Account opens Tide, its bar at Tide's ground, with the Sheet and its scrim over it and nothing yet stored: " + J(s0));
    ok(f.d.activeElement === f.d.getElementById("lookSheet"), "the Sheet takes focus as it opens");
    const lsh = f.d.getElementById("lookSheet"), fb = lsh ? [...lsh.querySelectorAll("button")] : [];
    if (fb.length) fb[fb.length - 1].focus();
    if (lsh) lsh.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    const wrapFwd = f.d.activeElement === fb[0];
    if (lsh) lsh.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    ok(fb.length === 3 && wrapFwd && f.d.activeElement === fb[fb.length - 1], "Tab from its last control wraps to its first, and Shift+Tab from the first to the last, so focus stays inside it");
    ok(f.errs.length === 0, "and no error is raised (" + (f.errs.join(" | ") || "none") + ")");

    /* 3. A CHOICE KEPT */
    const nn = await open({ store: { "salt-look": "night" } }), tt = await open({ store: { "salt-look": "tide" } }), bad = await open({ store: { "salt-look": "dusk" } });
    ok(nn.state().theme === "night" && nn.state().bar === NIGHT.obsidian && nn.state().held === "night" && !nn.state().sheet && !nn.state().scrim,
      "with night kept Salt Account opens Night, its bar at Night's ground, the row on Night and no Sheet: " + J(nn.state()));
    ok(tt.state().theme === "tide" && tt.state().bar === TIDE.obsidian && tt.state().held === "tide" && !tt.state().sheet, "with tide kept it opens Tide and asks nothing: " + J(tt.state()));
    ok(bad.state().theme === "tide" && bad.state().bar === TIDE.obsidian && bad.state().sheet, "a value that is no theme counts as nothing kept: Tide, and the Sheet: " + J(bad.state()));

    /* 4. A STORE THAT THROWS */
    const th = await open({ throws: true });
    const ts = th.state();
    ok(ts.theme === "tide" && ts.bar === TIDE.obsidian && !ts.sheet && !ts.scrim && th.errs.length === 0,
      "a device whose store throws opens Tide with no Sheet, since the answer could not be kept, and no error: " + J(ts) + " " + (th.errs.join(" | ") || "none"));
    await th.tap("nav.shop"); await th.tap("part.shop.device"); await th.tap("look.night");
    ok(th.state().theme === "night" && th.state().held === "night" && th.state().bar === NIGHT.obsidian && th.errs.length === 0,
      "and the row still changes the visit, whose store refuses the write (errors " + (th.errs.join(" | ") || "none") + ")");

    /* 5. CHOOSING ON THE SHEET */
    const c1 = await open({});
    c1.w.__same = 1;
    await c1.tap("look.sheet-night");
    const cn = c1.state();
    ok(cn.theme === "night" && cn.bar === NIGHT.obsidian && cn.kept === "night" && cn.held === "night" && !cn.sheet && !cn.scrim,
      "choosing Night on the Sheet applies it at once with the bar, stores it, marks the row and closes the Sheet and its scrim: " + J(cn));
    ok(c1.w.__same === 1 && c1.errs.length === 0, "with no reload and no error (" + (c1.errs.join(" | ") || "none") + ")");
    const again = await open({ store: c1.snap() });
    ok(again.state().theme === "night" && again.state().bar === NIGHT.obsidian && !again.state().sheet, "and the next open on that device wears Night and is not asked");
    const c2 = await open({});
    await c2.tap("look.sheet-tide");
    ok(c2.state().kept === "tide" && c2.state().theme === "tide" && c2.state().held === "tide" && !c2.state().sheet, "choosing Tide stores it too, and closes the Sheet: " + J(c2.state()));

    /* 6. LEAVING WITHOUT CHOOSING */
    const e1 = await open({});
    press(e1.w, "Escape");
    ok(!e1.state().sheet && !e1.state().scrim && e1.state().theme === "tide" && e1.state().kept === null, "Escape closes the Sheet with Tide kept and nothing stored: " + J(e1.state()));
    ok((await open({ store: e1.snap() })).state().sheet, "and the next open on that device asks again");
    const e2 = await open({});
    await e2.tap("look.sheet-close");
    ok(!e2.state().sheet && !e2.state().scrim && e2.state().kept === null && e2.state().theme === "tide", "Close does the same");
    const e3 = await open({});
    const scrim3 = e3.d.getElementById("lookScrim"); if (scrim3) scrim3.click();
    ok(!e3.state().sheet && !e3.state().scrim && e3.state().kept === null && e3.state().theme === "tide", "and so does a tap on the scrim");

    /* 7. SHOP > THIS DEVICE > LOOK */
    const a1 = await open({ store: { "salt-look": "night" } });
    a1.w.__same = 1;
    await a1.tap("nav.shop");
    ok(!shown(a1.d.getElementById("oLook")), "Shop opens on Hours, and the Look row is not shown there");
    await a1.tap("part.shop.device");
    const vis = ["makerSchedule", "makerBulletin", "mTest", "oLook"].filter((id) => shown(a1.d.getElementById(id))).join();
    ok(vis === "oLook" && a1.w.location.hash === "#shop/device" && a1.d.querySelector('.aparts[data-place="shop"] [data-part="device"]').getAttribute("aria-selected") === "true",
      "This device shows the Look row and no other section of Shop, its tab marked and its address #shop/device: " + vis + " " + a1.w.location.hash);
    await a1.tap("look.tide");
    const t1 = a1.state();
    ok(t1.theme === "tide" && t1.bar === TIDE.obsidian && t1.held === "tide" && t1.kept === "tide" && !t1.sheet,
      "Tide there changes data-theme and the browser bar, marks the row and keeps the choice: " + J(t1));
    await a1.tap("look.night");
    const t2 = a1.state();
    ok(t2.theme === "night" && t2.bar === NIGHT.obsidian && t2.held === "night" && t2.kept === "night", "and Night the same way: " + J(t2));
    ok(a1.w.__same === 1 && a1.errs.length === 0, "with no reload and no error (" + (a1.errs.join(" | ") || "none") + ")");
    const viaAddress = await open({ hash: "#shop/device" });
    ok(shown(viaAddress.d.getElementById("oLook")), "a page opened on #shop/device is on This device");
    const viaChoice = await open({});
    await viaChoice.tap("look.sheet-night");
    await viaChoice.tap("nav.shop"); await viaChoice.tap("part.shop.device");
    ok(viaChoice.state().held === "night", "a choice made on the Sheet is the one the row then holds: " + J(viaChoice.state()));

    /* 8. AN ACCESS LAPSE WINS */
    const lp = await open({ lapse: true });
    const ls = lp.state(), ended = lp.d.getElementById("aEnded");
    ok(ended && !ended.hidden && lp.d.body.classList.contains("ended") && !ls.sheet && !ls.scrim,
      "when the Access session has ended on a device that has chosen nothing, the lapse screen shows and the Sheet and its scrim are down: " + J(ls));
    const lc = await open({});
    ok(lc.state().sheet && lc.d.getElementById("aEnded").hidden && !lc.d.body.classList.contains("ended"), "though without a lapse the Sheet is up and the lapse screen is not");

    /* 9. THE CUSTOMER'S PAGE IS DRAWN AS IT WAS */
    const U = "ctab-cdef", cust = landingPage(U, "look-nonce", null);
    const doc = new JSDOM(cust).window.document;
    const cRow = doc.getElementById("lookRow"), cSheet = doc.getElementById("lookSheet");
    ok(cRow && cSheet && !cRow.querySelector("[data-act]") && !cSheet.querySelector("[data-act]") && cSheet.querySelector(".look-note").textContent === EN["look.note"]
      && !doc.getElementById("oLook") && !doc.querySelector('[data-part="device"]') && !/under Shop/.test(cSheet.textContent),
    "the customer's Look row and Sheet carry no act and say Account as they did, and his Shop part is not on her page");
    const bodyOf = (h) => h.replace(/<script nonce="[^"]*">[\s\S]*?<\/script>/g, "");
    const css = (h) => (h.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ["", ""])[1];
    ok(css(cust) === css(html) && css(cust).length > 1e5,
      "the customer's page and his carry one stylesheet: nothing was added for his page, so no rule of his can reach the customer's");
    const ownerScript = (html.match(/<script nonce="look-nonce">([\s\S]*?)<\/script>/g) || []).join("");
    ok(/lookAsk\(null, true\)/.test(ownerScript) && !/lookAsk\(null, true\)/.test(cust) && !/Shop, in This device|look\.sheet-|part\.shop\.device/.test(cust),
      "and the call that asks on his page's first open is on his page alone: " + J([/lookAsk\(null, true\)/.test(ownerScript), /lookAsk\(null, true\)/.test(cust)]));
    ok(bodyOf(cust).includes('data-look="night" aria-pressed="false" data-w="look.night">') && bodyOf(cust).includes('data-look="tide" aria-pressed="true" data-w="look.tide">'),
      "the customer's two buttons are drawn with the attributes they had, and no more");

    /* 10. TAP TARGETS, OFF THE PAGE'S OWN RULES: a recipe that sets 44px both ways, or the token it sets them from */
    const w0 = p.w, rules = [];
    for (const sheetCss of w0.document.styleSheets) for (const r of sheetCss.cssRules) if (r.selectorText) rules.push(r);
    const tap = Number.parseInt(NIGHT.tap, 10);
    const px = (v) => { const m = /^var\(--salt-tap\)$/.test(String(v).trim()) ? tap : Number.parseFloat(v); return Number.isFinite(m) ? m : 0; };
    const size = (el) => {
      let h = 0, wd = 0;
      for (const r of rules) {
        let hit = false;
        try { hit = !/:(hover|focus|active|disabled)|::/.test(r.selectorText) && el.matches(r.selectorText); } catch (e) { hit = false; }
        if (!hit) continue;
        h = Math.max(h, px(r.style.getPropertyValue("min-height")), px(r.style.getPropertyValue("height")));
        wd = Math.max(wd, px(r.style.getPropertyValue("min-width")), px(r.style.getPropertyValue("width")));
      }
      return [h, wd];
    };
    const targets = { "Look: Night": rb[0], "Look: Tide": rb[1], "Sheet: Night": tiles[0], "Sheet: Tide": tiles[1], "Sheet: Close": sh && sh.querySelector("#lookX"),
      "tab: This device": strip$ && strip$.querySelector('[data-part="device"]') };
    const small = Object.entries(targets).filter(([, el]) => !el || size(el).some((n) => n < 44) && !(el.classList && el.classList.contains("look-tile") && size(el)[0] >= 44)).map(([k]) => k);
    ok(tap === 44 && Object.values(targets).every(Boolean) && small.length === 0,
      "every control of the look is 44px both ways by the page's own rules (the Sheet's tiles by their height, their width being the grid's)" + (small.length ? ", and these are not: " + J(small) : ""));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
