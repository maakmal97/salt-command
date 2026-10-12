/* test/admin-bar-foot.mjs: THE BAR OF FIVE PLACES STANDS ON THE SCREEN'S FOOT (12 Oct 2026, his iPhone report that on Record it did not).
 *
 * jsdom has no layout, so the pixels are measured in a real browser by tools/maker-forms-geometry.mjs: on every place, on Record's four parts and with each of its
 * seventeen forms open, at 375 and 768, Night and Tide, the bar's bottom is the visible screen's bottom. What the suite holds is what puts it there, each check red
 * under its own mutation (test/admin-bar-foot.mutations.json, run with tools/section.mjs):
 *   1  the bar is the system's fixed recipe, fixed to the screen's left, right and bottom, and it gives way to the rail from 1080px
 *   2  nothing re-frames it: it is a child of the page's shell, and no rule of the page puts a transform, filter, perspective, containment, will-change or container on the
 *      shell, the body or the root, any of which makes that ancestor the bar's frame in the screen's place
 *   3  on a phone the shell keeps the bar's height clear beneath its last control, and the body its safe area
 *   4  in the iPhone's saved app the document is the screen's height at least (his iPhone, 12 Oct 2026: a short place stood its bar 20pt and 55pt above the foot, a long one
 *      and Safari never did): the head script marks the root and sets --app-h from the screen, upright or lying down, in that app alone, and the body's min-height is it
 * Drawn by the maker harness (test/maker-act.mjs). */
import { JSDOM } from "jsdom";
import { richOwnerPage } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";

/* every rule of the page's sheets, with the media it stands in ("" for none) and its declarations */
const rulesOf = (w) => {
  const rules = [];
  for (const sheet of w.document.styleSheets) for (const r of sheet.cssRules) {
    if (r.selectorText) rules.push(["", r.selectorText, r.style]);
    else if (r.media) for (const x of r.cssRules) if (x.selectorText) rules.push([r.media.mediaText.replace(/\s+/g, ""), x.selectorText, x.style]);
  }
  return rules;
};
/* what makes an ancestor the containing block of a fixed descendant */
const FRAMES = ["transform", "translate", "rotate", "scale", "perspective", "filter", "backdrop-filter", "contain", "will-change", "container-type", "content-visibility", "offset-path"];
const QUIET = /^(none|auto|normal|initial|unset|revert|visible)?$/;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, rules = rulesOf(p.w), pick = (sel, media = "") => rules.filter((r) => r[0] === media && r[1] === sel).map((r) => r[2]);

    /* 1. THE RECIPE */
    const bar = d.querySelector("nav.salt-appbar"), recipe = pick(".salt-appbar"), rail = pick(".salt-appbar", "(min-width:1080px)");
    const zero = (k) => /^0(px)?$/.test(recipe[0].getPropertyValue(k));
    ok(!!bar && bar.querySelectorAll(".place").length === 5 && recipe.length === 1 && recipe[0].getPropertyValue("position") === "fixed" && zero("left") && zero("right") && zero("bottom")
      && rail.length === 1 && rail[0].getPropertyValue("display") === "none",
    "the bar of five places is the system's recipe, fixed to the screen's left, right and bottom, and gone from 1080px where the rail stands: " + (recipe[0] && recipe[0].cssText.slice(0, 120)));

    /* 2. NOTHING RE-FRAMES IT */
    const shell = bar && bar.parentElement, line = [shell, d.body, d.documentElement];
    const framed = [];
    for (const [media, sel, style] of rules) {
      let hit = false;
      try { hit = line.some((e) => e && e.matches(sel)); } catch (e) { hit = false; }
      if (hit) for (const k of FRAMES) if (!QUIET.test(style.getPropertyValue(k).trim())) framed.push([media, sel, k, style.getPropertyValue(k)]);
    }
    const touching = rules.filter(([, sel]) => { try { return line.some((e) => e && e.matches(sel)); } catch (e) { return false; } }).length;
    ok(!!shell && shell.id === "roster" && shell.classList.contains("adm") && touching > 3 && framed.length === 0,
      "the bar is a child of his page's shell and no rule of the " + touching + " that reach the shell, the body or the root frames it in the screen's place" + (framed.length ? ": " + JSON.stringify(framed) : ""));

    /* 3. THE ROOM KEPT UNDER THE LAST CONTROL */
    const phone = "(max-width:1079.98px)", shellBase = pick(".gate.adm"), shellPhone = pick(".gate.adm", phone), bodyPhone = pick("body", phone);
    ok(shellBase.length === 1 && /--salt-bar-h/.test(shellBase[0].getPropertyValue("padding-bottom")) && /safe-area-inset-bottom/.test(shellBase[0].getPropertyValue("padding-bottom"))
      && shellPhone.length === 1 && shellPhone[0].getPropertyValue("padding-bottom") === "var(--salt-bar-h)"
      && bodyPhone.length === 1 && /safe-area-inset-bottom/.test(bodyPhone[0].getPropertyValue("padding")),
    "the shell keeps the bar's height clear under its last control on a phone, and the body its safe area: " + JSON.stringify([shellBase, shellPhone, bodyPhone].map((r) => r[0] && r[0].cssText.slice(0, 110))));

    /* 4. THE SAVED APP'S DOCUMENT IS THE SCREEN TALL */
    const served = landingPage("", "bar-nonce", { master: "fixture-master", accounts: [] });
    const script = (served.match(/<script nonce="bar-nonce">([\s\S]*?)<\/script>/) || [, ""])[1];
    /* the page's head script run on an iPhone: the screen 393x852, the window upright or lying down, navigator.standalone as the phone sets it (true in the saved app,
       false in Safari, and absent where nothing sets it) */
    const iphone = ({ standalone, lying = false }) => {
      const w = new JSDOM('<!doctype html><html><head><meta name="theme-color" content="x"></head><body></body></html>', { runScripts: "outside-only" }).window;
      const set = (o, k, v) => Object.defineProperty(o, k, { value: v, configurable: true });
      if (standalone !== undefined) set(w.navigator, "standalone", standalone);
      set(w.screen, "width", 393); set(w.screen, "height", 852);
      const turn = (l) => { set(w, "innerWidth", l ? 852 : 393); set(w, "innerHeight", l ? 393 : 852); };
      turn(lying); w.eval(script);
      const r = w.document.documentElement;
      return { mark: () => r.getAttribute("data-app"), h: () => r.style.getPropertyValue("--app-h"), turn: (l) => { turn(l); w.dispatchEvent(new w.Event("resize")); } };
    };
    const up = iphone({ standalone: true }), down = iphone({ standalone: true, lying: true }), safari = iphone({ standalone: false }), other = iphone({});
    const read = [up.mark(), up.h(), down.h()];
    up.turn(true);
    ok(JSON.stringify(read) === '["1","852px","393px"]' && up.h() === "393px" && safari.mark() === null && safari.h() === "" && other.mark() === null && other.h() === "",
      "the head script marks the root and sets --app-h to the screen's height (852px upright, 393px lying down, and again when it turns) in the saved app alone, never in Safari or"
        + " where navigator.standalone is not set: " + JSON.stringify([read, up.h(), safari.mark(), other.mark()]));
    const bodyApp = pick("html[data-app] body", "(max-width:1079.98px)"), plain = pick("html[data-app] body");
    ok(bodyApp.length === 1 && plain.length === 0 && /html\[data-app\] body\{min-height:100vh;min-height:var\(--app-h,100vh\)\}/.test([...d.querySelectorAll("style")].map((x) => x.textContent).join("")),
      "under 1080px the saved app's body is at least --app-h tall, 100vh standing before it for a browser that lacks custom properties, and only the saved app's root is asked: " + (bodyApp[0] && bodyApp[0].cssText));
    /* the customer's page carries the bar too and its short places stand as exposed, so it has the same script and the same rule; a guest board has no bar and no script */
    const customer = landingPage("", "bar-nonce", undefined);
    ok(customer.includes(script) && customer.includes("html[data-app] body{min-height:100vh;min-height:var(--app-h,100vh)}"),
      "the customer's page has the same head script and the same rule, so a short place of theirs in the saved app is held as his is");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
