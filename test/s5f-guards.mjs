/* test/s5f-guards.mjs: S5f-3 OF THE BOOK PLAN, THE GUARDS (28 Oct 2026; his answer to Ask B). While D1 `book_source` reads 'd1' none of this changes anything; with 'book' every second writer of the ledger stops.
 * Each check is red under its own mutation (test/s5f-guards.mutations.json):
 *   1  POST /book/load: with the Book as the source a load must be an import (?import=1), and still needs its key; with git as the source it loads as it did
 *   2  POST /book/compact: keyed; dry in either world; a real run only with the Book as the source; it marks the drafts of every open entry committed BEFORE the Book compacts and any stray AT the compaction's moment,
 *      so no draft is ever on its way to a reader once the base holds its row; an entry whose draft is not approved refuses the whole thing; a retry after the Book compacted marks from the Book's own log
 *   3  the dispatch: with the Book as the source the minute ladder rings nothing, and an approval's dispatch asks for the publish alone (and says so in the run's name); with git as the source both are as they were
 *   4  the laptop: source-flag reads d1, book, no table (d1) and a refusal (cannot tell); drafts.mjs --approve and update.mjs refuse with the Book as the source and when the flag cannot be read; --approved stages nothing there
 *   5  tools/book-load.mjs --import posts ?import=1, and a plain post does not
 *   6  the chain: one step reads the flag, and the fold's stage, the mirror's re-seed, the shadow load and the two comparisons stand down on mode == book */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book } from "../src/book.js";
import { onItsWay, boundOf } from "../src/way.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const worker = (await import("../src/worker.js")).default;
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const sale = (id, qty) => ({ id, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: "2031-01-02", qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" } });
  const loadBody = () => JSON.stringify({ rev: "r", book: fb(), pricing, derived, v: V, stamped: AT_STAMP });

  /* a D1 on the real migrations in node:sqlite, as the ladder test builds one; `batch` runs writes so meta.changes is real */
  const world = (rows = []) => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    for (const r of rows) db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,decided_at,committed_at) VALUES (?,?,'sales','{}','{}','fixture','cloud-drafter',?,?,?)")
      .run(r.id, r.status, r.drafted || "2026-10-28T09:00:00.000Z", r.status === "pending" ? null : (r.decided || "2026-10-28T09:00:00.000Z"), r.committed || null);
    const mkq = (a, sql) => { const st = db.prepare(sql); return { sql, run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; }, batch(list) { return list.map((s) => (/^\s*select/i.test(s.sql) ? s.all() : s.run())); } };
    return { db, D1, flag: (mode) => db.exec("UPDATE book_source SET mode='" + mode + "'"), committed: (id) => (db.prepare("SELECT committed_at AS c FROM draft WHERE id=?").get(id) || {}).c || null };
  };
  const mkBook = () => {
    const b = new Book(objectState(), {});
    b.clock = () => new Date().toISOString();
    const me = { hook: null };
    const ns = { idFromName: (n) => n, get: () => ({ fetch: (r) => { if (me.hook && new URL(r.url).pathname === "/compact" && !r.url.includes("dry=1")) me.hook(); return b.fetch(r); } }) };
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    return { b, ns, call, me, at: () => call("/at"), tap: (items) => call("/tap", { method: "POST", body: JSON.stringify({ items, day: "2031-01-02", v: V }) }),
      load: () => b.fetch(new Request("https://book/load", { method: "POST", body: loadBody() })).then((r) => r.json()) };
  };
  const hit = async (path, { method = "POST", key = "bk", body, env }) => {
    const r = await worker.fetch(new Request("https://salt.test" + path, { method, headers: key ? { "X-Book-Key": key } : {}, body }), env, { waitUntil() { } });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  /* 1: the load is an import while the Book is the source */
  {
    const B = mkBook(); await B.load(); const W = world();
    const env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    const l1 = await hit("/book/load", { body: loadBody(), env });
    ok(l1.status === 200 && l1.body.ok === true, "with git as the source a load goes in as it always did: " + l1.status);
    W.flag("book");
    const rev = (await B.at()).rev;
    const l2 = await hit("/book/load", { body: loadBody(), env });
    ok(l2.status === 409 && l2.body.ok === false && l2.body.source === "book" && /import/.test(l2.body.error) && (await B.at()).rev === rev, "with the Book as the source a plain load is refused 409 and the Book is untouched: " + JSON.stringify(l2.body));
    const grown = fb(); grown.sales.push({ rid: "s9998", customer: "ZZ2-BBB", date: "2031-01-01", qty: 1, total: 55, cash: 55, deliveredQty: 1, product: "salt", note: "x" });
    const l3 = await hit("/book/load?import=1", { body: JSON.stringify({ rev: "r", book: grown, pricing, derived, v: V, stamped: AT_STAMP }), env });
    ok(l3.status === 200 && l3.body.ok === true && (await B.at()).rev === rev + 1, "an import is taken, and moves the revision: " + JSON.stringify([l3.status, (await B.at()).rev]));
    const l4 = await hit("/book/load?import=1", { body: loadBody(), key: null, env });
    const l5 = await hit("/book/load?import=0", { body: loadBody(), env });
    ok(l4.status === 401 && l5.status === 409, "an import still needs the key, and only import=1 is one");
  }

  /* 2: the compaction route and the marks */
  {
    const B = mkBook(); await B.load();
    const ids = [IDN(1), IDN(2), IDN(3)], OLD = IDN(4), EARLY = "2026-01-01T00:00:00.000Z";
    const W = world(ids.map((id) => ({ id, status: "approved" })).concat([{ id: OLD, status: "approved", committed: EARLY }]));
    const env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    for (const [k, id] of ids.entries()) await B.tap([sale(id, k + 1)]);
    await B.tap([sale(OLD, 7)]);
    let mid = null; B.me.hook = () => { mid = ids.map((i) => W.committed(i)); };
    ok((await hit("/book/compact", { key: null, env })).status === 401 && (await hit("/book/compact", { method: "GET", env })).status === 405, "the route is keyed and POST only");
    const dry = await hit("/book/compact?dry=1", { env });
    ok(dry.status === 200 && dry.body.ok && dry.body.dry && dry.body.open === 3 + 1 && ids.every((i) => W.committed(i) === null), "a dry run answers in either world and marks nothing: " + JSON.stringify(dry.body));
    const real0 = await hit("/book/compact", { env }), a0 = await B.at();
    ok(real0.status === 409 && /not the source/.test(real0.body.error) && ids.every((i) => W.committed(i) === null) && a0.booked.length === 4, "with git as the source a real run is refused and nothing is marked or closed: " + JSON.stringify(real0.body));
    W.flag("book");
    const real = await hit("/book/compact", { env }), a1 = await B.at();
    ok(real.status === 200 && real.body.ok && real.body.open === 4 && real.body.compacted === 4 && real.body.closed === 4 && real.body.left === 0 && a1.booked.length === 0, "with the Book as the source it compacts four entries and marks their drafts: " + JSON.stringify(real.body));
    ok(mid && mid.every((c) => c && c <= a1.at), "the drafts were already committed when the Book was asked to compact, while their entries were still open: " + JSON.stringify(mid));
    ok(W.committed(OLD) === EARLY, "a draft already committed keeps its own moment: " + W.committed(OLD));
    ok(ids.every((i) => W.committed(i) && W.committed(i) <= a1.at), "every draft is committed at or before the base's moment: " + JSON.stringify(ids.map((i) => W.committed(i))) + " at " + a1.at);
    const way = W.db.prepare("SELECT COUNT(*) AS n FROM draft WHERE " + onItsWay(boundOf({ at: a1.at, booked: a1.booked }))).get().n;
    ok(way === 0, "and none of them is on its way to a reader, so no sale counts twice: " + way);
    const again = await hit("/book/compact", { env });
    ok(again.status === 200 && again.body.ok && again.body.open === 0 && again.body.compacted === 0 && again.body.left === 0, "a second run finds nothing open and marks nothing new: " + JSON.stringify(again.body));
  }
  {
    /* an entry whose draft is not approved refuses the whole compaction: nothing is marked, nothing closed */
    const B = mkBook(); await B.load();
    const W = world([{ id: IDN(1), status: "approved" }, { id: IDN(2), status: "pending" }]); W.flag("book");
    const env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    await B.tap([sale(IDN(1), 1)]); await B.tap([sale(IDN(2), 2)]);
    const r = await hit("/book/compact", { env }), a = await B.at();
    ok(r.status === 409 && r.body.notApproved && r.body.notApproved.join() === IDN(2) && W.committed(IDN(1)) === null && a.booked.length === 2, "an open entry whose draft is still pending refuses the compaction, and nothing is marked or closed: " + JSON.stringify(r.body));
  }
  {
    /* a Book that compacted but whose marks were lost: the retry marks from the Book's own log, at the base's moment */
    const B = mkBook(); await B.load();
    const W = world([{ id: IDN(1), status: "approved" }, { id: IDN(2), status: "approved" }]); W.flag("book");
    const env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    await B.tap([sale(IDN(1), 1)]); await B.tap([sale(IDN(2), 2)]);
    const c = await B.call("/compact", { method: "POST" });
    ok(c.ok && c.compacted === 2 && W.committed(IDN(1)) === null, "the Book compacted and D1 was never marked (the failure past the commit)");
    const r = await hit("/book/compact", { env }), a = await B.at();
    ok(r.status === 200 && r.body.ok && r.body.open === 0 && r.body.closed === 2 && r.body.left === 0 && W.committed(IDN(1)) <= a.at && W.committed(IDN(2)) <= a.at, "the retry marks both from the Book's log, at or before its moment: " + JSON.stringify([r.body, W.committed(IDN(1)), a.at]));
  }
  {
    /* a stray whose draft was rejected meanwhile is left uncommitted, and a mark that did not land is said, never read as done */
    const B = mkBook(); await B.load();
    const W = world([{ id: IDN(1), status: "approved" }, { id: IDN(2), status: "approved" }]); W.flag("book");
    const env = { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B.ns, SALT_LEDGER: W.D1 };
    await B.tap([sale(IDN(1), 1)]); await B.tap([sale(IDN(2), 2)]);
    await B.call("/compact", { method: "POST" });
    W.db.exec("UPDATE draft SET status='rejected' WHERE id='" + IDN(2) + "'");
    const r = await hit("/book/compact", { env });
    ok(r.status === 200 && W.committed(IDN(1)) && W.committed(IDN(2)) === null, "a draft rejected after its entry closed is not marked committed: " + JSON.stringify([r.body, W.committed(IDN(1)), W.committed(IDN(2))]));
    const B2 = mkBook(); await B2.load();
    const W2 = world([{ id: IDN(1), status: "approved" }]); W2.flag("book");
    await B2.tap([sale(IDN(1), 1)]); await B2.call("/compact", { method: "POST" });
    const lost = { ...W2.D1, batch: (list) => list.map(() => ({ meta: { changes: 0 } })) };
    const r2 = await hit("/book/compact", { env: { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: B2.ns, SALT_LEDGER: lost } });
    ok(r2.status === 500 && r2.body.ok === false && r2.body.left === 1 && /still uncommitted/.test(r2.body.error), "a mark that did not land fails the run with the count left, never reads as done: " + JSON.stringify(r2.body));
  }

  /* 2b: Fable's review of 29 Oct 2026, each a way the compaction's marks could cost money */
  {
    const { compactAndMark } = await import("../src/book-compact.js");
    const adm = (W, id, state = "accepted") => W.db.prepare("INSERT INTO input_admission (id,fingerprint,resource,amount,snapshot,entry,state) VALUES (?,?,?,?,?,?,?)").run(id, "f" + id, "loan:l1", 5, "book@1", "{}", state);
    const admState = (W, id) => (W.db.prepare("SELECT state FROM input_admission WHERE id=?").get(id) || {}).state;
    /* a reward unit or a loan repayment held against its balance is released when its draft is committed, here as the fold's own mark does it */
    {
      const B = mkBook(); await B.load();
      const W = world([{ id: IDN(1), status: "approved" }, { id: IDN(2), status: "approved" }]); W.flag("book");
      adm(W, IDN(1)); adm(W, "2031-01-09T00:00:00.000Z");
      const env = { BOOK: B.ns, SALT_LEDGER: W.D1 };
      await B.tap([sale(IDN(1), 1)]); await B.tap([sale(IDN(2), 2)]);
      const r = await compactAndMark(env);
      ok(r.ok && admState(W, IDN(1)) === "committed" && admState(W, "2031-01-09T00:00:00.000Z") === "accepted", "an admission held for a closed draft is released, and an admission for a draft the compaction did not close is left alone: " + JSON.stringify([r.ok, admState(W, IDN(1)), admState(W, "2031-01-09T00:00:00.000Z")]));
    }
    /* a compaction the Book refuses leaves every draft and admission as it found it */
    {
      const B = mkBook(); await B.load();
      const W = world([{ id: IDN(1), status: "approved" }, { id: IDN(2), status: "approved", committed: "2026-01-01T00:00:00.000Z" }]); W.flag("book");
      adm(W, IDN(1));
      const refusing = { idFromName: (n) => n, get: () => ({ fetch: (r) => (new URL(r.url).pathname === "/compact" && !r.url.includes("dry=1") ? Promise.resolve(Response.json({ ok: false, error: "refused" }, { status: 409 })) : B.b.fetch(r)) }) };
      await B.tap([sale(IDN(1), 1)]); await B.tap([sale(IDN(2), 2)]);
      const r = await compactAndMark({ BOOK: refusing, SALT_LEDGER: W.D1 });
      ok(!r.ok && r.status === 409 && W.committed(IDN(1)) === null && admState(W, IDN(1)) === "accepted" && W.committed(IDN(2)) === "2026-01-01T00:00:00.000Z", "a refused compaction takes back the marks this run made (the draft and its admission) and leaves a draft committed before it alone: " + JSON.stringify([r, W.committed(IDN(1)), admState(W, IDN(1)), W.committed(IDN(2))]));
    }
    /* the Worker's clock ahead of the Book's: the closed drafts are brought back to the base's moment */
    {
      const B = mkBook(); await B.load();
      const W = world([{ id: IDN(1), status: "approved" }]); W.flag("book");
      await B.tap([sale(IDN(1), 1)]);
      const r = await compactAndMark({ BOOK: B.ns, SALT_LEDGER: W.D1 }, { now: "2099-01-01T00:00:00.000Z" }), a = await B.at();
      const way = W.db.prepare("SELECT COUNT(*) AS n FROM draft WHERE " + onItsWay(boundOf({ at: a.at, booked: a.booked }))).get().n;
      ok(r.ok && W.committed(IDN(1)) <= a.at && way === 0, "a Worker clock ahead of the Book's leaves no closed draft marked after the base's moment, so none counts twice: " + JSON.stringify([W.committed(IDN(1)), a.at, way]));
    }
    /* a tap that lands between the check and the compaction is not sealed into the base */
    {
      const B = mkBook(); await B.load();
      const W = world([{ id: IDN(1), status: "approved" }, { id: IDN(5), status: "pending" }]); W.flag("book");
      await B.tap([sale(IDN(1), 1)]);
      B.me.hook = () => { B.b.tap({ items: [sale(IDN(5), 9)], day: "2031-01-02", v: V }); };
      const r = await compactAndMark({ BOOK: B.ns, SALT_LEDGER: W.D1 }), a = await B.at();
      ok(!r.ok && r.status === 409 && /booked since/.test(r.error) && a.booked.length === 2 && W.committed(IDN(1)) === null, "an entry booked after its draft was checked refuses the compaction, which seals nothing and takes its marks back: " + JSON.stringify([r.status, r.error, a.booked.length, W.committed(IDN(1))]));
      B.me.hook = null;
      const direct = await B.call("/compact", { method: "POST", body: JSON.stringify({ expect: [IDN(1)] }) }), plain = await B.call("/compact?dry=1", { method: "POST" });
      ok(direct.status === 409 && direct.fresh && direct.fresh.join() === IDN(5) && plain.ok, "the Book itself names the entry it was not told of, and a caller that names none is as it was");
    }
  }

  /* 3: the dispatch */
  {
    const fetchLog = [], realF = globalThis.fetch, realL = console.log;
    const T0 = "2026-10-28T02:02:00.000Z", tick = async (W, min, extra = {}) => {
      fetchLog.length = 0; const waits = [];
      globalThis.fetch = async (u, o) => { if (/cloud-commit\.yml\/dispatches$/.test(String(u))) { fetchLog.push(JSON.parse(o.body)); return new Response(null, { status: 204 }); } return new Response("{}", { status: 404 }); };
      console.log = () => { };
      try {
        const kv = new Map(); const env = { SALT_LEDGER: W.D1, SALT_QUEUE: { get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null), put: async (k, v) => { kv.set(k, v); } }, REQUIRE_ACCESS: "0", SALT_GITHUB_TOKEN: "ghp-test", ...extra };
        await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.parse(T0) + min * 60000 }, env, { waitUntil: (p) => waits.push(p) });
        for (let n = -1; n !== waits.length;) { n = waits.length; await Promise.allSettled(waits); }
      } finally { globalThis.fetch = realF; console.log = realL; }
      return fetchLog.length;
    };
    const W = world([{ id: "2026-10-28T02:00:00.000Z", status: "approved", decided: T0 }]);
    ok(await tick(W, 15) === 1, "with git as the source an approval still uncommitted is dispatched again at 15 minutes (the ladder is as it was)");
    const W2 = world([{ id: "2026-10-28T02:00:00.000Z", status: "approved", decided: T0 }]); W2.flag("book");
    ok(await tick(W2, 15) === 0 && await tick(W2, 30) === 0 && await tick(W2, 60) === 0, "with the Book as the source the ladder rings nothing: an approved row waits for no fold");
    /* an approval's own dispatch */
    const approve = async (W, id) => {
      fetchLog.length = 0; const jobs = [];
      globalThis.fetch = async (u, o) => { if (/cloud-commit\.yml\/dispatches$/.test(String(u))) { fetchLog.push(JSON.parse(o.body)); return new Response(null, { status: 204 }); } return new Response("{}", { status: 404 }); };
      console.log = () => { };
      try {
        const res = await worker.fetch(new Request("https://salt.test/drafts/" + encodeURIComponent(id) + "/approve", { method: "POST", headers: { "X-Salt-Key": "wk", "content-type": "application/json" }, body: JSON.stringify({ by: "phone" }) }),
          { SALT_LEDGER: W.D1, SALT_QUEUE: { get: async () => null, put: async () => { } }, REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", SALT_GITHUB_TOKEN: "ghp-test" }, { waitUntil: (p) => jobs.push(p) });
        await Promise.allSettled(jobs); return { status: res.status, sent: fetchLog.slice() };
      } finally { globalThis.fetch = realF; console.log = realL; }
    };
    const P = world([]);
    P.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,flags) VALUES (?,?,?,?,?,?,?,?,?)").run("2026-10-28T09:30:00.000Z", "pending", "sales",
      JSON.stringify({ at: "2026-10-28T09:30:00.000Z", raw: "Sell 1 unit to CH4-MAL for RM 110" }), JSON.stringify({ date: "2026-10-28", customer: "CH4-MAL", qty: 1, total: 110, cash: 110 }), "fixture", "test", "2026-10-28T09:30:00.000Z", "[]");
    const a1 = await approve(P, "2026-10-28T09:30:00.000Z");
    ok(a1.status === 200 && a1.sent.length === 1 && a1.sent[0].inputs.reason === "approval" && a1.sent[0].inputs.stage_only === "true", "with git as the source an approval dispatches the stage under the reason approval: " + JSON.stringify(a1));
    const P2 = world([]); P2.flag("book");
    P2.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at,flags) VALUES (?,?,?,?,?,?,?,?,?)").run("2026-10-28T09:31:00.000Z", "pending", "sales",
      JSON.stringify({ at: "2026-10-28T09:31:00.000Z", raw: "Sell 1 unit to CH4-MAL for RM 110" }), JSON.stringify({ date: "2026-10-28", customer: "CH4-MAL", qty: 1, total: 110, cash: 110 }), "fixture", "test", "2026-10-28T09:31:00.000Z", "[]");
    const a2 = await approve(P2, "2026-10-28T09:31:00.000Z");
    ok(a2.status === 200 && a2.sent.length === 1 && a2.sent[0].inputs.reason === "publish: approval" && a2.sent[0].inputs.stage_only === "true", "with the Book as the source it asks for the publish alone, and the run's name says so: " + JSON.stringify(a2));
  }

  /* 4: the laptop */
  {
    const { sourceFrom, guardVerdict } = await import("../tools/source-flag.mjs");
    const set = (rows, extra = {}) => ({ code: 0, out: JSON.stringify([{ results: rows, success: true, ...extra }]) });
    ok(sourceFrom(set([{ mode: "d1" }])).mode === "d1" && sourceFrom(set([{ mode: "book" }])).mode === "book" && sourceFrom(set([])).mode === "d1" && sourceFrom(set([{ mode: "other" }])).mode === "d1", "the reader gives d1 for d1, an empty row and any other word, and book only for book");
    const nt = sourceFrom({ code: 1, out: JSON.stringify({ error: { text: "D1_ERROR: no such table: book_source: SQLITE_ERROR" } }) });
    const down = sourceFrom({ code: 1, out: JSON.stringify({ error: { text: "A request to the Cloudflare API failed. (7403)" } }) });
    ok(nt.mode === "d1" && down.mode === null && /7403/.test(down.error), "a store before the migration is d1, and a store that will not answer is unknown, never d1: " + JSON.stringify([nt, down]));
    ok(guardVerdict({ mode: "d1" }, "x").ok === true && guardVerdict({ mode: "book" }, "drafts.mjs --approve").ok === false && /Book is the source/.test(guardVerdict({ mode: "book" }, "drafts.mjs --approve").why) && guardVerdict({ mode: null, error: "boom" }, "x").ok === false && /would not say/.test(guardVerdict({ mode: null, error: "boom" }, "x").why), "the verdict lets d1 through and refuses the Book and a flag it could not read, each in its own words");
    const bin = mkdtempSync(join(tmpdir(), "salt-npx-"));
    try {
      writeFileSync(join(bin, "shim.mjs"), "import{readFileSync}from'node:fs';const f=process.argv.join(' ').includes('book_source')&&process.env.SHIM_FLAG_OUT;process.stdout.write(readFileSync(f||process.env.SHIM_OUT,'utf8'));process.exit(+(f?process.env.SHIM_FLAG_CODE:process.env.SHIM_CODE)||0);\n");
      writeFileSync(join(bin, "npx.cmd"), "@node \"%~dp0shim.mjs\" %*\r\n");
      writeFileSync(join(bin, "npx"), "#!/bin/sh\nexec node \"$(dirname \"$0\")/shim.mjs\" \"$@\"\n");
      chmodSync(join(bin, "npx"), 0o755);
      const tool = (file, args, out, code = 0, flag = null) => {
        const f = join(bin, "out.txt"); writeFileSync(f, out); const g = join(bin, "flag.txt"); if (flag) writeFileSync(g, flag.out);
        const r = spawnSync(process.execPath, [join(REPO, "tools", file), ...args], { cwd: REPO, encoding: "utf8", timeout: 60000,
          env: { ...process.env, PATH: bin + delimiter + process.env.PATH, Path: bin + delimiter + (process.env.Path || process.env.PATH), SHIM_OUT: f, SHIM_CODE: String(code), ...(flag ? { SHIM_FLAG_OUT: g, SHIM_FLAG_CODE: String(flag.code) } : {}) } });
        return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
      };
      const BOOKS = JSON.stringify([{ results: [{ mode: "book" }], success: true }]), D1S = JSON.stringify([{ results: [{ mode: "d1" }], success: true }]);
      const REF = JSON.stringify({ error: { text: "A request to the Cloudflare API failed. (7403)" } });
      const ap = tool("drafts.mjs", ["--approve", "2026-10-28T09:00:00.000Z", "--by", "test"], BOOKS);
      ok(ap.status === 3 && /REFUSED/.test(ap.out) && /Book is the source/.test(ap.out) && !/approved \(/.test(ap.out), "drafts.mjs --approve is refused with the Book as the source, and approves nothing: " + ap.status + " " + ap.out.slice(0, 140));
      const ap2 = tool("drafts.mjs", ["--approve", "2026-10-28T09:00:00.000Z", "--by", "test"], REF, 1);
      ok(ap2.status === 3 && /REFUSED/.test(ap2.out) && /would not say/.test(ap2.out), "and refused when the flag cannot be read: " + ap2.status + " " + ap2.out.slice(0, 140));
      const ap3 = tool("drafts.mjs", ["--approve", "2026-10-28T09:00:00.000Z", "--by", "test"], D1S);
      ok(ap3.status !== 3 && !/REFUSED/.test(ap3.out), "and not refused with git as the source (it goes on to its own checks): " + ap3.status + " " + ap3.out.slice(0, 100));
      const ad = tool("drafts.mjs", ["--approved"], BOOKS);
      ok(ad.status === 0 && /"count": 0/.test(ad.out) && /"source": "book"/.test(ad.out) && /"held"/.test(ad.out) && !/"approved": \[\s*\{/.test(ad.out), "--approved stages nothing with the Book as the source and says what is held: " + ad.out.slice(0, 120).replace(/\s+/g, " "));
      const ad2 = tool("drafts.mjs", ["--approved"], JSON.stringify([{ results: [], success: true }]), 0, { out: REF, code: 1 });
      ok(ad2.status !== 0 && !/"ok": true/.test(ad2.out) && /7403/.test(ad2.out), "--approved stops when the flag cannot be read, though the rows could be: " + ad2.status + " " + ad2.out.slice(0, 120).replace(/s+/g, " "));
      const up = tool("update.mjs", [], BOOKS);
      ok(up.status === 3 && /REFUSED/.test(up.out) && /update\.mjs/.test(up.out) && !/PREFLIGHT/i.test(up.out), "update.mjs is refused with the Book as the source before its preflight: " + up.status + " " + up.out.slice(0, 120));
      const sd = tool("d1.mjs", ["--seed"], BOOKS), sd2 = tool("d1.mjs", ["--seed"], REF, 1);
      ok(sd.status === 3 && /REFUSED/.test(sd.out) && /d1.mjs --seed/.test(sd.out) && sd2.status === 3, "the hand seed of the mirror is refused with the Book as the source, and when the flag cannot be read: " + [sd.status, sd2.status]);
      const up2 = tool("update.mjs", [], REF, 1);
      ok(up2.status === 3 && /REFUSED/.test(up2.out), "and when the flag cannot be read");
      const sf = tool("source-flag.mjs", [], BOOKS), sf2 = tool("source-flag.mjs", ["--refuse", "a road"], D1S), sf3 = tool("source-flag.mjs", [], REF, 1);
      ok(sf.status === 0 && /source=book/.test(sf.out) && sf2.status === 0 && /old world stands/.test(sf2.out) && sf3.status === 1 && /::error::/.test(sf3.out), "the flag tool prints the source, passes --refuse on d1, and fails the chain's step when D1 will not say: " + [sf.status, sf2.status, sf3.status]);
    } finally { rmSync(bin, { recursive: true, force: true }); }
  }

  /* 5: the import flag on the laptop's load */
  {
    const { post } = await import("../tools/book-load.mjs");
    const urls = []; const fetchImpl = async (u) => { urls.push(String(u)); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
    await post("https://x.test/", "{}", { SALT_BOOK_KEY: "k" }, { fetchImpl });
    await post("https://x.test/", "{}", { SALT_BOOK_KEY: "k" }, { fetchImpl, importing: true });
    ok(urls[0] === "https://x.test/book/load" && urls[1] === "https://x.test/book/load?import=1", "a plain post names no import and --import names one: " + urls.join(" "));
  }

  /* 6: the chain */
  {
    const yml = readFileSync(join(REPO, ".github", "workflows", "cloud-commit.yml"), "utf8").replace(/\r\n/g, "\n");
    const step = (name) => { const i = yml.indexOf("      - name: " + name + "\n"); if (i < 0) return null; const j = yml.indexOf("\n      - ", i + 10); const k = yml.indexOf("\n  suite:", i); return yml.slice(i, Math.min(...[j, k].filter((x) => x > 0))); };
    const src = step("Which store is the source of the ledger");
    ok(!!src && /id: source/.test(src) && /node tools\/source-flag\.mjs --github/.test(src) && yml.indexOf("id: source") < yml.indexOf("id: guard") && !/continue-on-error/.test(src) && /CLOUDFLARE_API_TOKEN/.test(src), "one step reads the flag first, fail closed (a flag D1 will not say stops the run)");
    const dependent = ["Stand down if the last batch is still unfolded", "Re-seed the mirror from the master just shipped", "Load the shadow Book from the book just shipped", "Check the readers agree", "Check the Book builds the same statements"];
    const bad = dependent.filter((n) => !/steps\.source\.outputs\.mode != 'book'/.test((step(n) || "").split("\n").find((l) => /^\s+if:/.test(l)) || ""));
    ok(bad.length === 0, "the stage's guard, the mirror's re-seed, the shadow load and both comparisons stand down while the Book is the source: " + (bad.join(", ") || "all five"));
    const keep = ["Deploy", "Gate", "Publish the statements, live", "Check the engine prices as the page did"].filter((n) => /mode != 'book'/.test((step(n) || "").split("\n").find((l) => /^\s+if:/.test(l)) || ""));
    ok(keep.length === 0, "and the deploy, the gate, the publish and the pricing parity still run: " + (keep.join(", ") || "none stood down"));
  }
}
