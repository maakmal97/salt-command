/* test/page-width.mjs: ONE PAGE WIDTH ON EVERY SALT SURFACE (15 Nov 2026, his word: "fix the width so that they are all consistent across all Salt
 * apps"). The Desk's frame stood 1144px wide, the Counter's shell 1240px and Salt Admin's 1180px, then 1376px from a 1440px screen. salt-ds 1.32.0 holds
 * one token, --salt-page-max (1376px), and each surface's frame reads it at every width from 1080px. jsdom lays nothing out, so the rule is proved as each
 * surface's served stylesheets, read as rules and resolved at a screen width; the measured pages (the three frames the same box at 1180, 1366, 1440, 1536
 * and 1920) are the Chromium probe's, in the version's notes.
 *   W1  the Desk, the Counter and Salt Admin each carry the token at 1376px
 *   W2  the Desk's frame (.shell) stands at most the token wide and its wrap no longer caps it, at every width from 1080px
 *   W3  Salt Admin's frame (.gate.adm) stands at most the token wide at every width from 1080px, 1440 included
 *   W4  the Counter's shell (.cshell) stands at most the token wide at every width from 1080px
 * 15 Nov 2026, THE MOVE TO AMBIENT: the Counter and Salt Admin no longer wear salt-ds, so they carry no --salt-page-max. Each is one Ambient shell,
 * which lays itself out by its own width (container queries) and is never sized by the page; so W1 holds the token on the Desk alone, and W3 and
 * W4 hold that the page's own layer sizes neither shell. Ambient has no page width of its own for an app's shell yet: said in the kit's notes.
 * Every assertion is red under its own mutation (test/page-width.mutations.json). */
import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { landingPage, SITE_STYLE, AMB_STYLE } from "../stmt/page.js";
import { SITE_CSS } from "../stmt/statement-css.js";

const J = JSON.stringify;
const WIDTHS = [1080, 1180, 1366, 1440, 1920];
function flat(sheets) {
  const out = [];
  const walk = (rules, q) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules, (r.media && r.media.mediaText) || q); else if (r.selectorText) out.push({ sel: r.selectorText.trim(), style: r.style, q }); } };
  for (const s of sheets) walk(s.cssRules, "");
  return out;
}
const sheetsOf = (html) => new JSDOM("<!doctype html><html><head>" + [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => "<style>" + m[1] + "</style>").join("") + "</head></html>", { virtualConsole: new VirtualConsole() }).window.document.styleSheets;
/* a media condition at a screen width: min-width and max-width in px, a condition naming anything else (pointer, colour scheme) not held */
function holds(q, w) {
  if (!q) return true;
  let held = true;
  for (const m of q.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)) held = held && (m[1] === "min" ? w >= +m[2] : w <= +m[2]);
  return held && !/pointer|prefers|orientation|hover/.test(q);
}
/* the value a property takes for a selector at a width: the last rule in source order that sets it and holds there */
const at = (rules, sel, prop, w) => rules.filter((r) => r.sel === sel && r.style.getPropertyValue(prop) && holds(r.q, w)).map((r) => r.style.getPropertyValue(prop).trim()).pop() || "";
const token = (rules) => rules.filter((r) => r.sel === ":root" && !r.q).map((r) => r.style.getPropertyValue("--salt-page-max").trim()).filter(Boolean).pop() || "";

export async function run({ ok }) {
  const desk = flat(sheetsOf(readFileSync(process.env.SALT_MASTER || new URL("../master/salt_command.html", import.meta.url), "utf8")));
  const counter = flat(sheetsOf(landingPage("0000-0000", "pw-nonce")));
  const admin = flat(sheetsOf(landingPage("", "pw-nonce", { master: "fixture-master", accounts: [] })));
  const PAGE = "var(--salt-page-max)";
  /* the page's own layers (the site's layer and the page's older one), read as served after Ambient, which is the shell's own */
  const own = (html) => { const st = (/<style[^>]*>([\s\S]*?)<\/style>/.exec(html) || [, ""])[1]; return flat(sheetsOf("<style>" + st.slice(AMB_STYLE.length) + "</style>")); };
  const counterOwn = own(landingPage("0000-0000", "pw-nonce")), adminOwn = own(landingPage("", "pw-nonce", { master: "fixture-master", accounts: [] }));
  /* W1 */
  ok(token(desk) === "1376px" && token(counter) === "" && token(admin) === "",
    "W1 the Desk carries --salt-page-max at 1376px, and the Counter and Salt Admin, on Ambient, carry none: " + J([token(desk), token(counter), token(admin)]));
  /* W2 */
  const dShell = WIDTHS.map((w) => at(desk, ".shell", "max-width", w)), dWrap = WIDTHS.map((w) => at(desk, ".wrap", "max-width", w));
  ok(dShell.every((v) => v === PAGE), "W2.1 the Desk's frame is at most the page width at " + J(WIDTHS) + ": " + J(dShell));
  ok(dWrap.every((v) => v === "none"), "W2.2 the Desk's wrap caps nothing at " + J(WIDTHS) + ": " + J(dWrap));
  /* W3 */
  const sized = (rules, sels) => WIDTHS.map((w) => sels.map((sel) => ["max-width", "width", "height", "margin-inline", "margin-left", "margin-right"].map((p) => at(rules, sel, p, w)).join("")).join("")).filter(Boolean);
  const aGate = sized(adminOwn, ["#roster", ".adm", ".gate.adm", ".amb-shell", ".amb-screen", "#roster > .amb-screen"]);
  ok(aGate.length === 0 && admin.some((r) => r.sel === ".amb-shell" && /100dvh/.test(r.style.getPropertyValue("height"))),
    "W3 Salt Admin's shell is Ambient's, the screen's height, and the page's layer sizes it at none of " + J(WIDTHS) + ": " + J(aGate));
  /* W4 */
  const cShell = sized(counterOwn, ["#tabs", ".cshell", ".amb-shell", ".amb-screen"]);
  ok(cShell.length === 0 && counter.some((r) => r.sel === ".amb-shell"), "W4 the Counter's shell is Ambient's, and the page's layer sizes it at none of " + J(WIDTHS) + ": " + J(cShell));
}
