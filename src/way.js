/* src/way.js: "ON ITS WAY", AS A SQL FRAGMENT (S3 of the Book plan, 25 Oct 2026).
 *
 * A draft is ON ITS WAY to a reader while the book that reader read does not hold its row yet: pending, or approved and not folded.
 * The chain marks a folded draft committed (committed_at), then re-seeds the D1 mirror, then loads the Book, so the moment the
 * reader's book was made is the bound. THE BOUND IS THE ONE THE READER'S OWN BOOK CARRIES (Fable's review, 25 Oct 2026):
 *   a book read from the Book carries `at`, the moment of the Book's latest successful load, and a draft is in that book when
 *   committed_at <= at (the mark precedes the load in one chain run, so a failed load leaves committed_at > at: still on its way,
 *   counted once; a load that landed makes at > committed_at: in the book, no longer on its way). Both come from the SAME read, so
 *   a tap whose book and drafts straddle a load cannot count a payment twice or miss one.
 *   a book read from the D1 mirror carries no `at`: the fragments below then are byte for byte what they were (committed_at IS
 *   NULL, or committed_at after the mirror's snapshot.at), which is the way back.
 * The bound is spliced as a literal that must read as an ISO time, or it is not used.
 *
 * ONLY THE "ON ITS WAY TO A READER" QUESTION MOVES. "Awaiting the fold" (the redispatch count, the drafts view, the phone's queue
 * status, a trip's siblings under Approve, the input-admission lifecycle) is a question about D1 and the fold, and stays on
 * committed_at in both modes.
 */
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;

/* a bound that may be spliced into SQL, or null */
export const boundOk = (at) => (typeof at === "string" && ISO.test(at) ? at : null);

/* S4c (27 Oct 2026): A BOUND IS THE BOOK'S LATEST LOAD, AND THE DRAFTS THE BOOK HOLDS AS OPEN ENTRIES. A tap books an entry in the Book, so the view the reader read already
   holds that draft's row: the draft is no longer on its way to that reader, whatever its status or committed_at says, or its money would count twice (once in the view, once as
   a draft on top of it). The book carries the ids (`booked`) from the SAME read as `at`. With none open the bound is the plain `at` string and every clause below is byte for byte
   what S3 shipped; with some it is { at, booked }. Every helper takes either. The ids are spliced after a shape check, as `at` is. */
const DRAFT_ID = ISO;
const atOf = (b) => (b && typeof b === "object" ? boundOk(b.at) : boundOk(b));
const idsOf = (b) => (b && typeof b === "object" && Array.isArray(b.booked) ? b.booked.filter((i) => typeof i === "string" && DRAFT_ID.test(i)) : []);
const notBooked = (b, a = "") => { const ids = idsOf(b); return ids.length ? " AND " + a + "id NOT IN (" + ids.map((i) => "'" + i + "'").join(",") + ")" : ""; };

/* the bound a book carries: its `at` where it was read from the Book (with the draft ids it holds open, if any), else null (the mirror's own subquery form) */
export const boundOf = (book) => {
  const at = boundOk(book && book.at);
  if (!at) return null;
  const booked = idsOf({ booked: book.booked });
  return booked.length ? { at, booked } : at;
};

/* not folded into the book the reader read: for a clause that today says `committed_at IS NULL` */
export const unfolded = (b, a = "") => {
  const at = atOf(b);
  return (at ? "(" + a + "committed_at IS NULL OR " + a + "committed_at > '" + at + "')" : a + "committed_at IS NULL") + notBooked(b, a);
};

/* pending, or approved and not in the reader's book: today's ON_ITS_WAY, which counts a draft committed after the mirror's snapshot */
export const onItsWay = (b) => {
  const at = atOf(b), ids = notBooked(b);
  const base = at
    ? "status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > '" + at + "'))"
    : "status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1)))";
  return "(" + base + ")" + ids;
};

/* the row an entry made is in the reader's book: today's `landed`. It stays on committed_at, the fold's own question: a booked entry is in the view, but the Counter is told a
   row landed only when the fold has put it in git, so a held batch never tells a site of money git never took. S6 (flag book_outbox) is the one deliberate exception: its forced pass of the return leg
   tells the orders what the Book's view holds (a tapped, approved sale) without waiting for git, in the leg's own raise-only messages; an amendment that moves the row's key (a close, a change of total or
   delivery) still waits for the fold, because the order finds its row by that key and `landed` is judged here. */
export const landedBy = (b) => {
  const at = atOf(b);
  return at
    ? "committed_at IS NOT NULL AND committed_at <= '" + at + "'"
    : "committed_at IS NOT NULL AND committed_at <= (SELECT at FROM snapshot WHERE one=1)";
};
