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
  const m = /(?:\bdate:'|"date":")(\d{4}-\d{2}-\d{2})/.exec(rec[0]);
  return m ? m[1] : null;
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
      const bad = outOfOrder(book[name] || []);
      if (bad.length) { faults++; console.log(`  FAIL  ${name}: ${bad.length} row(s) out of date order (row ${bad[0].i + 1}: ${bad[0].why}). Run: node tools/sort-ledger.mjs`); }
      else console.log(`  ok    ${name}: ${(book[name] || []).length} rows in date order, undated last`);
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
