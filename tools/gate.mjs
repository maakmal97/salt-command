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
 * PARALLEL CHECKS: CHECKS are independent read-only verifications, so the CLI runs them concurrently
 * via async execFile + Promise.all and prints results in CHECKS order (cutting 14 cold Node starts
 * in series down to the single slowest check).
 *
 *   node tools/gate.mjs                exit 0 when every check passes, 1 on the first that does not
 *   node tools/gate.mjs --verify-only  run the 12 ci.yml verify checks concurrently (skips extract & build)
 */
import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { oneCodeEach } from "./stmt-pool.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resolveArgs = (args) => args.map((a) => (a.startsWith("tools/") ? resolve(REPO, a) : a));
const run = (args) => execFileSync(process.execPath, resolveArgs(args), { cwd: REPO, encoding: "utf8", stdio: "pipe" });
const runAsync = (args) => new Promise((done) => {
  const t = Date.now();
  execFile(process.execPath, resolveArgs(args), { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
    done({ ok: !err, ms: Date.now() - t, out: String(stdout || stderr || (err && err.message) || "") });
  });
});

export const CHECKS = [
  ["the workflows parse", ["tools/lint-workflows.mjs"]],
  ["the book is in date order", ["tools/sort-ledger.mjs", "--check"]],
  ["the master's version is in the changelog", ["tools/changelog.mjs", "--check"]],
  ["the engine in the master is the module", ["tools/engine.mjs", "--check"]],
  ["the book in the master is ledger/book.json", ["tools/booksync.mjs", "--check"]],
  ["the geography in the master is geo/", ["tools/geosync.mjs", "--check"]],
  ["the design in the master is design/", ["tools/designsync.mjs", "--check"]],
  ["the statement stylesheet is the generator's", ["tools/stmt-style.mjs", "--check"]],
  ["Ambient in design/ambient is the pulled copy", ["tools/ambientsync.mjs", "--check"]],
  ["the site's fonts are design/fonts, as bytes", ["tools/stmt-fonts.mjs", "--check"]],
  ["the site's QR encoder is engine/qr.mjs", ["tools/qrsync.mjs", "--check"]],
  ["the pay code check is Salt QR's (stands down without it)", ["tools/paycrcsync.mjs", "--check"]],
  ["the site's distance is engine/geo.mjs", ["tools/geosite.mjs", "--check"]],
  ["the extract is the book", ["tools/ledger.mjs", "--check"]],
];

/* v535: THE STAMP MAY NOT BE IN THE FUTURE. Five hand-made versions on 08 Sep carried a typed stamp
   that ran ahead of the clock. Parsed from "DD Mon YYYY, HH:MM KL", compared with Kuala Lumpur now
   plus ten minutes of grace for the run itself. */
export function stampAhead(stampText, nowMs) {
  const m = /^(\d{2}) ([A-Z][a-z]{2}) (\d{4}), (\d{2}):(\d{2}) KL$/.exec(String(stampText || "").trim());
  if (!m) return "the stamp is not in the shape DD Mon YYYY, HH:MM KL: " + stampText;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = MON.indexOf(m[2]); if (mi < 0) return "the stamp's month is not a short month: " + m[2];
  const stampMs = Date.UTC(+m[3], mi, +m[1], +m[4] - 8, +m[5]);
  const graceMs = 10 * 60e3;
  return stampMs > (nowMs == null ? Date.now() : nowMs) + graceMs ? "the master's stamp is in the future: " + stampText : "";
}
export function stampCheck() {
  const src = readFileSync(resolve(REPO, "master", "salt_command.html"), "utf8");
  const m = /const LAST_UPDATED='([^']*)';/.exec(src);
  const why = stampAhead(m ? m[1] : "");
  if (why) throw new Error(why);
  return m[1];
}

/* S14: ONE USERNAME, ONE CODE (tools/stmt-pool.mjs). First, being a file read: a merge of two folds'
   bindings can give one account to two codes, and the phone would then serve the wrong statement. */
export function usersCheck() {
  const file = resolve(process.env.SALT_STATEMENTS_DIR || resolve(REPO, "statements"), "_users.json");
  return Object.keys(oneCodeEach(JSON.parse(readFileSync(file, "utf8")))).length;
}

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
  const verifyOnly = process.argv.includes("--verify-only");
  const list = verifyOnly ? CHECKS.slice(0, 12) : CHECKS;
  const t0 = Date.now();
  let failed = false;
  if (!verifyOnly) {
    try { console.log(`  ok    every statement username has one code (${usersCheck()} codes)`); }
    catch (e) { failed = true; console.log(`  FAIL  ${e.message}`); }
  }
  if (!failed) {
    /* Stage 1: run all fast read-only checks concurrently; Stage 2: run slow jsdom ledger.mjs --check only if Stage 1 passed */
    const fast = list.filter(([, args]) => args[0] !== "tools/ledger.mjs");
    const slow = list.filter(([, args]) => args[0] === "tools/ledger.mjs");
    const fastResults = await Promise.all(fast.map(async ([what, args]) => ({ what, ...(await runAsync(args)) })));
    for (const r of fastResults) {
      if (r.ok) {
        console.log(`  ok    ${r.what} (${(r.ms / 1000).toFixed(1)} s)`);
      } else {
        failed = true;
        console.log(`  FAIL  ${r.what}\n        ${r.out.trim().split("\n").slice(-4).join("\n        ")}`);
        break;
      }
    }
    if (!failed && slow.length) {
      for (const [what, args] of slow) {
        const r = await runAsync(args);
        if (r.ok) console.log(`  ok    ${what} (${(r.ms / 1000).toFixed(1)} s)`);
        else { failed = true; console.log(`  FAIL  ${what}\n        ${r.out.trim().split("\n").slice(-4).join("\n        ")}`); break; }
      }
    }
  }
  if (!failed && !verifyOnly) {
    try { const st = stampCheck(); console.log(`  ok    the master's stamp is not in the future (${st})`); }
    catch (e) { failed = true; console.log(`  FAIL  ${e.message}`); }
  }
  if (!failed && !verifyOnly) {
    const t = Date.now();
    try { const id = buildMatches(); console.log(`  ok    public/ is what this master builds, id ${id} (${((Date.now() - t) / 1000).toFixed(1)} s)`); }
    catch (e) { failed = true; console.log(`  FAIL  ${e.message}`); }
  }
  console.log(failed
    ? `\n  GATE FAILED after ${((Date.now() - t0) / 1000).toFixed(1)} s: nothing deploys.`
    : `\n  GATE OK in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
  process.exit(failed ? 1 : 0);
}
