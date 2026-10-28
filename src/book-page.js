/* src/book-page.js: S5d OF THE BOOK PLAN, THE DESK PAGE READS THE BOOK AT REQUEST TIME (28 Oct 2026; plan: docs/plan-book-s5-s6.html). Dormant: the D1 flag `book_page` (migrations/0022) ships 'off'.
   Pure plumbing, like src/book-tap.js: it reads the flag and shapes the Book's answer for the page; the Worker's own functions (src/worker.js) ask the Book. */
import { unshape } from "./book.js";

/** 'on' or 'off': the one-row flag, 'off' when the table is missing or unreadable (a store before migrations/0022) */
export async function pageMode(db) {
  try { const r = await db.prepare("SELECT mode FROM book_page WHERE one=1").first(); return r && r.mode === "on" ? "on" : "off"; } catch (e) { return "off"; }
}

/** A Book view (its `/read` answer) as the page takes it: the book as ledger/book.json holds it (NOTES, prose the page never reads, left out) with the version, the Book's revision and the ids of the drafts
    the view holds. \`rev\` is the revision read BEFORE the view, so a move between the two reads as a later revision to the page and it fetches again: it can be late and never early. Null when the Book holds nothing. */
export function servedBook(res, rev) {
  if (!res || !res.ok || !res.rows || !res.state) return null;
  const { book } = unshape(res);
  delete book.NOTES;
  return { ok: true, v: res.v, stamped: res.stamped, at: res.at, rev: Number.isInteger(rev) ? rev : null, booked: Array.isArray(res.booked) ? res.booked : [], book };
}
