/* test/counter-c-labels.mjs: BOLDER LABELS (Counter Batch C, P1, item 20; his yes of 18 Oct 2026, 600 on his answer 1 of 20 Oct 2026).
 *
 * salt-ds 1.9.0 sets the eyebrow, the field label and the legend set as a label at 600, fields at 0.18em; the Desk's own section
 * label, its answer-box labels and its ledger column labels follow; the Counter carries the recipes through tools/stmt-style.mjs.
 * Each check reads the stylesheet as it ships; each was proved red by its own mutation (test/counter-c-labels.mutations.json).
 *   1  the vendored eyebrow at 600, its 0.24em kept
 *   2  the vendored field label at 600 and 0.18em
 *   3  the vendored legend set as a label at 600
 *   4  the Counter's carried eyebrow and field label at 600
 *   5  the Desk's own h2 at 600
 *   6  the Desk's answer-box label at 600 and 0.18em
 *   7  the Desk's ledger column label at 600 and 0.18em
 *   8  the master's DESIGN block is design/ as it stands: the h2 and the eyebrow at 600 in what the Desk serves */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(REPO, f), "utf8").replace(/\r\n/g, "\n");
/* the declarations of the first rule whose selector list ends with `head` and opens a block */
export function rule(css, head) {
  const i = css.indexOf(head + " {") >= 0 ? css.indexOf(head + " {") : css.indexOf(head + "{");
  if (i < 0) return {};
  const body = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i)).replace(/\/\*[\s\S]*?\*\//g, "");
  const out = {};
  for (const m of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const em = (v) => parseFloat(String(v).replace(/^\./, "0."));

export async function run({ ok }) {
  const ds = read("design/salt-ds.css");
  const eb = rule(ds, ".salt-eyebrow");
  ok(eb["font-weight"] === "600" && em(eb["letter-spacing"]) === 0.24, "the vendored eyebrow is 600 at 0.24em: " + JSON.stringify(eb));
  const fl = rule(ds, "label.salt-field__label");
  ok(fl["font-weight"] === "600" && em(fl["letter-spacing"]) === 0.18, "the vendored field label is 600 at 0.18em: " + JSON.stringify(fl));
  const lg = rule(ds, ".salt-options__legend--label");
  ok(lg["font-weight"] === "600", "the vendored legend set as a label is 600: " + JSON.stringify(lg));

  const { SITE_RECIPES } = await import(pathToFileURL(join(REPO, "stmt/statement-css.js")).href + "?" + Date.now());
  const ce = rule(SITE_RECIPES, ".salt-eyebrow"), cf = rule(SITE_RECIPES, "label.salt-field__label");
  ok(ce["font-weight"] === "600" && cf["font-weight"] === "600" && em(cf["letter-spacing"]) === 0.18,
    "the Counter carries the eyebrow and the field label at 600: " + JSON.stringify([ce["font-weight"], cf["font-weight"], cf["letter-spacing"]]));

  const desk = read("design/desk.css");
  const h2 = rule(desk, "\nh2");
  ok(h2["font-weight"] === "600", "the Desk's section label (h2) is 600: " + JSON.stringify(h2));
  const qf = rule(desk, ".qfield label");
  ok(qf["font-weight"] === "600" && em(qf["letter-spacing"]) === 0.18, "the Desk's answer-box label is 600 at 0.18em: " + JSON.stringify(qf));
  const lc = rule(desk, ".lclabel");
  ok(lc["font-weight"] === "600" && em(lc["letter-spacing"]) === 0.18, "the Desk's ledger column label is 600 at 0.18em: " + JSON.stringify(lc));

  const master = readFileSync(process.env.SALT_MASTER || join(REPO, "master", "salt_command.html"), "utf8").replace(/\r\n/g, "\n");
  const block = (name) => { const a = master.indexOf("/* ==== DESIGN " + name + ":"); return a < 0 ? "" : master.slice(a, master.indexOf("END DESIGN " + name + " ==== */", a)); };
  const mh = rule(block("desk"), "\nh2"), me = rule(block("base"), ".salt-eyebrow");
  ok(mh["font-weight"] === "600" && me["font-weight"] === "600", "the Desk serves the h2 and the eyebrow at 600: " + JSON.stringify([mh["font-weight"], me["font-weight"]]));
}
