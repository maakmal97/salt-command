#!/usr/bin/env node
/* tools/section.mjs — ONE SECTION OF THE SUITE ON ITS OWN, AND ITS CHECKS PROVED RED BY MUTATION (27 Sep 2026, his instruction).
 *
 * A red proof runs one section over and over. Every session hand-built that runner (verify.mjs sliced into an AsyncFunction,
 * the suite's helpers sliced beside it), and landing v901 took two such scripts. This keeps nothing of the suite's own: it
 * reads the sections through readSuite and runs one through runShard, both in tools/suite-split.mjs, so a section runs here
 * exactly as npm test runs it, and a change to the suite's shape breaks npm test first and is fixed there, once.
 *
 *   node tools/section.mjs "<title prefix>"                     the one section whose title starts so: its lines, its exit
 *   node tools/section.mjs "<prefix>" --master <file>           against that master, through SALT_MASTER (openMaster reads it)
 *   node tools/section.mjs "<prefix>" --book <sha>              against the master at <sha>, when only a fold's edits differ
 *   node tools/section.mjs "<prefix>" --mutations <file.json>   unmutated, then under each of [{name, file?, find, replace}]
 *
 * A MUTATION is an exact-string pair: its needle occurs exactly once and the text changes, or nothing runs. With no file, or
 * the master's path, it goes to a copy of the master run through SALT_MASTER, so those run side by side, the cores less one
 * (one at a time for a section suite-split would never run twice at once). Any other file is edited in this checkout, one
 * at a time, and put back byte for byte in a finally and on an interrupt, its original kept in the temp folder until then;
 * none starts while a shard file says a run is live here (npm test's or this tool's; npm run test:serial leaves none).
 * Exit 1 when the unmutated run is not green, or a mutation proved nothing: every check stayed green (nobody noticed it), or
 * the run crashed before any check failed, which is the runner's word and not a check's.
 */
import "../test/frozen.mjs";   /* first: a mutation copy is made of the frozen master, as a suite run reads it */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, relative, dirname, isAbsolute, sep } from "node:path";
import { tmpdir, cpus } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inputs, readSuite, unitsOf, runShard, shardFile, shardsOnDisk } from "./suite-split.mjs";
import { locate } from "./booksync.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = join(REPO, "master", "salt_command.html");
const rel = (f) => relative(REPO, f).split(sep).join("/");

/* the one section whose title starts with the prefix */
export function pick(blocks, prefix) {
  const hit = blocks.filter((b) => b.title.startsWith(prefix));
  if (hit.length !== 1) throw new Error(hit.length ? `${hit.length} sections start "${prefix}": ${hit.map((b) => b.title).join(" | ")}` : `no section starts "${prefix}"`);
  return hit[0];
}

/* a mutation applied: its needle exactly once, and the text changed */
export function mutate(text, { name, find, replace }) {
  if (typeof find !== "string" || !find || typeof replace !== "string") throw new Error(`${name}: find must be a non-empty string and replace a string`);
  const at = text.indexOf(find);
  if (at < 0 || text.indexOf(find, at + 1) >= 0) throw new Error(`${name}: the needle occurs ${at < 0 ? "nowhere" : "more than once"} in the file`);
  const out = text.slice(0, at) + replace + text.slice(at + find.length);
  if (out === text) throw new Error(`${name}: the replacement changes nothing`);
  return out;
}

/* what a run shows: red when a check failed, green when it reached the footer with none, else crashed */
export function stateOf(r) {
  if (r.res ? r.res.fail > 0 : r.lines.some((l) => /^\s*FAIL: /.test(l))) return "red";
  return r.res && r.res.sections > 0 && r.code === 0 ? "green" : "crashed";
}

/* exit 0 only when the unmutated run is green and every mutation turned a check red */
export function verdict(base, runs) {
  const b = stateOf(base), states = runs.map(stateOf);
  return { base: b, states, exit: b === "green" && states.every((s) => s === "red") ? 0 : 1 };
}

/* runs of one section at once: the cores less one, or one for a section suite-split would never run beside itself */
export function widthFor(block, cores) {
  const u = unitsOf([block, { ...block }]);
  return !u.serial.length && u.units.length === 2 ? Math.max(1, cores - 1) : 1;
}

/* a checkout file under one edit for the length of fn, then put back byte for byte, also when fn throws or the process exits */
export async function withEdit(file, text, fn) {
  const bytes = readFileSync(file), back = () => writeFileSync(file, bytes);
  process.prependListener("exit", back);
  try {
    writeFileSync(file, text);
    if (readFileSync(file, "utf8") !== text) throw new Error(`${rel(file)}: the edit did not land`);
    return await fn();
  } finally {
    back();
    process.off("exit", back);
    if (!readFileSync(file).equals(bytes)) throw new Error(`${rel(file)} was not put back byte for byte`);
  }
}

/* THE LINES A FOLD WRITES IN A MASTER, as tools/fold.mjs apply() writes them: the BOOK block, the evolution array, the stamp */
export function foldLines(text) {
  const lineOf = (i) => text.slice(0, i).split("\n").length, spans = [];
  const book = locate(text);
  if (book) spans.push([lineOf(book.start), lineOf(book.end - 1)]);
  const ev = text.indexOf("const evolution=["), evEnd = ev < 0 ? -1 : text.indexOf("}];", ev);
  if (evEnd >= 0) spans.push([lineOf(ev), lineOf(evEnd + 2)]);
  const st = /const LAST_UPDATED='[^']*';/.exec(text);
  if (st) spans.push([lineOf(st.index), lineOf(st.index + st[0].length - 1)]);
  return (n) => spans.some(([a, b]) => n >= a && n <= b);
}

/* the hunks between two masters that are not a fold's, by git's own diff: none means only the book, evolution and the stamp moved */
export function notFold(was, now, dir) {
  const a = join(dir, "was.html"), b = join(dir, "now.html");
  writeFileSync(a, was); writeFileSync(b, now);
  const d = spawnSync("git", ["diff", "--no-index", "--no-color", "--no-ext-diff", "-U0", a, b], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (d.status !== 0 && d.status !== 1) throw new Error("git diff failed: " + (d.stderr || d.error));
  const inWas = foldLines(was), inNow = foldLines(now), lines = d.stdout.split("\n"), out = [];
  const all = (from, n, inside) => { for (let k = 0; k < n; k++) if (!inside(from + k)) return false; return true; };
  lines.forEach((l, i) => {
    const h = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(l);
    if (!h) return;
    const w = [+h[1], h[2] == null ? 1 : +h[2]], n = [+h[3], h[4] == null ? 1 : +h[4]];
    if (all(w[0], w[1], inWas) && all(n[0], n[1], inNow)) return;
    out.push({ was: w, now: n, text: (lines.slice(i + 1).find((x) => /^[-+]/.test(x)) || "").slice(0, 120) });
  });
  return out;
}

/* at most `width` jobs at once, results in the jobs' order */
async function pool(jobs, width) {
  const out = []; let next = 0;
  const lane = async () => { while (next < jobs.length) { const k = next++; out[k] = await jobs[k](); } };
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, lane));
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const stop = (why, code = 1) => { console.log(why); process.exit(code); };
  const opt = {}, rest = [], argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (["--master", "--book", "--mutations"].includes(argv[i])) opt[argv[i].slice(2)] = argv[++i];
    else rest.push(argv[i]);
  }
  if (rest.length !== 1 || Object.values(opt).some((v) => !v) || (opt.master && opt.book))
    stop('usage: node tools/section.mjs "<title prefix>" [--master <file> | --book <sha>] [--mutations <file.json>]', 2);

  const suite = readSuite(inputs({ own: false }).text);
  if (!suite) stop("refused: cannot find the sections or the footer in test/verify.mjs");
  let block;
  try { block = pick(suite.blocks, rest[0]); } catch (e) { stop("refused: " + e.message); }

  const tmp = mkdtempSync(join(tmpdir(), "salt-section-")), flying = new Set();
  process.on("exit", () => { for (const n of flying) rmSync(shardFile(n), { force: true }); rmSync(tmp, { recursive: true, force: true }); });
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(s, () => process.exit(130));

  let master = opt.master ? resolve(opt.master) : process.env.SALT_MASTER || MASTER;
  if (!existsSync(master)) stop(`refused: no master at ${master}`);
  if (opt.book) {
    const was = spawnSync("git", ["show", `${opt.book}:master/salt_command.html`], { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 });
    if (was.status !== 0) stop(`refused: git show ${opt.book}:master/salt_command.html: ${(was.stderr || "").trim()}`);
    const foreign = notFold(was.stdout, readFileSync(master, "utf8"), tmp);
    if (foreign.length) stop(`refused: the master at ${opt.book} differs from ${rel(master)} outside the BOOK block, evolution and LAST_UPDATED:\n`
      + foreign.map((h) => `  lines ${h.was[0]}+${h.was[1]} there, ${h.now[0]}+${h.now[1]} here: ${h.text}`).join("\n"));
    master = join(tmp, "was.html");
    console.log(`the master at ${opt.book}, which differs from this one only in the book, evolution and LAST_UPDATED;`
      + " a section reading ledger/book.json off disk still reads today's");
  }
  const envFor = (file) => (file === MASTER ? {} : { SALT_MASTER: file });

  let muts = [];
  if (opt.mutations) {
    try { muts = JSON.parse(readFileSync(opt.mutations, "utf8")); } catch (e) { stop(`refused: ${opt.mutations}: ${e.message}`); }
    if (!Array.isArray(muts) || !muts.length) stop(`refused: ${opt.mutations} holds no list of mutations`);
    const names = new Set();
    for (const m of muts) {
      if (!m || typeof m.name !== "string" || !m.name || names.has(m.name)) stop(`refused: every mutation needs a name of its own: ${JSON.stringify(m && m.name)}`);
      names.add(m.name);
      const path = m.file ? resolve(REPO, m.file) : master;
      m.onMaster = !m.file || rel(path) === "master/salt_command.html";
      m.path = m.onMaster ? master : path;
      if (!m.onMaster && (rel(path).startsWith("..") || isAbsolute(rel(path)) || !existsSync(path))) stop(`refused: ${m.name}: ${m.file} is not a file in this checkout`);
      try { mutate(readFileSync(m.path, "utf8"), m); } catch (e) { stop("refused: " + e.message); }
    }
  }
  const onCopy = muts.filter((m) => m.onMaster), inCheckout = muts.filter((m) => !m.onMaster);

  /* a shard file on disk is a run live in this checkout, reading the files a checkout mutation edits */
  const live = () => shardsOnDisk().map((f) => {
    let age = "gone"; try { age = Math.round((Date.now() - statSync(join(REPO, "test", f)).mtimeMs) / 60000) + " min old"; } catch (e) { /* finished */ }
    return `test/${f} (${age})`;
  });
  const refuseLive = (l) => stop(`refused: ${l.join(", ")} says a suite run is live in this checkout, and a checkout mutation edits`
    + " files it reads; if nothing is running, a run killed before it cleaned up left it: delete it and run again");
  if (inCheckout.length && live().length) refuseLive(live());

  let seq = 0;
  const run = (env) => {
    const name = `section-${seq++}-${process.pid}`, lines = [], t0 = Date.now();
    flying.add(name);
    return runShard(suite, name, [block], (l) => lines.push(l), env)
      .then(({ code, res }) => { flying.delete(name); return { code, res, lines, s: (Date.now() - t0) / 1000 }; });
  };

  /* the unmutated run and the master copies side by side */
  const [base, ...copies] = await pool([() => run(envFor(master)), ...onCopy.map((m, i) => () => {
    const copy = join(tmp, `m${i}.html`);
    writeFileSync(copy, mutate(readFileSync(m.path, "utf8"), m));
    return run({ SALT_MASTER: copy });
  })], widthFor(block, cpus().length));

  const tally = (r) => (r.res ? `${r.res.pass} passed, ${r.res.fail} failed` : `no totals, exit ${r.code}`) + `, ${r.s.toFixed(1)} s`;
  console.log(block.title);
  for (const l of base.lines) if (l.trim() && l !== block.title) console.log(l);
  console.log((muts.length ? "unmutated: " : "") + tally(base));
  if (!muts.length) process.exit(verdict(base, []).exit);
  if (stateOf(base) !== "green") stop("the unmutated run is not green, so no mutation proves anything");

  const report = (m, r) => {
    const st = stateOf(r), head = { red: "red      ", green: "UNNOTICED", crashed: "crashed  " }[st] + " " + m.name + ": ";
    if (st === "crashed") console.log(head + (r.lines.find((l) => /Error/.test(l)) || r.lines.filter((l) => l.trim()).pop() || tally(r)).trim().slice(0, 200));
    else console.log(head + tally(r) + (st === "green" && r.res.pass < base.res.pass ? `: ${base.res.pass - r.res.pass} fewer checks ran` : ""));
    if (st === "red") for (const l of r.lines.filter((x) => /^\s*FAIL: /.test(x))) console.log("  " + l.trim().slice(0, 200));
    return r;
  };
  const runs = onCopy.map((m, i) => report(m, copies[i]));
  if (inCheckout.length) console.log(`checkout mutations, one at a time; each original is kept in ${tmp} until it is put back`);
  for (const m of inCheckout) {
    if (live().length) refuseLive(live());
    const bytes = readFileSync(m.path);
    let text;
    try { text = mutate(bytes.toString("utf8"), m); } catch (e) { stop("refused: " + e.message); }
    writeFileSync(join(tmp, rel(m.path).split("/").join("__")), bytes);
    runs.push(report(m, await withEdit(m.path, text, () => run(envFor(master)))));
  }
  const v = verdict(base, runs), none = v.states.filter((s) => s !== "red").length;
  console.log(none ? `${none} of ${muts.length} mutations proved nothing` : `each of ${muts.length} mutations turned a check red`);
  process.exit(v.exit);
}
