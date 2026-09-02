#!/usr/bin/env node
/* designsync.mjs — keep the design blocks inlined in the master equal to their files.
 *
 * The desk is one self-contained page and loads nothing, so it cannot link the design
 * system's stylesheet. It carries the text instead, between markers, exactly as it carries
 * the engine, the book and the geography; this is the tool that puts it there and proves it
 * is still there unchanged. Two blocks, both at the foot of the master's <style>, because
 * both are last-wins layers over the rules above them:
 *
 *   DESIGN base   design/salt-ds.css   the design system's stylesheet, vendored from
 *                                      Code/salt-ds/src/styles.css (tokens and recipes;
 *                                      the font import lives in fonts.css there and is
 *                                      deliberately not vendored: the CSP is self-only)
 *   DESIGN desk   design/desk.css      the desk's own layer, binding its class vocabulary
 *                                      to those tokens
 *
 *   node tools/designsync.mjs --pull    copy the design system's stylesheet into design/
 *                                       (from ../salt-ds, or $SALT_DS)
 *   node tools/designsync.mjs --sync    write both files into the master between the markers
 *   node tools/designsync.mjs --check   exit 1 if either block in the master is not its file
 *
 * THE FILES ARE THE SOURCE. Edit design/desk.css, or the design system and then --pull; run
 * --sync; build. An edit inside the markers is overwritten by the next --sync and fails
 * --check in CI until then. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = resolve(REPO, "master", "salt_command.html");
const DS_SRC = resolve(process.env.SALT_DS || resolve(REPO, "..", "salt-ds"), "src", "styles.css");
const BLOCKS = [
  { name: "base", file: resolve(REPO, "design", "salt-ds.css"),
    begin: "/* ==== DESIGN base: generated from design/salt-ds.css, vendored from Code/salt-ds src/styles.css, by tools/designsync.mjs. Edit the design system, --pull, --sync; never this block. ==== */",
    end: "/* ==== END DESIGN base ==== */" },
  { name: "desk", file: resolve(REPO, "design", "desk.css"),
    begin: "/* ==== DESIGN desk: generated from design/desk.css by tools/designsync.mjs. Edit the file, never this block. ==== */",
    end: "/* ==== END DESIGN desk ==== */" },
];

const text = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n").replace(/\n+$/, "");
const blockFor = (b) => b.begin + "\n" + text(b.file) + "\n" + b.end;

function locate(master, b) {
  const i = master.indexOf(b.begin);
  if (i < 0) return null;
  const j = master.indexOf(b.end, i);
  if (j < 0) throw new Error(`${b.name}: begin marker without an end marker`);
  if (master.indexOf(b.begin, i + 1) >= 0) throw new Error(`${b.name}: the begin marker appears twice`);
  return { i, j: j + b.end.length };
}

const mode = process.argv[2];
if (mode === "--pull") {
  if (!existsSync(DS_SRC)) { console.log(`  FAIL  no design system at ${DS_SRC} (set SALT_DS)`); process.exit(1); }
  const css = text(DS_SRC);
  if (/@import\s+url\(\s*["']?https?:/.test(css)) { console.log("  FAIL  the design system's styles.css imports a remote font; that belongs in fonts.css"); process.exit(1); }
  writeFileSync(BLOCKS[0].file, css + "\n", "utf8");
  console.log(`  ok    pulled ${css.split("\n").length} lines into design/salt-ds.css`);
  process.exit(0);
}

let master = readFileSync(MASTER, "utf8");
if (mode === "--check") {
  let bad = 0;
  for (const b of BLOCKS) {
    const at = locate(master, b);
    if (!at) { console.log(`  FAIL  ${b.name}: no DESIGN ${b.name} block in the master. Run: node tools/designsync.mjs --sync`); bad++; continue; }
    if (master.slice(at.i, at.j).replace(/\r\n/g, "\n") !== blockFor(b)) { console.log(`  FAIL  ${b.name}: the master's block is not design/${b.name === "base" ? "salt-ds" : "desk"}.css. Run: node tools/designsync.mjs --sync`); bad++; }
    else console.log(`  ok    ${b.name}: the master's DESIGN ${b.name} block is the file, byte for byte`);
  }
  process.exit(bad ? 1 : 0);
}
if (mode === "--sync") {
  for (const b of BLOCKS) {
    const at = locate(master, b);
    const block = blockFor(b);
    if (at) master = master.slice(0, at.i) + block + master.slice(at.j);
    else {
      /* first time: the block goes at the foot of the stylesheet, so it wins */
      const close = master.indexOf("</style>");
      if (close < 0) throw new Error("no </style> in the master");
      master = master.slice(0, close) + block + "\n" + master.slice(close);
    }
    console.log(`  ok    ${b.name}: ${at ? "replaced" : "inserted"} (${block.split("\n").length} lines)`);
  }
  writeFileSync(MASTER, master, "utf8");
  process.exit(0);
}
console.log("usage: node tools/designsync.mjs --pull | --sync | --check");
process.exit(2);
