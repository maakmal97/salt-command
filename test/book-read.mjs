/* test/book-read.mjs: S3 OF THE BOOK PLAN, READ FROM THE BOOK (25 Oct 2026; Fable's review of the same day applied).
 * What is proved here, each check red under its own mutation (test/book-read.mutations.json):
 *   1  the Book's read equals the mirror's, row for row, in the book's order, state key for state key (the frozen book, invented derived
 *      documents), and a list that is not a collection and an empty one come back as the mirror has them
 *   2  the flag: 'd1' (the shipped value), a store with no flag table, no Book bound, a Book with no snapshot, and a Book that trails the
 *      mirror each read the mirror, and a Book read carries `at` while a mirror read carries none
 *   3  a load of an OLDER version is refused (409) and moves nothing; an equal one is the idempotent replay; the order digest sees a list reordered
 *   4  "on its way": a draft committed after the Book's `at` is still on its way, one committed before it is not, and in the mirror's form
 *      the clause is the one it always was; the tap reads the book FIRST and takes the bound from that very read
 *   5  /read and /at answer on the live Book alone (not the recovery test's object, not the live-socket object), carry no route of their own
 *      in the Worker, and the readcheck is in the CI routes with the Book's key
 *   6  the readcheck names a Book that differs (a row, the order, a derived document) and passes one that agrees
 */
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { FROZEN_BOOK } from "./frozen.mjs";
import { objectState } from "./orderbook-harness.mjs";
import { Book, canon, COLLECTIONS, DERIVED, versionNo } from "../src/book.js";
import { buildSeed } from "../tools/d1.mjs";
import { COLLECTIONS as TOOL_COLLECTIONS } from "../tools/book.mjs";
import { DERIVED as TOOL_DERIVED } from "../tools/book-load.mjs";
import { readBook, readMirror, withRefunds, bindBook, wayBound } from "../src/drafter.js";
import { compareReads, bookDirect } from "../src/book-read.js";
import { rowRoom, orderInFlight, termsInFlight } from "../src/orders.js";
import POSITION_ENGINE from "../engine/position.mjs";
import { unfolded, onItsWay, landedBy } from "../src/way.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "25 Oct 2026, 21:38 KL";

export async function run({ ok }) {
  const frozen = JSON.parse(readFileSync(FROZEN_BOOK, "utf8"));
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const derived = {
    OPEN: { v: V, at: "2026-10-25T13:38:15.371Z", count: 1, byKey: { "X|2026-10-25|10": { k: 1 } }, position: { salt: { units: 3 } }, countedOn: "2026-10-25" },
    TERMS: { creditDays: 7 }, REWARD: { stated: { salt: { times: 10 } } }, STOCK: { today: "2026-10-25", books: { salt: { shelf: 6.5 } } }
  };
  /* the ledger the mirror is seeded from: the book less NOTES (the mirror never held it), plus the derived documents */
  const { NOTES, ...bookless } = frozen;
  const ledger = { ...bookless, PRICING: pricing, ...derived };

  /* ---- the two stores -------------------------------------------------------------------------------------------------- */
  const d1 = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const mk = (a, sql) => { const st = db.prepare(sql); return { run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; }, first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mk([], sql); o.bind = (...a) => mk(a, sql); return o; } };
    return { db, D1 };
  };
  const seedMirror = (db, v = V, led = ledger) => db.exec(buildSeed({ v, stamped: AT_STAMP, ledger: led }).sql);
  const theBook = (v = V) => {
    const os = objectState(); const b = new Book(os, {}); let t = 0;
    b.clock = () => "2026-10-25T14:00:" + String(10 + t++).padStart(2, "0") + ".000Z";
    return { os, b, load: async (body = {}) => b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: frozen, pricing, derived, v, stamped: AT_STAMP, ...body }) })) };
  };
  const ns = (book) => ({ idFromName: (n) => n, get: () => ({ fetch: (r) => book.fetch(r) }) });
  const setMode = (db, mode) => db.exec("UPDATE book_read SET mode='" + mode + "'");
  const shown = async (D1, book) => { const r = await withRefunds(D1, book); const { at, booked, ...rest } = r; return canon(rest); };

  /* 1: the Book's read equals the mirror's */
  const A = d1(); seedMirror(A.db); setMode(A.db, "book");
  const B = theBook(); const loaded = await (await B.load()).json();
  bindBook(A.D1, ns(B.b));
  const viaBook = await readBook(A.D1), viaMirror = await readMirror(A.D1);
  ok(loaded.ok && !!viaBook.at && viaMirror.at === undefined,
    "a Book read carries the moment of the Book's latest load and a mirror read carries none");
  ok(await shown(A.D1, viaBook) === await shown(A.D1, viaMirror),
    "the Book's read equals the mirror's: sales and purchases in the book's order, every state key, the loans, the refunds, the version");
  ok(viaBook.state.PROD_ORDER.join() === frozen.PROD_ORDER.join() && viaBook.state.PROD_ORDER[0] === "salt" && viaBook.state.COUNTS.length === frozen.COUNTS.length
    && canon(viaBook.state.COUNTS) === canon(frozen.COUNTS) && !("NOTES" in viaBook.state) && viaBook.state.__collections.join() === viaMirror.state.__collections.join(),
    "a list that is not a collection comes back whole and in order, salt first; NOTES, which the mirror never held, does not");
  const reordered = structuredClone(frozen); reordered.sales.reverse();
  const R = theBook(); await R.load(); await R.load({ book: reordered });
  const rRead = await (await R.b.fetch(new Request("https://book/read"))).json();
  ok(rRead.rows.sales[0].rid === frozen.sales[frozen.sales.length - 1].rid, "a list the book reorders is read back in the new order, not the order it was first booked in");
  const emptied = structuredClone(frozen); emptied.partners = [];
  const E = theBook(); await E.load({ book: emptied });
  const eRead = (await import("../src/book.js")).shape(await (await E.b.fetch(new Request("https://book/read"))).json());
  ok(Array.isArray(eRead.state.partners) && eRead.state.partners.length === 0 && eRead.state.__collections.includes("lostDemand"),
    "an empty list is still a list: it comes back empty, not missing, and an empty collection is still named");
  ok(COLLECTIONS.join() === TOOL_COLLECTIONS.join() && DERIVED.join() === TOOL_DERIVED.join(),
    "src/book.js and the tools name the same collections and the same derived documents");

  /* 2: the flag and its fallbacks */
  const flagged = async (setup) => { const w = d1(); seedMirror(w.db); const bk = theBook(); await bk.load(); setup(w, bk); return readBook(w.D1); };
  const rd1 = await flagged((w, bk) => { bindBook(w.D1, ns(bk.b)); });   /* the shipped flag, 'd1' */
  ok(rd1.at === undefined && rd1.version === V, "with the flag at 'd1' (as shipped) the readers read the mirror");
  const rnoTable = await flagged((w, bk) => { w.db.exec("DROP TABLE book_read"); bindBook(w.D1, ns(bk.b)); });
  ok(rnoTable.at === undefined, "a store before migration 0018 reads the mirror");
  const rnoBook = await flagged((w) => { setMode(w.db, "book"); });
  ok(rnoBook.at === undefined, "in 'book' mode with no Book bound, the mirror is read");
  const rempty = await (async () => { const w = d1(); seedMirror(w.db); setMode(w.db, "book"); bindBook(w.D1, ns(theBook().b)); return readBook(w.D1); })();
  ok(rempty.at === undefined && rempty.version === V, "a Book that holds no snapshot yet answers 503 and the mirror is read");
  const rnosnap = await (async () => { const w = d1(); seedMirror(w.db); w.db.exec("DELETE FROM snapshot"); setMode(w.db, "book"); const bk = theBook(); await bk.load(); bindBook(w.D1, ns(bk.b)); return readBook(w.D1); })();
  ok(rnosnap.at === undefined && rnosnap.version == null, "a mirror being seeded (no snapshot) is read as the mirror, so the drafter still stands down on it");
  const rtrail = await (async () => { const w = d1(); seedMirror(w.db, "v1253", { ...ledger, PRICING: { ...pricing, v: "v1253" } }); setMode(w.db, "book"); const bk = theBook("v1252"); await bk.load(); bindBook(w.D1, ns(bk.b)); return readBook(w.D1); })();
  ok(rtrail.at === undefined && rtrail.version === "v1253", "a Book that trails the mirror (a load that failed) is not read: the whole read is the mirror's");
  const rahead = await (async () => { const w = d1(); seedMirror(w.db, "v1251", { ...ledger, PRICING: { ...pricing, v: "v1251" } }); setMode(w.db, "book"); const bk = theBook("v1252"); await bk.load(); bindBook(w.D1, ns(bk.b)); return readBook(w.D1); })();
  ok(!!rahead.at && rahead.version === "v1252", "a Book at the mirror's version, or ahead of it, is read");

  /* 3: an older load is refused; an equal one replays; the order digest */
  const S = theBook(); await S.load();
  const snapBefore = JSON.stringify(S.os.db.prepare("SELECT * FROM snap").all()), rowsBefore = JSON.stringify(S.os.db.prepare("SELECT coll,key,seq,booked_at,gone_at FROM rows ORDER BY coll,key").all());
  const old = await S.load({ v: "v1251" });
  ok(old.status === 409 && (await old.json()).stale === true
    && JSON.stringify(S.os.db.prepare("SELECT * FROM snap").all()) === snapBefore && JSON.stringify(S.os.db.prepare("SELECT coll,key,seq,booked_at,gone_at FROM rows ORDER BY coll,key").all()) === rowsBefore,
    "a load of an older version is refused with 409 and moves nothing: not the stamp, not a row");
  const same = await S.load();
  ok(same.status === 200 && (await same.json()).added === 0, "a load of the same version is the idempotent replay");
  ok(versionNo("v1252") === 1252 && versionNo("1252") === null && versionNo(null) === null, "a version reads as a number only in the vNNNN form");
  const O = theBook(); const first = await (await O.load()).json(); const second = await (await O.load({ book: reordered })).json();
  ok(first.readback.rows.sales.digest === second.readback.rows.sales.digest && first.readback.rows.sales.order !== second.readback.rows.sales.order && second.revised === 0,
    "a reordered list keeps its rows' digest and changes its order digest, and the reorder is not counted as revised rows");

  /* 4: on its way */
  const AT = "2026-10-25T14:00:10.000Z";
  ok(unfolded(null) === "committed_at IS NULL" && unfolded(AT) === "(committed_at IS NULL OR committed_at > '" + AT + "')" && unfolded("x'; DROP TABLE draft; --") === "committed_at IS NULL"
    && unfolded(AT, "d.") === "(d.committed_at IS NULL OR d.committed_at > '" + AT + "')",
    "the clause for a Book bound is the bound, for no bound is exactly what it was, and a bound that is not a time is never spliced into SQL");
  ok(onItsWay(null) === "(status='pending' OR (status='approved' AND (committed_at IS NULL OR committed_at > (SELECT at FROM snapshot WHERE one=1))))"
    && landedBy(null) === "committed_at IS NOT NULL AND committed_at <= (SELECT at FROM snapshot WHERE one=1)",
    "the mirror's form of on its way and of landed is byte for byte the old one");
  const owes = (s) => POSITION_ENGINE.txOwed(s) - POSITION_ENGINE.txPaid(s), keys = new Map();
  for (const s of frozen.sales) keys.set(POSITION_ENGINE.ovKey(s), (keys.get(POSITION_ENGINE.ovKey(s)) || 0) + 1);
  const LW = d1(); const lat = (c) => { LW.db.exec("DELETE FROM draft"); LW.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES ('a','approved','sales','{}','{}','x','y','2026-10-25T01:00:00.000Z',?)").run(c); return LW.db.prepare("SELECT (" + landedBy(AT) + ") AS l FROM draft").get().l; };
  ok(lat("2026-10-25T13:59:00.000Z") === 1 && lat("2026-10-25T14:00:30.000Z") === 0 && lat(null) === 0, "landed is a draft marked committed at or before the Book's bound, and not one marked after it or not marked");
  const WB = d1(); seedMirror(WB.db); const WBK = theBook(); await WBK.load(); bindBook(WB.D1, ns(WBK.b));
  const boundD1 = await wayBound(WB.D1); setMode(WB.db, "book"); const boundBook = await wayBound(WB.D1);
  ok(boundD1 === null && boundBook === "2026-10-25T14:00:10.000Z", "a reader with no book in hand asks the Book for its bound in 'book' mode and has none in 'd1' mode");
  const sale = frozen.sales.find((s) => !s.cancelled && s.rid && owes(s) > 60 && keys.get(POSITION_ENGINE.ovKey(s)) === 1);
  const room = async (mode, committedAt, snapAt) => {
    const w = d1(); seedMirror(w.db); w.db.exec("UPDATE snapshot SET at='" + snapAt + "'");
    const bk = theBook(); await bk.load(); bindBook(w.D1, ns(bk.b)); setMode(w.db, mode);
    const entry = { at: "2026-10-25T01:00:00.000Z", payload: { mode: "amend", direction: "SELL", kind: "Fulfilment", cash: 50, rid: sale.rid } };
    w.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(entry.at, "approved", "sales", JSON.stringify(entry), "{}", "x", "y", entry.at, committedAt);
    const r = await rowRoom(w.D1, "SELL");
    return r(POSITION_ENGINE.ovKey(sale), { at: "own", payload: { rid: sale.rid } });
  };
  const onWayBook = await room("book", "2026-10-25T14:00:30.000Z", "2026-10-25T13:00:00.000Z");   /* marked after the Book's load */
  const landedBook = await room("book", "2026-10-25T13:59:00.000Z", "2026-10-25T13:00:00.000Z");   /* marked before it: the Book holds the row */
  const unmarked = await room("book", null, "2026-10-25T13:00:00.000Z");
  ok(onWayBook && landedBook && unmarked && onWayBook.on === 50 && landedBook.on === 0 && unmarked.on === 50,
    "in 'book' mode a payment marked after the Book's latest load is on its way, one marked before it is in the Book, one not marked is on its way");
  const mirrorLate = await room("d1", "2026-10-25T13:30:00.000Z", "2026-10-25T13:00:00.000Z"), mirrorEarly = await room("d1", "2026-10-25T12:30:00.000Z", "2026-10-25T13:00:00.000Z");
  ok(mirrorLate.on === 50 && mirrorEarly.on === 0, "in 'd1' mode the bound is still the mirror's snapshot, as it was");
  const src = readFileSync(join(REPO, "src", "orders.js"), "utf8");
  const rr = src.slice(src.indexOf("export async function rowRoom("), src.indexOf("export async function rowRoom(") + 900);
  ok(/const book = await \(mirror \? mirror\(\) : readBook\(db\)\)\.catch\(\(\) => null\);\s*const way = onWay \|\| await paysOnWay\(db, direction, boundOf\(book\)\)/.test(rr) && !/Promise\.all/.test(rr),
    "the tap reads the book first and the payments on their way by that book's own bound, never the two at once");

  /* 4b: the load tool and git's side of the parity */
  const BL = await import("../tools/book-load.mjs");
  const tmp = mkdtempSync(join(tmpdir(), "salt-bl-"));
  writeFileSync(join(tmp, "book.json"), JSON.stringify(frozen)); writeFileSync(join(tmp, "ledger.json"), JSON.stringify({ v: V, stamped: AT_STAMP, ledger: { PRICING: pricing, ...derived } }));
  const sent = JSON.parse(BL.payload(join(tmp, "book.json"), join(tmp, "ledger.json"), "abc"));
  ok(sent.v === V && sent.stamped === AT_STAMP && canon(sent.derived) === canon(derived) && sent.pricing.v === V,
    "the load tool sends the version, its stamp and the derived documents beside the book");
  const want = BL.expected(frozen, pricing, derived);
  ok(want.state.OPEN && want.state.TERMS && want.state.REWARD && want.state.STOCK && want.state.__arrays && /^[0-9a-f]{16}$/.test(want.rows.sales.order) && want.rows.sales.order !== want.rows.sales.digest,
    "git's side of the parity holds the derived documents, the list lengths and an order digest per list");
  const loadedRb = (await (await theBook().load()).json()).readback;
  ok(BL.compare(want, loadedRb).ok && !BL.compare(want, { ...loadedRb, rows: { ...loadedRb.rows, sales: { ...loadedRb.rows.sales, order: "0".repeat(16) } } }).ok
    && BL.compare(want, { ...loadedRb, rows: { ...loadedRb.rows, sales: { ...loadedRb.rows.sales, order: "0".repeat(16) } } }).differ.join().includes("other order"),
    "the parity names a list that holds the same rows in another order");

  /* 4c: the site-follow flight checks take the bound of the book their caller holds (Fable, M1) */
  const flight = async (fn, at, committedAt, snapAt) => {
    const w = d1(); seedMirror(w.db); w.db.exec("UPDATE snapshot SET at='" + snapAt + "'");
    const entry = { at: "2026-10-25T02:00:00.000Z", orderId: "o1", status: "Amendment", payload: { mode: "amend" } };
    w.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(entry.at, "approved", "sales", JSON.stringify(entry), "{}", "x", "y", entry.at, committedAt);
    return fn({ SALT_LEDGER: w.D1 }, { id: "o1" }, at);
  };
  const T1 = "2026-10-25T14:00:00.000Z", before = "2026-10-25T13:59:00.000Z", after = "2026-10-25T14:00:30.000Z";
  const later = "2026-10-25T14:01:00.000Z", early = "2026-10-25T13:00:00.000Z";
  ok(await flight(orderInFlight, T1, after, later) === true && await flight(orderInFlight, T1, before, early) === false
    && await flight(termsInFlight, T1, after, later) === true && await flight(termsInFlight, T1, before, early) === false
    && await flight(orderInFlight, null, after, before) === true && await flight(orderInFlight, null, before, after) === false,
    "an order's flight checks use the bound they are handed, against the mirror's snapshot when they disagree; with none handed the snapshot decides, as before");
  ok((readFileSync(join(REPO, "src", "worker.js"), "utf8").match(/makerHeldMoves\(env, boundOf\(book\)\)/g) || []).length === 5, /* the fifth since 27 Oct 2026: a row's payment past what it owes */ "the maker's held moves are asked by the bound of the book each caller already holds");

  /* 5: the reads are not routes */
  const T = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); T.state.id = { equals: (o) => o === "book-pitr-test" };
  const L = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); L.state.id = { equals: (o) => o === "live" };
  const get = (b, p) => b.fetch(new Request("https://book/" + p));
  ok((await get(T, "read")).status === 404 && (await get(T, "at")).status === 404 && (await get(L, "read")).status === 404 && (await get(L, "at")).status === 404,
    "the recovery test's object and the live-socket object answer neither /read nor /at");
  ok((await get(new Book(objectState(), {}), "read")).status === 503, "a Book that has not loaded answers 503, not an empty book");
  const w = await import("../src/worker.js");
  const wsrc = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  const probe = async (path) => { try { return (await w.default.fetch(new Request("https://salt.test" + path, { headers: { "X-Book-Key": "bk" } }), { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: ns(B.b), SALT_LEDGER: A.D1 })).status; } catch (e) { return 500; } };
  ok((await probe("/book/read")) !== 200 && (await probe("/book/at")) !== 200 && (await probe("/book/readcheck")) === 200,
    "the Worker answers neither /book/read nor /book/at, whatever key is sent");
  ok(!/"\/book\/read"|"\/book\/at"/.test(wsrc) && /CI_ROUTES = new Set\([^)]*"GET \/book\/readcheck"/.test(wsrc) && !!w.default,
    "the Worker has no route for /read or /at, and the readcheck is a CI route (behind the Book's key)");

  /* 6: the readcheck */
  const C = d1(); seedMirror(C.db); const CB = theBook(); await CB.load(); bindBook(C.D1, ns(CB.b));
  const mirrorBook = await withRefunds(C.D1, await readMirror(C.D1)), bookRes = await bookDirect(C.D1);
  const good = compareReads(mirrorBook, bookRes);
  ok(good.ok && good.differ.length === 0, "the readcheck passes a Book that agrees with the mirror");
  const tamper = async (fn) => { const t = theBook(); await t.load(); fn(t.os.db); const r = await bookDirect((() => { bindBook(C.D1, ns(t.b)); return C.D1; })()); return compareReads(mirrorBook, r); };
  const rowT = await tamper((db) => db.prepare("UPDATE rows SET doc=? WHERE coll='sales' AND key=?").run(canon({ ...frozen.sales[0], total: 1 }), "r:" + frozen.sales[0].rid));
  const ordT = await tamper((db) => db.prepare("UPDATE rows SET seq = 100000 WHERE coll='sales' AND key=?").run("r:" + frozen.sales[0].rid));
  const docT = await tamper((db) => db.prepare("UPDATE state SET doc=? WHERE k='TERMS'").run(canon({ creditDays: 8 })));
  ok(!rowT.ok && rowT.differ.some((x) => /sales/.test(x)) && !ordT.ok && ordT.differ.some((x) => /sales/.test(x)) && !docT.ok && docT.differ.some((x) => /TERMS/.test(x)),
    "the readcheck names a sale that differs, a list out of order and a derived document that differs");
  const text = JSON.stringify(rowT) + JSON.stringify(docT);
  ok(!text.includes(frozen.sales[0].rid) && !/creditDays/.test(text), "and names only: no row, no rid, no value reaches the public log");
  /* 7: the drafter's own reads take the book's bound */
  const { withDraftLots, tripCheck } = await import("../src/drafter.js");
  const lots = async (mode, committedAt) => {
    const w = d1(); seedMirror(w.db); w.db.exec("UPDATE snapshot SET at='2026-10-25T13:00:00.000Z'");
    const bk = theBook(); await bk.load(); bindBook(w.D1, ns(bk.b)); setMode(w.db, mode);
    const row = { date: "2026-10-25", supplier: "S1-AAA", qty: 5, total: 100, product: "salt", trip: "t1", delivery: 0 };
    w.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run("2026-10-25T01:00:00.000Z", "approved", "purchases", "{}", JSON.stringify(row), "x", "y", "2026-10-25T01:00:00.000Z", committedAt);
    const book = await readBook(w.D1);
    return (await withDraftLots(w.D1, book)).draftLots.length;
  };
  ok(await lots("book", "2026-10-25T14:00:30.000Z") === 1 && await lots("book", "2026-10-25T13:59:00.000Z") === 0 && await lots("book", null) === 1
    && await lots("d1", "2026-10-25T14:00:30.000Z") === 0 && await lots("d1", null) === 1,
    "the lots drafted and not yet folded are those the book's bound leaves out in 'book' mode, and the uncommitted ones in 'd1' mode, as before");

  /* 8: the readcheck route, keyed; the entry points bind the Book; the chain asks it after the load */
  const RC = d1(); seedMirror(RC.db); const RB = theBook(); await RB.load();
  const rcEnv = { REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", SALT_BOOK_KEY: "bk", BOOK: ns(RB.b), SALT_LEDGER: RC.D1 };
  const rc = (headers, e = rcEnv, method = "GET") => w.default.fetch(new Request("https://salt.test/book/readcheck", { method, headers }), e);
  const rcOk = await rc({ "X-Book-Key": "bk" });
  const rcJ = await rcOk.json();
  ok((await rc({})).status === 401 && (await rc({ "X-Book-Key": "no" })).status === 401 && rcOk.status === 200 && rcJ.ok === true && rcJ.mode === "d1" && rcJ.version === V && rcJ.bookVersion === V
    && (await rc({ "X-Book-Key": "bk" }, { ...rcEnv, BOOK: undefined })).status === 503 && (await rc({ "X-Book-Key": "bk" }, rcEnv, "POST")).status === 405,
    "the readcheck is keyed, read-only, 503 where the Book is unbound, and says the mirror and the Book agree with their versions and the flag");
  ok(/fetch\(request, env, ctx\) \{\s*if \(env\.SALT_LEDGER && env\.BOOK\) bindBook\(env\.SALT_LEDGER, env\.BOOK\);/.test(wsrc) && /scheduled\(event, env, ctx\) \{\s*if \(env\.SALT_LEDGER && env\.BOOK\) bindBook\(env\.SALT_LEDGER, env\.BOOK\);/.test(wsrc),
    "both entry points of the Desk Worker bind the Book to the ledger before anything reads");
  const RT = await import("../tools/book-readcheck.mjs");
  ok(/agree over 12 sales/.test(RT.line({ ok: true, rows: 12, version: "v1", bookVersion: "v1", mode: "d1" })) && /DIFFER: sales, state\.TERMS/.test(RT.line({ ok: false, differ: ["sales", "state.TERMS"], version: "v1", bookVersion: "v1", mode: "book" }))
    && /NOT RUN/.test(RT.line({ error: "x" })) && (await RT.check("https://x", {})).error.includes("SALT_BOOK_KEY"),
    "the readcheck tool says agreement, the names that differ, or that it did not run, and with no key sends nothing");
  let tries = 0;
  const flaky = async () => { const st = [502, 200][tries++]; return { status: st, json: async () => (st === 200 ? { ok: true } : { error: "x" }) }; };
  let fours = 0;
  ok((await RT.check("https://x/", { SALT_BOOK_KEY: "k" }, { wait: 0, fetchImpl: flaky })).ok === true && tries === 2
    && (await RT.check("https://x", { SALT_BOOK_KEY: "k" }, { wait: 0, fetchImpl: async () => { fours++; return { status: 401, json: async () => ({ error: "key" }) }; } })).error.startsWith("HTTP 401") && fours === 1,
    "a 5xx is retried and a 4xx is said at once");
  const wf = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8");
  const at = wf.indexOf("- name: Check the readers agree"), stepText = wf.slice(at, wf.indexOf("\n      # ----", at));
  ok(at > wf.indexOf("- name: Load the shadow Book") && at < wf.indexOf("- name: Deploy the statements site") && /continue-on-error: true/.test(stepText)
    && /steps\.plan\.outputs\.deploy == '1'/.test(stepText) && /node tools\/book-readcheck\.mjs/.test(stepText),
    "the chain checks the readers agree after the Book loads, only on a deploy, and a red check never blocks the fold");

  /* 9: a Book that held rows before S3 gains the order column and the snapshot, and its first S3 load sets them */
  const OLD = objectState();
  OLD.db.exec("CREATE TABLE rows (coll TEXT NOT NULL, key TEXT NOT NULL, doc TEXT NOT NULL, h TEXT NOT NULL, booked_at TEXT NOT NULL, revised_at TEXT, gone_at TEXT, PRIMARY KEY (coll, key))");
  OLD.db.exec("INSERT INTO rows (coll, key, doc, h, booked_at) VALUES ('sales', 'r:" + frozen.sales[0].rid + "', '" + canon(frozen.sales[0]).split("'").join("''") + "', 'x', '2026-10-01T00:00:00Z')");
  const ob = new Book(OLD, {});
  ok(OLD.db.prepare("SELECT seq FROM rows").get().seq === null && OLD.db.prepare("SELECT COUNT(*) AS c FROM snap").get().c === 0 && (await ob.fetch(new Request("https://book/read"))).status === 503,
    "a Book that held rows before S3 gains the order column, reads NULL there and answers 503 until a load writes the snapshot");
  await ob.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: frozen, pricing, derived, v: V, stamped: AT_STAMP }) }));
  ok(OLD.db.prepare("SELECT COUNT(*) AS c FROM rows WHERE seq IS NULL").get().c === 0 && OLD.db.prepare("SELECT booked_at FROM rows WHERE key = ?").get("r:" + frozen.sales[0].rid).booked_at === "2026-10-01T00:00:00Z"
    && (await ob.fetch(new Request("https://book/read"))).status === 200,
    "its next load sets every row's place, keeps the moment the row was first booked, and the Book then reads");

  /* the sweep (Fable): every draft clause that asks "committed" outside src/way.js is a question about D1 and the fold ("awaiting the fold", the
     admission lifecycle, the mark itself), never "on its way to a reader"; those that were on its way take the book's bound. A new literal is
     red here until it is placed in one class or the other. */
  const lits = {};
  for (const f of readdirSync(join(REPO, "src")).filter((x) => x.endsWith(".js") && x !== "way.js")) {
    const n = readFileSync(join(REPO, "src", f), "utf8").split("\n").filter((l) => /committed_at IS NULL|committed_at >|committed_at <=|committed_at IS NOT NULL/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;
    if (n) lits[f] = n;
  }
  ok(JSON.stringify(lits) === JSON.stringify({ "book-tap.js": 2, "input-admission.js": 6, "worker.js": 8 }),
    "the only draft clauses that ask committed_at are the awaiting-the-fold and admission ones (input-admission.js 6, worker.js 8: the two the load asks to name the open entries the fold took, S4a; book-tap.js 2: the net's and the rids' own, S4d): " + JSON.stringify(lits));
}
