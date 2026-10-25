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

/* the bound a book carries: its `at` where it was read from the Book, else null (the mirror's own subquery form) */
export const boundOf = (book) => boundOk(book && book.at);

/* not folded into the book the reader read: for a clause that today says `committed_at IS NULL` */
export const unfolded = (at, a = "") => (boundOk(at) ? "(" + a + "committed_at IS NULL OR " + a + "committed_at > '" + at + "')" : a + "committed_at IS NULL");

/* pending, or approved and not in the reader's book: today's ON_ITS_WAY, which counts a draft committed after the mirror's snapshot */
export const onItsWay = (at) => (boundOk(at)
  ? "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > '" + at + "')))"
  : "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1))))");

/* the row an entry made is in the reader's book: today's `landed` */
export const landedBy = (at) => (boundOk(at)
  ? "committed_at IS NOT NULL AND committed_at <= '" + at + "'"
  : "committed_at IS NOT NULL AND committed_at <= (SELECT at FROM snapshot WHERE one=1)");
