/* src/book.js: THE BOOK, A SHADOW DURABLE OBJECT BESIDE GIT (S2a of the Book plan, 18 Oct 2026).
 *
 * WHAT IT IS. A copy of the folded book, loaded at each fold. Git (ledger/book.json) stays the source. Since S3 (25 Oct 2026) the desk's readers may READ it
 * instead of the D1 mirror: the one-row flag in D1 (migrations/0018, shipped at 'd1') says whether they do, and a Book that trails the mirror is never
 * read (src/book-read.js, docs/DESK.md "The Book: read"). The fold, the drafter's writes and the Counter still never ask it a question. Its way back is the
 * flag, one statement and no deploy; the class itself goes with a new migration tag that deletes it (wrangler.jsonc), nothing else.
 *
 * NO RULE LIVES HERE. The load books the folded rows verbatim; the fold (tools/fold.mjs over engine/apply.mjs) already
 * applied every rule to them, so a second copy of a rule would be the thing that drifts (CLAUDE.md rule 1). Since S4a (27 Oct 2026)
 * a TAP can book an ENTRY here, beside the base, and it does so by calling the engine's own planBatch and applyEntry (bookEntry
 * below), never a rule of its own: the entries sit in the `booked` table, the base stays git's book as of the latest load, and
 * the view (base plus the open entries replayed in booked order, their minted rids forced) is what `/read` answers while any is open.
 * Nothing calls `tap` until S4d. A load closes the entries the fold took (docs/DESK.md, "The Book: tap").
 *
 * WHAT IT HOLDS, in its own SQLite:
 *   rows    each row of every array in the book (sales, purchases, COUNTS, loans, roster ...), under the collection and a
 *           key: the row's rid where it has one, else its own content hash. `booked_at` is the moment THE LOAD first booked
 *           the row and is never moved; `revised_at` the moment a rid row's content last changed; `gone_at` the moment a
 *           load no longer carried it (a row is kept, not deleted, so a row that returns keeps its booked_at).
 *   state   every other key of the book (STATED_STOCK, PROD_OPENING, NOTES, PRICING ...), one JSON document each, with the
 *           same stamps. PRICING is not in book.json (it is derived from it, ledger/ledger.json), so the load carries it.
 *   loads   one line a load: when, what changed, and the digest of what it carried.
 *
 * WHAT A LOAD ANSWERS (S2b, 20 Oct 2026). Counts and digests, never a row or a value: the CI service token reaches the route and
 * the Actions log is public. `added` counts rows AND documents booked, which is why S2a's first load said "433 rows, 450 booked"
 * (433 rows and 17 documents); `docs` is the live document count beside `rows`. `readback` is the PARITY half: read back out of
 * this object's own SQLite after the load commits, per collection the live rows' count and a digest over each row's sha256
 * RECOMPUTED FROM ITS STORED doc (never the stored h, so a row the store mangled shows), and per document the digest of its stored
 * doc. tools/book-load.mjs computes the same from git's files by its own hand and names any collection or document that differs.
 *
 * A LOAD IS IDEMPOTENT. It is one synchronous transaction that books what the object does not hold, revises what changed
 * and marks what is gone, so the same book loaded twice, or a retried or replayed fold, changes nothing the second time:
 * the counts say 0, no stamp moves. The hashes are taken BEFORE the transaction (crypto.subtle is async, and nothing may be
 * awaited inside it). The chain runs one at a time (its concurrency group), so loads arrive in order.
 *
 * RECOVERY (S2c, 20 Oct 2026). The platform keeps 30 days of this object's history and restores it to a bookmark: arm the
 * bookmark, abort, and the next start opens the storage as it stood there. That is proved on a SECOND object of this class,
 * PITR_NAME, never on the live Book: the `pitr` verbs answer only on the object whose id IS the test name's (an allowlist, so the
 * live Book and any third name are refused), and the Worker's route names the test object and nothing else (tools/book-pitr.mjs
 * loads the book at an earlier fold, then the tip, restores to the first and back to the second, each read back against git by
 * book-load's own hand). The live Book is only READ for it: `/window` says whether its first load is still in the platform's
 * reach, and each load answers its exact bookmark, which the fold's log keeps, so a restore by hand lands on a fold and not near
 * one. Restoring the live Book has no route: docs/DESK.md, "The Book: recovery", is the hand step, his yes first.
 *
 * THE DESK'S LIVE OBJECT (Speed Wave 2 L1, 21 Oct 2026). The object named LIVE_NAME is this same class holding no book: it accepts the
 * Desk page's WebSocket (hibernating, tag "desk", at most 16, the oldest closed) and tells every one the KIND of thing that moved:
 * "orders", "drafts", or "rev" when the build the Worker serves is not the build it last told of. Nothing else crosses: no id, no
 * row, no figure. On that object /load, /pitr and /window answer 404, and on every other name /live, /tell and /rev do; a socket
 * message only asks (the ping is answered, a third other message closes it) and never reaches a load or a recovery verb.
 *
 * A PLAIN CLASS WITH fetch(), like stmt/orderbook.js: nothing here imports from stmt/ and the suite drives it over node:sqlite.
 */
import { planBatch, applyEntry, applyRename, movesOf } from "../engine/apply.mjs";
import { isPinned } from "../engine/pinned.mjs";
import { nextRid } from "../engine/rid.mjs";
import { sortBook } from "../engine/sort.mjs";
import PRICING_RULES from "../engine/rules.mjs";
export const BOOK_NAME = "book";
export const PITR_NAME = "book-pitr-test";
/* 21 Oct 2026, Speed Wave 2 L1: a THIRD object of this class holds the Desk's live sockets and nothing else (see the header's last paragraph) */
export const LIVE_NAME = "live";
export const LIVE_MAX = 16, LIVE_STRIKES = 3, LIVE_KINDS = ["orders", "drafts"];
const REV_RE = /^[0-9a-f]{16}$/;
/* S3 (25 Oct 2026): THE LISTS THE MIRROR KEEPS AS ROWS (tools/book.mjs COLLECTIONS, pinned equal by the suite; src/ cannot import tools/),
   the derived documents ledger/ledger.json adds to the book, and the one key the mirror never carried */
export const COLLECTIONS = ["sales", "purchases", "loans", "contacts", "selfUseLog", "lostDemand", "customerRefunds", "ONE_OFFS"];
export const DERIVED = ["OPEN", "TERMS", "REWARD", "STOCK"];
export const NOT_MIRRORED = ["NOTES"];
const ARRAYS = "__arrays";   /* {array key: its length}, so an empty list is still a fact and a read can rebuild every list the book had */
const VERSION_RE = /^v(\d+)$/;
/* the platform's bookmarks are "mostly alphanumeric" with dashes, about 61 characters */
export const BOOKMARK_RE = /^[0-9a-zA-Z-]{16,128}$/;
const DAY = 86400000;
export const MAX_LOAD_BYTES = 8 * 1024 * 1024;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha(text) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))); }

/* the same JSON with every object's keys in order, so a row hashes the same however the file spelled it */
export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

/* The book as the load carries it -> what the transaction books: rows [{coll, key, doc, h}], state [{k, doc, h}], the digest. */
export async function prepare(book, pricing, meta) {
  if (!book || typeof book !== "object" || Array.isArray(book)) throw new Error("a book object is required");
  if (!Array.isArray(book.sales) || !book.sales.length || !Array.isArray(book.purchases) || !book.purchases.length)
    throw new Error("a book with sales and purchases is required; a load of less is refused rather than mark every row gone");
  const rows = [], state = [], arrays = {};
  for (const coll of Object.keys(book).sort()) {
    const v = book[coll];
    if (!Array.isArray(v)) { const doc = canon(v); state.push({ k: coll, doc, h: await sha(doc) }); continue; }
    arrays[coll] = v.length;
    const seen = new Set();
    let seq = 0;
    for (const r of v) {
      const doc = canon(r), h = await sha(doc);
      const base = r && typeof r === "object" && typeof r.rid === "string" && r.rid ? "r:" + r.rid : "h:" + h;
      let key = base;
      for (let n = 2; seen.has(key); n++) key = base + "#" + n;
      seen.add(key);
      rows.push({ coll, key, doc, h, seq: seq++ });
    }
  }
  { const doc = canon(arrays); state.push({ k: ARRAYS, doc, h: await sha(doc) }); }
  /* S3: the documents ledger/ledger.json derives from the book, and the version they are for. A caller that sends none (the recovery test) loads a Book that cannot be read. */
  const snap = meta && typeof meta.v === "string" && meta.v ? { v: meta.v, stamped: meta.stamped == null ? null : String(meta.stamped) } : null;
  if (snap && meta.derived && typeof meta.derived === "object")
    for (const k of DERIVED) if (meta.derived[k] !== undefined && meta.derived[k] !== null) { const doc = canon(meta.derived[k]); state.push({ k, doc, h: await sha(doc) }); }
  /* PRICING.takenAt is minted per extract (tools/book.mjs), so it moves on every chain run with nothing else changed; it is
     left out, here and in S2b's compare, or every replayed fold would read as a revision */
  if (pricing !== undefined && pricing !== null) { const { takenAt, ...steady } = pricing; const doc = canon(steady); state.push({ k: "PRICING", doc, h: await sha(doc) }); }
  state.sort((a, b) => (a.k < b.k ? -1 : 1));
  rows.sort((a, b) => (a.coll + "\u0000" + a.key < b.coll + "\u0000" + b.key ? -1 : 1));
  const digest = await sha(rows.map((r) => r.coll + "|" + r.key + "|" + r.h).join("\n") + "\n--\n" + state.map((s) => s.k + "|" + s.h).join("\n"));
  return { rows, state, digest, snap };
}

/* S5e: WHAT A READ ANSWERS -> the book as ledger/book.json holds it, and the derived documents beside it. Every array (a collection or a plain list: the roster, the counts) is a book key of its own,
   every other state document too; the five derived documents (and PRICING) are handed back apart, as ledger.json carries them. No rule lives here: it puts back what `prepare` took apart. */
export function unshape(res) {
  const rows = res.rows || {}, state = res.state || {}, arrays = state[ARRAYS] || {}, book = {}, derived = {};
  for (const k of Object.keys(arrays)) book[k] = rows[k] || [];
  for (const [k, doc] of Object.entries(state)) {
    if (k === ARRAYS) continue;
    if (DERIVED.includes(k) || k === "PRICING") derived[k] = doc; else book[k] = doc;
  }
  return { book, derived };
}

/* a version "v1252" as a number, or null where it does not read so (a stale-load check then cannot judge, and lets the load through) */
export const versionNo = (v) => { const m = VERSION_RE.exec(String(v == null ? "" : v)); return m ? +m[1] : null; };

/* S3: what a read answers -> what readBook builds on, the mirror's own shape. Rows of a collection come back in book order (seq);
   every list that is not a COLLECTION is one document in the mirror's state (PROD_ORDER, COUNTS, roster ...), rebuilt from its rows,
   and `__collections` is what the mirror writes. NOTES is the one book key the mirror never held. */
export function shape(res) {
  const rows = res.rows || {}, state = {};
  const arrays = (res.state && res.state[ARRAYS]) || {};
  for (const [k, doc] of Object.entries(res.state || {})) if (k !== ARRAYS && !NOT_MIRRORED.includes(k) && !COLLECTIONS.includes(k)) state[k] = doc;
  for (const k of Object.keys(arrays)) if (!COLLECTIONS.includes(k) && !NOT_MIRRORED.includes(k)) state[k] = rows[k] || [];
  state.__collections = COLLECTIONS.filter((c) => c in arrays);
  const colls = {};
  for (const c of COLLECTIONS) colls[c] = rows[c] || [];
  return { rows: colls, state, version: res.v == null ? null : res.v, stamped: res.stamped == null ? null : res.stamped, at: res.at || null };
}

/* ---- S4a (27 Oct 2026): THE BOOKED ENTRIES. A tap books an ENTRY here, beside the base; the base (`rows`, `state`) stays git's book as of the latest load
   and is written by a load alone. The VIEW is the base with the unfolded entries replayed through the engine's own planBatch and applyEntry (no second copy
   of the law lives in this file), each with its minted rids FORCED, so a replay never mints again. Nothing calls `tap` until S4d; see docs/DESK.md. ---- */
export const FOLD_ONLY = ["roster", "rename"];   /* a username comes from the spare pool in git, a rename re-keys files: the fold's alone, until the roster flag (D1 book_roster, shipped off) is on */
export const TAP_MAX = 50;
const ISO_ID = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/;
const DAY_RE = /^\d{4}-\d\d-\d\d$/;
/* the books whose rule carries a % or a drift: the fold reads the same off the master's TIER_RULE lines (pinned equal by the suite) */
export const DRIFT_BOOKS = Object.keys(PRICING_RULES.TIER_RULE).filter((k) => { const r = PRICING_RULES.TIER_RULE[k]; return !!r && (r.drift !== undefined || r.pct !== undefined); });
/* a code written into the desk's own logic is "pinned" and its rename is left for a hand fold: engine/pinned.mjs is the master's scan written down (the suite scans the master against it) */

/* what planBatch and applyEntry read beside the book: the reward scheme and the pricing snapshot are the Book's own derived documents */
export function lawCtx(derived, day) {
  const rw = derived.REWARD && derived.REWARD.stated ? { stated: derived.REWARD.stated, ...(derived.TERMS ? { terms: derived.TERMS } : {}) } : null;
  const pricing = derived.PRICING && derived.PRICING.byProduct ? derived.PRICING : null;
  return { today: day, pinnedInMaster: isPinned, driftBooks: DRIFT_BOOKS, reward: rw, pricing };
}

/* why an item is the fold's alone, or null: a roster entry or a rename (unless the roster flag is on: `rosterOn`); a Counter trade naming a party the book does not hold yet (its Add ID has to book first) */
export function foldOnlyWhy(item, book, rosterOn) {
  if (!rosterOn && FOLD_ONLY.includes(item.collection)) return item.collection + " is booked by the fold";
  const pl = item.entry && item.entry.payload;
  if (["sales", "purchases"].includes(item.collection) && pl && pl.mode === "new" && item.entry.makerRequest) {
    const have = new Set(book.roster || []);
    const miss = [pl.party, pl.assoc, pl.downstream].filter((c) => typeof c === "string" && c && !have.has(c));
    if (miss.length) return "names a party the book does not hold yet";
  }
  return null;
}

/* the party codes a row names (a sale's customer, a purchase's supplier, a Counter trade's party, associate and end buyer): what a rename can have retired */
const NAMING = ["customer", "party", "supplier", "assoc", "downstream"];
export function namedCodes(item) {
  const out = new Set(), take = (o) => { if (o && typeof o === "object") for (const k of NAMING) if (typeof o[k] === "string" && o[k]) out.add(o[k]); };
  take(item && item.row); take(item && item.entry && item.entry.payload);
  return [...out];
}

/* ONE ENTRY BOOKED INTO `book` IN PLACE, by the engine's own plan and applyEntry. `forced` is the rids a first booking minted, in the order it minted them; with none the rids
   are minted on the book as it stands and returned. A refusal leaves the book as it was (the plan is pure); a throw mid-apply is the caller's to contain (it books on a clone). */
export function bookEntry(book, item, ctx, forced) {
  /* a replay forces the rids the first booking minted; if the base now holds one of them under another row (a stranger's row, minted by the fold), this entry cannot stand */
  if (Array.isArray(forced)) for (const rid of forced) if (["sales", "purchases", "loans"].some((c) => (book[c] || []).some((x) => x && x.rid === rid))) return { ok: false, why: "its rid " + rid + " is held by another row" };
  const staged = { approved: [item] };
  const notes = { version: "the tap", rows: { [item.id]: { what: "", note: "" } } };
  const p = planBatch(book, staged, notes, ctx);
  if (p.refused.length) return { ok: false, why: p.refused.map((x) => x.why).join("; ") };
  const minted = [], queue = Array.isArray(forced) ? forced.slice() : null;
  const mint = (rows, prefix) => {
    const f = nextRid(rows, prefix);
    return (n) => { const r = queue && queue.length ? queue.shift() : f(n); minted.push(r); return r; };
  };
  const effects = { renames: [], roster: [] };
  for (const it of p.items) {
    const r = applyEntry(book, it, { nextRid: mint, staged, notes, moves: movesOf(p, it), reward: ctx.reward, today: ctx.today, pricing: ctx.pricing });
    for (const rn of r.renames) { applyRename(book, rn); effects.renames.push({ from: rn.from, to: rn.to, pairs: rn.pairs, geo: rn.geo || null }); }   /* S5: a rename re-keys the book where it stands, by the engine's own applyRename (the fold's batch runs the same) */
    if (it.roster) effects.roster.push({ code: it.roster.code, kind: (item.row || {}).kind || null, register: !!it.roster.register });
  }
  return { ok: true, minted, effects: effects.renames.length || effects.roster.length ? effects : null };
}

/* the money fields of a row for a tap-against-fold comparison: notes are the fold's to write, so every `note` is left out */
const noNote = (v) => canon(JSON.parse(JSON.stringify(v === undefined ? null : v), (k, x) => (k === "note" ? undefined : x)));
/* what an entry moves and the fold also writes the same way: the stock, the counts, the loans and the two lists; a document a hand edit of the master may move between loads is not compared */
const TAP_PURE = ["STATED_STOCK", "PROD_OPENING", "COUNTS", "COUNT_ON", "loans", "sales", "purchases"];
/* S5: and, when a roster entry or a rename was among the folded, what the road writes: the roster, the associates and partners, the places and the starting %s (a rename re-keys sales and purchases too, already compared) */
const ROSTER_PURE = ["roster", "associates", "partners", "PLACED", "TIER_OF"];
/* THE TAP CHECK: the view as it stood before a load against the view after it, for the entries the load folded. If the fold and the tap run one law the view does not move.
   Always the rows the entries minted; and, when the batch was nothing but entries (`pure`), every list and document but the notes and the watermark (stock, counts, loans). Names only. */
export function tapDiffer(pre, post, folded, pure) {
  const differ = [];
  for (const rid of [...new Set(folded.flatMap((e) => e.rids))]) {
    const coll = rid[0] === "s" ? "sales" : rid[0] === "p" ? "purchases" : rid[0] === "l" ? "loans" : null;
    if (!coll) continue;
    const a = (pre.book[coll] || []).find((r) => r && r.rid === rid), b = (post.book[coll] || []).find((r) => r && r.rid === rid);
    if (!b) differ.push(rid + " (not in the base)");
    else if (!a) differ.push(rid + " (not in the view)");
    else if (noNote(a) !== noNote(b)) differ.push(rid);
  }
  /* S5: an Add ID or a rename the load folded (by D1's word or by its effects) is checked against the new base's roster, in any load: the code it registered is there (unless a later folded rename moved it on), the codes it renamed are moved */
  const rosterPost = new Set(post.book.roster || []), moved = new Set(folded.flatMap((e) => ((e.fx && e.fx.renames) || []).flatMap((rn) => (rn.pairs || []).map((p) => p[0]))));
  for (const e of folded) {
    if (!e.fx) continue;
    for (const x of e.fx.roster || []) if (x.register && !moved.has(x.code) && !rosterPost.has(x.code)) differ.push("roster " + x.code + " (not in the base)");
    for (const rn of e.fx.renames || []) for (const [f, t] of rn.pairs || []) if (rosterPost.has(f) || !rosterPost.has(t)) differ.push("roster " + f + " to " + t + " (not moved in the base)");
  }
  if (pure) for (const k of folded.some((e) => e.coll === "roster" || e.coll === "rename") ? TAP_PURE.concat(ROSTER_PURE) : TAP_PURE) {
    const a = pre.book[k], b = post.book[k];
    if (Array.isArray(a) && Array.isArray(b)) { const key = (l) => l.map(noNote).sort().join("|"); if (key(a) !== key(b)) differ.push(k); }
    else if (noNote(a) !== noNote(b)) differ.push(k);
  }
  return differ;
}

/* S5a: a strict load that would change the view, and a dry run's own unwinding: thrown inside a transaction so it rolls back, caught by compact */
class Refused extends Error {}
class DryRun extends Error { constructor(r) { super("dry run"); this.r = r; } }

export class Book {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clock = () => new Date().toISOString();
    this.schema();
    /* the page's ping is answered by the platform without waking this object; Node has neither name, so each is looked for first */
    if (this.isLive() && typeof state.setWebSocketAutoResponse === "function" && typeof WebSocketRequestResponsePair === "function")
      state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /* the three tables; again after the test's deleteAll, which drops the whole database, tables included */
  schema() {
    const sql = this.state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS rows (coll TEXT NOT NULL, key TEXT NOT NULL, doc TEXT NOT NULL, h TEXT NOT NULL, booked_at TEXT NOT NULL, revised_at TEXT, gone_at TEXT, PRIMARY KEY (coll, key))");
    sql.exec("CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, doc TEXT NOT NULL, h TEXT NOT NULL, booked_at TEXT NOT NULL, revised_at TEXT)");
    /* S3: the row's place in its list, and the Book's one snapshot (version, stamp, the moment of the load that wrote them). A Book that
       held rows before S3 gains the column; its rows read NULL until the next load sets them. */
    try { sql.exec("ALTER TABLE rows ADD COLUMN seq INTEGER"); } catch (e) { if (!/duplicate column/i.test(String((e && e.message) || e))) throw e; }
    sql.exec("CREATE TABLE IF NOT EXISTS snap (one INTEGER PRIMARY KEY CHECK (one = 1), v TEXT NOT NULL, stamped TEXT, at TEXT NOT NULL)");
    /* S5a: THE BOOK'S REVISION. A monotonic count that moves with anything the Book holds that a reader could see differently: a load that changed a row or a document or closed an
       entry, a tap that booked an entry, a void that took one back, a compaction. Unlike the version (a git version, which stops moving once approvals are not versions) it moves with
       money. Nothing reads it yet. A Book that held a snapshot before S5a gains the column at 0. */
    try { sql.exec("ALTER TABLE snap ADD COLUMN rev INTEGER NOT NULL DEFAULT 0"); } catch (e) { if (!/duplicate column/i.test(String((e && e.message) || e))) throw e; }
    /* S5f-4: THE REVISION THE DERIVED DOCUMENTS (PRICING, OPEN, TERMS, REWARD, STOCK) WERE COMPUTED AT. A load carries them, so it sets this to the revision it leaves; a tap, a void and a compaction move `rev` and leave it, so
       `rev - derived_rev` is how far the documents trail the book. With the Book as the source the readers' staleness flags say so (src/book-read.js); in the old world nothing reads it. A Book before this gains the column at 0. */
    try { sql.exec("ALTER TABLE snap ADD COLUMN derived_rev INTEGER NOT NULL DEFAULT 0"); } catch (e) { if (!/duplicate column/i.test(String((e && e.message) || e))) throw e; }
    /* S4a: the entries a tap booked. The view replays the unfolded, unvoided ones in seq order; a load marks the ones it folded. A voided one is kept, not deleted. */
    sql.exec("CREATE TABLE IF NOT EXISTS booked (seq INTEGER PRIMARY KEY AUTOINCREMENT, draft_id TEXT NOT NULL, item TEXT NOT NULL, rids TEXT NOT NULL, day TEXT NOT NULL, at TEXT NOT NULL, folded_at TEXT, voided_at TEXT)");
    sql.exec("CREATE INDEX IF NOT EXISTS booked_draft ON booked (draft_id)");
    /* S5 (the roster road): WHAT AN ENTRY DID TO THE FILES GIT HOLDS BESIDE THE BOOK, as the Book applied it: { renames: [{from, to, pairs, geo}], roster: [{code, kind, register}] }, NULL for any other entry.
       The flip's export step (tools/roster-export.mjs) reads it to move the statement username, the place override and the suite's fixtures exactly as the fold did. A Book that held entries before gains the column. */
    try { sql.exec("ALTER TABLE booked ADD COLUMN effects TEXT"); } catch (e) { if (!/duplicate column/i.test(String((e && e.message) || e))) throw e; }
    /* S6: THE OUTBOX. A tap that booked a sale (or an amendment of one) leaves a row here in the SAME transaction; the Desk's drain (src/outbox.js) answers it with one forced pass of the return leg,
       which tells every order what the ledger says, and marks the rows it covered sent. A row is a durable "something booked: tell the orders", never a message: the leg's own messages are
       state, raise-only, and idempotent, so a row drained twice tells nothing twice. Nothing reads it while the flag (D1 book_outbox) is off. */
    sql.exec("CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, draft_id TEXT NOT NULL, at TEXT NOT NULL, sent_at TEXT, tries INTEGER NOT NULL DEFAULT 0, err TEXT)");
    sql.exec("CREATE TABLE IF NOT EXISTS loads (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, rev TEXT, digest TEXT NOT NULL, added INTEGER NOT NULL, revised INTEGER NOT NULL, gone INTEGER NOT NULL, returned INTEGER NOT NULL, rows INTEGER NOT NULL)");
  }

  /* One synchronous transaction; see the header. `p` is prepare()'s result. */
  load(p, rev, opts = {}) {
    const sql = this.state.storage.sql, at = this.clock();
    return this.state.storage.transactionSync(() => {
      /* S3 (Fable, 25 Oct 2026): A LOAD OF AN OLDER VERSION IS REFUSED. Readers key "on its way" off the moment of the latest load, so a
         laptop run posting last version's book would advance it past a payment the Book does not hold. An equal version is the
         idempotent replay; a version that does not read as vNNNN is let through. */
      if (p.snap) {
        const was = sql.exec("SELECT v FROM snap WHERE one = 1").toArray()[0], a = was && versionNo(was.v), b = versionNo(p.snap.v);
        if (a !== null && b !== null && b < a) return { ok: false, stale: true, error: "the Book is at " + was.v + " and refuses a load of " + p.snap.v };
      }
      /* S4a: the view as it stood before this load, for the tap check below (only while an entry is open) */
      const evs = this.events(), pre = opts.pre || (evs.length ? this.viewOf(evs) : null);   /* S5a: compaction hands in the view it already built */
      const n = { added: 0, revised: 0, gone: 0, returned: 0 };
      const held = new Map();
      for (const r of sql.exec("SELECT coll, key, h, gone_at, seq FROM rows").toArray()) held.set(r.coll + "\u0000" + r.key, r);
      for (const r of p.rows) {
        const was = held.get(r.coll + "\u0000" + r.key);
        held.delete(r.coll + "\u0000" + r.key);
        if (!was) { sql.exec("INSERT INTO rows (coll, key, doc, h, booked_at, seq) VALUES (?, ?, ?, ?, ?, ?)", r.coll, r.key, r.doc, r.h, at, r.seq); n.added++; continue; }
        if (was.h !== r.h) { sql.exec("UPDATE rows SET doc = ?, h = ?, revised_at = ?, gone_at = NULL, seq = ? WHERE coll = ? AND key = ?", r.doc, r.h, at, r.seq, r.coll, r.key); n.revised++; continue; }
        if (was.gone_at) { sql.exec("UPDATE rows SET gone_at = NULL WHERE coll = ? AND key = ?", r.coll, r.key); n.returned++; }
        /* a place in the list is not a revision of the row */
        if (was.seq !== r.seq) sql.exec("UPDATE rows SET seq = ? WHERE coll = ? AND key = ?", r.seq, r.coll, r.key);
      }
      for (const r of held.values()) if (!r.gone_at) { sql.exec("UPDATE rows SET gone_at = ? WHERE coll = ? AND key = ?", at, r.coll, r.key); n.gone++; }
      const keep = new Set(p.state.map((s) => s.k));
      for (const s of p.state) {
        const was = sql.exec("SELECT h FROM state WHERE k = ?", s.k).toArray()[0];
        if (!was) { sql.exec("INSERT INTO state (k, doc, h, booked_at) VALUES (?, ?, ?, ?)", s.k, s.doc, s.h, at); n.added++; }
        else if (was.h !== s.h) { sql.exec("UPDATE state SET doc = ?, h = ?, revised_at = ? WHERE k = ?", s.doc, s.h, at, s.k); n.revised++; }
      }
      /* a key the book no longer carries leaves with it (PRICING, and the derived documents, are the load's own, and stay when a load omits them) */
      for (const r of sql.exec("SELECT k FROM state").toArray()) if (!keep.has(r.k) && r.k !== "PRICING" && !DERIVED.includes(r.k)) { sql.exec("DELETE FROM state WHERE k = ?", r.k); n.gone++; }
      const prevSnap = sql.exec("SELECT rev, derived_rev FROM snap WHERE one = 1").toArray()[0] || {}, prevRev = prevSnap.rev || 0, prevDerived = prevSnap.derived_rev || 0;
      if (p.snap) sql.exec("INSERT OR REPLACE INTO snap (one, v, stamped, at) VALUES (1, ?, ?, ?)", p.snap.v, p.snap.stamped, at);
      /* S4a: THE ENTRIES THIS LOAD FOLDED. One is folded when D1 says its draft is committed (`opts.folded`, ids the Worker checked) or when the new base holds every rid it minted;
         the rest stay open and are replayed on the new base. The view before and after is compared for the folded ones (tapDiffer). */
      let tap = null;
      if (evs.length) {
        const said = new Set(opts.folded || []), clash = [];
        const heldDoc = new Map(sql.exec("SELECT key, doc FROM rows WHERE gone_at IS NULL AND key LIKE 'r:%'").toArray().map((r) => [r.key, r.doc]));
        /* a rid the base holds closes an entry only if the row under it is the one the entry booked (party, date, qty, total): a stranger's row under the same rid
           leaves the entry open, and the replay then refuses it (its rid is held), so it is named stuck and clashing, never closed by another row's money */
        const byRid = (e) => {
          const rs = JSON.parse(e.rids);
          if (!rs.length || !rs.every((x) => heldDoc.has("r:" + x))) return false;
          const it = JSON.parse(e.item), own = ["sales", "purchases", "loans"].includes(it.collection) && !it.amends ? it.row || {} : null;
          if (!own) return false;   /* an amendment mints no row of its own to compare (only generated ones): D1's word alone closes it */
          const base = JSON.parse(heldDoc.get("r:" + rs[0]));
          const alike = ["customer", "supplier", "party", "date", "qty", "total", "kg", "rm"].every((k) => own[k] === undefined || canon(own[k]) === canon(base[k]));
          if (!alike) clash.push(e.draft_id);
          return alike;
        };
        /* an Add ID or a rename mints no rid, so D1's word is not the only way it closes: the new base holds the code it registered, or has moved the codes it renamed (what its effects record) */
        const rosterNow = new Set(sql.exec("SELECT doc FROM rows WHERE coll = 'roster' AND gone_at IS NULL").toArray().map((x) => JSON.parse(x.doc)));
        const byEffect = (e) => {
          const fx = e.effects ? JSON.parse(e.effects) : null;
          if (!fx) return false;
          const regs = (fx.roster || []).filter((x) => x.register), rns = fx.renames || [];
          if (!regs.length && !rns.length) return false;
          return regs.every((x) => rosterNow.has(x.code)) && rns.every((rn) => (rn.pairs || []).every(([f, t]) => !rosterNow.has(f) && rosterNow.has(t)));
        };
        const done = evs.filter((e) => said.has(e.draft_id) || byRid(e) || byEffect(e));
        for (const e of done) sql.exec("UPDATE booked SET folded_at = ? WHERE seq = ?", at, e.seq);
        const rest = evs.filter((e) => !done.includes(e)), post = this.viewOf(rest);
        tap = { folded: done.length, open: rest.length, stuck: post.stuck.map((s) => s.id), clash,
          differ: done.length ? tapDiffer(pre, post, done.map((e) => ({ rids: JSON.parse(e.rids), coll: JSON.parse(e.item).collection, fx: e.effects ? JSON.parse(e.effects) : null })), !!opts.pure && !rest.length) : [] };
      }
      /* S5a: a strict load (compaction) is refused, and the whole transaction with it, when the view it would write is not the view that was read, or when it would lose a row */
      if (opts.strict && (!tap || tap.differ.length || tap.stuck.length || tap.open || n.gone || !tap.folded))
        throw new Refused("compaction refused: " + JSON.stringify(tap ? { differ: tap.differ, stuck: tap.stuck, open: tap.open, gone: n.gone, folded: tap.folded } : { entries: 0 }));
      const moved = n.added + n.revised + n.gone + n.returned > 0 || !!(tap && tap.folded);
      /* S5f-4: a load's derived documents are as fresh as the revision it leaves; a compaction rewrites the documents it already held, so it leaves where they were computed (`keepDerived`) */
      if (p.snap) sql.exec("UPDATE snap SET rev = ?, derived_rev = ? WHERE one = 1", prevRev + (moved ? 1 : 0), opts.keepDerived ? prevDerived : prevRev + (moved ? 1 : 0));
      const live = sql.exec("SELECT COUNT(*) AS c FROM rows WHERE gone_at IS NULL").toArray()[0].c;
      const docs = sql.exec("SELECT COUNT(*) AS c FROM state").toArray()[0].c;
      sql.exec("INSERT INTO loads (at, rev, digest, added, revised, gone, returned, rows) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", at, rev == null ? null : String(rev), p.digest, n.added, n.revised, n.gone, n.returned, live);
      const out = { ok: true, at, rev: rev == null ? null : String(rev), bookRev: p.snap ? prevRev + (moved ? 1 : 0) : prevRev, digest: p.digest, rows: live, docs, ...n, ...(tap ? { tap } : {}) };
      if (opts.dry) throw new DryRun(out);   /* S5a: a dry compaction is a load that unwinds, so nothing it did stays */
      return out;
    });
  }

  /* THE READ-BACK (S2b): what this object holds, out of its own SQLite. Live rows only (a gone row is kept, not counted). Each
     digest is the first 16 hex of a sha256: a collection's over its rows' own sha256 in sorted order, a document's over its doc. */
  async readback() {
    const sql = this.state.storage.sql, rows = {}, state = {};
    const by = new Map();
    /* S3: `order` is a digest over the same row hashes IN THE BOOK'S ORDER (seq), so a reader's order is in parity as well as its rows */
    for (const r of sql.exec("SELECT coll, doc FROM rows WHERE gone_at IS NULL ORDER BY coll, seq").toArray()) {
      if (!by.has(r.coll)) by.set(r.coll, []);
      by.get(r.coll).push(await sha(r.doc));
    }
    for (const [coll, hs] of by) rows[coll] = { n: hs.length, digest: (await sha(hs.slice().sort().join("\n"))).slice(0, 16), order: (await sha(hs.join("\n"))).slice(0, 16) };
    for (const r of sql.exec("SELECT k, doc FROM state").toArray()) state[r.k] = (await sha(r.doc)).slice(0, 16);
    return { rows, state };
  }

  /* S2c: the exact point after what was just written. sync() first, so the bookmark cannot sit before a load still held behind the
     output gate. null where the storage keeps no history (the suite's plain harness). */
  async mark() {
    const s = this.state.storage;
    if (typeof s.getCurrentBookmark !== "function") return null;
    await s.sync();
    return s.getCurrentBookmark();
  }

  /* the load, its read-back and its bookmark as one piece: no other request may land between them while the hashes are awaited */
  held(p, rev, opts) {
    return this.state.blockConcurrencyWhile(async () => { const r = this.load(p, rev, opts); if (!r.ok) return r; return { ...r, readback: await this.readback(), bookmark: await this.mark() }; });
  }

  /* S2c: only the test object answers a recovery verb. An allowlist on its id, failing closed when the namespace is not to hand. */
  isTest() {
    const ns = this.env && this.env.BOOK, id = this.state.id;
    if (!ns || typeof ns.idFromName !== "function" || !id || typeof id.equals !== "function") return false;
    return id.equals(ns.idFromName(PITR_NAME));
  }

  /* L1: only the live object answers a socket route. The same allowlist on its id as isTest, failing closed on any missing piece. */
  isLive() {
    try { return this.state.id.equals(this.env.BOOK.idFromName(LIVE_NAME)) === true; } catch (e) { return false; }
  }

  /* the 101 answer, as one seam: Node's Response refuses that status, so the suite replaces this one method */
  upgraded(client) { return new Response(null, { status: 101, webSocket: client }); }
  socks() { return typeof this.state.getWebSockets === "function" ? this.state.getWebSockets("desk") : []; }
  att(ws) { try { return ws.deserializeAttachment() || null; } catch (e) { return null; } }
  shut(ws, code, why) { try { ws.close(code, why); } catch (e) { /* already closed */ } }
  tellAll(msg) { let n = 0; for (const ws of this.socks()) { try { ws.send(msg); n++; } catch (e) { /* closing */ } } return n; }

  /* L1: THE LIVE OBJECT'S THREE ROUTES. The Worker has proved the owner before it forwards (ownerAccess, whatever REQUIRE_ACCESS says). */
  async liveFetch(request, url) {
    const path = url.pathname, no = () => Response.json({ ok: false, error: "not found" }, { status: 404 });
    if (path === "/live" && request.method === "GET") {
      if (String(request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") return new Response("Expected a WebSocket upgrade.", { status: 426 });
      if (typeof this.state.acceptWebSocket !== "function" || typeof WebSocketPair !== "function") return new Response("No sockets here.", { status: 501 });
      const mine = this.socks().map((ws) => ({ ws, att: this.att(ws) })).sort((x, y) => ((x.att && x.att.born) || 0) - ((y.att && y.att.born) || 0));
      for (let i = 0; i <= mine.length - LIVE_MAX; i++) this.shut(mine[i].ws, 1008, "replaced by a newer page");
      const [client, server] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(server, ["desk"]);
      server.serializeAttachment({ born: Date.now() });
      server.send(JSON.stringify({ k: "hello" }));
      return this.upgraded(client);
    }
    if (request.method !== "POST" || (path !== "/tell" && path !== "/rev")) return no();
    let body = null;
    try { body = await request.json(); } catch (e) { body = null; }
    if (path === "/tell") {
      if (!body || !LIVE_KINDS.includes(body.k)) return Response.json({ ok: false, error: "a tell is orders or drafts" }, { status: 400 });
      return Response.json({ ok: true, sent: this.tellAll(JSON.stringify({ k: body.k })) });
    }
    if (!body || typeof body.id !== "string" || !REV_RE.test(body.id)) return Response.json({ ok: false, error: "a build id is 16 hex characters" }, { status: 400 });
    const sql = this.state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS live_rev (one INTEGER PRIMARY KEY CHECK (one = 1), id TEXT NOT NULL)");
    const was = sql.exec("SELECT id FROM live_rev WHERE one = 1").toArray()[0];
    if (!was || was.id !== body.id) sql.exec("INSERT OR REPLACE INTO live_rev (one, id) VALUES (1, ?)", body.id);
    const changed = !!was && was.id !== body.id;
    return Response.json({ ok: true, changed, sent: changed ? this.tellAll(JSON.stringify({ k: "rev" })) : 0 });
  }

  /* A SOCKET ONLY ASKS. The ping is answered by the platform; any other message is a strike, and the third closes the socket. */
  webSocketMessage(ws, message) {
    if (message === "ping") { try { ws.send("pong"); } catch (e) { /* closing */ } return; }
    const att = this.att(ws);
    if (!att) { this.shut(ws, 1008, "unknown socket"); return; }
    att.strikes = (att.strikes || 0) + 1;
    if (att.strikes >= LIVE_STRIKES) { this.shut(ws, 1008, "this socket only listens"); return; }
    try { ws.serializeAttachment(att); } catch (e) { /* closing */ }
  }
  webSocketClose(ws, code) { this.shut(ws, code && code !== 1005 && code !== 1006 ? code : 1000, "closed"); }
  webSocketError(ws) { this.shut(ws, 1011, "error"); }

  /* S3: THE READ. Everything a reader of the book needs, in one synchronous pass of the Book's own SQLite (so it never sees half a load: a
     load is one transaction, and held() keeps the read-back's awaits from interleaving). Docs are stored as JSON text, so the answer is
     put together as text and the Worker parses it once. Rows of a list come back in the book's order (seq). Not a route: the Worker
     reaches it through the binding, only readBook and readcheck ask, and the answer carries cost, so it is never in CI_ROUTES. */
  readText(base = false) {
    const sql = this.state.storage.sql;
    const snap = sql.exec("SELECT v, stamped, at, rev, derived_rev FROM snap WHERE one = 1").toArray()[0];
    if (!snap) return null;
    /* S4a: with entries open the answer is the VIEW (base plus the entries, `booked` naming them), memoised on the load and the open entries; `base` asks for the base alone (the readcheck) */
    if (!base) { const v = this.viewFor(snap); if (v) return v.text; }
    const by = new Map();
    for (const r of sql.exec("SELECT coll, doc FROM rows WHERE gone_at IS NULL ORDER BY coll, seq").toArray()) {
      if (!by.has(r.coll)) by.set(r.coll, []);
      by.get(r.coll).push(r.doc);
    }
    const rows = [...by].map(([c, docs]) => JSON.stringify(c) + ":[" + docs.join(",") + "]").join(",");
    const state = sql.exec("SELECT k, doc FROM state ORDER BY k").toArray().map((r) => JSON.stringify(r.k) + ":" + r.doc).join(",");
    return '{"ok":true,"v":' + JSON.stringify(snap.v) + ',"stamped":' + JSON.stringify(snap.stamped) + ',"at":' + JSON.stringify(snap.at) + ',"rev":' + (snap.rev || 0) + ',"derivedRev":' + (snap.derived_rev || 0) + ',"rows":{' + rows + '},"state":{' + state + "}}";
  }
  /* S5d: the Book's revision and nothing else: one row, no view built (the page's /rev poll asks it) */
  revno() {
    const s = this.state.storage.sql.exec("SELECT rev, derived_rev FROM snap WHERE one = 1").toArray()[0];
    return s ? { ok: true, rev: s.rev || 0, derivedRev: s.derived_rev || 0 } : null;
  }
  /* S3: the Book's version and the moment of its latest load, and nothing else (cheap; for a caller that holds a book already or needs only the bound) */
  snapshot() {
    const snap = this.state.storage.sql.exec("SELECT v, stamped, at, rev, derived_rev FROM snap WHERE one = 1").toArray()[0];
    if (!snap) return null;
    const v = this.viewFor(snap);
    return { ok: true, v: snap.v, stamped: snap.stamped, at: snap.at, rev: snap.rev || 0, derivedRev: snap.derived_rev || 0, booked: v ? v.view.booked : [], stuck: v ? v.view.stuck.map((s) => s.id) : [] };
  }

  /* ---- S4a: the booked entries ---- */
  events() { return this.state.storage.sql.exec("SELECT seq, draft_id, item, rids, day, at, effects FROM booked WHERE folded_at IS NULL AND voided_at IS NULL ORDER BY seq").toArray(); }

  /* the base as the engine's book object (derived documents kept apart), out of the Book's own SQLite */
  baseBook() {
    const sql = this.state.storage.sql, book = {}, derived = {}, arrays = {};
    for (const r of sql.exec("SELECT k, doc FROM state").toArray()) {
      const doc = JSON.parse(r.doc);
      if (r.k === ARRAYS) Object.assign(arrays, doc);
      else if (DERIVED.includes(r.k) || r.k === "PRICING") derived[r.k] = doc;
      else book[r.k] = doc;
    }
    for (const k of Object.keys(arrays)) book[k] = [];
    for (const r of sql.exec("SELECT coll, doc FROM rows WHERE gone_at IS NULL ORDER BY coll, seq").toArray()) (book[r.coll] = book[r.coll] || []).push(JSON.parse(r.doc));
    return { book, derived };
  }

  /* THE VIEW: the base with each open entry replayed in booked order on the book as the earlier ones left it. An entry the base can no longer take (the plan refuses it,
     or the apply throws) is left OUT of the view and of `booked` and named in `stuck`, so its draft counts as on its way once and the readcheck says so; the read never fails. */
  viewOf(evs) {
    let { book, derived } = this.baseBook();
    const booked = [], stuck = [];
    for (const e of evs) {
      const next = structuredClone(book);
      let r;
      try { r = bookEntry(next, JSON.parse(e.item), lawCtx(derived, e.day), JSON.parse(e.rids)); } catch (err) { r = { ok: false, why: String((err && err.message) || err) }; }
      if (r.ok) { book = next; booked.push(e.draft_id); } else stuck.push({ id: e.draft_id, why: r.why });
    }
    if (booked.length) sortBook(book);
    return { book, derived, booked, stuck };
  }

  /* the view's `/read` text, or null with no open entry; memoised on the load's moment and the open entries' seqs */
  viewFor(snap) {
    const evs = this.events();
    if (!evs.length) { this.memo = null; return null; }
    const key = this.state.storage.sql.exec("SELECT COALESCE(MAX(seq), 0) AS m FROM loads").toArray()[0].m + "|" + evs.map((e) => e.seq).join(",") + "|" + (snap.rev || 0) + "|" + (snap.derived_rev || 0);   /* S5f-4: the revision is in the answer, so it is in the key */
    if (this.memo && this.memo.key === key) return this.memo;
    const view = this.viewOf(evs), rows = {}, state = {}, arrays = {};
    for (const [k, v] of Object.entries(view.book)) { if (Array.isArray(v)) { arrays[k] = v.length; if (v.length) rows[k] = v; } else state[k] = v; }
    state[ARRAYS] = arrays; Object.assign(state, view.derived);
    const text = JSON.stringify({ ok: true, v: snap.v, stamped: snap.stamped, at: snap.at, rev: snap.rev || 0, derivedRev: snap.derived_rev || 0, rows, state, booked: view.booked, stuck: view.stuck.map((s) => s.id) });
    this.memo = { key, text, view };
    return this.memo;
  }

  /* BOOK THE ENTRIES OF ONE TAP (a trip is one call: every item or none). One synchronous transaction, nothing awaited. The answers:
       { ok: true, booked: [{id, rids, seq, again?}] }   booked (an item already booked answers its own rids again: idempotent by draft id)
       { ok: true, foldOnly: [{id, why}] }               nothing booked: the fold's alone (a trip with one such row is all the fold's)
       { ok: false, refused: [{id, why}] }  409          the law refuses; nothing written
       { ok: false, fallback: true }                     the Book cannot book now (behind the mirror, no snapshot, an entry stuck): the caller approves as today */
  tap(body) {
    const items = body && body.items, day = body && body.day, bad = (error) => ({ ok: false, status: 400, error });
    if (!Array.isArray(items) || !items.length || items.length > TAP_MAX) return bad("send 1 to " + TAP_MAX + " items");
    if (!DAY_RE.test(String(day))) return bad("day is YYYY-MM-DD");
    for (const it of items) if (!it || typeof it !== "object" || typeof it.id !== "string" || !ISO_ID.test(it.id) || typeof it.collection !== "string" || it.status !== "approved") return bad("an item is a staged approved row");
    if (new Set(items.map((i) => i.id)).size !== items.length) return bad("an item is named twice");
    const sql = this.state.storage.sql;
    return this.state.storage.transactionSync(() => {
      const snap = sql.exec("SELECT v FROM snap WHERE one = 1").toArray()[0];
      if (!snap) return { ok: false, status: 503, fallback: true, error: "the Book holds no snapshot yet" };
      if (body.v != null) { const a = versionNo(snap.v), b = versionNo(body.v); if (a !== null && b !== null && a < b) return { ok: false, status: 409, fallback: true, behind: true, error: "the Book is at " + snap.v + ", behind " + body.v }; }
      const evs = this.events(), have = new Map(evs.map((e) => [e.draft_id, e]));
      /* a draft whose entry a load already closed is taken: booked again it would count twice (an amendment has no twin guard) */
      const closed = new Map();
      for (const i of items) { const c = sql.exec("SELECT rids, seq FROM booked WHERE draft_id = ? AND folded_at IS NOT NULL ORDER BY seq DESC LIMIT 1", i.id).toArray()[0]; if (c && !have.has(i.id)) closed.set(i.id, c); }
      const missing = items.filter((i) => !have.has(i.id) && !closed.has(i.id));
      const out = items.filter((i) => have.has(i.id) || closed.has(i.id)).map((i) => (have.has(i.id)
        ? { id: i.id, rids: JSON.parse(have.get(i.id).rids), seq: have.get(i.id).seq, again: true }
        : { id: i.id, rids: JSON.parse(closed.get(i.id).rids), seq: closed.get(i.id).seq, again: true, folded: true }));
      if (!missing.length) return { ok: true, booked: out };
      const view = this.viewOf(evs);
      if (view.stuck.length) return { ok: false, status: 409, fallback: true, stuck: view.stuck.map((s) => s.id), error: "an earlier entry is stuck" };
      let book = view.book;
      /* S5: A CODE A RENAME RETIRED IS REFUSED. A row that names it (a sale drafted before the rename and approved after) would land under a code the book no longer holds, or be re-keyed only while the
         rename is still open and not once it is folded: the result would depend on the timing. The entries on file (open or folded, never voided) and this trip's own renames say which codes are retired;
         a code put back on the roster since is not. */
      const retired = new Map();
      for (const x of sql.exec("SELECT effects FROM booked WHERE effects IS NOT NULL AND voided_at IS NULL").toArray()) for (const rn of (JSON.parse(x.effects).renames || [])) for (const [f, t] of (rn.pairs || [])) retired.set(f, t);
      const foldOnly = missing.map((it) => ({ id: it.id, why: foldOnlyWhy(it, book, body.roster === true) })).filter((x) => x.why);
      if (foldOnly.length) return { ok: true, foldOnly };
      const planned = [];
      for (const it of missing) {
        const gone = namedCodes(it).find((c) => retired.has(c) && !(book.roster || []).includes(c));
        if (gone) return { ok: false, status: 409, refused: [{ id: it.id, why: gone + " is now " + retired.get(gone) + ": a rename moved it, so this row names a code the book no longer holds" }] };
        const next = structuredClone(book);
        let r;
        try { r = bookEntry(next, it, lawCtx(view.derived, day), null); } catch (err) { return { ok: false, status: 500, fallback: true, error: "the entry could not be booked: " + String((err && err.message) || err).slice(0, 200) }; }
        if (!r.ok) return { ok: false, status: 409, refused: [{ id: it.id, why: r.why }] };
        book = next; planned.push({ it, rids: r.minted, effects: r.effects });
        if (r.effects) for (const rn of r.effects.renames) for (const [f, t] of rn.pairs || []) retired.set(f, t);
      }
      const at = this.clock();
      sql.exec("UPDATE snap SET rev = rev + 1 WHERE one = 1");
      for (const x of planned) {
        sql.exec("INSERT INTO booked (draft_id, item, rids, day, at, effects) VALUES (?, ?, ?, ?, ?, ?)", x.it.id, JSON.stringify(x.it), JSON.stringify(x.rids), day, at, x.effects ? JSON.stringify(x.effects) : null);
        if (x.it.collection === "sales") sql.exec("INSERT INTO outbox (draft_id, at) VALUES (?, ?)", x.it.id, at);   /* S6: only a sale can move an order */
      }
      const seqOf = (id) => sql.exec("SELECT seq FROM booked WHERE draft_id = ? AND folded_at IS NULL AND voided_at IS NULL", id).toArray()[0].seq;
      return { ok: true, booked: out.concat(planned.map((x) => ({ id: x.it.id, rids: x.rids, seq: seqOf(x.it.id) }))) };
    });
  }

  /* S5a: EVERY ENTRY the Book ever booked, open, folded or voided, in booked order, with the item as staged: the event log a daily export replays. */
  allEvents() { return this.state.storage.sql.exec("SELECT seq, draft_id, item, rids, day, at, folded_at, voided_at, effects FROM booked ORDER BY seq").toArray().map((e) => ({ ...e, item: JSON.parse(e.item), rids: JSON.parse(e.rids), effects: e.effects ? JSON.parse(e.effects) : null })); }

  /* S5a: THE EXPORT: the base, the whole event log, the last loads and the revision, as one answer for the nightly sealed export (src/backup.js). Binding only, never a route. */
  async exportAll() {
    const sql = this.state.storage.sql, snap = sql.exec("SELECT v, stamped, at, rev, derived_rev FROM snap WHERE one = 1").toArray()[0];
    if (!snap) return { ok: false, status: 503, error: "the Book holds no snapshot yet" };
    return { ok: true, v: snap.v, stamped: snap.stamped, at: snap.at, rev: snap.rev || 0, derivedRev: snap.derived_rev || 0, base: JSON.parse(this.readText(true)),
      entries: this.allEvents(), outbox: sql.exec("SELECT seq, draft_id, at, sent_at, tries, err FROM outbox ORDER BY seq").toArray(), loads: sql.exec("SELECT seq, at, rev, digest, added, revised, gone, returned, rows FROM loads ORDER BY seq DESC LIMIT 30").toArray() };
  }

  /* S5a: COMPACTION. (A row with no rid is keyed by its content, so a replay that edits one in place would read as one row gone and one added and refuse for good: no entry kind does that today,
     and the dry rehearsal on every fold is the alarm for the first one that does.) The Book's own view (the base with every open entry replayed) becomes the new base, by the SAME load path (prepare, load) as a git load, with every open entry marked
     folded in that transaction. STRICT: the load's own tap check must find the view unchanged, no entry stuck, and no row lost, or the whole transaction is thrown away. `dry` prepares it,
     reads the same checks off the plan and writes nothing: what the chain asks after every fold. Entries are kept (the event log), only closed. */
  compact(dry) {
    return this.state.blockConcurrencyWhile(async () => {
      const sql = this.state.storage.sql, snap = sql.exec("SELECT v, stamped FROM snap WHERE one = 1").toArray()[0];
      if (!snap) return { ok: false, status: 503, error: "the Book holds no snapshot yet" };
      const evs = this.events();
      if (!evs.length) return { ok: true, compacted: 0, open: 0, dry: !!dry };
      const view = this.viewOf(evs);
      if (view.stuck.length) return { ok: false, status: 409, error: "an entry is stuck, so the view is not whole", stuck: view.stuck.map((s) => s.id) };
      const { PRICING, ...rest } = view.derived;
      const closed = evs.map((e) => e.draft_id);
      /* S5f-2: THE WATERMARK MOVES WITH THE CLOSE. QUEUE_COMMITTED is the newest queue entry the base holds (a draft's id is its queue entry's `at`); the fold moves it to the newest id it folds, and a replay
         never does. A compaction that closed entries and left it behind would have the page count a phone's queued entry twice: the new base holds it, the entry is no longer open (so BOOKED_IDS does not
         name it) and it is not under the old mark. Never lowered, so an equal or newer mark is kept. */
      const newest = closed.reduce((a, id) => (id > a ? id : a), ""), mark = typeof view.book.QUEUE_COMMITTED === "string" ? view.book.QUEUE_COMMITTED : "";
      if (newest > mark) view.book.QUEUE_COMMITTED = newest;
      const p = await prepare(view.book, PRICING, { v: snap.v, stamped: snap.stamped, derived: rest });
      const opts = { folded: closed, pure: true, strict: true, pre: view, keepDerived: true };
      if (dry) {
        /* the same plan, run as a load that unwinds inside its own transaction: nothing is written, and the strict checks decide */
        try { this.load(p, "compact-dry", { ...opts, dry: true }); return { ok: false, status: 500, dry: true, error: "a dry compaction returned without unwinding" }; }   /* a load that returns here would be a real one */
        catch (e) {
          if (e instanceof DryRun) return { ok: true, dry: true, compactable: evs.length, closed, rows: e.r.rows, digest: e.r.digest, revised: e.r.revised, added: e.r.added };
          if (e instanceof Refused) return { ok: false, status: 409, dry: true, error: e.message };
          throw e;
        }
      }
      try {
        const r = this.load(p, "compact", opts);
        /* `closed` is the draft ids this closed: the flip marks exactly those committed in D1 in the same step, or the readers count their money twice (the base holds the row and, with the entry closed, the draft is no longer excluded from "on its way"). A retry after a failure past the commit answers compacted 0 and open 0: that is success. */
        return { ok: true, compacted: r.tap.folded, closed, at: r.at, bookRev: r.bookRev, digest: r.digest, rows: r.rows, revised: r.revised, added: r.added, readback: await this.readback(), bookmark: await this.mark() };
      } catch (e) { if (e instanceof Refused) return { ok: false, status: 409, error: e.message }; throw e; }
    });
  }

  /* take back the open entries of these drafts (a rejection): folded ones stay, a voided one is kept */
  void(ids) {
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string" || !ISO_ID.test(i))) return { ok: false, status: 400, error: "send draft ids" };
    const sql = this.state.storage.sql, at = this.clock();
    return this.state.storage.transactionSync(() => {
      let n = 0;
      for (const id of ids) n += sql.exec("SELECT COUNT(*) AS c FROM booked WHERE draft_id = ? AND folded_at IS NULL AND voided_at IS NULL", id).toArray()[0].c;
      for (const id of ids) sql.exec("UPDATE booked SET voided_at = ? WHERE draft_id = ? AND folded_at IS NULL AND voided_at IS NULL", at, id);
      if (n) sql.exec("UPDATE snap SET rev = rev + 1 WHERE one = 1");
      return { ok: true, voided: n };
    });
  }

  /* S2c, READ ONLY on any object: whether the first load is still inside the platform's 30 days (29, to keep off the edge).
     Counts, two times and a verdict; nothing is armed. A load's `at` is taken a moment before its commit, and the platform refuses
     a time before the database existed ("Requested time is before this database existed", live, 20 Oct 2026), so the first load
     is read a minute after its stamp; loads are hours apart. A refusal is answered, never thrown. */
  async window() {
    const s = this.state.storage;
    const w = s.sql.exec("SELECT MIN(at) AS first, COUNT(*) AS n FROM loads").toArray()[0];
    if (!w.n || typeof s.getBookmarkForTime !== "function") return { ok: true, loads: w.n, reachable: false };
    const first = Date.parse(w.first);
    if (!Number.isFinite(first)) return { ok: true, loads: w.n, reachable: false };
    const floor = Date.now() - 29 * DAY, since = first + 60000 >= floor ? "first" : "29 days";
    const from = Math.max(first + 60000, floor);
    try {
      const then = await s.getBookmarkForTime(from), now = await s.getCurrentBookmark();
      return { ok: true, loads: w.n, first: w.first, from: new Date(from).toISOString(), since,
        reachable: typeof then === "string" && BOOKMARK_RE.test(then) && then <= now };
    } catch (e) { return { ok: false, loads: w.n, first: w.first, error: String((e && e.message) || e).slice(0, 200) }; }
  }

  /* S2c: THE RECOVERY TEST'S VERBS, on the test object alone (see the header). `restart` aborts the object, so its own answer
     rarely arrives: the Worker's route answers for it. */
  async pitr(text) {
    if (!this.isTest()) return Response.json({ ok: false, error: "the recovery test runs on the test object alone, never the live Book" }, { status: 403 });
    let body;
    try { body = JSON.parse(text); } catch (e) { return Response.json({ ok: false, error: "not JSON" }, { status: 400 }); }
    const s = this.state.storage, verb = body && body.verb;
    if (verb === "clear") { await s.deleteAll(); this.schema(); return Response.json({ ok: true, cleared: true }); }
    if (verb === "load") {
      let p;
      try { p = await prepare(body.book, body.pricing); } catch (e) { return Response.json({ ok: false, error: String((e && e.message) || e) }, { status: 400 }); }
      return Response.json(await this.held(p, body.rev));
    }
    if (verb === "arm") {
      const bm = String(body.bookmark || "");
      if (!BOOKMARK_RE.test(bm)) return Response.json({ ok: false, error: "not a bookmark" }, { status: 400 });
      return Response.json({ ok: true, undo: await s.onNextSessionRestoreBookmark(bm) });
    }
    if (verb === "restart") { this.state.abort("the recovery test restarts the test object"); return Response.json({ ok: true, restarted: true }); }
    if (verb === "readback") {
      const loads = s.sql.exec("SELECT COUNT(*) AS c FROM loads").toArray()[0].c;
      return Response.json({ ok: true, loads, readback: await this.readback(), bookmark: await this.mark() });
    }
    return Response.json({ ok: false, error: "no such verb" }, { status: 400 });
  }

  /* The routes. Cost is in the request, never in the answer: counts, digests and bookmarks only. */
  async fetch(request) {
    const url = new URL(request.url);
    if (this.isLive()) return this.liveFetch(request, url);
    if (url.pathname === "/window" && request.method === "GET") return Response.json(await this.window());
    /* S3: the reads answer on the live Book alone; the recovery test's object is never read by a reader */
    /* S4a: the booked entries' verbs answer on the live Book alone, like the reads, and are never a route of the Worker */
    if (url.pathname === "/outbox" || url.pathname === "/outbox/done" || url.pathname === "/outbox/fail") {
      if (this.isTest()) return Response.json({ ok: false, error: "not found" }, { status: 404 });
      const sql = this.state.storage.sql;
      if (url.pathname === "/outbox" && request.method === "GET") return Response.json({ ok: true, pending: sql.exec("SELECT seq, draft_id, at, tries FROM outbox WHERE sent_at IS NULL ORDER BY seq").toArray() });
      if (request.method !== "POST") return Response.json({ ok: false, error: "not found" }, { status: 404 });
      let b = null; try { b = JSON.parse(await request.text()); } catch (e) { b = null; }
      const seqs = b && Array.isArray(b.seqs) && b.seqs.length <= 500 && b.seqs.every((n) => Number.isInteger(n)) ? b.seqs : null;
      if (!seqs) return Response.json({ ok: false, error: "send seqs, a list of integers" }, { status: 400 });
      const at = this.clock(), mark = url.pathname === "/outbox/done"
        ? (n) => sql.exec("UPDATE outbox SET sent_at = ?, err = NULL WHERE seq = ? AND sent_at IS NULL", at, n)
        : (n) => sql.exec("UPDATE outbox SET tries = tries + 1, err = ? WHERE seq = ? AND sent_at IS NULL", String(b.err || "").slice(0, 200), n);
      this.state.storage.transactionSync(() => { for (const n of seqs) mark(n); });
      return Response.json({ ok: true, marked: seqs.length });
    }
    if ((url.pathname === "/events" && request.method === "GET") || ((url.pathname === "/tap" || url.pathname === "/void" || url.pathname === "/compact") && request.method === "POST") || (url.pathname === "/export" && request.method === "GET")) {
      if (this.isTest()) return Response.json({ ok: false, error: "not found" }, { status: 404 });
      if (url.pathname === "/compact") { const r = await this.compact(url.searchParams.get("dry") === "1"); return Response.json(r, { status: r.status || (r.ok ? 200 : 409) }); }
      if (url.pathname === "/export") { const r = await this.exportAll(); return Response.json(r, { status: r.status || (r.ok ? 200 : 503) }); }
      if (url.pathname === "/events" && url.searchParams.get("all") === "1") { const s = this.state.storage.sql.exec("SELECT at, rev FROM snap WHERE one = 1").toArray()[0]; return Response.json({ ok: true, at: s ? s.at : null, rev: s ? s.rev : 0, entries: this.allEvents() }); }
      if (url.pathname === "/events") { const s = this.state.storage.sql.exec("SELECT at FROM snap WHERE one = 1").toArray()[0]; return Response.json({ ok: true, at: s ? s.at : null, ids: this.events().map((e) => e.draft_id) }); }
      let body = null;
      try { body = JSON.parse(await request.text()); } catch (e) { body = null; }
      const r = url.pathname === "/tap" ? this.tap(body) : this.void(body && body.ids);
      return Response.json(r, { status: r.status || (r.ok ? 200 : 400) });
    }
    if ((url.pathname === "/read" || url.pathname === "/at" || url.pathname === "/revno") && request.method === "GET") {
      if (this.isTest()) return Response.json({ ok: false, error: "not found" }, { status: 404 });
      const out = url.pathname === "/read" ? this.readText(url.searchParams.get("base") === "1") : url.pathname === "/revno" ? this.revno() : this.snapshot();
      if (!out) return Response.json({ ok: false, error: "the Book holds no snapshot yet" }, { status: 503 });
      return typeof out === "string" ? new Response(out, { headers: { "content-type": "application/json" } }) : Response.json(out);
    }
    const isLoad = url.pathname === "/load" && request.method === "POST", isPitr = url.pathname === "/pitr" && request.method === "POST";
    if (!isLoad && !isPitr) return Response.json({ ok: false, error: "not found" }, { status: 404 });
    const text = await request.text();
    if (text.length > MAX_LOAD_BYTES) return Response.json({ ok: false, error: "the load is too large" }, { status: 413 });
    if (isPitr) return this.pitr(text);
    let body, p;
    try { body = JSON.parse(text); p = await prepare(body && body.book, body && body.pricing, body && { v: body.v, stamped: body.stamped, derived: body.derived }); }
    catch (e) { return Response.json({ ok: false, error: String((e && e.message) || e) }, { status: 400 }); }
    /* S4a: the ids the Worker found committed among the open entries, and whether the batch was nothing but entries (the tap check's second half) */
    const folded = (url.searchParams.get("folded") || "").split(",").filter((x) => ISO_ID.test(x));
    const r = await this.held(p, body.rev, { folded, pure: url.searchParams.get("pure") === "1" });
    return Response.json(r, { status: r.ok ? 200 : 409 });
  }
}
