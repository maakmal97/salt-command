/* test/admin-bar-foot.mjs: THE BAR OF FIVE PLACES STANDS ON THE SCREEN'S FOOT (12 Oct 2026, his iPhone report that on Record it did not).
 *
 * jsdom has no layout, so the pixels are measured in a real browser by tools/maker-forms-geometry.mjs: on every place, on Record's four parts and with each of its
 * seventeen forms open, at 375 and 768, Night and Tide, the bar's bottom is the visible screen's bottom. What the suite holds is what puts it there, each check red
 * under its own mutation (test/admin-bar-foot.mutations.json, run with tools/section.mjs):
 *   1  the bar is the system's fixed recipe, fixed to the screen's left, right and bottom, and it gives way to the rail from 1080px
 *   2  nothing re-frames it: it is a child of the page's shell, and no rule of the page puts a transform, filter, perspective, containment, will-change or container on the
 *      shell, the body or the root, any of which makes that ancestor the bar's frame in the screen's place
 *   3  on a phone the shell keeps the bar's height clear beneath its last control, and the body its safe area
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage } from "./maker-act.mjs";

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
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
