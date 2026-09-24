/* tools/stmt-style.mjs: THE STATEMENT IN THE SALT IDENTITY.
 *
 * v472 put the Salt design system onto the desk (docs/DESIGN.md). The statement was left
 * behind: it still carried the pre-identity scheme in hardcoded hexes, #0f1115 and #2a3140
 * and #ffc75a, so the one document a customer ever sees was the only surface not drawn in
 * the product's own material.
 *
 * ONE COPY OF THE TOKENS, NOT A SECOND. The :root block is read out of design/salt-ds.css at
 * generation time rather than transcribed, so a retune of the design system reaches the
 * statement with nothing to keep in step. What is NOT carried over is the rest of that file:
 * the salt- recipes are a desk vocabulary and a statement uses none of them, so inlining all
 * 45KB into every one of thirty-five standalone documents, every month, would be weight in
 * the repo for nothing. The tokens are the part that must not drift, and they are 3KB.
 *
 * THE THREE SEMANTIC WORDS ARE READ FROM THE CUSTOMER'S SIDE, and that is a real decision
 * rather than an oversight. On the desk, verdigris is "settled and owed to you" and ember is
 * "what you owe", where "you" is the owner. This document is read by the buyer, so the same
 * two words point the other way round: HIS outstanding balance is ember, because it is what
 * he owes, and salt still to collect is verdigris, because it is owed to him. Keeping the
 * desk's polarity here would print a customer's debt in the colour of a settled account.
 * Steel stays pending in both readings. There is no fourth colour: a gift is not a state, so
 * it is mist, and a cancelled line is struck through rather than coloured.
 *
 * THE WORKER CANNOT READ A FILE, AND THIS FILE DOES. That is what broke the first attempt:
 * the unlock page imported this module, so the Worker bundle pulled in node:fs, node:path and
 * node:url, and the Cloudflare build failed. Even had it bundled, readFileSync would have
 * thrown on every request. So the stylesheet is GENERATED into stmt/statement-css.js by
 * `node tools/stmt-style.mjs --sync`, the statements Worker imports that plain constant, and
 * `--check` proves the generated copy is what this file produces. It is the same arrangement
 * the engines, the book and the geography already use: one source, a generated copy where the
 * source cannot reach, and CI holding the two together.
 *
 * PRINT IS NOT AN AFTERTHOUGHT. These are printed and photographed, and a dark page prints as
 * a black rectangle or not at all, so the print block inverts to ink on white and keeps the
 * three semantic words legible as ink colours.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The design system's own :root block, verbatim. */
export function saltTokens() {
  const css = readFileSync(join(REPO, "design", "salt-ds.css"), "utf8");
  const m = /:root\s*\{[\s\S]*?\n\}/.exec(css);
  if (!m) throw new Error("stmt-style: no :root block in design/salt-ds.css");
  return m[0];
}

/** The brand faces' @font-face rules, vendored as design/fonts.css (22 Sep 2026): the page carries
    them first and the Worker serves the files they name from stmt/fonts.js.
    THE ADDRESS IS MADE ABSOLUTE HERE (stage 1 of the Counter redesign, 24 Sep 2026). The vendored
    rules say url(fonts/...), which is right beside the desk and wrong on this site: the page is also
    served at /s/<token> and /g/<id>, where a relative url asks /s/fonts/ and /g/fonts/, and the Worker
    serves the faces at /fonts/ alone. The desk's copy is untouched. */
export function fontFaceCss() {
  const css = readFileSync(join(REPO, "design", "fonts.css"), "utf8").split("url(fonts/").join("url(/fonts/");
  if (/url\((?!\/fonts\/)/.test(css)) throw new Error("stmt-style: a face in design/fonts.css is not under fonts/, so the site would not serve it");
  return css;
}

/* THE SYSTEM'S RECIPES THE SITE USES, VERBATIM (22 Sep 2026, his instruction that the Counter use
   the design system rather than restate it): the one filled button, the quiet one, the field, the
   tab strip and the state chip, sliced by their headers out of the same vendored stylesheet as the
   tokens. The page carries them beside the tokens, so a recipe changed upstream reaches the
   customer at the next sync, and the page's own layer decides only geometry. */
const RECIPE_HEADS = [
  "/* ---- Pill button ---- */", "/* ---- Fields ---- */", "/* ---- Tab strip ---- */",
  "/* ---- Status chip:", "/* ---- Ghost button:", "/* ---- Status chip, the added tones ---- */",
];
export function siteRecipes() {
  const css = readFileSync(join(REPO, "design", "salt-ds.css"), "utf8");
  const out = RECIPE_HEADS.map((h) => {
    const i = css.indexOf(h);
    if (i < 0) throw new Error("stmt-style: no recipe headed " + h + " in design/salt-ds.css");
    const j = css.indexOf("\n/* ---- ", i + h.length);
    return css.slice(i, j < 0 ? css.length : j);
  }).join("\n")
    /* NOT THE SELECT. The recipe draws its chevron with a data: image, and this site's page loads
       NOTHING, a data: URL included (asserted since v694): its own select.fld draws the chevron
       out of two gradients and keeps it. Stripped here, and a url( anywhere else in a recipe
       stops the generation rather than the suite. */
    .replace(/\n\.salt-field__input\.salt-field__select \{[^}]*\}/, "")
    .replace(/\n\.salt-field__select option \{[^}]*\}/, "");
  if (/url\(/.test(out)) throw new Error("stmt-style: a site recipe carries a url(), which the page may not load");
  return out;
}

/* The statement's own layer. Class names are the ones stmtDoc already emits: this is a
   change of material, not a rewrite of the markup, for the same reason v472 was a layer. */
const LAYER = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;padding:44px 20px 60px;
  color:var(--salt-text);
  background:
    radial-gradient(1200px 640px at 82% -12%, rgba(184,115,51,.16) 0%, transparent 62%),
    radial-gradient(900px 560px at -10% 6%, rgba(197,160,89,.10) 0%, transparent 58%),
    var(--salt-obsidian);
  background-attachment:fixed;
  font-family:var(--salt-font-display);
  font-size:var(--salt-text-md);line-height:1.6;-webkit-font-smoothing:antialiased}

/* FIGURES IN MONO, SENTENCES IN THE DISPLAY FACE. Decision 3 of the identity, and the whole
   figure vocabulary of a statement is listed here once. */
.dt,.q,.amt,.u,.tr span:last-child,.owedv,.who,.idx td,.mini td,.mini th,.pw,
.ok,.due,.pend,.cx,.owedunits,.gift,.nilamt,.eyebrow,.whol,th,.rvh,.slab
  {font-family:var(--salt-font-mono);font-variant-numeric:tabular-nums}

.w{max-width:620px;margin:0 auto}
.eyebrow{font-size:var(--salt-text-xs);letter-spacing:.32em;color:var(--salt-copper);
  font-weight:700;margin:0 0 10px;text-transform:uppercase}
h1{margin:0;font-size:var(--salt-text-2xl);font-weight:600;letter-spacing:-.01em;line-height:1.12;
  font-family:var(--salt-font-display)}
.meta{color:var(--salt-text-muted);font-size:var(--salt-text-sm);margin:10px 0 0}
.whol{font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700;margin:0}
.whol.gap1{margin:26px 0 0}.whol.gap2{margin:30px 0 0}
.who{margin:8px 0 4px;font-size:var(--salt-text-lg);font-weight:700;color:var(--salt-text);
  letter-spacing:.06em}
/* brass leads the hairlines: decision 1 */
.rule{height:1px;background:var(--salt-line);margin:24px 0 4px;border:0}

.tblw{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;min-width:340px}
/* UX1, 24 Sep 2026: A LIVE TABLE FITS THE PHONE'S COLUMN. Held at 340px inside a box of 280 to 335, the
   Status column was cut mid-word with nothing to say the box scrolls; the long status line wraps instead,
   and the box stays only as the net. .tblw is on live documents alone, so a sealed issue keeps the look it
   was issued with. */
.tblw table{min-width:0}
.tblw .owedunits{white-space:normal}
table.rft{margin-top:10px}
th{font-size:var(--salt-text-xs);letter-spacing:.16em;text-transform:uppercase;
  color:var(--salt-text-muted);font-weight:700;padding:0 0 10px;text-align:right;white-space:nowrap}
th.l{text-align:left}
td{padding:15px 0;border-bottom:1px solid var(--salt-line-faint);text-align:right;vertical-align:top}
td.l{text-align:left}
.dt{font-size:var(--salt-text-md);color:var(--salt-text)}
.nodt{color:var(--salt-text-muted)}
.sub2{font-size:var(--salt-text-sm);color:var(--salt-text-muted);margin-top:4px;
  font-family:var(--salt-font-display)}
.rsn{font-size:var(--salt-text-sm);color:var(--salt-text-muted);font-family:var(--salt-font-display)}
.q{font-size:var(--salt-text-md);color:var(--salt-mist-light)}
.u{font-size:var(--salt-text-xs);color:var(--salt-text-muted);margin-left:5px}
/* v782: THE BOOK'S MARK, beside the quantity it qualifies. It takes the row's own colour rather
   than the book's hue, because a statement is read on paper as often as on a screen and a hue
   that survives one may not survive the other; the SHAPE is what carries the meaning, which is
   why the shape is also the accessible name. .sr is the name for a screen reader and is off the
   page rather than display:none, which would take it out of the accessibility tree as well. */
.pm{display:inline-flex;align-items:center;margin-right:5px;vertical-align:-1px;color:var(--salt-text-muted)}
.pm .psym{display:block}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.amt{font-size:var(--salt-text-lg);font-weight:700;color:var(--salt-text)}

/* THE THREE WORDS. Each is a mono word in its colour; nothing here is a filled badge. */
.ok{font-size:var(--salt-text-sm);color:var(--salt-verdigris);letter-spacing:.02em}
.due{font-size:var(--salt-text-sm);font-weight:700;color:var(--salt-ember);white-space:nowrap}
.pend{color:var(--salt-steel);font-weight:700;font-size:var(--salt-text-sm);letter-spacing:.02em}
.owedunits{font-size:var(--salt-text-sm);color:var(--salt-verdigris);margin-top:5px;
  font-weight:600;white-space:nowrap}
.cx{color:var(--salt-text-muted);font-weight:700;font-size:var(--salt-text-sm);letter-spacing:.02em}
.cxn{color:var(--salt-text-muted);font-weight:600}
.cxr{text-decoration:line-through;text-decoration-thickness:1px;opacity:.45}
.gift{font-size:var(--salt-text-sm);color:var(--salt-mist-light);letter-spacing:.02em;white-space:nowrap}
.nilamt{color:var(--salt-text-muted);font-weight:400}

.tot{margin-top:30px}
.tr{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:8px 0;
  font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.tr span:last-child{color:var(--salt-text);white-space:nowrap}
.tr.big{margin-top:10px;padding-top:16px;border-top:1px solid var(--salt-line);
  font-size:var(--salt-text-xl);font-weight:700;color:var(--salt-text)}
.tr.big span:last-child{color:var(--salt-ember)}
.tr.big.clear span:last-child{color:var(--salt-verdigris)}
.tr.sub{color:var(--salt-text-muted);font-size:var(--salt-text-sm)}

/* GLASS ONCE: a pane is white 3% with a brass hairline. A pane inside a pane is flat. */
.owed,.rec{margin-top:26px;border:1px solid var(--salt-line);border-radius:var(--salt-radius-md);
  background:var(--salt-glass)}
.owed{padding:20px 22px}
.owedl{margin:0;font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700}
.owedv{margin:8px 0 0;font-size:var(--salt-text-2xl);font-weight:700;color:var(--salt-verdigris);
  letter-spacing:-.01em}
.owedv>span:last-child{font-size:var(--salt-text-md);font-weight:600;margin-left:6px;color:var(--salt-text-muted)}
.owedn{margin:12px 0 0;font-size:var(--salt-text-sm);color:var(--salt-text-muted);line-height:1.6}
.rec{padding:22px 22px 8px}
.recl{margin:0 0 18px;font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700}
.stp{display:flex;gap:14px;margin-bottom:20px}
.stpn{flex:0 0 24px;height:24px;border-radius:var(--salt-radius-pill);border:1px solid var(--salt-line);
  color:var(--salt-brass);font-size:var(--salt-text-xs);font-weight:700;font-family:var(--salt-font-mono);
  display:flex;align-items:center;justify-content:center;line-height:1}
.stpb{flex:1 1 auto;min-width:0}
.stpt{margin:0;font-size:var(--salt-text-md);font-weight:600;color:var(--salt-text);line-height:1.5}
.stpd{margin:7px 0 0;font-size:var(--salt-text-sm);color:var(--salt-text-muted);line-height:1.65}
table.mini{width:100%;border-collapse:collapse;margin-top:10px;min-width:0}
table.mini th{font-size:var(--salt-text-xs);letter-spacing:.14em;padding:0 0 6px;color:var(--salt-text-muted)}
table.mini td{padding:8px 0;font-size:var(--salt-text-sm);border-bottom:1px solid var(--salt-line-faint);
  color:var(--salt-mist-light)}
table.mini tr.tot td{border-bottom:0;border-top:1px solid var(--salt-line);font-weight:700;
  color:var(--salt-text);padding-top:9px}
table.mini tr.sub td{border-bottom:0;color:var(--salt-text);font-weight:700}
b.short{color:var(--salt-ember)}
.recn{margin:2px 0 16px;font-size:var(--salt-text-sm);color:var(--salt-text-muted);line-height:1.65;
  border-top:1px solid var(--salt-line-faint);padding-top:14px}
.note{margin-top:34px;font-size:var(--salt-text-sm);color:var(--salt-text-muted);line-height:1.7}

/* The QR block. A code on paper is only useful if what it opens is written beside it. */
.qrb{margin-top:34px;display:flex;gap:20px;align-items:center;
  border-top:1px solid var(--salt-line);padding-top:26px}
.qrb svg{border-radius:var(--salt-radius-sm);display:block;flex:0 0 auto}
.qrt{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted);line-height:1.7}
.qrt code{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);color:var(--salt-brass);
  word-break:break-all}
@media (max-width:460px){.qrb{flex-direction:column;align-items:flex-start}}

@media print{
  body{background:#fff;color:#111;padding:24px}
  .eyebrow,.whol,.owedl,.recl{color:#8a5a20}
  .meta,.note,.sub2,.u,.nilamt,.cxn,.cx,.stpd,.recn,.qrt,.rsn,.nodt{color:#555}
  .q,.mini td{color:#333}
  .ok,.owedunits,.tr.big.clear span:last-child,.owedv{color:#1d6b52}
  .due,.tr.big span:last-child,b.short{color:#a8442c}
  .pend{color:#41586e}
  .gift{color:#555}
  td{border-color:#ddd}.rule,.tr.big{border-color:#c9ad74}
  .tr{color:#333}.tr span:last-child,.amt,.dt{color:#111}
  .owed,.rec{background:#fbfaf7;border-color:#d8c79c}
  .stpn{color:#8a5a20;border-color:#d8c79c}
  .stpt{color:#111}
  .qrb{border-color:#ddd}.qrt code{color:#8a5a20}
}`;

/** The whole stylesheet for a statement document. */
export function statementCss() {
  return saltTokens() + LAYER;
}

/* The review sheet's own additions. It is his page and not a customer's, so it carries the
   two things a statement must never: every account side by side, and the passwords. */
export const REVIEW_CSS = `
.rv{max-width:960px;margin:0 auto 40px}
.rvh{font-size:var(--salt-text-xs);letter-spacing:.3em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700;margin:0 0 10px}
.rvt{margin:0 0 8px;font-size:var(--salt-text-2xl);font-weight:600;letter-spacing:-.01em}
.rvs{color:var(--salt-text-muted);font-size:var(--salt-text-sm);margin:0 0 26px;line-height:1.7}
.rvs b{color:var(--salt-text)}
.idxw{overflow-x:auto;-webkit-overflow-scrolling:touch}
.idx{width:100%;border-collapse:collapse;margin-bottom:14px;min-width:760px}
.idx th{font-size:var(--salt-text-xs);letter-spacing:.16em;text-transform:uppercase;
  color:var(--salt-text-muted);font-weight:700;padding:0 10px 9px;text-align:right;
  border-bottom:1px solid var(--salt-line);white-space:nowrap}
.idx th.l{text-align:left}
.idx td{padding:11px 10px;border-bottom:1px solid var(--salt-line-faint);text-align:right;
  font-size:var(--salt-text-sm)}
.idx td.l{text-align:left}.idx td.r{text-align:right}
.idx a{color:var(--salt-brass);text-decoration:none;font-weight:700}
.idx a:hover{text-decoration:underline}
.idx tr.f-owes{background:rgba(212,105,76,.07)}
.idx tr.f-goods{background:rgba(111,174,151,.07)}
.idx tr.f-pend{background:rgba(142,162,182,.07)}
/* v454's fourth flag: money owed back TO a customer. It is the owner's liability, so it takes
   ember like anything else he owes, and the row tint follows the same reading. */
.idx tr.f-refund{background:rgba(212,105,76,.07)}
b.owe{color:var(--salt-ember)}b.gd{color:var(--salt-verdigris)}b.pd{color:var(--salt-steel)}
b.rf{color:var(--salt-ember)}
.pw{font-size:var(--salt-text-sm);color:var(--salt-brass);letter-spacing:.04em;white-space:nowrap}
.cut{margin:0;border:0;border-top:1px dashed var(--salt-line);padding:0}
.slab{max-width:960px;margin:34px auto 6px;font-size:var(--salt-text-xs);letter-spacing:.24em;
  text-transform:uppercase;color:var(--salt-copper);font-weight:700}
.warn{max-width:960px;margin:0 auto 26px;border:1px solid rgba(212,105,76,.4);
  border-radius:var(--salt-radius-md);padding:16px 20px;background:rgba(212,105,76,.08);
  color:var(--salt-mist-light);font-size:var(--salt-text-sm);line-height:1.7}
.warn b{color:var(--salt-ember)}
@media print{
  .rv,.slab{color:#111}.idx a{color:#8a5a20}.sheet{page-break-after:always}
  .rvs,.idx td{color:#333}.pw{color:#000}
  .warn{background:#fdf4f1;border-color:#e0a894;color:#333}
  .idx tr.f-owes,.idx tr.f-goods,.idx tr.f-pend{background:transparent}
}`;

/* ---- the generated copy, for the one consumer that cannot read a file ----------------
   stmt/statement-css.js is written from here and committed. The statements Worker imports
   it; nothing else should. `--check` is what stops it drifting from design/salt-ds.css, and it
   belongs in CI beside the engine, book and geography checks for exactly the same reason. */
const GENERATED = resolve(REPO, "stmt", "statement-css.js");

function moduleText() {
  return "/* GENERATED by `node tools/stmt-style.mjs --sync`. Do not edit.\n"
    + " *\n"
    + " * The statement stylesheet, baked flat so the statements Worker can serve its page\n"
    + " * without reading a file: a Worker has no filesystem, and tools/stmt-style.mjs reads\n"
    + " * design/salt-ds.css for its tokens. Edit that module or the design system, then sync.\n"
    + " * CI runs `--check` and fails if this file is not what the module produces.\n"
    + " */\n"
    + "export const STATEMENT_CSS = " + JSON.stringify(statementCss()) + ";\n"
    + "export const SITE_RECIPES = " + JSON.stringify(siteRecipes()) + ";\n"
    + "export const FONT_FACE_CSS = " + JSON.stringify(fontFaceCss()) + ";\n";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || "--check";
  const want = moduleText();
  if (mode === "--sync") {
    writeFileSync(GENERATED, want);
    console.log("wrote stmt/statement-css.js (" + want.length + " bytes)");
  } else if (mode === "--check") {
    const got = existsSync(GENERATED) ? readFileSync(GENERATED, "utf8") : "";
    if (got !== want) {
      console.error("stmt/statement-css.js is not what tools/stmt-style.mjs produces.");
      console.error("The design system or the statement layer changed and the copy was not synced.");
      console.error("Run: node tools/stmt-style.mjs --sync");
      process.exit(1);
    }
    console.log("stmt/statement-css.js matches tools/stmt-style.mjs");
  } else {
    console.error("usage: node tools/stmt-style.mjs [--sync|--check]");
    process.exit(2);
  }
}
