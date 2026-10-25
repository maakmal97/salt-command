/* src/book.js: THE BOOK, A SHADOW DURABLE OBJECT BESIDE GIT (S2a of the Book plan, 18 Oct 2026).
 *
 * WHAT IT IS. A copy of the folded book, loaded at each fold. Git (ledger/book.json) stays the source. Since S3 (25 Oct 2026) the desk's readers may READ it
 * instead of the D1 mirror: the one-row flag in D1 (migrations/0018, shipped at 'd1') says whether they do, and a Book that trails the mirror is never
 * read (src/book-read.js, docs/DESK.md "The Book: read"). The fold, the drafter's writes and the Counter still never ask it a question. Its way back is the
 * flag, one statement and no deploy; the class itself goes with a new migration tag that deletes it (wrangler.jsonc), nothing else.
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
    sql.exec("CREATE TABLE IF NOT EXISTS loads (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, rev TEXT, digest TEXT NOT NULL, added INTEGER NOT NULL, revised INTEGER NOT NULL, gone INTEGER NOT NULL, returned INTEGER NOT NULL, rows INTEGER NOT NULL)");
  }

  /* One synchronous transaction; see the header. `p` is prepare()'s result. */
  load(p, rev) {
    const sql = this.state.storage.sql, at = this.clock();
    return this.state.storage.transactionSync(() => {
      /* S3 (Fable, 25 Oct 2026): A LOAD OF AN OLDER VERSION IS REFUSED. Readers key "on its way" off the moment of the latest load, so a
         laptop run posting last version's book would advance it past a payment the Book does not hold. An equal version is the
         idempotent replay; a version that does not read as vNNNN is let through. */
      if (p.snap) {
        const was = sql.exec("SELECT v FROM snap WHERE one = 1").toArray()[0], a = was && versionNo(was.v), b = versionNo(p.snap.v);
        if (a !== null && b !== null && b < a) return { ok: false, stale: true, error: "the Book is at " + was.v + " and refuses a load of " + p.snap.v };
      }
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
      if (p.snap) sql.exec("INSERT OR REPLACE INTO snap (one, v, stamped, at) VALUES (1, ?, ?, ?)", p.snap.v, p.snap.stamped, at);
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
  held(p, rev) {
    return this.state.blockConcurrencyWhile(async () => { const r = this.load(p, rev); if (!r.ok) return r; return { ...r, readback: await this.readback(), bookmark: await this.mark() }; });
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
  readText() {
    const sql = this.state.storage.sql;
    const snap = sql.exec("SELECT v, stamped, at FROM snap WHERE one = 1").toArray()[0];
    if (!snap) return null;
    const by = new Map();
    for (const r of sql.exec("SELECT coll, doc FROM rows WHERE gone_at IS NULL ORDER BY coll, seq").toArray()) {
      if (!by.has(r.coll)) by.set(r.coll, []);
      by.get(r.coll).push(r.doc);
    }
    const rows = [...by].map(([c, docs]) => JSON.stringify(c) + ":[" + docs.join(",") + "]").join(",");
    const state = sql.exec("SELECT k, doc FROM state ORDER BY k").toArray().map((r) => JSON.stringify(r.k) + ":" + r.doc).join(",");
    return '{"ok":true,"v":' + JSON.stringify(snap.v) + ',"stamped":' + JSON.stringify(snap.stamped) + ',"at":' + JSON.stringify(snap.at) + ',"rows":{' + rows + '},"state":{' + state + "}}";
  }
  /* S3: the Book's version and the moment of its latest load, and nothing else (cheap; for a caller that holds a book already or needs only the bound) */
  snapshot() {
    const snap = this.state.storage.sql.exec("SELECT v, stamped, at FROM snap WHERE one = 1").toArray()[0];
    return snap ? { ok: true, v: snap.v, stamped: snap.stamped, at: snap.at } : null;
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
    if ((url.pathname === "/read" || url.pathname === "/at") && request.method === "GET") {
      if (this.isTest()) return Response.json({ ok: false, error: "not found" }, { status: 404 });
      const out = url.pathname === "/read" ? this.readText() : this.snapshot();
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
    const r = await this.held(p, body.rev);
    return Response.json(r, { status: r.ok ? 200 : 409 });
  }
}
