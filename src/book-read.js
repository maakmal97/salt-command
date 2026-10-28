/* src/book-read.js: THE READERS' ROAD TO THE BOOK (S3 of the Book plan, 25 Oct 2026). Pure plumbing, importing nothing of the drafter, so
   the modules that only need a bound (maker-request, vault-pair) can reach it without a cycle. */
import { BOOK_NAME, versionNo, shape, canon } from "./book.js";
import { boundOf } from "./way.js";

/* S3 (25 Oct 2026): WHERE THE READERS READ. The Worker binds the Book's namespace to the D1 binding once per request (bindBook); readBook then
   reads the one-row flag (migrations/0018) and, in 'book' mode, the Book Durable Object, unless the Book trails the mirror (a failed
   load: the whole read is the mirror's, and the "on its way" fragments take the mirror's form with it). The book it returns says which
   it is: from the Book it carries `at`, the moment of that Book's latest load, which is the bound every "on its way" clause of the
   same reader uses (src/way.js); from the mirror it carries none and every clause is as it was. The way back is the flag, no deploy. */
const BOOKS = new WeakMap();
export function bindBook(db, ns) { if (db && ns && typeof ns.get === "function" && typeof ns.idFromName === "function") BOOKS.set(db, ns); }
/* S4d: the namespace a request bound (the tap and its net reach the Book through it, as the readers do) */
export const nsOf = (db) => BOOKS.get(db) || null;
/** 'd1' or 'book': WHICH STORE IS THE SOURCE OF THE LEDGER (migrations/0023, `book_source`, shipped 'd1'; S5f, the flip). Anything but an explicit 'book' reads 'd1', so a missing table, an unreadable row or a
    store before the migration is the old world: git's book is the source and the fold writes it. Every guard of the flip keys off this one read. */
export async function sourceMode(db) {
  try { const r = await db.prepare("SELECT mode FROM book_source WHERE one=1").first(); return r && r.mode === "book" ? "book" : "d1"; } catch (e) { return "d1"; }
}
async function readFlag(db) {
  try { const r = await db.prepare("SELECT mode FROM book_read WHERE one=1").first(); return r && r.mode === "book" ? "book" : "d1"; } catch (e) { return "d1"; }
}
/* S5f-4: with the Book as the source the readers read it whatever the readers' flag says (that flag is the way back while git is the source, and a frozen mirror is not a book to read) */
export async function readMode(db) { return await sourceMode(db) === "book" ? "book" : readFlag(db); }
/* S5f-4: THE BOOK'S VERSION, FOR A STALENESS TEST. In the old world a book's version is git's (the snapshot's v), which moves with every fold. With the Book as the source an approval is not a version, so the token that moves with money is the
   Book's revision: `book@<rev>`. Every test that asked "is this the book I read?" asks this instead: the told mark and the tie-out, the pricing and open-order flags, the input admission's snapshot, the maker's row room. */
export const BOOK_TOKEN = /^book@\d+$/;
export const bookToken = (rev) => "book@" + rev;
/* a Book that is the source and cannot be read is an error, never the mirror: the mirror is frozen at the flip, so reading it would price and book against yesterday */
export class BookDown extends Error {}
/* the Book's answer for `path` ("read" or "at"), or null: not in book mode, no Book bound or answering, no snapshot, or the Book trails the mirror.
   S5f-4: with the Book as the SOURCE none of those is a reason to read the mirror: the answer is marked `source: "book"` and carries its revision, and a Book that will not answer THROWS (BookDown), since the mirror is frozen. */
export async function fromBook(db, path) {
  const ns = BOOKS.get(db);
  if (!ns) return null;   /* no Book bound: nothing to read (a Worker deploys with the binding, and this asks D1 nothing, as it never did) */
  const src = await sourceMode(db) === "book";
  if (src) {
    let res = null;
    try {
      const r = await ns.get(ns.idFromName(BOOK_NAME)).fetch(new Request("https://book/" + path));
      res = r.ok ? await r.json() : null;
    } catch (e) { res = null; }
    if (!res || !res.ok || typeof res.at !== "string" || !Number.isInteger(res.rev) || !Number.isInteger(res.derivedRev)) throw new BookDown("the Book is the source of the ledger and did not answer");
    return { ...res, source: "book" };
  }
  if (await readFlag(db) !== "book") return null;
  try {
    const head = await db.prepare("SELECT v FROM snapshot WHERE one=1").first();
    if (!head || head.v == null) return null;
    const r = await ns.get(ns.idFromName(BOOK_NAME)).fetch(new Request("https://book/" + path));
    if (!r.ok) return null;
    const res = await r.json();
    if (!res || !res.ok || typeof res.at !== "string") return null;
    const a = versionNo(res.v), b = versionNo(head.v);
    if (a !== null && b !== null ? a < b : res.v !== head.v) return null;
    return res;
  } catch (e) { return null; }
}
/** The snapshot row AND the source flag in ONE read (`src`): a caller that already reads the snapshot (tellSite, tieOut) must not add a round trip, or its timing against a concurrent writer moves. A store with no
    book_source table answers the plain read, which is the old world. */
export async function snapshotWithSource(db, cols) {
  try { return await db.prepare("SELECT " + cols + ", (SELECT mode FROM book_source WHERE one=1) AS src FROM snapshot WHERE one=1").first(); }
  catch (e) { return db.prepare("SELECT " + cols + " FROM snapshot WHERE one=1").first(); }
}
/** the token from a row snapshotWithSource read: its v in the old world, the Book's revision when `src` says book (a throw when the Book will not say) */
export async function tokenFrom(db, snap) {
  if (snap && snap.src === "book") return versionToken(db);
  return snap && snap.v != null ? snap.v : null;
}
/** the token a staleness test compares: the snapshot's v in the old world, `book@<rev>` with the Book as the source (the Book's own cheap revision verb, no view built); null when the old world has no snapshot yet, and a throw when the Book is the source and will not say */
export async function versionToken(db) {
  if (await sourceMode(db) !== "book") {
    const h = await db.prepare("SELECT v FROM snapshot WHERE one=1").first();
    return h && h.v != null ? h.v : null;
  }
  const ns = BOOKS.get(db);
  if (!ns) throw new BookDown("the Book is the source of the ledger and is not bound, so it cannot say its revision");
  let j = null;
  try { const r = await ns.get(ns.idFromName(BOOK_NAME)).fetch(new Request("https://book/revno")); j = r.ok ? await r.json() : null; } catch (e) { j = null; }
  if (!j || !Number.isInteger(j.rev)) throw new BookDown("the Book is the source of the ledger and did not say its revision");
  return bookToken(j.rev);
}
/* the bound for a reader that holds no book of its own: the Book's latest load, or null for the mirror's own form */
export async function wayBound(db) {
  const r = await fromBook(db, "at");
  return r ? boundOf(r) : null;
}

/* the Book's answer as the book readBook returns: the mirror's shape plus `at`, and the refunds riding along so withRefunds needs no second
   read (a copy of the book keeps them) */
export function bookOf(res) {
  const b = shape(res), state = b.state;
  if (!Array.isArray(state.loans)) state.loans = b.rows.loans;
  /* S5f-4: from the Book as the source the version is the Book's revision, and the pricing and open-order documents carry the revision they were computed at, so the readers' own comparison (document.v against the book's version)
     says "stale" exactly when they trail the book, and says nothing while they do not */
  let version = b.version;
  if (res.source === "book") {
    version = bookToken(res.rev);
    for (const k of ["PRICING", "OPEN"]) if (state[k] && typeof state[k] === "object" && !Array.isArray(state[k])) state[k] = { ...state[k], v: bookToken(res.derivedRev) };
  }
  return { sales: b.rows.sales, purchases: b.rows.purchases, state, version, pricing: state.PRICING || null, at: b.at, customerRefunds: b.rows.customerRefunds, booked: Array.isArray(res.booked) ? res.booked : [] };
}

/* the Book's answer whatever the flag and the mirror say, or null: the readcheck's side of the comparison */
export async function bookDirect(db) {
  const ns = BOOKS.get(db);
  if (!ns) return null;
  try {
    /* S4a: the BASE, whatever entries are open: the readcheck compares git's book as the mirror holds it, and the entries are not in the mirror */
    const r = await ns.get(ns.idFromName(BOOK_NAME)).fetch(new Request("https://book/read?base=1"));
    const res = r.ok ? await r.json() : null;
    return res && res.ok ? res : null;
  } catch (e) { return null; }
}

/* THE READCHECK (S3): the mirror's book (with its refunds) against the Book's answer, by NAMES only (the Actions log is public).
   STOCK is left out because the mirror's seed leaves it out of its own hash and may hold an older one; PRICING.takenAt and OPEN.at are minted
   per extract and the Book drops the first and may keep a later copy of the second. A list is compared in order, and named "(order)" where
   it holds the same rows in another. */
export function compareReads(mirror, res) {
  const differ = [];
  if (!mirror || !res) return { ok: false, differ: [!mirror ? "the mirror did not answer" : "the Book did not answer"] };
  const b = bookOf(res);
  const same = (x, y) => canon(x) === canon(y);
  const strip = (k, v) => (k === "PRICING" && v && typeof v === "object" ? (({ takenAt, ...r }) => r)(v) : k === "OPEN" && v && typeof v === "object" ? (({ at, ...r }) => r)(v) : v);
  const list = (name, x, y) => {
    if (same(x, y)) return;
    const key = (a) => (a || []).map((r) => canon(r)).sort().join("|");
    differ.push(name + (key(x) === key(y) ? " (order)" : ""));
  };
  list("sales", mirror.sales, b.sales);
  list("purchases", mirror.purchases, b.purchases);
  list("customerRefunds", mirror.customerRefunds || [], b.customerRefunds);
  if (mirror.version !== b.version) differ.push("version");
  for (const k of [...new Set([...Object.keys(mirror.state || {}), ...Object.keys(b.state)])].sort()) {
    if (k === "STOCK") continue;
    const x = (mirror.state || {})[k], y = b.state[k];
    if (x === undefined || y === undefined) { differ.push("state." + k + (x === undefined ? " (only in the Book)" : " (not in the Book)")); continue; }
    if (Array.isArray(x) && Array.isArray(y)) { list("state." + k, x, y); continue; }
    if (!same(strip(k, x), strip(k, y))) differ.push("state." + k);
  }
  return { ok: !differ.length, differ, rows: b.sales.length + b.purchases.length };
}
