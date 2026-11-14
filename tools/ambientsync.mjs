#!/usr/bin/env node
/* ambientsync.mjs: Salt's design is Ambient's own files, never a copy typed here.
 *
 * 14 NOV 2026, THE MOVE TO AMBIENT (docs/plan-ambient-move.html): a copy of Code/ambient-ds consumer/designsync.mjs with
 * the two paths set for this repo. It sits beside tools/designsync.mjs, which keeps carrying salt-ds to a surface that has
 * not moved yet, and takes that name when the last surface has moved and salt-ds is retired.
 *
 * COPY THIS FILE to the app's tools/designsync.mjs and set the two paths under "This app".
 * Nothing in the app may load off another origin, so the app carries the design system:
 *   - src/tokens.css, whole, between two markers in the app's stylesheet
 *   - any of ambient.css, ambient.js and icons.svg, as files beside it
 * A pull also writes tools/ambient.lock.json: the design system's commit and a hash of each
 * thing carried. The app's build imports matches() and refuses to ship on drift.
 *
 *   node tools/ambientsync.mjs --pull     write the block, the files and the lock from ../ambient-ds
 *                                        (or $AMBIENT_DS). Refused unless that checkout is a clean main.
 *   node tools/ambientsync.mjs --pull --preview   pull whatever is there, to look. A preview never passes --check.
 *   node tools/ambientsync.mjs --check    non-zero if anything carried is not what the lock recorded, or if
 *                                        a clean main beside the app has moved on since
 *
 * THE DESIGN SYSTEM IS THE SOURCE. Change it there, land it on main, --pull, build. An edit inside
 * the markers, or to a carried file, is overwritten by the next --pull and fails --check until then.
 * --check needs no design system on the machine (a CI runner has none): the lock is enough. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ---- This app ---- */
/* the stylesheet that carries the tokens between the markers */
const APP_CSS = resolve(REPO, "design", "ambient", "app.css");
/* the system's files this app carries whole, and where; leave out what the app does not use */
const CARRIED = {
  "ambient.css": resolve(REPO, "design", "ambient", "ambient.css"),
  "ambient.js": resolve(REPO, "design", "ambient", "ambient.js"),
  "icons.svg": resolve(REPO, "design", "ambient", "icons.svg"),
};
/* ---- end ---- */

const LOCK = resolve(REPO, "tools", "ambient.lock.json");
const DS_ROOT = resolve(process.env.AMBIENT_DS || resolve(REPO, "..", "ambient-ds"));
const DS_SRC = resolve(DS_ROOT, "src");
/* Ambient ships no face: the system's own font on every device. The name stays so a build that
   hashed, copied and precached a design system's fonts reads an empty list and does nothing. */
export const FONT_FILES = [];
export const BEGIN = "/* ==== DESIGN tokens: generated from Code/ambient-ds src/tokens.css by tools/designsync.mjs --pull. Edit the design system, --pull; never this block. ==== */";
export const END = "/* ==== END DESIGN tokens ==== */";

/* line endings are git's business, so nothing here depends on them */
const read = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const sha = (s) => createHash("sha256").update(s).digest("hex");

/** The design system's token file, verbatim, or null when the system is not on this machine. */
export function tokens() {
  const f = resolve(DS_SRC, "tokens.css");
  return existsSync(f) ? read(f).trim() : null;
}
/** What the last pull recorded: { version, commit, tokens, files, preview? }, or null before the first. */
export function lock() {
  return existsSync(LOCK) ? JSON.parse(read(LOCK)) : null;
}
/** The version this app carries, as the last pull recorded it. */
export function version() {
  const l = lock();
  return l ? l.version : null;
}
/* Where the design system's checkout stands, or null when it is not on this machine. */
function source() {
  if (tokens() == null) return null;
  /* twenty seconds at most: a fetch with no network must not hold a pull for ever */
  const git = (...a) => execFileSync("git", ["-C", DS_ROOT, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20000 }).trim();
  try { return { commit: git("rev-parse", "HEAD"), branch: git("rev-parse", "--abbrev-ref", "HEAD"), dirty: git("status", "--porcelain") !== "", git }; }
  catch { return { commit: null, branch: null, dirty: true, git }; }
}
/* Whether that checkout's main is the main everyone has: level with its origin, as last fetched. */
function landed(src) {
  try { src.git("fetch", "-q", "origin", "main"); } catch { /* offline, or no origin: go by what is known here */ }
  try { return src.git("rev-parse", "origin/main") === src.commit; } catch { return true; }
}

function locate(css) {
  const i = css.indexOf(BEGIN);
  if (i < 0) return null;
  const j = css.indexOf(END, i);
  if (j < 0) throw new Error("designsync: begin marker without an end marker");
  if (css.indexOf(BEGIN, i + 1) >= 0) throw new Error("designsync: the begin marker appears twice");
  return { i, j: j + END.length };
}

/** The block the app's stylesheet carries now, between the markers, or null. */
export function carried() {
  const css = read(APP_CSS), at = locate(css);
  return at ? css.slice(at.i + BEGIN.length + 1, at.j - END.length - 1) : null;
}

/** What is wrong with the copy here: an empty list when the app may ship. */
export function drift() {
  const l = lock(), out = [];
  if (!l) return ["nothing has been pulled: there is no " + LOCK];
  if (l.preview) out.push("the copy here is a preview, pulled from a design system that was not a clean main");
  const mine = carried();
  if (mine == null || sha(mine) !== l.tokens) out.push("the tokens in " + APP_CSS + " are not what was pulled");
  for (const [name, f] of Object.entries(CARRIED)) {
    if (!existsSync(f) || sha(read(f)) !== l.files[name]) out.push(f + " is not what was pulled");
  }
  /* and where a clean main of the design system is beside the app, the app must be level with it */
  const src = source();
  if (src && src.commit && !src.dirty && src.branch === "main" && src.commit !== l.commit) {
    const behind = tokens() !== mine || Object.entries(CARRIED).some(([name, f]) => !existsSync(f) || read(f) !== read(resolve(DS_SRC, name)));
    if (behind) out.push("the design system has moved on to " + src.commit.slice(0, 7) + " since the pull at " + String(l.commit).slice(0, 7));
  }
  return out;
}
/** True when everything carried is what the last pull wrote, and no newer design waits on main. */
export const matches = () => drift().length === 0;
/** Ambient has no font files, so there is nothing to differ. */
export const fontsMatch = () => true;

function pull(preview) {
  const want = tokens(), src = source();
  if (want == null) return "no design system at " + DS_SRC + " (set AMBIENT_DS)";
  if (!preview && (src.dirty || src.branch !== "main")) {
    return "the design system at " + DS_ROOT + (src.branch !== "main" ? " is on " + (src.branch || "no branch") : " has uncommitted changes")
      + ": pull only from a clean main, or add --preview to look (a preview never ships)";
  }
  if (!preview && !landed(src)) return "the design system's main at " + DS_ROOT + " is not level with its origin/main: push it or pull it first, or add --preview to look";
  const css = read(APP_CSS), at = locate(css);
  if (!at) return APP_CSS + " carries no DESIGN tokens markers; add the BEGIN and END lines where the tokens go";
  const files = {};
  for (const name of Object.keys(CARRIED)) files[name] = read(resolve(DS_SRC, name));
  writeFileSync(APP_CSS, css.slice(0, at.i) + BEGIN + "\n" + want + "\n" + END + css.slice(at.j), "utf8");
  for (const [name, mine] of Object.entries(CARRIED)) {
    mkdirSync(dirname(mine), { recursive: true });
    writeFileSync(mine, files[name], "utf8");
  }
  const ver = (/Ambient tokens (\d+\.\d+\.\d+)/.exec(want) || [])[1] || null;
  const record = { version: ver, commit: src.commit, ...(preview ? { preview: true } : {}), tokens: sha(want),
    files: Object.fromEntries(Object.entries(files).map(([name, text]) => [name, sha(text)])) };
  writeFileSync(LOCK, JSON.stringify(record, null, 2) + "\n", "utf8");
  console.log("  ok    pulled Ambient " + ver + " at " + String(src.commit).slice(0, 7) + (preview ? " as a preview" : "") + ": "
    + want.split("\n").length + " lines of tokens and " + Object.keys(files).join(", "));
  return null;
}

function main() {
  const args = process.argv.slice(2), mode = args.find((a) => a === "--pull" || a === "--check") || (args.length ? "" : "--check");
  if (mode === "--pull") {
    const refused = pull(args.includes("--preview"));
    if (refused) { console.log("  FAIL  " + refused); process.exit(1); }
  } else if (mode === "--check") {
    const off = drift();
    for (const f of off) console.log("  FAIL  " + f);
    if (off.length) { console.log("        run: node tools/ambientsync.mjs --pull"); process.exit(1); }
    const l = lock();
    console.log("  ok    level with Ambient " + l.version + " at " + String(l.commit).slice(0, 7) + ": the tokens and " + Object.keys(CARRIED).length + " carried files, as pulled");
  } else {
    console.log("usage: node tools/ambientsync.mjs [--pull [--preview] | --check]");
    process.exit(2);
  }
}

/* run as a command, however the path to this file was spelt (a junction, a symlink, another case) */
const here = fileURLToPath(import.meta.url);
if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(here)) main();
