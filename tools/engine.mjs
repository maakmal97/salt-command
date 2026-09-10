/* engine.mjs — keep the engine inlined in the master equal to the engine module.
 *
 * WHY A COPY EXISTS AT ALL. The desk is one self-contained page: it opens from disk, loads
 * nothing, and the build fails on any external script. So the desk cannot import
 * engine/pricing.mjs at runtime. It carries the file's text instead, between two markers, and
 * this tool is what puts it there and what proves it is still there unchanged.
 *
 *   node tools/engine.mjs --sync    write engine/pricing.mjs into the master between the markers
 *   node tools/engine.mjs --check   exit 1 if the block in the master is not the module
 *
 * THE MODULE IS THE SOURCE. Edit engine/pricing.mjs, run --sync, build. An edit inside the
 * markers in the master is overwritten by the next --sync and fails --check in CI until then.
 * The transformation is exactly one line: the module's final `export default` is dropped,
 * because the desk's script is classic, not a module. Nothing else is rewritten, so what the
 * tests import is byte for byte what the desk runs. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = resolve(REPO, "master", "salt_command.html");
const ENGINES = [
  { name: "pricing", file: resolve(REPO, "engine", "pricing.mjs") },
  { name: "position", file: resolve(REPO, "engine", "position.mjs") },
  /* v564: the QR encoder, because the desk draws one on the board sheet he hands a customer and
     the statements build draws one from the same text. Two encoders would drift. */
  { name: "qr", file: resolve(REPO, "engine", "qr.mjs") },
];

const BEGIN = (n) => `/* ==== ENGINE ${n}: generated from engine/${n}.mjs by tools/engine.mjs. Edit the module, never this block. ==== */`;
const END = (n) => `/* ==== END ENGINE ${n} ==== */`;

function blockFor(e) {
  const src = readFileSync(e.file, "utf8").replace(/\r\n/g, "\n");
  const lines = src.replace(/\n+$/, "").split("\n");
  const last = lines[lines.length - 1];
  if (!/^export default \w+;$/.test(last)) {
    throw new Error(`engine/${e.name}.mjs must end with a single 'export default NAME;' line, found: ${last}`);
  }
  return BEGIN(e.name) + "\n" + lines.slice(0, -1).join("\n") + "\n" + END(e.name);
}

function locate(master, e) {
  const b = master.indexOf(BEGIN(e.name));
  const en = master.indexOf(END(e.name));
  if (b < 0 && en < 0) return null;
  if (b < 0 || en < b) throw new Error(`the ${e.name} engine markers in the master are damaged`);
  if (master.indexOf(BEGIN(e.name), b + 1) >= 0) throw new Error(`the ${e.name} BEGIN marker appears twice`);
  return { start: b, end: en + END(e.name).length };
}

const mode = process.argv[2];
let master = readFileSync(MASTER, "utf8");
let problems = 0;
for (const e of ENGINES) {
  const want = blockFor(e);
  const at = locate(master, e);
  if (mode === "--sync") {
    if (at) {
      master = master.slice(0, at.start) + want + master.slice(at.end);
    } else {
      /* first time: straight after the desk's script opens, so the engine exists before
         anything that could call it */
      const anchor = "\n<script>\n";
      const i = master.indexOf(anchor);
      if (i < 0) throw new Error("could not find the desk's <script> to insert the engine after");
      master = master.slice(0, i + anchor.length) + want + "\n" + master.slice(i + anchor.length);
    }
    console.log(`  ok    ${e.name}: inlined ${want.split("\n").length} lines into the master`);
  } else if (mode === "--check") {
    if (!at) { console.log(`  FAIL  ${e.name}: the master carries no inlined engine. Run: node tools/engine.mjs --sync`); problems++; continue; }
    const have = master.slice(at.start, at.end);
    if (have !== want) {
      console.log(`  FAIL  ${e.name}: the block in the master differs from engine/${e.name}.mjs. Run: node tools/engine.mjs --sync`);
      problems++;
    } else {
      console.log(`  ok    ${e.name}: the master's inlined engine is the module, byte for byte`);
    }
  } else {
    console.log("usage: node tools/engine.mjs --sync | --check");
    process.exit(2);
  }
}
if (mode === "--sync") writeFileSync(MASTER, master);
if (problems) process.exit(1);
