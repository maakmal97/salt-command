/* src/book-compact.js: S5f-3 OF THE BOOK PLAN, COMPACT THE BOOK AND MARK WHAT IT CLOSED COMMITTED (28 Oct 2026; plan: docs/plan-book-s5-s6.html). Dormant: the real run needs D1 `book_source` = 'book'.
   The Worker's side of the Book's `compact` verb (src/book.js), for the flip and for the daily export job. Pure plumbing: the Book decides whether a compaction holds; this keeps D1 level with it.

   WHY D1 MUST BE MARKED, AND IN WHAT ORDER. A booked draft is "on its way" to a reader (src/way.js) until the reader's book holds its row: an open entry is in the view (so the draft is left out of the way), and a closed
   one is in the base only once the draft's committed_at is at or before the base's `at`. So a compaction that closed an entry and left its draft uncommitted counts the money twice, once in the base and once on top as a
   draft; and a draft marked committed AFTER the compaction's `at` is still on its way. Hence the order: (1) every open entry's draft is marked committed, in ONE batch, while the entry is still open (the view holds the row, the
   draft is committed: counted once); (2) the Book compacts, its base now holds them (committed_at before `at`: counted once); (3) any draft the compaction closed that is still unmarked (a tap that landed between 1 and 2) is
   marked committed AT the compaction's `at`, never later, so it is in the base and not on its way. Every state in between counts a row once. A retry after a failure past the Book's commit finds nothing open and marks
   from the Book's own event log (`/events?all=1`), so the marks are derived, never remembered. Read back: no closed entry's approved draft is left uncommitted. */
import { BOOK_NAME } from "./book.js";
import { sourceMode } from "./book-tap.js";

const CHUNK = 500;   /* ids in one statement's json array: about 14 KB, well inside D1's statement size */
const MARK = "UPDATE draft SET committed_at=?1 WHERE committed_at IS NULL AND status='approved' AND id IN (SELECT value FROM json_each(?2))";
const LEFT = "SELECT COUNT(*) AS n FROM draft WHERE committed_at IS NULL AND status='approved' AND id IN (SELECT value FROM json_each(?1))";
const chunks = (ids) => { const out = []; for (let i = 0; i < ids.length; i += CHUNK) out.push(ids.slice(i, i + CHUNK)); return out; };

async function ask(env, path, method) {
  const stub = env.BOOK.get(env.BOOK.idFromName(BOOK_NAME));
  const r = await stub.fetch(new Request("https://book/" + path, { method }));
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

/** Compact the Book and mark committed the drafts it closed. `dry` rehearses (any source): it writes nothing in the Book or in D1.
    A real run needs the Book as the source: in the old world the fold must book those drafts into git, and marking them committed would drop them from it.
    Answers { ok, dry, open, compacted, closed, marked, left, at } or { ok: false, status, error }. */
export async function compactAndMark(env, { dry = false, now = new Date().toISOString() } = {}) {
  if (!env.BOOK || !env.SALT_LEDGER) return { ok: false, status: 503, error: "the Book or the ledger is not bound" };
  if (dry) {
    const a = await ask(env, "compact?dry=1", "POST");
    return a.body && a.body.ok ? { ok: true, dry: true, open: a.body.compactable || a.body.open || 0, closed: (a.body.closed || []).length } : { ok: false, status: a.status === 200 ? 409 : a.status, dry: true, error: String((a.body && a.body.error) || "no answer").slice(0, 200) };
  }
  if (await sourceMode(env.SALT_LEDGER) !== "book") return { ok: false, status: 409, error: "the Book is not the source (D1 book_source reads d1): a real compaction would drop its drafts from the fold, so only a dry run answers" };
  const db = env.SALT_LEDGER;
  const ev = await ask(env, "events", "GET");
  if (!ev.body || !ev.body.ok || !Array.isArray(ev.body.ids)) return { ok: false, status: 503, error: "the Book did not say which entries are open" };
  const open = ev.body.ids;
  /* an entry whose draft is not approved is not a booked row (a void that failed, a draft still pending): compaction would write a sale nobody approved into the base */
  const notApproved = [];
  for (const part of chunks(open)) {
    const rs = await db.prepare("SELECT id FROM draft WHERE status<>'approved' AND id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(part)).all();
    for (const r of rs.results || []) notApproved.push(r.id);
  }
  if (notApproved.length) return { ok: false, status: 409, error: "an open entry's draft is not approved, so the Book is not compacted", notApproved };
  let marked = 0;
  if (open.length) {
    const rs = await db.batch(chunks(open).map((part) => db.prepare(MARK).bind(now, JSON.stringify(part))));
    for (const r of rs) marked += Number((r && r.meta && r.meta.changes) || 0);
  }
  const c = await ask(env, "compact", "POST");
  if (!c.body || !c.body.ok) return { ok: false, status: c.status === 200 ? 409 : c.status, error: String((c.body && c.body.error) || "the Book would not compact").slice(0, 300), open: open.length, marked, markedBeforeRefusal: true };
  /* the Book's own log says what is closed, so a retry after a failure past its commit marks what is left */
  const all = await ask(env, "events?all=1", "GET");
  const closed = all.body && Array.isArray(all.body.entries) ? all.body.entries.filter((e) => e.folded_at && !e.voided_at).map((e) => e.draft_id) : (c.body.closed || []);
  /* a retry finds nothing open and the Book answers no moment: its latest load's moment is then the one the base holds the rows at or before */
  const at = c.body.at || ((await ask(env, "at", "GET")).body || {}).at || now;
  if (closed.length) await db.batch(chunks(closed).map((part) => db.prepare(MARK).bind(at, JSON.stringify(part))));
  let left = 0;
  for (const part of chunks(closed)) { const r = await db.prepare(LEFT).bind(JSON.stringify(part)).first(); left += Number((r && r.n) || 0); }
  return { ok: left === 0, status: left === 0 ? 200 : 500, ...(left ? { error: left + " closed entries' drafts are still uncommitted after the mark" } : {}), open: open.length, compacted: c.body.compacted || 0, closed: closed.length, marked, left, at, bookRev: c.body.bookRev };
}
