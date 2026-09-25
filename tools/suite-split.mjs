#!/usr/bin/env node
/* tools/suite-split.mjs — THE SUITE, SPLIT ACROSS PROCESSES (24 Sep 2026, his instruction).
 *
 * test/verify.mjs runs in one Node process, about 3.3 minutes on this laptop's one core in use of sixteen. Every section is
 * its own `await (async () => { ... })();` block (the 17 Sep rule), so a section can run in any process. This writes one
 * module per shard beside verify.mjs (so its relative imports and REPO still resolve), each the suite's prelude, its share of
 * the sections and the footer, and runs them at once.
 *
 * TWO PHASES, BECAUSE TWO KINDS OF SECTION TOUCH WHAT OTHERS READ. A section that runs tools/build.mjs rewrites public/, and
 * one removes test/tmp outright; they run first, alone, in one process. Sections that name the same fixed folder under
 * test/tmp are kept in one shard, so two never share it at once. The rest are packed longest first into the emptiest shard.
 *
 * PACKED BY MEASURED COST, ON A RUNNER TOO (26 Sep 2026). Last run's timings (test/.suite-times.json) are this machine's
 * and gitignored, so a runner had none and packed by text length, a poor measure of time. test/suite-costs.json is the
 * laptop's timings by section title, committed: titles already in verify.mjs and whole milliseconds, nothing from the
 * book. A section costs this machine's last time, else the committed cost, else its length at the rate the costed
 * sections run. Refresh the file after a full run with --write-costs; a stale one only packs less evenly.
 *
 * The totals are the sum of the shards', and a section count short of the headings in verify.mjs fails the run, which is what
 * the suite's own floor check does in one process; that check stands down in a shard (SUITE_SHARD) because a shard runs part.
 * It is `npm test` (his instruction of 24 Sep 2026), here and in CI, where the workflows ask for three shards. No machine
 * runs more shards than its cores less one (never fewer than two): a hosted runner's memory comes with its cores, 16 GB
 * with four, and each shard may take a 4 GB heap. `npm run test:serial` is the one-process road.
 *
 *   node tools/suite-split.mjs                 shards = half the cores, at most 10
 *   node tools/suite-split.mjs --jobs 12
 *   node tools/suite-split.mjs --write-costs   test/suite-costs.json from this machine's last run; runs nothing
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cpus } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY = join(REPO, "test", "verify.mjs"), TIMES = join(REPO, "test", ".suite-times.json");
const COSTS = join(REPO, "test", "suite-costs.json");

/* what a machine packs by: verify.mjs, the committed costs, and its own last run, which a runner never has */
export function inputs({ own = true } = {}) {
  const read = (f) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch (e) { return {}; } };
  return { text: readFileSync(VERIFY, "utf8"), past: own ? read(TIMES) : {}, costs: read(COSTS) };
}

/* the suite's prelude, its sections and its footer; null when the headings or the footer cannot be found */
export function readSuite(text) {
  const lines = text.split("\n");
  const heads = lines.map((l, i) => (l.startsWith("section(") ? i : -1)).filter((i) => i >= 0);
  const footAt = lines.findIndex((l) => l.startsWith("console.log(`\\n${pass} passed"));
  if (!heads.length || footAt < heads[heads.length - 1]) return null;
  const blocks = heads.map((h, k) => {
    const text = lines.slice(h, k + 1 < heads.length ? heads[k + 1] : footAt).join("\n");
    return { k, title: (lines[h].match(/^section\("((?:[^"\\]|\\.)*)"/) || [])[1] || lines[h], text };
  });
  return { prelude: lines.slice(0, heads[0]).join("\n"), footer: lines.slice(footAt).join("\n"), blocks };
}

/* phase one, what writes a shared path; the rest as units, fixed folders under test/tmp binding their sections together */
export function unitsOf(blocks) {
  const serial = blocks.filter((b) => /tools\/build\.mjs"|rmSync\(join\(REPO, "test", "tmp"\)/.test(b.text));
  const rest = blocks.filter((b) => serial.indexOf(b) < 0);
  const group = new Map(), owner = {};
  for (const b of rest) group.set(b, [b]);
  for (const b of rest) for (const m of b.text.matchAll(/"test", "tmp", "([\w.-]+)"/g)) {
    const o = owner[m[1]];
    if (!o) { owner[m[1]] = b; continue; }
    const ga = group.get(o), gb = group.get(b);
    if (ga === gb) continue;
    for (const x of gb) { ga.push(x); group.set(x, ga); }
  }
  return { serial, units: [...new Set(group.values())] };
}

/* a section's cost: this machine's last time, else the committed cost, else its length at the rate the costed ones run */
export function coster(blocks, past = {}, costs = {}) {
  const has = (o, t) => Object.prototype.hasOwnProperty.call(o, t) && Number.isFinite(o[t]);
  const from = (b) => (has(past, b.title) ? "run" : has(costs, b.title) ? "file" : "length");
  const known = (b) => (has(past, b.title) ? past[b.title] : costs[b.title]);
  let ms = 0, chars = 0;
  for (const b of blocks) if (from(b) !== "length") { ms += known(b); chars += b.text.length; }
  const rate = ms > 0 && chars > 0 ? ms / chars : 1 / 20;
  const cost = (b) => (from(b) === "length" ? b.text.length * rate : known(b));
  cost.from = from;
  return cost;
}

/* longest first into the emptiest shard */
export function pack(units, jobs, cost) {
  const shards = Array.from({ length: jobs }, () => ({ load: 0, blocks: [] }));
  for (const u of units.map((u) => ({ u, c: u.reduce((a, b) => a + cost(b), 0) })).sort((a, b) => b.c - a.c)) {
    const s = shards.reduce((a, b) => (b.load < a.load ? b : a));
    s.load += u.c; s.blocks.push(...u.u);
  }
  return shards;
}

/* the one road from verify.mjs to shards */
export function plan(text, { jobs, past = {}, costs = {} }) {
  const suite = readSuite(text);
  if (!suite) return null;
  const { serial, units } = unitsOf(suite.blocks);
  const cost = coster(suite.blocks, past, costs);
  return { ...suite, serial, cost, shards: pack(units, jobs, cost) };
}

/* shards: --jobs, else half the cores, at most 10; never more than the cores less one, never fewer than two */
export function jobsFor(argv, cores) {
  const ji = argv.indexOf("--jobs");
  if (ji < 0) return Math.max(2, Math.min(10, Math.floor(cores / 2)));
  return Math.max(1, Math.min(+argv[ji + 1], Math.max(2, cores - 1)));
}

/* what test/suite-costs.json holds: the sections verify.mjs has now, in its order, each in whole tens of milliseconds */
export function costsFrom(blocks, times) {
  const out = {};
  for (const b of blocks) {
    const t = Object.prototype.hasOwnProperty.call(times, b.title) ? times[b.title] : null;
    if (Number.isFinite(t) && t >= 0) out[b.title] = Math.max(10, Math.round(t / 10) * 10);
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { text, past, costs } = inputs();

  if (process.argv.includes("--write-costs")) {
    const suite = readSuite(text);
    const out = suite ? costsFrom(suite.blocks, past) : {};
    const n = Object.keys(out).length, of = suite ? suite.blocks.length : 0;
    if (!suite || n * 2 < of) { console.log(`  FAIL  this machine has timings for ${n} of ${of} sections: run npm test first`); process.exit(1); }
    writeFileSync(COSTS, JSON.stringify(out, null, 1) + "\n");
    console.log(`test/suite-costs.json: ${n} of ${of} sections, from this machine's last run`);
    process.exit(0);
  }

  const JOBS = jobsFor(process.argv.slice(2), cpus().length);
  const p = plan(text, { jobs: JOBS, past, costs });
  if (!p) { console.log("  FAIL  cannot find the sections or the footer in test/verify.mjs"); process.exit(1); }
  const { prelude, footer, blocks, serial, shards, cost } = p;
  const by = { run: 0, file: 0, length: 0 };
  for (const b of blocks) by[cost.from(b)]++;
  console.log(`packing ${blocks.length} sections into ${JOBS} shards (${by.run} by this machine's last run, ${by.file} by test/suite-costs.json, ${by.length} by length):`
    + ` ${shards.map((s) => (s.load / 1000).toFixed(0)).join(", ")} s estimated`);

  const times = {};
  const run = (name, bl) => new Promise((done) => {
    const file = join(REPO, "test", `.shard-${name}.mjs`);
    writeFileSync(file, [prelude, ...bl.sort((a, b) => a.k - b.k).map((b) => b.text), footer].join("\n"));
    const p = spawn(process.execPath, ["--max-old-space-size=4096", file], { cwd: REPO, env: { ...process.env, SUITE_SHARD: name } });
    let buf = "", last = null, lastAt = Date.now(), res = null;
    const titles = new Set(bl.map((b) => b.title));
    const line = (l) => {
      if (titles.has(l)) { const now = Date.now(); if (last) times[last] = now - lastAt; last = l; lastAt = now; return; }
      const m = l.match(/^(\d+) passed, (\d+) failed, across (\d+) sections$/);
      if (m) { res = { pass: +m[1], fail: +m[2], sections: +m[3] }; return; }
      if (/^\s*(FAIL|SKIP)/.test(l) || /Error|at file:/.test(l)) console.log(`  [${name}] ${last ? last.slice(0, 50) + ": " : ""}${l.trim()}`);
    };
    const eat = (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { line(buf.slice(0, i).replace(/\r$/, "")); buf = buf.slice(i + 1); } };
    p.stdout.on("data", eat); p.stderr.on("data", eat);
    p.on("close", (code) => { if (buf) line(buf); if (last) times[last] = Date.now() - lastAt; rmSync(file, { force: true }); done({ name, code, res, n: bl.length }); });
  });

  const t0 = Date.now();
  const results = [];
  if (serial.length) results.push(await run("serial", serial));
  const t1 = Date.now();
  results.push(...await Promise.all(shards.filter((s) => s.blocks.length).map((s, i) => run(String(i), s.blocks))));
  const t2 = Date.now();

  let pass = 0, fail = 0, sections = 0, broken = [];
  for (const r of results) {
    if (!r.res) { broken.push(r.name); continue; }
    pass += r.res.pass; fail += r.res.fail; sections += r.res.sections;
  }
  if (sections < blocks.length) broken.push(`${blocks.length - sections} section(s) never ran`);
  try { writeFileSync(TIMES, JSON.stringify({ ...past, ...times }, null, 1)); } catch (e) { /* timings are a convenience */ }
  console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`
    + ` (${results.length} processes: ${((t1 - t0) / 1000).toFixed(1)} s alone, then ${((t2 - t1) / 1000).toFixed(1)} s side by side)`);
  if (broken.length) console.log("  FAIL  a shard did not finish: " + broken.join(", "));
  process.exit(fail || broken.length ? 1 : 0);
}
