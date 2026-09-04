#!/usr/bin/env node
/* sort-ledger.mjs — put `sales` and `purchases` back in date order, undated pending rows last.
 *
 * FROM v340 THE BOOK IS ledger/book.json, so that is what is sorted. The master's copy of the
 * rows is generated from it (tools/booksync.mjs), so sorting the file and syncing the block is
 * the whole job; the block in the master is never edited directly.
 *
 *   node tools/sort-ledger.mjs           sort book.json, rewrite it and the master's block
 *   node tools/sort-ledger.mjs --check   report rows out of order, exit 1 if any, write nothing
 *
 * A sort is a permutation: the tool asserts that every row it wrote is a row it read, and the
 * same number of them. The line-based helpers below are kept because the tests use them to
 * read the generated block in the master as well, and a record there is one line per row. */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { readBookFile, writeBookFile, syncText, BOOK, MASTER } from "./booksync.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
export const ARRAYS = ["purchases", "sales"];

/* ---- helpers on LINES, for the block in the master (kept for the tests) ---- */
const TOP = /^ {2,3}\{/;
export function splitRecords(lines) {
  const recs = [];
  for (const line of lines) {
    if (TOP.test(line) || !recs.length) recs.push([line]);
    else recs[recs.length - 1].push(line);
  }
  return recs;
}
/* a record is an array of lines (the master's block) or a row object (the book) */
export function dateOf(rec) {
  if (rec && !Array.isArray(rec) && typeof rec === "object") return rec.date || null;
  /* v359: A ROW'S OWN date CAN LAND ANYWHERE IN THE TEXT, not reliably before its amend or
     paidSplit array. The v358 fix assumed it always came first, on the ground that
     applyAmend only ever ADDS date to a row that has none; that held until a row was
     amended a first time, because `row.date = pay.date` runs AFTER the amend array is
     created in the same call, so it lands past it in the object's own key order. Searching
     "up to the first amend" then read the amendment step's own date as the row's whenever
     the row had none of its own (v358's bug) and missed the row's real date entirely
     whenever it did have one but amend still came first in the text (this one).
     So this reads the line structurally instead of by position: walk it tracking
     object/array depth, and take the first "date" key found at depth 1, the row's own top
     level, wherever in the line it falls. A date inside a nested amend or paidSplit entry
     sits at depth 2 or deeper and is skipped regardless of where it appears in the text. */
  const s = rec[0];
  let depth = 0, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{" || c === "[") { depth++; continue; }
    if (c === "}" || c === "]") { depth--; continue; }
    if (depth === 1) {
      const m = /^(?:"date":"|date:')(\d{4}-\d{2}-\d{2})/.exec(s.slice(i));
      if (m) return m[1];
    }
  }
  return null;
}
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

/* AN UNDATED ROW IS A FAULT, NOT AN ORDERING, from 04 Sep 2026 on his instruction that no
   undated row may stand on the ledger.

   The sort still puts an undated row last, and that stays: it is what keeps the order stable
   while a row is mid-flight, and outOfOrder still measures order rather than completeness. What
   changes is that `--check`, which is the thing CI runs, now fails on one. Sorting an undated
   row to the end accommodated it for ever; three rows sat there because of it, s108 and s109
   from 24 Aug and s119 from 4 Sep, every one of them cancelled and therefore, until the fold's
   Correction gate was narrowed the same day, unreachable by any repair.

   THIS READS THE ROW, NOT THE TEXT. dateOf() walks the record structurally and takes the first
   `date` at depth 1, so a date nested inside an amend or a paidSplit is not mistaken for the
   row's own. That is the same reader the order check uses, so the two cannot disagree about
   what a row's date is. */
export function undated(recs) {
  const bad = [];
  (recs || []).forEach((rec, i) => {
    if (dateOf(rec) === null) bad.push({ i, rid: (rec && !Array.isArray(rec) && rec.rid) || null });
  });
  return bad;
}
const nameRow = (x) => x.rid || `row ${x.i + 1}`;

/* ---- the book ---- */
export function sortBook(book) {
  let changed = 0;
  const report = [];
  for (const name of ARRAYS) {
    const rows = book[name] || [];
    const bad = outOfOrder(rows);
    const sorted = sortRecords(rows);
    const before = rows.map((r) => JSON.stringify(r)).sort().join("\n");
    const after = sorted.map((r) => JSON.stringify(r)).sort().join("\n");
    if (before !== after || sorted.length !== rows.length) throw new Error(`${name}: the sort is not a permutation of its input`);
    const moved = sorted.filter((r, i) => r !== rows[i]).length;
    report.push({ name, rows: rows.length, moved, bad });
    if (moved) { book[name] = sorted; changed += moved; }
  }
  return { changed, report };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const book = readBookFile();
  if (CHECK) {
    let faults = 0;
    for (const name of ARRAYS) {
      const none = undated(book[name] || []);
      if (none.length) { faults++; console.log(`  FAIL  ${name}: ${none.length} row(s) carry no date (${none.map(nameRow).join(", ")}). Every row on the ledger is dated; correct the row rather than sorting it last.`); }
      const bad = outOfOrder(book[name] || []);
      if (bad.length) { faults++; console.log(`  FAIL  ${name}: ${bad.length} row(s) out of date order (row ${bad[0].i + 1}: ${bad[0].why}). Run: node tools/sort-ledger.mjs`); }
      if (!none.length && !bad.length) console.log(`  ok    ${name}: ${(book[name] || []).length} rows, every one dated and in date order`);
    }
    process.exit(faults ? 1 : 0);
  }
  const { changed, report } = sortBook(book);
  for (const r of report) console.log(`  ok    ${r.name}: ${r.rows} rows, ${r.moved ? r.moved + " moved into date order" : "already in date order"}`);
  if (changed) {
    writeBookFile(book);
    writeFileSync(MASTER, syncText(readFileSync(MASTER, "utf8"), book));
    console.log(`\nSORTED ${BOOK} and synced the master`);
  } else console.log("\nNothing to sort.");
}
