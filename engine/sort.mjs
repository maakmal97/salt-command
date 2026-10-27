/* engine/sort.mjs: THE BOOK'S ORDER, PURE (S4a of the Book plan, 27 Oct 2026). Lifted out of tools/sort-ledger.mjs with no change so the Book can
   sort the view as the fold sorts the book (tools/sort-ledger.mjs re-exports every name). No fs, no clock. */
export const ARRAYS = ["purchases", "sales"];

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
