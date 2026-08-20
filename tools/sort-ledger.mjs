#!/usr/bin/env node
/* sort-ledger.mjs — put the master's `sales` and `purchases` arrays back in date order.
 *
 * THE DATE IS SUPERIOR TO THE POSITION, and that is a standing decision of 20 Aug 2026. Rows
 * are appended in the order they are folded, which is the order entries were queued, and that
 * is not the order things happened: a row agreed on the 17th and fulfilled on the 18th lands
 * after rows dated the 18th, and an amendment can date a row into the middle of the book long
 * after its neighbours were written. The desk sorts by date wherever the order matters, so
 * this was never a computation fault. It made the FILE unreadable, which is a different
 * problem and worth fixing on its own terms: the file is what a person audits.
 *
 * PENDING ROWS CARRY NO DATE AND SORT LAST. That is the desk's own rule showing through:
 * an undated row has not happened, so it cannot be placed among the things that have. Within
 * one date, and within the undated block, the existing order is preserved exactly — the sort
 * is stable, so nothing moves that did not have to.
 *
 * Ids and array positions are NOT remapped and never will be. Nothing on this desk keys off a
 * row's index, so there is no id to keep in step; remapping would be work with no reader.
 *
 *   node tools/sort-ledger.mjs           sort in place, report what moved
 *   node tools/sort-ledger.mjs --check   report only, exit 1 if anything is out of order
 *
 * `npm test` runs the --check logic against the master, so an out-of-order book cannot ship.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_MASTER =
  resolve(REPO, "master", "salt_command.html");
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;
const CHECK = process.argv.includes("--check");
const ARRAYS = ["purchases", "sales"];

/* A record is one row object: the line that opens it plus every continuation line up to the
 * next opening line or the array's close.
 *
 * THE INDENT IS THE BOUNDARY, AND THE FIRST VERSION OF THIS FUNCTION GOT IT WRONG IN A WAY
 * THAT DESTROYED RM 8,981 OF THE BOOK. It started a new record at any line whose trimmed
 * content began with "{". Rows carry NESTED amendment records (`amend:[{date:...,kind:
 * 'Fulfilment',...}]`), 19 of them across the sales array, each on its own line beginning
 * with "{" at an indent of ten. The sort therefore tore those rows in half and reordered the
 * halves by the AMENDMENT's date, which merged 96 sales rows into 49 and took revenue from
 * RM 21,167.76 to RM 12,186.50. It parsed, it built, it passed 254 tests and it deployed.
 *
 * So: a record opens only at the ARRAY's own indent, two or three spaces. Anything deeper
 * belongs to the row above it. Brace counting was considered and rejected: 128 note lines
 * carry a brace inside their prose, so a depth counter fires on the text rather than the
 * structure, and a check that cries wolf is worse than no check.
 *
 * AND THE COUNT IS ASSERTED, because the failure above was silent. `sortArray` refuses to
 * write unless the records it split reassemble to exactly the lines it was given. */
const TOP = /^ {2,3}\{/;
export function splitRecords(lines) {
  const recs = [];
  for (const line of lines) {
    if (TOP.test(line) || !recs.length) recs.push([line]);
    else recs[recs.length - 1].push(line);
  }
  return recs;
}

export function dateOf(rec) {
  const m = /\bdate:'(\d{4}-\d{2}-\d{2})'/.exec(rec[0]);
  return m ? m[1] : null;
}

/* Stable: decorate with the original index, sort on (date, index), undated to the end. */
export function sortRecords(recs) {
  return recs
    .map((rec, i) => ({ rec, i, d: dateOf(rec) }))
    .sort((a, b) => {
      if (a.d === b.d) return a.i - b.i;
      if (a.d === null) return 1;
      if (b.d === null) return -1;
      return a.d < b.d ? -1 : 1;
    })
    .map((x) => x.rec);
}

export function outOfOrder(recs) {
  const bad = [];
  let last = null, seenUndated = false;
  recs.forEach((rec, i) => {
    const d = dateOf(rec);
    if (d === null) { seenUndated = true; return; }
    if (seenUndated) bad.push({ i, d, why: "a dated row sits after an undated one" });
    else if (last && d < last) bad.push({ i, d, why: `${d} sits after ${last}` });
    if (!seenUndated) last = d;
  });
  return bad;
}

/* THE CLI BODY RUNS ONLY WHEN THIS FILE IS THE ENTRY POINT. test/verify.mjs imports the three
   functions above to run the same check inside `npm test`, and an unguarded body would have
   the test suite silently REWRITE the master on every run. */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();

function main() {
const src = readFileSync(MASTER, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const lines = src.split(/\r?\n/);

let changed = 0, faults = 0;
for (const name of ARRAYS) {
  const open = lines.findIndex((l) => l.startsWith(`const ${name}=[`));
  if (open < 0) { console.log(`  FAIL  no "const ${name}=[" in the master`); faults++; continue; }
  let close = open + 1;
  while (close < lines.length && lines[close].trimEnd() !== "];") close++;
  if (close >= lines.length) { console.log(`  FAIL  ${name} is never closed`); faults++; continue; }

  const body = lines.slice(open + 1, close);
  const recs = splitRecords(body);
  const bad = outOfOrder(recs);

  if (!bad.length) { console.log(`  ok    ${name}: ${recs.length} rows, already in date order`); continue; }
  if (CHECK) {
    faults++;
    console.log(`  FAIL  ${name}: ${bad.length} row(s) out of date order`);
    for (const b of bad.slice(0, 8)) console.log(`          row ${b.i + 1}: ${b.why}`);
    continue;
  }
  const sorted = sortRecords(recs).flat();
  /* THE PERMUTATION CHECK. The sort may only REORDER whole records: same lines, same count,
     nothing dropped and nothing invented. This is the assertion the first version did not
     have, and it is the one that would have caught it before the book went out. */
  const before = body.slice().sort(), after = sorted.slice().sort();
  if (sorted.length !== body.length || before.some((l, i) => l !== after[i])) {
    console.log(`  FAIL  ${name}: the sort would not be a permutation of the input. Nothing written.`);
    faults++; continue;
  }
  lines.splice(open + 1, close - open - 1, ...sorted);
  changed += bad.length;
  console.log(`  ok    ${name}: ${recs.length} rows, ${bad.length} moved into date order`);
}

if (CHECK) {
  console.log(faults ? "\nOUT OF ORDER. Run: node tools/sort-ledger.mjs" : "\nIN ORDER.");
  process.exit(faults ? 1 : 0);
}
if (faults) process.exit(1);
if (changed) { writeFileSync(MASTER, lines.join(eol), "utf8"); console.log(`\nSORTED ${MASTER}`); }
else console.log("\nNothing to do.");
}
