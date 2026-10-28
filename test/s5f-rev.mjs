/* test/s5f-rev.mjs: S5f-4 OF THE BOOK PLAN, THE STALENESS TESTS MOVE FROM GIT'S VERSION TO THE BOOK'S REVISION (28 Oct 2026). Dormant: every change keys off D1 `book_source`, and with `d1` every answer is what it was.
 * The sites, found by grep and listed in docs/DESK.md "S5f-4": the told mark and the tie-out (src/orders.js), the pricing and open-order flags and the preapproval digest (src/drafter.js, through the book the readers
 * hand it), the reader's own "Book trails the mirror" test and the flag that picks the reader (src/book-read.js), the input admission's snapshot (src/input-admission.js), the maker's row room, the amend preview's
 * "mirror is updating" (src/orders.js), and the Counter's stamp (src/worker.js /stmt/rev, stmt/worker.js, tools/stmt-publish.mjs). Each check is red under its own mutation (test/s5f-rev.mutations.json):
 *   1  the Book: derivedRev is the revision its derived documents were computed at: a load sets it, a tap, a void and a compaction leave it; /at, /revno and /read carry rev and derivedRev, and a read after a void is not the memoised one
 *   2  the readers with the Book as the source: the Book is read whatever the readers' flag says, never judged against the frozen mirror, never replaced by it when it will not answer (a throw); the old world as it was
 *   3  bookOf: the version is the Book's revision and the pricing and open-order documents say the revision they were computed at, so the drafter's own stale flag fires exactly when they trail and not otherwise
 *   4  the told mark and the tie-out run on the revision, and time a stall from the first pass that saw it
 *   5  the amend preview does not compare the data's version with the build's while the Book is the source
 *   6  input admission: a reservation is held against the revision, and one made at an older revision stops counting
 *   7  the Counter's stamp: `<id>.<rev>` from the Desk, accepted by the Counter and sealed by the publisher; the plain id with git as the source */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL", T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const { buildSeed } = await import("../tools/d1.mjs");
  const R = await import("../src/book-read.js");
  const { readBook, flagsFor } = await import("../src/drafter.js");
  const { tellSite, tieOut } = await import("../src/orders.js");
  const worker = (await import("../src/worker.js")).default;
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const sale = (id, qty) => ({ id, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: T(2), qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" } });
  const loadBody = (v = V) => JSON.stringify({ rev: "r", book: fb(), pricing: { ...pricing, v }, derived: { ...derived, OPEN: { ...derived.OPEN, v } }, v, stamped: AT_STAMP });
  const mkBook = () => {
    const b = new Book(objectState(), {}); let t = 0;
    b.clock = () => "2026-10-28T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    const ns = { idFromName: (n) => n, get: () => ({ fetch: (r) => b.fetch(r) }) };
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    return { b, ns, call, at: () => call("/at"), revno: () => call("/revno"), read: (q = "") => call("/read" + q),
      post: (path, body) => call(path, { method: "POST", body: JSON.stringify(body || {}) }),
      load: (v) => b.fetch(new Request("https://book/load", { method: "POST", body: loadBody(v) })).then((r) => r.json()),
      tap: (items) => call("/tap", { method: "POST", body: JSON.stringify({ items, day: T(2), v: V }) }) };
  };
  const world = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = fb();
    db.exec(buildSeed({ v: V, stamped: AT_STAMP, ledger: { ...bookless, PRICING: pricing, ...derived } }).sql);
    const mkq = (a, sql) => { const st = db.prepare(sql); return { sql, run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; }, batch(list) { return list.map((s) => (/^\s*select/i.test(s.sql) ? s.all() : s.run())); } };
    return { db, D1, source: (m) => db.exec("UPDATE book_source SET mode='" + m + "'"), readFlag: (m) => db.exec("UPDATE book_read SET mode='" + m + "'") };
  };

  /* 1: the Book's two revisions */
  {
    const B = mkBook(); await B.load();
    const a0 = await B.at(), r0 = await B.read();
    ok(Number.isInteger(a0.rev) && a0.rev >= 1 && a0.derivedRev === a0.rev && r0.rev === a0.rev && r0.derivedRev === a0.derivedRev && (await B.revno()).derivedRev === a0.rev, "a load leaves the derived documents as fresh as the revision: " + JSON.stringify([a0.rev, a0.derivedRev, r0.rev, r0.derivedRev]));
    await B.tap([sale(IDN(1), 2)]); await B.tap([sale(IDN(2), 3)]);
    const a1 = await B.at(), r1 = await B.read();
    ok(a1.rev === a0.rev + 2 && a1.derivedRev === a0.derivedRev && r1.rev === a1.rev && r1.derivedRev === a1.derivedRev, "a tap moves the revision and leaves the documents where they were computed: " + JSON.stringify([a1.rev, a1.derivedRev, r1.rev]));
    await B.post("/void", { ids: [IDN(2)] });
    const a2 = await B.at(), r2 = await B.read();
    ok(a2.rev === a1.rev + 1 && r2.rev === a2.rev && r2.booked.join() === IDN(1), "a void moves it, and a read after it is not the memoised one: " + JSON.stringify([a2.rev, r2.rev, r2.booked]));
    const c = await B.post("/compact"), a3 = await B.at();
    ok(c.ok && a3.rev === a2.rev + 1 && a3.derivedRev === a0.derivedRev && (await B.read("?base=1")).derivedRev === a0.derivedRev, "a compaction moves the revision and does not claim the documents are fresher: " + JSON.stringify([a3.rev, a3.derivedRev]));
    await B.load(); /* git's book again: it lacks the tapped rows, so the load changes the base and the documents it carries are as fresh as the revision it leaves */
    const a4 = await B.at();
    ok(a4.rev >= a3.rev && a4.derivedRev === a4.rev, "a load makes the documents it carries as fresh as the revision it leaves: " + JSON.stringify([a3.rev, a4.rev, a4.derivedRev]));
    await B.load(); const a5 = await B.at();
    ok(a5.rev === a4.rev && a5.derivedRev === a4.rev, "and a replay of the same load moves nothing: " + JSON.stringify([a4.rev, a5.rev, a5.derivedRev]));
    const oldOs = objectState();
    oldOs.db.exec("CREATE TABLE snap (one INTEGER PRIMARY KEY CHECK (one = 1), v TEXT NOT NULL, stamped TEXT, at TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0)");
    oldOs.db.exec("INSERT INTO snap (one, v, stamped, at, rev) VALUES (1, 'v1250', 's', '2026-10-01T00:00:00.000Z', 4)");
    const old = new Book(oldOs, {});
    const oa = await (await old.fetch(new Request("https://book/at"))).json();
    ok(oa.rev === 4 && oa.derivedRev === 0, "a Book that held a snapshot before this gains the column and says 0: " + JSON.stringify([oa.rev, oa.derivedRev]));
    const ex = await B.call("/export");
    ok(ex.ok && ex.derivedRev === a5.derivedRev, "the export carries it, so a restore knows how stale the documents were");
  }

  /* 2 and 3: the readers */
  {
    const B = mkBook(); await B.load();
    const W = world(); R.bindBook(W.D1, B.ns);
    ok(await R.sourceMode(W.D1) === "d1" && await R.readMode(W.D1) === "d1", "with a fresh store the source is git and the readers read the mirror");
    W.readFlag("book");
    const d1res = await R.fromBook(W.D1, "read");
    ok(d1res && d1res.source === undefined && d1res.v === V, "git as the source: the readers' flag picks the Book and the answer is as it was, with no source mark");
    W.db.exec("UPDATE snapshot SET v='v1253'");
    ok(await R.fromBook(W.D1, "read") === null, "and a Book behind the mirror is not read (the old test, kept)");
    W.source("book"); W.readFlag("d1");
    const res = await R.fromBook(W.D1, "read");
    ok(await R.readMode(W.D1) === "book" && res && res.source === "book" && Number.isInteger(res.rev) && Number.isInteger(res.derivedRev), "the Book as the source is read whatever the readers' flag says, and never judged against the frozen mirror (here ahead of it): " + JSON.stringify([res && res.source, res && res.rev]));
    const down = async (ns) => { const W2 = world(); W2.source("book"); if (ns) R.bindBook(W2.D1, ns); return { W2, thrown: await R.fromBook(W2.D1, "read").then(() => null, (e) => e) }; };
    const unbound = await down(null), unboundOld = await R.fromBook(world().D1, "read"), five = await down({ idFromName: (n) => n, get: () => ({ fetch: async () => new Response("{}", { status: 503 }) }) }), boom = await down({ idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error("net"); } }) });
    const old = await down({ idFromName: (n) => n, get: () => ({ fetch: async () => Response.json({ ok: true, at: "x", rows: {}, state: {}, v: V }) }) });
    ok([five, boom, old].every((x) => x.thrown instanceof R.BookDown) && unboundOld === null, "with the Book as the source a Book that answers 503, throws or answers no revision is an error and never the mirror (no binding at all is nothing to read, asking D1 nothing, as before): " + [five, boom, old].map((x) => x.thrown && x.thrown.message).join(" | "));
    const oldW = world(); oldW.readFlag("book"); R.bindBook(oldW.D1, { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("{}", { status: 503 }) }) });
    ok(await R.fromBook(oldW.D1, "read") === null, "with git as the source the same Book is null, and the readers fall to the mirror as they always did");
    const drafterDown = world(); drafterDown.source("book"); R.bindBook(drafterDown.D1, { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("{}", { status: 503 }) }) });
    ok(await readBook(drafterDown.D1).then(() => "read", (e) => e instanceof R.BookDown ? "threw" : "other") === "threw", "the drafter's reader throws rather than draft off the frozen mirror");
    ok(await R.versionToken(W.D1) === R.bookToken(res.rev) && /^book@\d+$/.test(await R.versionToken(W.D1)), "the token the staleness tests compare is book@<revision>");
    const toks = await R.versionToken(world().D1);
    ok(toks === V, "and the snapshot's version with git as the source: " + toks);
    ok(await R.versionToken(unbound.W2.D1).then(() => "ok", (e) => e instanceof R.BookDown ? "threw" : "other") === "threw", "the token of a Book that will not say is an error, never a guess");

    /* 3: bookOf, and the drafter's own flag */
    const bk = R.bookOf(res);
    ok(bk.version === R.bookToken(res.rev) && bk.pricing.v === R.bookToken(res.derivedRev) && bk.state.OPEN.v === R.bookToken(res.derivedRev) && bk.pricing.v === bk.version, "right after a load the version is the revision and the pricing and open-order documents say the same revision: " + JSON.stringify([bk.version, bk.pricing.v, bk.state.OPEN.v]));
    await B.tap([sale(IDN(1), 2)]);
    const res2 = await R.fromBook(W.D1, "read"), bk2 = R.bookOf(res2);
    ok(bk2.version === R.bookToken(res2.rev) && bk2.pricing.v === R.bookToken(res.derivedRev) && bk2.pricing.v !== bk2.version && bk2.state.OPEN.v !== bk2.version, "after a tap the documents trail the version: " + JSON.stringify([bk2.version, bk2.pricing.v]));
    const row = { date: T(2), customer: "ZZ1-AAA", qty: 1, total: 100, cash: 100, deliveredQty: 1, product: "salt" }, entry = { at: IDN(5), payload: { mode: "new", direction: "SELL", party: "ZZ1-AAA" } };
    const stale = (b) => { try { return flagsFor(entry, row, b, {}).some((f) => /The pricing snapshot was taken at/.test(f)); } catch (e) { return "threw " + e.message; } };
    ok(stale(bk2) === true && stale(bk) === false, "the drafter's own stale-pricing flag fires after a tap and not right after a load: " + JSON.stringify([stale(bk2), stale(bk)]));
    const plain = R.bookOf(d1res);
    ok(plain.version === V && plain.pricing.v === V && plain.state.OPEN.v === V, "with git as the source bookOf leaves the version and both documents as the Book holds them");
    await B.load(); /* a load: the documents are fresh again */
    const bk3 = R.bookOf(await R.fromBook(W.D1, "read"));
    ok(bk3.pricing.v === bk3.version && stale(bk3) === false, "and the next load makes them fresh again (no flag)");
  }

  /* 4: the told mark and the tie-out */
  {
    const B = mkBook(); await B.load();
    const kv = () => { const m = new Map(); return { m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } }; };
    const siteEnv = (W, marks = {}) => {
      const q = kv(); for (const [k, v] of Object.entries(marks)) q.m.set(k, v);
      const calls = [];
      const STMT_SITE = { fetch: async (url) => { calls.push(String(url)); return Response.json({ ok: true, orders: [] }); } };
      R.bindBook(W.D1, B.ns);
      return { env: { SALT_LEDGER: W.D1, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, q, calls };
    };
    const mirror = async () => ({ sales: [{ rid: "s001", customer: "ZZ1-AAA", date: T(1), qty: 1, total: 100 }], version: V });
    const Wd = world();
    const d = siteEnv(Wd, { "orders:told": V });
    const t0 = await tellSite(d.env, undefined, mirror);
    ok(t0.told === 0 && t0.v === V && d.calls.length === 0, "git as the source: a version the Counter was told of stands down, as it did");
    const Wb = world(); Wb.source("book");
    const tok = R.bookToken((await B.at()).rev);
    const b1 = siteEnv(Wb, { "orders:told": tok });
    const t1 = await tellSite(b1.env, undefined, mirror);
    ok(t1.told === 0 && t1.v === tok && b1.calls.length === 0, "the Book as the source: the pass stands down on the revision the Counter was told of: " + JSON.stringify(t1));
    const b2 = siteEnv(Wb, { "orders:told": V });
    const t2 = await tellSite(b2.env, undefined, mirror);
    ok(b2.calls.length >= 1 && t2.v !== V, "and a mark of git's version does not stand it down: the orders are read (a pass runs)");
    await B.tap([sale(IDN(1), 2)]);
    const b3 = siteEnv(Wb, { "orders:told": tok });
    const t3 = await tellSite(b3.env, undefined, mirror);
    ok(b3.calls.length >= 1 && t3.v === R.bookToken((await B.at()).rev), "a tap moved the revision, so the pass the Counter was last told of is not this one: " + JSON.stringify(t3));
    ok(b3.q.m.get("orders:told") === R.bookToken((await B.at()).rev), "and a clean pass records the revision it was for");
    const now = new Date("2026-10-28T12:00:00.000Z");
    const e1 = siteEnv(Wb, { "orders:told": "book@0" });
    const x1 = await tieOut(e1.env, mirror, now), x2 = await tieOut(e1.env, mirror, new Date(now.getTime() + 10 * 60000)), x3 = await tieOut(e1.env, mirror, new Date(now.getTime() + 16 * 60000));
    const leg = (x) => (x.faults || []).find((f) => f.what === "return leg");
    ok(x1.ok && !leg(x1) && !leg(x2) && leg(x3) && /book@\d+/.test(leg(x3).why) && JSON.parse(e1.q.m.get("orders:seen")).v === R.bookToken((await B.at()).rev), "the Book as the source: a stall is timed from the first pass that saw the revision, and says the revision, not a git version: " + JSON.stringify(leg(x3)));
    const e2 = siteEnv(Wb, { "orders:told": R.bookToken((await B.at()).rev) });
    ok(!leg(await tieOut(e2.env, mirror, new Date(now.getTime() + 60 * 60000))), "and a Counter told of this revision is never a stall");
    const e3 = siteEnv(Wd, { "orders:told": "v1100" });
    Wd.db.exec("UPDATE snapshot SET at='2026-10-28T10:00:00.000Z'");
    const y = await tieOut(e3.env, mirror, new Date("2026-10-28T10:16:00.000Z"));
    ok(leg(y) && /book v1252 since 2026-10-28T10:00:00.000Z/.test(leg(y).why) && !e3.q.m.has("orders:seen"), "git as the source: the stall is timed from the snapshot's moment, as it was, and nothing new is written: " + JSON.stringify(leg(y)));
  }

  /* 5: the amend preview's version compare (read from the code that runs: the exported guard is the line's own condition) */
  {
    const src = readFileSync(join(REPO, "src", "orders.js"), "utf8");
    ok(/!book\.version \|\| \(!BOOK_TOKEN\.test\(String\(book\.version\)\) && book\.version !== revision\.v\)/.test(src), "the amend preview compares the data's version with the build's only when the version is git's (the Book's revision is not a build)");
  }

  /* 6: input admission, driven for real: a repayment is admitted against a loan, held against the revision it was read at, and the hold ends when the revision moves */
  {
    const { admitInput } = await import("../src/input-admission.js");
    const loan = { rid: "l001", date: T(1), party: "ZZ1-AAA", direction: "out", form: "cash", valueKg: null, valueRM: 100, status: "open", product: null, note: "", repaid: [] };
    const lb = () => { const b = fb(); b.loans = [loan]; return b; };
    const B = mkBook();
    await B.b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: lb(), pricing, derived, v: V, stamped: AT_STAMP }) }));
    const W = world(); W.source("book"); R.bindBook(W.D1, B.ns);
    const repay = (n, rm) => ({ at: IDN(n), payload: { mode: "repay", loan: "l001", rm, date: T(2) } });
    const b1 = await readBook(W.D1);
    ok(/^book@\d+$/.test(b1.version) && b1.state.loans.some((l) => l.rid === "l001"), "the book a repayment is admitted against carries the Book's revision as its version and the loan: " + b1.version);
    const a1 = await admitInput(W.D1, repay(7, 70), b1, "device:A");
    const held = W.db.prepare("SELECT snapshot, state, amount FROM input_admission WHERE id=?").get(IDN(7));
    ok(a1.accepted === true && held && held.snapshot === b1.version && held.state === "accepted", "it is admitted, and held against the revision: " + JSON.stringify([a1, held]));
    W.db.prepare("UPDATE input_admission SET state='committed' WHERE id=?").run(IDN(7));
    const a2 = await admitInput(W.D1, repay(8, 60), await readBook(W.D1), "device:A");
    ok(a2.error && /already reserved/.test(a2.error), "while the revision stands a committed admission still holds its 70, so a second 60 on a loan of 100 is refused: " + JSON.stringify(a2));
    await B.tap([sale(IDN(1), 2)]);
    const b3 = await readBook(W.D1);
    ok(b3.version !== b1.version, "a tap moves the revision the next reader sees");
    const a3 = await admitInput(W.D1, repay(8, 60), b3, "device:A");
    ok(a3.accepted === true, "and once it has moved, the committed admission (the book holds it now) stops counting and the second is taken: " + JSON.stringify(a3));
    const stale = await admitInput(W.D1, repay(9, 1), b1, "device:A");
    ok(stale.error && /changed|reserved/.test(stale.error), "an input read at an older revision is refused as the book having changed, never admitted on the stale read: " + JSON.stringify(stale));
    const Wd = world(); const Bd = mkBook(); await Bd.b.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: lb(), pricing, derived, v: V, stamped: AT_STAMP }) }));
    R.bindBook(Wd.D1, Bd.ns); Wd.readFlag("book");
    const bd = await readBook(Wd.D1), ad = await admitInput(Wd.D1, repay(7, 70), bd, "device:A");
    ok(bd.version === V && ad.accepted === true && Wd.db.prepare("SELECT snapshot FROM input_admission WHERE id=?").get(IDN(7)).snapshot === V, "with git as the source the admission is held against git's version, as it was: " + JSON.stringify([bd.version, ad]));
  }

  /* 7: the Counter's stamp */
  {
    const B = mkBook(); await B.load();
    const W = world(); R.bindBook(W.D1, B.ns);
    const manifest = { id: "0123456789abcdef", v: V };
    const env = (extra = {}) => ({ STMT_DESK_KEY: "dk", SALT_LEDGER: W.D1, BOOK: B.ns, REQUIRE_ACCESS: "0", ASSETS: { fetch: async () => new Response(JSON.stringify(manifest), { status: 200 }) }, ...extra });
    const get = async (e) => { const r = await worker.fetch(new Request("https://salt.test/stmt/rev", { headers: { "X-Stmt-Desk": "dk" } }), e, { waitUntil() { } }); return { status: r.status, body: await r.json() }; };
    const g1 = await get(env());
    ok(g1.status === 200 && g1.body.id === "0123456789abcdef", "git as the source: the stamp is the build id alone: " + JSON.stringify(g1.body));
    W.source("book");
    const rev = (await B.at()).rev, g2 = await get(env());
    ok(g2.status === 200 && g2.body.id === "0123456789abcdef." + rev, "the Book as the source: the stamp is the build id and the Book's revision: " + JSON.stringify(g2.body));
    await B.tap([sale(IDN(1), 2)]);
    ok((await get(env())).body.id === "0123456789abcdef." + (rev + 1), "a tap moves it, so a statement sealed before it is withheld as updating until the next publish");
    const g3 = await get(env({ BOOK: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("{}", { status: 503 }) }) } }));
    R.bindBook(W.D1, B.ns);
    ok(g3.status === 503 && !g3.body.ok, "a Book that will not say its revision is a 503, never the plain id");
    const { readDeskBuildId } = await import("../tools/stmt-publish.mjs");
    const tmp = join(REPO, "test", "tmp"); const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    mkdirSync(tmp, { recursive: true }); const file = join(tmp, "rev-s5f.json"); writeFileSync(file, JSON.stringify(manifest));
    const was = process.env.SALT_BOOK_REV;
    try {
      delete process.env.SALT_BOOK_REV; const a = readDeskBuildId(file);
      process.env.SALT_BOOK_REV = "17"; const b = readDeskBuildId(file);
      process.env.SALT_BOOK_REV = "x1"; const c = (() => { try { return readDeskBuildId(file); } catch (e) { return "threw"; } })();
      ok(a === "0123456789abcdef" && b === "0123456789abcdef.17" && c === "threw", "the publisher seals the build id alone, or with the Book revision the chain names, and refuses one that is not a number: " + [a, b, c].join(" "));
    } finally { if (was === undefined) delete process.env.SALT_BOOK_REV; else process.env.SALT_BOOK_REV = was; rmSync(file, { force: true }); }
    const ssrc = readFileSync(join(REPO, "stmt", "worker.js"), "utf8");
    const re = new RegExp((ssrc.match(/const BUILD_ID_RE = (\/.*\/);/) || [])[1].slice(1, -1));
    ok(re.test("0123456789abcdef") && re.test("0123456789abcdef.17") && !re.test("0123456789abcdef.") && !re.test("0123456789abcdef.x") && !re.test("0123456789abcde.1") && !re.test("0123456789abcdefg"), "the Counter takes the build id with or without a revision after a dot, and nothing else");
  }
}
