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
 *   ... --mutations <file.json> --jobs <n>                     at most n checkout mutations at once
 *
 * A MUTATION is an exact-string pair: its needle occurs exactly once and the text changes, or nothing runs. With no file, or
 * the master's path, it goes to a copy of the master run through SALT_MASTER, so those run side by side, the cores less one
 * (one at a time for a section suite-split would never run twice at once). Any other file is a CHECKOUT MUTATION, and this
 * checkout is never edited (19 Oct 2026, his question why they ran one at a time): each lane copies the checkout into the
 * temp folder once (everything but .git, .claude, node_modules and shard files; node_modules a junction, .git a file naming
 * this checkout's git folder), runs the section unmutated there first and refuses unless it is green (a copy taken while a
 * live run rewrote a file would otherwise read as red), then runs its share one after another, each edit put back byte for
 * byte before the next. Lanes: the cores less two, three quarters of the free memory at 1.8 GB a run, --jobs and the
 * mutations, the least of them. So a killed run leaves nothing in the checkout, and none waits on a run live here. The
 * verdicts print in the file's order. The .git file makes a lane a working tree of this checkout's git folder: a section
 * may read git (check-ignore, ls-files), never write it.
 * Exit 1 when the unmutated run is not green, or a mutation proved nothing: every check stayed green (nobody noticed it), or
 * the run crashed before any check failed, which is the runner's word and not a check's.
 */
import "../test/frozen.mjs";   /* first: a mutation copy is made of the frozen master, as a suite run reads it */
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, cpSync, symlinkSync, mkdirSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve, relative, dirname, isAbsolute, sep } from "node:path";
import { tmpdir, cpus, freemem } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inputs, readSuite, unitsOf, runShard, shardFile, SHARD_GB, GB } from "./suite-split.mjs";
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

/* a lane's copy is used only when the section ran green there unmutated, or a copy-only failure would read as a mutation's red */
export function laneGreen(ctl, n, said = "") {
  if (stateOf(ctl) !== "green") throw new Error(`the section unmutated on lane ${n}'s copy of this checkout is not green (${said}), so no mutation there proves anything`);
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

/* at most `width` jobs at once, one promise a job in the jobs' order, so a caller can report each as soon as those before it
   are in; `setup(lane)` runs once before a lane's first job and hands each of its jobs what it made, and a lane whose setup
   failed fails the job it took and takes no more. A rejection waits for its caller, never an unhandled one. */
export function pool(jobs, width, setup = () => null) {
  const out = jobs.map(() => { let ok, no; const p = new Promise((a, b) => { ok = a; no = b; }); p.catch(() => {}); return { p, ok, no }; });
  let next = 0;
  const lane = async (n) => {
    let made, set = false;
    while (next < jobs.length) {
      const k = next++;
      if (!set) try { made = await setup(n); set = true; } catch (e) { out[k].no(e); return; }
      try { out[k].ok(await jobs[k](made)); } catch (e) { out[k].no(e); }
    }
  };
  for (let n = 0; n < Math.min(width, jobs.length); n++) lane(n);
  return out.map((o) => o.p);
}

/* lanes for checkout mutations: the cores less two, the runs three quarters of the free memory holds, --jobs and the mutations,
   the least, never under one */
export function lanesFor(jobs, cores, free, count) {
  return Math.max(1, Math.min(cores - 2, Math.floor(free * 0.75 / (SHARD_GB * GB)), jobs > 0 ? jobs : Infinity, count));
}

/* THIS CHECKOUT COPIED for one lane's checkout mutations: every entry but .git, .claude, node_modules and the shard files of
   runs live here; node_modules a junction, never copied; .git a file naming this checkout's git folder, so the few checks asking
   git still read it (and could write it: a section only reads git). A mutation edits the copy's file, never the checkout's. */
export function copyCheckout(from, to, gitDir) {
  mkdirSync(to, { recursive: true });
  const skip = new Set([".git", ".claude", "node_modules"]), shards = join(from, "test");
  for (const e of readdirSync(from)) {
    if (skip.has(e)) continue;
    cpSync(join(from, e), join(to, e), { recursive: true, filter: (src) => !(dirname(src) === shards && /^\.shard-.+\.mjs$/.test(src.slice(shards.length + 1))) });
  }
  if (existsSync(join(from, "node_modules"))) symlinkSync(join(from, "node_modules"), join(to, "node_modules"), "junction");
  if (gitDir) writeFileSync(join(to, ".git"), `gitdir: ${gitDir}\n`);
  return to;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const stop = (why, code = 1) => { console.log(why); process.exit(code); };
  const opt = {}, rest = [], argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (["--master", "--book", "--mutations", "--jobs"].includes(argv[i])) opt[argv[i].slice(2)] = argv[++i];
    else rest.push(argv[i]);
  }
  if (rest.length !== 1 || Object.values(opt).some((v) => !v) || (opt.master && opt.book) || (opt.jobs && !(Number.isInteger(+opt.jobs) && +opt.jobs >= 1)))
    stop('usage: node tools/section.mjs "<title prefix>" [--master <file> | --book <sha>] [--mutations <file.json> [--jobs <n>]]', 2);

  const suite = readSuite(inputs({ own: false }).text);
  if (!suite) stop("refused: cannot find the sections or the footer in test/verify.mjs");
  let block;
  try { block = pick(suite.blocks, rest[0]); } catch (e) { stop("refused: " + e.message); }

  const tmp = mkdtempSync(join(tmpdir(), "salt-section-")), flying = new Set();
  /* a lane's node_modules junction is unlinked first, so the folder's removal can never walk into the real node_modules */
  process.on("exit", () => {
    for (const n of flying) rmSync(shardFile(n), { force: true });
    for (const l of readdirSync(tmp)) if (/^lane\d+$/.test(l)) try { unlinkSync(join(tmp, l, "node_modules")); } catch (e) { /* no junction */ }
    try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* a lane's run still closing holds a file: the temp folder keeps it */ }
  });
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

  let seq = 0;
  const run = (env, root) => {
    const name = `section-${seq++}-${process.pid}`, lines = [], t0 = Date.now();
    if (!root) flying.add(name);
    return runShard(suite, name, [block], (l) => lines.push(l), env, root)
      .then(({ code, res }) => { flying.delete(name); return { code, res, lines, s: (Date.now() - t0) / 1000 }; });
  };

  /* the unmutated run and the master copies side by side */
  const [base, ...copies] = await Promise.all(pool([() => run(envFor(master)), ...onCopy.map((m, i) => () => {
    const copy = join(tmp, `m${i}.html`);
    writeFileSync(copy, mutate(readFileSync(m.path, "utf8"), m));
    return run({ SALT_MASTER: copy });
  })], widthFor(block, cpus().length)));

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
  if (inCheckout.length) {
    const lanes = lanesFor(+opt.jobs || 0, cpus().length, freemem(), inCheckout.length);
    const git = spawnSync("git", ["rev-parse", "--absolute-git-dir"], { cwd: REPO, encoding: "utf8" });
    const gitDir = git.status === 0 ? git.stdout.trim() : null, frozenBook = join(REPO, "test", "fixtures", "book-frozen.json");
    process.setMaxListeners(process.getMaxListeners() + lanes);   /* each lane's withEdit holds an exit listener while its run is out */
    console.log(`checkout mutations, ${lanes} at a time, each lane on its own copy of this checkout in ${tmp}, green there unmutated first`);
    const envIn = (root) => ({ ...envFor(master), ...(process.env.SALT_BOOK === frozenBook ? { SALT_BOOK: join(root, rel(frozenBook)) } : {}) });
    const done = pool(inCheckout.map((m) => (root) => {
      const file = join(root, rel(m.path));
      return withEdit(file, mutate(readFileSync(file, "utf8"), m), () => run(envIn(root), root));
    }), lanes, async (n) => {
      const root = copyCheckout(REPO, join(tmp, `lane${n}`), gitDir);
      const ctl = await run(envIn(root), root);
      laneGreen(ctl, n, tally(ctl));
      return root;
    });
    for (const [i, m] of inCheckout.entries()) {
      let r;
      try { r = await done[i]; } catch (e) { stop(`refused: ${m.name}: ${e.message}`); }
      runs.push(report(m, r));
    }
  }
  const v = verdict(base, runs), none = v.states.filter((s) => s !== "red").length;
  console.log(none ? `${none} of ${muts.length} mutations proved nothing` : `each of ${muts.length} mutations turned a check red`);
  process.exit(v.exit);
}
