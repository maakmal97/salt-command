/* book-reads.mjs: no test reads the LIVE book for its content (S0 of the Book plan, the guard).
 *
 * The suite reads test/fixtures/book-frozen.json through FROZEN_BOOK, or the live files through LIVE_BOOK / LIVE_MASTER where the check is
 * about the live files themselves (test/frozen.mjs). A test that builds the path to ledger/book.json or ledger/ledger.json itself would
 * go red again on the next phone fold with no code change. bookReadFaults names each such line; a line that has to (a fake workspace, the
 * extract compared with the file) says why in a `book-read-ok:` comment on the line. */
const PATH_PIECES = /["']ledger["']\s*,\s*["'](?:book|ledger)\.json["']/;
const URL_FORM = /new URL\(\s*["'`]\.\.\/ledger\/(?:book|ledger)\.json/;
const DIRECT = /\b(?:readFileSync|readFile|copyFileSync|existsSync|statSync|cpSync)\(\s*["'`]\.{0,2}\/?ledger\/(?:book|ledger)\.json/;
export const OK_MARK = "book-read-ok:";
const FRAMEWORK = new Set(["test/frozen.mjs", "test/book-reads.mjs"]);

/* files: [{ path, text }] -> [{ path, line }] */
export function bookReadFaults(files) {
  const out = [];
  for (const f of files) {
    if (FRAMEWORK.has(f.path)) continue;
    f.text.split("\n").forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith("//") || t.startsWith("*") || /^\/\*.*\*\/$/.test(t)) return;   /* a comment-only line */
      if (l.includes(OK_MARK)) return;
      if (PATH_PIECES.test(l) || URL_FORM.test(l) || DIRECT.test(l)) out.push({ path: f.path, line: i + 1 });
    });
  }
  return out;
}
