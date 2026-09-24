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
 * test/tmp are kept in one shard, so two never share it at once. The rest are packed by last run's timings (test/.suite-times
 * .json, laptop only), longest first into the emptiest shard.
 *
 * The totals are the sum of the shards', and a section count short of the headings in verify.mjs fails the run, which is what
 * the suite's own floor check does in one process; that check stands down in a shard (SUITE_SHARD) because a shard runs part.
 * It is `npm test` (his instruction of 24 Sep 2026), here and in CI, where half of a runner's cores is two shards;
 * `npm run test:serial` is the one-process road.
 *
 *   node tools/suite-split.mjs            shards = half the cores, at most 10
 *   node tools/suite-split.mjs --jobs 12
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cpus } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFY = join(REPO, "test", "verify.mjs"), TIMES = join(REPO, "test", ".suite-times.json");
const ji = process.argv.indexOf("--jobs");
const JOBS = ji > 0 ? Math.max(1, +process.argv[ji + 1]) : Math.max(2, Math.min(10, Math.floor(cpus().length / 2)));

const lines = readFileSync(VERIFY, "utf8").split("\n");
const heads = lines.map((l, i) => (l.startsWith("section(") ? i : -1)).filter((i) => i >= 0);
const footAt = lines.findIndex((l) => l.startsWith("console.log(`\\n${pass} passed"));
if (!heads.length || footAt < heads[heads.length - 1]) { console.log("  FAIL  cannot find the sections or the footer in test/verify.mjs"); process.exit(1); }
const prelude = lines.slice(0, heads[0]).join("\n"), footer = lines.slice(footAt).join("\n");
const blocks = heads.map((h, k) => {
  const text = lines.slice(h, k + 1 < heads.length ? heads[k + 1] : footAt).join("\n");
  return { k, title: (lines[h].match(/^section\("((?:[^"\\]|\\.)*)"/) || [])[1] || lines[h], text };
});

/* phase one: what writes a shared path */
const serial = blocks.filter((b) => /tools\/build\.mjs"|rmSync\(join\(REPO, "test", "tmp"\)/.test(b.text));
const rest = blocks.filter((b) => serial.indexOf(b) < 0);

/* fixed folders under test/tmp bind their sections together */
const group = new Map(), owner = {};
for (const b of rest) group.set(b, [b]);
for (const b of rest) for (const m of b.text.matchAll(/"test", "tmp", "([\w.-]+)"/g)) {
  const o = owner[m[1]];
  if (!o) { owner[m[1]] = b; continue; }
  const ga = group.get(o), gb = group.get(b);
  if (ga === gb) continue;
  for (const x of gb) { ga.push(x); group.set(x, ga); }
}
const units = [...new Set(group.values())];

/* pack by last run's timings; a section never timed is costed by its length */
let past = {};
try { past = JSON.parse(readFileSync(TIMES, "utf8")); } catch (e) { /* first run */ }
const cost = (b) => past[b.title] != null ? past[b.title] : b.text.length / 20;
const shards = Array.from({ length: JOBS }, () => ({ load: 0, blocks: [] }));
for (const u of units.map((u) => ({ u, c: u.reduce((a, b) => a + cost(b), 0) })).sort((a, b) => b.c - a.c)) {
  const s = shards.reduce((a, b) => (b.load < a.load ? b : a));
  s.load += u.c; s.blocks.push(...u.u);
}

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
if (sections < heads.length) broken.push(`${heads.length - sections} section(s) never ran`);
try { writeFileSync(TIMES, JSON.stringify({ ...past, ...times }, null, 1)); } catch (e) { /* timings are a convenience */ }
console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`
  + ` (${results.length} processes: ${((t1 - t0) / 1000).toFixed(1)} s alone, then ${((t2 - t1) / 1000).toFixed(1)} s side by side)`);
if (broken.length) console.log("  FAIL  a shard did not finish: " + broken.join(", "));
process.exit(fail || broken.length ? 1 : 0);
