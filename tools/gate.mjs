#!/usr/bin/env node
/* gate.mjs — the fast gate before a deploy (v522, Part A step 4 of his instruction of 08 Sep 2026).
 *
 * WHY. The full suite is about two minutes of jsdom, and until v521 it ran TWICE per approval,
 * once in the fold and once before the deploy, on the same commit. Neither run was what stood
 * between a wrong fold and the phone: fold.mjs --apply is all or nothing and refuses what it
 * must, and the suite's failures after a fold have been its own fixtures moving with the live
 * book (twice on 08 Sep). What must hold before a build reaches the phone is mechanical, and
 * ci.yml already names it: the workflows parse, the book is in date order, the master's
 * version is in the changelog, every generated block in the master is its module, the extract
 * is the book, and public/ is what this master builds. That is this gate, in seconds. The full
 * suite runs after the phone is live and fails the run loudly if it fails; it never pulls a
 * correct ledger back off the phone.
 *
 *   node tools/gate.mjs        exit 0 when every check passes, 1 on the first that does not
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (args) => execFileSync(process.execPath, args.map((a) => a.startsWith("tools/") ? resolve(REPO, a) : a), { cwd: REPO, encoding: "utf8", stdio: "pipe" });

export const CHECKS = [
  ["the workflows parse", ["tools/lint-workflows.mjs"]],
  ["the book is in date order", ["tools/sort-ledger.mjs", "--check"]],
  ["the master's version is in the changelog", ["tools/changelog.mjs", "--check"]],
  ["the engine in the master is the module", ["tools/engine.mjs", "--check"]],
  ["the book in the master is ledger/book.json", ["tools/booksync.mjs", "--check"]],
  ["the geography in the master is geo/", ["tools/geosync.mjs", "--check"]],
  ["the design in the master is design/", ["tools/designsync.mjs", "--check"]],
  ["the statement stylesheet is the generator's", ["tools/stmt-style.mjs", "--check"]],
  ["the extract is the book", ["tools/ledger.mjs", "--check"]],
];

export function buildMatches() {
  const revPath = resolve(REPO, "public", "rev.json");
  const before = JSON.parse(readFileSync(revPath, "utf8")).id;
  run(["tools/build.mjs"]);
  const after = JSON.parse(readFileSync(revPath, "utf8")).id;
  if (before !== after) throw new Error(`public/ is not what this master builds (committed ${before}, rebuilt ${after})`);
  return after;
}

/* v523: pathToFileURL, as fold.mjs does it. A hand-built file URL matched on Windows and not on the
   runner, where the gate then printed nothing and exited 0: a no-op gate the suite caught after
   the v522 deploy. */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const t0 = Date.now();
  let failed = false;
  for (const [what, args] of CHECKS) {
    const t = Date.now();
    try { run(args); console.log(`  ok    ${what} (${((Date.now() - t) / 1000).toFixed(1)} s)`); }
    catch (e) { failed = true; console.log(`  FAIL  ${what}\n        ${String((e && e.stdout) || (e && e.message) || e).trim().split("\n").slice(-4).join("\n        ")}`); break; }
  }
  if (!failed) {
    const t = Date.now();
    try { const id = buildMatches(); console.log(`  ok    public/ is what this master builds, id ${id} (${((Date.now() - t) / 1000).toFixed(1)} s)`); }
    catch (e) { failed = true; console.log(`  FAIL  ${e.message}`); }
  }
  console.log(failed ? `\n  GATE FAILED after ${((Date.now() - t0) / 1000).toFixed(1)} s: nothing deploys.` : `\n  GATE OK in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
  process.exit(failed ? 1 : 0);
}
