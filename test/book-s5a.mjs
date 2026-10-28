/* test/book-s5a.mjs: S5a AND S5c OF THE BOOK PLAN, THE BOOK'S REVISION, ITS COMPACTION AND ITS EXPORT (28 Oct 2026; Fable's review of 28 Oct applied). Nothing here is read by a law or a reader:
 * the revision is carried and logged, the compaction is rehearsed (dry) on every fold and run for real only at the flip, and the export is a sealed copy in R2. Each check is red under its own
 * mutation (test/book-s5a.mutations.json):
 *   1  the revision: moves with a load that changed something, a tap that booked, a void that took one back, a compaction; not with an idempotent load, a tap seen again, a refused tap or
 *      a void of nothing; carried by /at; a Book that held a snapshot before S5a gains the column at 0; never decreases
 *   2  compaction: the Book's own view becomes the base by the load's own path with every open entry closed; dry writes nothing; the view is unchanged by it; the entries are kept; a stuck
 *      entry, a row it would lose and a row it would change each refuse the whole thing and leave the Book as it was
 *   3  the event log: every entry, open, folded or voided, in booked order, as staged
 *   4  the export: the base, the whole log and the revision, sealed to the backup key, read back, pruned to 30, remembered, and heard of when it stops; opened by the laptop's tool
 *   5  the readcheck names the revision and says whether compaction would hold, and goes red when it would not; the minute job runs the export beside the backup */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, canon, prepare, COLLECTIONS } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const mk = (env = {}, os = objectState()) => {
    const b = new Book(os, env); let t = 0;
    b.clock = () => "2026-10-28T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    const post = (path, body) => call(path, { method: "POST", body: JSON.stringify(body || {}) });
    const load = async (book = fb(), over = {}, q = "") => (await b.fetch(new Request("https://book/load" + q, { method: "POST", body: JSON.stringify({ rev: "r", book, pricing: { ...pricing, v: over.v || V }, derived, v: V, stamped: AT_STAMP, ...over }) }))).json();
    const tap = (items, extra = {}) => post("/tap", { items, day: T(2), v: V, ...extra });
    const read = (q = "") => call("/read" + q);
    const at = () => call("/at");
    return { os, b, call, post, load, tap, read, at };
  };
  const sale = (id, qty, d, extra) => ({ id, status: "approved", collection: "sales", row: Object.assign({ customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra || {}) });
  const count = (id, q, d) => ({ id, status: "approved", collection: "count", row: { product: "salt", qty: q, date: d } });
  const tr = (id, product, extra) => sale(id, 1, T(5), Object.assign({ trip: "t1791900000099", product, cash: 0, deliveredQty: 0, total: 100 }, extra || {}));
  /* S5f-2: a compaction moves the base's QUEUE_COMMITTED to the newest id it closes (test/s5f-compact-mark.mjs), so "the view is unchanged" is read without that one watermark */
  const body = (r) => JSON.stringify({ rows: canon(r.rows), state: canon({ ...r.state, QUEUE_COMMITTED: undefined }) });
  const baseTables = (B) => JSON.stringify([B.os.db.prepare("SELECT coll,key,h,seq,booked_at,revised_at,gone_at FROM rows ORDER BY coll,key").all(), B.os.db.prepare("SELECT k,h,booked_at,revised_at FROM state ORDER BY k").all()]);
  const open = (B) => B.os.db.prepare("SELECT COUNT(*) AS c FROM booked WHERE folded_at IS NULL AND voided_at IS NULL").get().c;

  /* 1: the revision */
  const A = mk(); await A.load();
  const r1 = (await A.at()).rev;
  ok(Number.isInteger(r1) && r1 >= 1, "a first load that added rows moves the revision off 0: " + r1);
  await A.load();
  ok((await A.at()).rev === r1, "an idempotent load of the same book does not move it");
  const grown = fb(); grown.sales.push({ rid: "s9998", customer: "ZZ2-BBB", date: T(1), qty: 1, total: 55, cash: 55, deliveredQty: 1, product: "salt", note: "x" });
  const l2 = await A.load(grown);
  ok((await A.at()).rev === r1 + 1 && l2.bookRev === r1 + 1, "a load that changed a row moves it by one, and the load's answer says where it stands: " + JSON.stringify([l2.bookRev, (await A.at()).rev]));
  const s1 = sale(IDN(1), 2, T(2));
  await A.tap([s1]);
  ok((await A.at()).rev === r1 + 2, "a tap that booked an entry moves it");
  await A.tap([s1]);
  const tw = fb().sales[fb().sales.length - 1];
  const twin = sale(IDN(6), +tw.qty, tw.date, { customer: tw.customer, total: tw.total, product: tw.product || "salt", cash: 0, deliveredQty: 0 });
  const refused = await A.tap([twin]);
  ok(refused.status === 409 && (await A.at()).rev === r1 + 2, "a tap seen again, and a tap the law refuses, move nothing");
  const v1 = await A.post("/void", { ids: [IDN(1)] });
  ok(v1.voided === 1 && (await A.at()).rev === r1 + 3, "a void that took an entry back moves it");
  await A.post("/void", { ids: [IDN(1)] });
  ok((await A.at()).rev === r1 + 3, "a void of nothing does not");
  const oldOs = objectState();
  oldOs.db.exec("CREATE TABLE snap (one INTEGER PRIMARY KEY CHECK (one = 1), v TEXT NOT NULL, stamped TEXT, at TEXT NOT NULL)");
  oldOs.db.exec("INSERT INTO snap (one, v, stamped, at) VALUES (1, 'v1250', 's', '2026-10-01T00:00:00.000Z')");
  const OLD = mk({}, oldOs);
  let oldRev = "threw"; try { oldRev = (await OLD.at()).rev; } catch (e) { oldRev = "threw: " + e.message; }
  ok(oldRev === 0, "a Book that held a snapshot before S5a gains the column and reads revision 0: " + oldRev);
  const rv = (await A.at()).rev;
  await A.load(grown, { v: "v1251" });
  ok((await A.at()).rev === rv, "a load the Book refuses as older moves nothing");

  /* 2: compaction */
  const C = mk(); await C.load();
  const items = [sale(IDN(1), 2, T(2)), count(IDN(2), 10.5, T(3)), tr(IDN(4), "salt", { delivery: 10 }), tr(IDN(5), "oil")];
  for (const it of items.slice(0, 2)) await C.tap([it]);
  await C.tap(items.slice(2));
  const viewBefore = await C.read(), baseA = baseTables(C), revBefore = (await C.at()).rev;
  const dry = await C.post("/compact?dry=1");
  ok(dry.ok && dry.dry && dry.compactable === 4 && baseTables(C) === baseA && open(C) === 4 && (await C.at()).rev === revBefore && body(await C.read()) === body(viewBefore),
    "a dry compaction says it would hold over the four open entries and writes nothing: base, entries, revision and view all as they were: " + JSON.stringify(dry));
  const before = new Map(C.os.db.prepare("SELECT coll, key, h FROM rows").all().map((r) => [r.coll + "|" + r.key, r.h]));
  const real = await C.post("/compact");
  const after = await C.read(), baseRead = await C.read("?base=1");
  ok(real.ok && real.compacted === 4 && open(C) === 0 && after.booked === undefined, "compaction closes the four open entries and the read is the base again: " + JSON.stringify({ ...real, readback: undefined, bookmark: undefined }));
  ok(body(after) === body(viewBefore) && body(baseRead) === body(viewBefore) && after.state.QUEUE_COMMITTED === IDN(5) && baseRead.state.QUEUE_COMMITTED === IDN(5), "the view is unchanged by it (its watermark moved to the newest closed id), and the base now holds every minted row (/read equals /read?base=1)");
  ok((await C.at()).rev === revBefore + 1 && real.bookRev === revBefore + 1, "it moves the revision once");
  const kept = C.os.db.prepare("SELECT coll, key, h, revised_at FROM rows WHERE gone_at IS NULL").all().filter((r) => before.has(r.coll + "|" + r.key));
  ok(kept.length === before.size && kept.every((r) => before.get(r.coll + "|" + r.key) === r.h && r.revised_at === null) && real.revised <= 10, "every row the base already held keeps its hash and is not revised by it (only the few documents the entries moved are; a broken round-trip would revise hundreds): " + real.revised);
  ok(real.closed.join() === items.map((i) => i.id).join() && dry.closed.join() === real.closed.join(), "it answers the draft ids it closed, in booked order, so the flip can mark exactly those committed: " + JSON.stringify(real.closed));
  const all = await C.call("/events?all=1");
  ok(all.entries.length === 4 && all.entries.every((e) => e.folded_at && !e.voided_at) && all.entries.map((e) => e.draft_id).join() === items.map((i) => i.id).join(), "the entries are kept, closed, in booked order: the event log survives it");
  const again = await C.post("/compact");
  ok(again.ok && again.compacted === 0 && (await C.at()).rev === revBefore + 1, "a second compaction finds nothing open and moves nothing");
  const more = await C.tap([sale(IDN(6), 1, T(6), { customer: "ZZ2-BBB" })]);
  ok(more.ok && more.booked.length === 1 && more.booked[0].rids.length === 1, "a tap after compaction books on the compacted base");
  const rids = new Set((await C.read("?base=1")).rows.sales.map((r) => r.rid));
  ok([...rids].length === (await C.read("?base=1")).rows.sales.length, "and no rid is held twice");

  /* a stuck entry is refused whole */
  const G = mk(); await G.load();
  const gs = sale(IDN(1), 2, T(2)); const gt = await G.tap([gs]);
  const stranger = fb(); stranger.sales.push({ rid: gt.booked[0].rids[0], customer: "ZZ2-BBB", date: T(1), qty: 1, total: 10, cash: 10, deliveredQty: 1, product: "salt", note: "x" });
  await G.load(stranger, { v: "v1253" });
  const gbase = baseTables(G), grev = (await G.at()).rev;
  const gc = await G.post("/compact");
  ok(gc.status === 409 && !gc.ok && /stuck/.test(gc.error) && baseTables(G) === gbase && open(G) === 1 && (await G.at()).rev === grev, "an entry the base can no longer take refuses compaction, and the Book is as it was: " + JSON.stringify(gc));

  /* strict: a row it would lose and a row it would change refuse the load and roll it back */
  const S = mk(); await S.load(); await S.tap([sale(IDN(1), 2, T(2))]);
  const snap = S.os.db.prepare("SELECT v, stamped FROM snap").get(), evs = S.b.events();
  const mkP = async (mut) => { const view = S.b.viewOf(S.b.events()); mut(view.book); const { PRICING, ...rest } = view.derived; return prepare(view.book, PRICING, { v: snap.v, stamped: snap.stamped, derived: rest }); };
  const sbase = baseTables(S), srev = (await S.at()).rev;
  const lose = await mkP((b) => b.sales.shift());
  let e1 = null; try { S.b.load(lose, "t", { folded: evs.map((e) => e.draft_id), pure: true, strict: true }); } catch (e) { e1 = e.message; }
  ok(/compaction refused/.test(e1 || "") && /"gone":[1-9]/.test(e1 || "") && baseTables(S) === sbase && open(S) === 1 && (await S.at()).rev === srev, "a compaction that would lose a row is refused and rolled back whole: " + e1);
  const spare = COLLECTIONS.find((c) => !["sales", "purchases", "loans"].includes(c) && (S.b.viewOf(S.b.events()).book[c] || []).length > 0);
  const lose2 = await mkP((b) => { b[spare].shift(); });
  let e4 = null; try { S.b.load(lose2, "t", { folded: evs.map((e) => e.draft_id), pure: true, strict: true }); } catch (e) { e4 = e.message; }
  ok(!!spare && /compaction refused/.test(e4 || "") && /"gone":[1-9]/.test(e4 || "") && !/"differ":\[[^\]]/.test(e4 || "") && baseTables(S) === sbase, "a row in a list the view check does not compare is lost: only the row-loss guard refuses it, and the load is rolled back: " + spare + " " + e4);
  const change = await mkP((b) => { const m = b.sales.find((r) => r.customer === "ZZ1-AAA" && r.date === T(2) && r.qty === 2); m.total = 999; });
  let e2 = null; try { S.b.load(change, "t", { folded: evs.map((e) => e.draft_id), pure: true, strict: true }); } catch (e) { e2 = e.message; }
  ok(/compaction refused/.test(e2 || "") && /differ/.test(e2 || "") && baseTables(S) === sbase && open(S) === 1, "a compaction that would change a row the entry minted is refused and rolled back: " + e2);
  const N = mk(); await N.load();
  let e3 = null; try { N.b.load(await prepare(fb(), pricing, { v: V, stamped: AT_STAMP, derived }), "t", { folded: [], pure: true, strict: true }); } catch (e) { e3 = e.message; }
  ok(/compaction refused/.test(e3 || ""), "a strict load with no entry to close is refused (it is not a compaction)");

  /* 4: the export */
  const E = mk(); await E.load(); await E.tap([sale(IDN(1), 2, T(2))]); await E.tap([count(IDN(2), 10.5, T(3))]); await E.post("/compact");
  await E.tap([sale(IDN(3), 1, T(4))]);
  const ex = await E.call("/export");
  ok(ex.ok && ex.rev === (await E.at()).rev && ex.base.rows.sales.length > 0 && ex.base.state && ex.entries.length === 3 && ex.entries.filter((e) => e.folded_at).length === 2 && ex.entries.filter((e) => !e.folded_at).length === 1 && ex.loads.length >= 1,
    "the export carries the base, the whole event log (two closed, one open), the revision and the loads: " + JSON.stringify({ rev: ex.rev, entries: ex.entries && ex.entries.length }));
  const T0 = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); T0.state.id = { equals: (o) => o === "book-pitr-test" };
  ok((await T0.fetch(new Request("https://book/export"))).status === 404 && (await T0.fetch(new Request("https://book/compact", { method: "POST" }))).status === 404 && (await mk().call("/export")).status === 503,
    "the recovery test's object answers neither verb, and a Book that has not loaded answers 503");
  const { runBookExport, bookExportAlarm, bookExportKeyFor, backupOpen, backupSeal, BOOKEXPORT_LAST } = await import("../src/backup.js");
  const { openBookExport } = await import("../tools/backup-open.mjs");
  const wc = globalThis.crypto, pair = await wc.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = JSON.stringify(await wc.subtle.exportKey("jwk", pair.publicKey));
  const bucket = () => { const m = new Map(), size = (s) => new TextEncoder().encode(s).length; return { m, put: async (k, v) => { m.set(k, v); }, head: async (k) => (m.has(k) ? { size: size(m.get(k)) } : null),
    list: async ({ prefix }) => ({ objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }), delete: async (ks) => { for (const k of [].concat(ks)) m.delete(k); } }; };
  const kv = () => { const m = new Map(); return { m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); } }; };
  const nsOf = (B) => ({ idFromName: (n) => n, get: () => ({ fetch: (r) => B.b.fetch(r) }) });
  const bk = bucket(), q = kv(), now = new Date("2026-10-28T18:30:00.000Z");
  const out = await runBookExport({ BACKUP: bk, BACKUP_PUBLIC_JWK: pub, BOOK: nsOf(E), SALT_QUEUE: q }, now);
  const objKey = bookExportKeyFor(now);
  ok(out.ok && out.key === objKey && objKey === "bookexport/2026-10-29.json" && bk.m.has(objKey) && out.entries === 3 && out.rev === ex.rev && (q.m.get(BOOKEXPORT_LAST) || "{}").includes('"ok":true'),
    "the nightly export files bookexport/<Kuala Lumpur date>.json, reads it back, and remembers the night: " + JSON.stringify(out));
  let opened = { book: { entries: [], base: { rows: { sales: [] }, state: {} } } }, openErr = null;
  try { opened = await openBookExport(pair.privateKey, JSON.parse(bk.m.get(objKey))); } catch (e) { openErr = e.message; }
  ok(!openErr && opened.book.entries.length === 3 && opened.book.rev === ex.rev && opened.book.base.rows.sales.length === ex.base.rows.sales.length && canon(opened.book.base.state) === canon(ex.base.state),
    "the laptop's tool opens it with the private key: the same base, the same log, the same revision");
  const noLog = await backupSeal(JSON.parse(pub), new TextEncoder().encode(JSON.stringify({ v: 1, at: "x", book: { base: { rows: {}, state: {} } } })));
  let eNo = null; try { await openBookExport(pair.privateKey, { v: 1, app: "salt-book-export", ...noLog }); } catch (e) { eNo = e.message; }
  let eApp = null; try { await openBookExport(pair.privateKey, { v: 1, app: "salt-backup", ...noLog }); } catch (e) { eApp = e.message; }
  ok(/no base or no event log/.test(eNo || "") && /not a salt-book-export/.test(eApp || ""), "the laptop refuses an export with no event log, and a D1 backup in its place");
  ok(!bk.m.get(objKey).includes("ZZ1-AAA") && !bk.m.get(objKey).includes("sales"), "and the object on Cloudflare is ciphertext: no code and no collection name in the clear");
  for (let d = 1; d <= 31; d++) bk.m.set("bookexport/2020-01-" + String(d).padStart(2, "0") + ".json", "{}");
  const pr = await runBookExport({ BACKUP: bk, BACKUP_PUBLIC_JWK: pub, BOOK: nsOf(E), SALT_QUEUE: q }, now);
  const left = [...bk.m.keys()].filter((k) => k.startsWith("bookexport/"));
  ok(pr.ok && left.length === 30 && left.includes(objKey) && pr.pruned === 2, "it keeps the newest 30 nights and never drops the night it just filed: " + left.length + " kept, " + pr.pruned + " pruned");
  ok([...bk.m.keys()].filter((k) => k.startsWith("backup/")).length === 0, "and never touches the D1 backups' prefix");
  const skip = await runBookExport({ BACKUP_PUBLIC_JWK: pub, BOOK: nsOf(E) }, now), noBook = await runBookExport({ BACKUP: bk, BACKUP_PUBLIC_JWK: pub }, now);
  ok(skip.skipped && /no bucket/.test(skip.why) && noBook.skipped && /no Book/.test(noBook.why), "with no bucket or no Book bound it does nothing and says so");
  const q2 = kv();
  const down = await runBookExport({ BACKUP: bk, BACKUP_PUBLIC_JWK: pub, BOOK: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response(JSON.stringify({ ok: false, error: "no snapshot" }), { status: 503 }) }) }, SALT_QUEUE: q2 }, now);
  ok(!down.ok && /would not export/.test(down.error) && (q2.m.get(BOOKEXPORT_LAST) || "{}").includes('"ok":false'), "a Book that will not export fails the night, and the failure is remembered");
  const badBucket = { ...bucket(), head: async () => ({ size: 1 }) };
  const short = await runBookExport({ BACKUP: badBucket, BACKUP_PUBLIC_JWK: pub, BOOK: nsOf(E), SALT_QUEUE: kv() }, now);
  ok(!short.ok && /read back/.test(short.error), "an object that reads back the wrong size fails the night");
  const al = (last, n) => { const k = kv(); if (last) k.m.set(BOOKEXPORT_LAST, JSON.stringify(last)); return bookExportAlarm({ BACKUP: bk, BOOK: {}, SALT_QUEUE: k }, n); };
  ok(await al(null, now) === "the Book export has never run" && /failed: boom/.test(await al({ ok: false, error: "boom", at: now.toISOString() }, now)) && /36 hours/.test(await al({ ok: true, at: "2026-10-26T00:00:00.000Z" }, now)) && await al({ ok: true, at: now.toISOString() }, now) === null
    && await bookExportAlarm({ SALT_QUEUE: kv() }, now) === null, "the morning digest hears of an export that never ran, failed, or is more than 36 hours old, and is quiet otherwise or with no bucket");

  /* 5: the readcheck and the minute job */
  const { buildSeed } = await import("../tools/d1.mjs");
  const worker = (await import("../src/worker.js")).default;
  const world = async (B) => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = fb();
    db.exec(buildSeed({ v: V, stamped: AT_STAMP, ledger: { ...bookless, PRICING: pricing, ...derived } }).sql);
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; }, first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } }; };
    const D1 = { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; }, batch(list) { return list.map((s) => ({ success: true, results: s.all().results })); } };
    return { db, D1 };
  };
  const RC = mk(); await RC.load(); await RC.tap([sale(IDN(1), 2, T(2))]);
  const W = await world(RC); W.db.exec("UPDATE book_read SET mode='book'");
  const rcall = async (ns, extra = {}) => (await worker.fetch(new Request("https://salt.test/book/readcheck", { headers: { "X-Book-Key": "bk" } }), { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: ns, SALT_LEDGER: W.D1, ...extra }, { waitUntil() {} })).json();
  const rcx = await rcall(nsOf(RC));
  ok(Number.isInteger(rcx.bookRev) && rcx.bookRev === (await RC.at()).rev && rcx.compact && rcx.compact.open === 1 && open(RC) === 1, "the readcheck names the Book's revision and says compaction would hold over the one open entry, and the rehearsal wrote nothing: " + JSON.stringify({ ok: rcx.ok, bookRev: rcx.bookRev, compact: rcx.compact, differ: rcx.differ }));
  const wrap = (answer) => ({ idFromName: (n) => n, get: () => ({ fetch: async (r) => (new URL(r.url).pathname === "/compact" ? new Response(JSON.stringify(answer), { status: 409 }) : RC.b.fetch(r)) }) });
  const rcf = await rcall(wrap({ ok: false, error: "a row would be lost" }));
  ok(rcf.ok === false && rcf.differ.some((d) => /compaction would be refused \(a row would be lost\)/.test(d)) && rcf.compact === null, "a compaction the Book would refuse turns the readcheck red and says why");
  const rcs = await rcall(wrap({ ok: false, error: "an entry is stuck", stuck: ["x"] }));
  ok(!rcs.differ.some((d) => /compaction/.test(d)), "a stuck entry is named once (as stuck), not again as a refused compaction");
  const { line } = await import("../tools/book-readcheck.mjs");
  ok(/Book rev 7/.test(line({ ok: true, version: "v1", bookVersion: "v1", mode: "book", rows: 3, bookRev: 7, compact: { open: 2 } })) && /compaction would hold over 2 open entries/.test(line({ ok: true, version: "v1", bookVersion: "v1", mode: "book", rows: 3, bookRev: 7, compact: { open: 2 } }))
    && !/rev/.test(line({ ok: true, version: "v1", bookVersion: "v1", mode: "book", rows: 3 })), "the chain's line carries the revision and the compaction, and is as it was without them");
  const { BACKUP_CRON } = await import("../src/backup.js");
  const cb = bucket(), cq = kv(), lines = [], was = console.log; console.log = (...a) => { lines.push(a.join(" ")); };
  const waits = [];
  try { await worker.scheduled({ cron: BACKUP_CRON, scheduledTime: Date.parse("2026-10-28T18:30:00.000Z") }, { BACKUP: cb, BACKUP_PUBLIC_JWK: pub, BOOK: nsOf(E), SALT_LEDGER: W.D1, SALT_QUEUE: cq }, { waitUntil(p) { waits.push(p); } }); await Promise.all(waits); } finally { console.log = was; }
  ok([...cb.m.keys()].some((k) => k.startsWith("bookexport/")) && lines.some((l) => /^book export: .*"ok":true/.test(l)), "the nightly job files the Book's export beside the backup, and says so in the log: " + J(lines.filter((l) => /book export/.test(l))));
  /* S5f-7 (Fable's review): the readcheck counts the entries taken back whose draft is not rejected, for the flip's gate */
  {
    const RV = mk(); await RV.load(); await RV.tap([sale(IDN(1), 2, T(2))]); await RV.post("/void", { ids: [IDN(1)] });
    const W2 = await world(RV);
    const rc2 = async () => (await worker.fetch(new Request("https://salt.test/book/readcheck", { headers: { "X-Book-Key": "bk" } }), { REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: nsOf(RV), SALT_LEDGER: W2.D1 }, { waitUntil() {} })).json();
    W2.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,'approved','sales','{}','{}','r','d','d')").run(IDN(1));
    const v1 = await rc2(); W2.db.exec("UPDATE draft SET status='rejected' WHERE id='" + IDN(1) + "'"); const v2 = await rc2();
    ok(v1.voidedUnrejected === 1 && v2.voidedUnrejected === 0, "the readcheck counts an entry taken back whose draft is still approved, and none once the draft is rejected: " + JSON.stringify([v1.voidedUnrejected, v2.voidedUnrejected]));
  }
  function J(v) { return JSON.stringify(v); }
}
