/* tools/rid.mjs — give every ledger row a STABLE IDENTITY.
 *
 * WHY THIS EXISTS. A row has been addressed by ovKey since the queue was built:
 * `party|date|total` (engine/position.mjs). That is enough for a fulfilment, which never
 * changes any of the three, and it is not enough for a general row editor, for two reasons
 * found by measuring the real book rather than by reasoning about it:
 *
 *   1. THE KEY IS BUILT FROM FIELDS THE EDITOR CAN CHANGE. Correct a row's party, date or
 *      total and its key changes with it, so a second correction cannot name the row it just
 *      edited. An id that is derived from the data cannot survive the data being edited.
 *   2. IT ALREADY COLLIDES. Two SA5-BTR lots dated 2026-07-22, both RM350, share one key, so
 *      neither can be addressed at all: tools/fold.mjs refuses with "matches 2 rows", and
 *      correctly, because it cannot know which was meant.
 *
 * A rid is opaque, assigned once, and never reused or renumbered: `s001` for a sale, `p001`
 * for a purchase. Nothing reads meaning into the number and nothing sorts by it. It exists so
 * that "this row" can be said out loud.
 *
 * IDEMPOTENT. It only fills a row that has none, and it never renumbers one that has. Run it
 * twice and the second run reports nothing to do.
 *
 *   node tools/rid.mjs            report what is missing, change nothing
 *   node tools/rid.mjs --assign   fill every gap, then normalise the book
 *
 * SALT_BOOK overrides the path, which is how the tests run it on a copy. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOK = process.env.SALT_BOOK || resolve(REPO, "ledger", "book.json");
const PREFIX = { sales: "s", purchases: "p" };

/* Parsed rather than matched with a regex, deliberately. The first version built the pattern
   with a template literal, where a lone backslash-d is just "d", so it read as ^s(d+)$ and
   matched nothing: max stayed at zero and it handed out s001 every single time. It looked
   right in a diff, and the FIRST assignment was correct by luck, because that one counts up
   from zero anyway. The collision would only have shown up on the first fold after it, on a
   real row. A parse has no escaping to get wrong.

   Found by a test asserting a folded row gets an unused id, which is the only reason it was
   not shipped: nothing else on this road would have noticed until two rows shared a name. */
export function nextRid(rows, prefix) {
  let max = 0;
  for (const r of rows) {
    if (!r || typeof r.rid !== "string" || !r.rid.startsWith(prefix)) continue;
    const tail = r.rid.slice(prefix.length);
    if (!tail.length || [...tail].some((c) => c < "0" || c > "9")) continue;
    max = Math.max(max, Number(tail));
  }
  return (n) => `${prefix}${String(max + n).padStart(3, "0")}`;
}

/* The one place a rid is minted, so the fold and this tool cannot disagree about the shape. */
export function assignRids(book) {
  const filled = [];
  for (const coll of ["sales", "purchases"]) {
    const rows = book[coll] || [];
    const mint = nextRid(rows, PREFIX[coll]);
    let n = 0;
    for (const r of rows) {
      if (!r || typeof r !== "object" || r.rid) continue;
      r.rid = mint(++n);
      filled.push(`${coll}  ${r.rid}  ${(r.customer || r.supplier || "?")} ${r.date || "undated"} RM${r.total}`);
    }
  }
  return filled;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("rid.mjs")) {
  const apply = process.argv.includes("--assign");
  const book = JSON.parse(readFileSync(BOOK, "utf8"));
  const before = ["sales", "purchases"].reduce((a, c) => a + (book[c] || []).filter((r) => r && r.rid).length, 0);
  const total = ["sales", "purchases"].reduce((a, c) => a + (book[c] || []).length, 0);
  const filled = assignRids(book);

  if (!filled.length) { console.log(`  ok    every row already carries a rid (${before}/${total})`); process.exit(0); }
  console.log(`  ${apply ? "assigning" : "would assign"} ${filled.length} rid${filled.length === 1 ? "" : "s"} (${before}/${total} carried one before):`);
  for (const l of filled.slice(0, 6)) console.log("    " + l);
  if (filled.length > 6) console.log(`    ... and ${filled.length - 6} more`);
  if (!apply) { console.log("\n  Nothing written. Re-run with --assign."); process.exit(0); }

  const { writeBookFile } = await import("./booksync.mjs");
  writeBookFile ? writeBookFile(book) : writeFileSync(BOOK, JSON.stringify(book, null, 2) + "\n");
  console.log(`  ok    ${filled.length} written to ledger/book.json. Now run: node tools/booksync.mjs --normalise && node tools/booksync.mjs --sync`);
}
