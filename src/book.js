/* src/book.js: THE BOOK, A SHADOW DURABLE OBJECT BESIDE GIT (S2a of the Book plan, 18 Oct 2026).
 *
 * WHAT IT IS. A copy of the folded book, loaded at each fold and read by NOTHING. Git (ledger/book.json) stays the source;
 * the desk, the Counter, the drafter and the fold never ask this object a question. S2b will compare it with git and go red
 * on any difference; S3 is the first step that lets a reader move onto it. Its way back is a new migration tag that deletes
 * the class (wrangler.jsonc), nothing else.
 *
 * NO RULE LIVES HERE. The load books the folded rows verbatim; the fold (tools/fold.mjs over engine/apply.mjs) already
 * applied every rule to them, so a second copy of a rule would be the thing that drifts (CLAUDE.md rule 1). A later step
 * that books a row itself calls the engine's applyEntry; this file does not.
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
 * A PLAIN CLASS WITH fetch(), like stmt/orderbook.js: nothing here imports from stmt/ and the suite drives it over node:sqlite.
 */
export const BOOK_NAME = "book";
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
export async function prepare(book, pricing) {
  if (!book || typeof book !== "object" || Array.isArray(book)) throw new Error("a book object is required");
  if (!Array.isArray(book.sales) || !book.sales.length || !Array.isArray(book.purchases) || !book.purchases.length)
    throw new Error("a book with sales and purchases is required; a load of less is refused rather than mark every row gone");
  const rows = [], state = [];
  for (const coll of Object.keys(book).sort()) {
    const v = book[coll];
    if (!Array.isArray(v)) { const doc = canon(v); state.push({ k: coll, doc, h: await sha(doc) }); continue; }
    const seen = new Set();
    for (const r of v) {
      const doc = canon(r), h = await sha(doc);
      const base = r && typeof r === "object" && typeof r.rid === "string" && r.rid ? "r:" + r.rid : "h:" + h;
      let key = base;
      for (let n = 2; seen.has(key); n++) key = base + "#" + n;
      seen.add(key);
      rows.push({ coll, key, doc, h });
    }
  }
  /* PRICING.takenAt is minted per extract (tools/book.mjs), so it moves on every chain run with nothing else changed; it is
     left out, here and in S2b's compare, or every replayed fold would read as a revision */
  if (pricing !== undefined && pricing !== null) { const { takenAt, ...steady } = pricing; const doc = canon(steady); state.push({ k: "PRICING", doc, h: await sha(doc) }); }
  state.sort((a, b) => (a.k < b.k ? -1 : 1));
  rows.sort((a, b) => (a.coll + "\u0000" + a.key < b.coll + "\u0000" + b.key ? -1 : 1));
  const digest = await sha(rows.map((r) => r.coll + "|" + r.key + "|" + r.h).join("\n") + "\n--\n" + state.map((s) => s.k + "|" + s.h).join("\n"));
  return { rows, state, digest };
}

export class Book {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clock = () => new Date().toISOString();
    const sql = state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS rows (coll TEXT NOT NULL, key TEXT NOT NULL, doc TEXT NOT NULL, h TEXT NOT NULL, booked_at TEXT NOT NULL, revised_at TEXT, gone_at TEXT, PRIMARY KEY (coll, key))");
    sql.exec("CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, doc TEXT NOT NULL, h TEXT NOT NULL, booked_at TEXT NOT NULL, revised_at TEXT)");
    sql.exec("CREATE TABLE IF NOT EXISTS loads (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, rev TEXT, digest TEXT NOT NULL, added INTEGER NOT NULL, revised INTEGER NOT NULL, gone INTEGER NOT NULL, returned INTEGER NOT NULL, rows INTEGER NOT NULL)");
  }

  /* One synchronous transaction; see the header. `p` is prepare()'s result. */
  load(p, rev) {
    const sql = this.state.storage.sql, at = this.clock();
    return this.state.storage.transactionSync(() => {
      const n = { added: 0, revised: 0, gone: 0, returned: 0 };
      const held = new Map();
      for (const r of sql.exec("SELECT coll, key, h, gone_at FROM rows").toArray()) held.set(r.coll + "\u0000" + r.key, r);
      for (const r of p.rows) {
        const was = held.get(r.coll + "\u0000" + r.key);
        held.delete(r.coll + "\u0000" + r.key);
        if (!was) { sql.exec("INSERT INTO rows (coll, key, doc, h, booked_at) VALUES (?, ?, ?, ?, ?)", r.coll, r.key, r.doc, r.h, at); n.added++; continue; }
        if (was.h !== r.h) { sql.exec("UPDATE rows SET doc = ?, h = ?, revised_at = ?, gone_at = NULL WHERE coll = ? AND key = ?", r.doc, r.h, at, r.coll, r.key); n.revised++; }
        else if (was.gone_at) { sql.exec("UPDATE rows SET gone_at = NULL WHERE coll = ? AND key = ?", r.coll, r.key); n.returned++; }
      }
      for (const r of held.values()) if (!r.gone_at) { sql.exec("UPDATE rows SET gone_at = ? WHERE coll = ? AND key = ?", at, r.coll, r.key); n.gone++; }
      const keep = new Set(p.state.map((s) => s.k));
      for (const s of p.state) {
        const was = sql.exec("SELECT h FROM state WHERE k = ?", s.k).toArray()[0];
        if (!was) { sql.exec("INSERT INTO state (k, doc, h, booked_at) VALUES (?, ?, ?, ?)", s.k, s.doc, s.h, at); n.added++; }
        else if (was.h !== s.h) { sql.exec("UPDATE state SET doc = ?, h = ?, revised_at = ? WHERE k = ?", s.doc, s.h, at, s.k); n.revised++; }
      }
      /* a key the book no longer carries leaves with it (PRICING alone is the load's own, and stays when a load omits it) */
      for (const r of sql.exec("SELECT k FROM state").toArray()) if (!keep.has(r.k) && r.k !== "PRICING") { sql.exec("DELETE FROM state WHERE k = ?", r.k); n.gone++; }
      const live = sql.exec("SELECT COUNT(*) AS c FROM rows WHERE gone_at IS NULL").toArray()[0].c;
      const docs = sql.exec("SELECT COUNT(*) AS c FROM state").toArray()[0].c;
      sql.exec("INSERT INTO loads (at, rev, digest, added, revised, gone, returned, rows) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", at, rev == null ? null : String(rev), p.digest, n.added, n.revised, n.gone, n.returned, live);
      return { ok: true, at, rev: rev == null ? null : String(rev), digest: p.digest, rows: live, docs, ...n };
    });
  }

  /* THE READ-BACK (S2b): what this object holds, out of its own SQLite. Live rows only (a gone row is kept, not counted). Each
     digest is the first 16 hex of a sha256: a collection's over its rows' own sha256 in sorted order, a document's over its doc. */
  async readback() {
    const sql = this.state.storage.sql, rows = {}, state = {};
    const by = new Map();
    for (const r of sql.exec("SELECT coll, doc FROM rows WHERE gone_at IS NULL").toArray()) {
      if (!by.has(r.coll)) by.set(r.coll, []);
      by.get(r.coll).push(await sha(r.doc));
    }
    for (const [coll, hs] of by) rows[coll] = { n: hs.length, digest: (await sha(hs.sort().join("\n"))).slice(0, 16) };
    for (const r of sql.exec("SELECT k, doc FROM state").toArray()) state[r.k] = (await sha(r.doc)).slice(0, 16);
    return { rows, state };
  }

  /* The route's one verb. Cost is in the request, never in the answer: counts and a digest only. */
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/load" || request.method !== "POST") return Response.json({ ok: false, error: "not found" }, { status: 404 });
    const text = await request.text();
    if (text.length > MAX_LOAD_BYTES) return Response.json({ ok: false, error: "the load is too large" }, { status: 413 });
    let body, p;
    try { body = JSON.parse(text); p = await prepare(body && body.book, body && body.pricing); }
    catch (e) { return Response.json({ ok: false, error: String((e && e.message) || e) }, { status: 400 }); }
    /* the load and its read-back as one piece: no other request may land between them while the hashes are awaited */
    return Response.json(await this.state.blockConcurrencyWhile(async () => { const r = this.load(p, body.rev); return { ...r, readback: await this.readback() }; }));
  }
}
