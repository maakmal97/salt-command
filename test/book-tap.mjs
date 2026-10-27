/* test/book-tap.mjs: S4a OF THE BOOK PLAN, THE BOOK BOOKS (27 Oct 2026; Fable's review of the design applied). Dormant: nothing in the Worker calls `tap` until S4d.
 * What is proved here, each check red under its own mutation (test/book-tap.mutations.json):
 *   1  a tap books an entry in the Book beside an untouched base: the rid is the next on the view, the answer is idempotent by draft id, `/read` is the view and
 *      `/read?base=1` the base, and the base tables are not written
 *   2  the view is what the fold makes: a sale, a count, an amendment and a two-row trip tapped one after another read as ENGINE_APPLY.applyBatch of the same entries on
 *      the same book (notes and the watermark aside); the engine's refusals (a twin) write nothing; a trip books every row or none
 *   3  what stays the fold's: a roster entry, a rename, a Counter trade naming a party the book lacks, and a trip with one such row
 *   4  a load keeps an open entry and replays it on the new base; an entry the load folds (by D1's word or by the rid it minted) closes, and the tap check names a fold that
 *      booked it differently; an entry the new base can no longer take is left out of the view and named `stuck`, and a tap then falls back
 *   5  the verbs answer on the live Book alone, a Book behind the mirror falls back, and void takes an open entry back
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, canon, tapDiffer, DRIFT_BOOKS, FOLD_ONLY } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "27 Oct 2026, 10:00 KL";
const T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const ENG = await import("../engine/apply.mjs");
  const { nextRid } = await import("../engine/rid.mjs"), { sortBook } = await import("../engine/sort.mjs");
  const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?s4a");
  const derived = { OPEN: { v: V, at: "2026-10-27T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-27", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };

  /* the Book over node:sqlite, a clock that moves one second a call, and a loader */
  const mk = (v = V, env = {}) => {
    const os = objectState(), b = new Book(os, env); let t = 0;
    b.clock = () => "2026-10-27T10:00:" + String(10 + t++).padStart(2, "0") + ".000Z";
    const post = (path, body) => b.fetch(new Request("https://book" + path, { method: "POST", body: JSON.stringify(body) }));
    const load = async (book = fb(), over = {}, q = "") => (await b.fetch(new Request("https://book/load" + q, { method: "POST", body: JSON.stringify({ rev: "r", book, pricing: { ...pricing, v: over.v || v }, derived, v, stamped: AT_STAMP, ...over }) }))).json();
    const tap = async (items, extra = {}) => { const r = await post("/tap", { items, day: T(2), v, ...extra }); return { status: r.status, ...(await r.json()) }; };
    const read = async (q = "") => (await b.fetch(new Request("https://book/read" + q))).json();
    const at = async () => (await b.fetch(new Request("https://book/at"))).json();
    return { os, b, load, tap, post, read, at };
  };
  const sale = (id, qty, d, extra) => ({ id, status: "approved", collection: "sales", row: Object.assign({ customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra || {}) });
  const count = (id, q, d) => ({ id, status: "approved", collection: "count", row: { product: "salt", qty: q, date: d } });
  const fulfil = (id, key, cash, d) => ({ id, status: "approved", collection: "sales", amends: key, amendKind: "Fulfilment", row: { cash, kg: 0, date: d }, entry: { at: id, payload: { mode: "amend", kind: "Fulfilment", amends: key, cash, kg: 0, date: d } } });
  /* what the fold makes of the same entries, on the same book: ENGINE_APPLY.applyBatch with the fold's own plan context */
  const folded = (rows, book = fb(), extra = {}) => {
    const st = { ok: true, count: rows.length, approved: rows };
    const nt = { version: "v9999", rows: Object.fromEntries(rows.map((r) => [r.id, { note: "n", ...(extra[r.id] || {}) }])) };
    return ENG.applyBatch(book, st, nt, Object.assign(Object.create(FOLD.planCtx), { nextRid, sortBook }));
  };
  const SKIP = ["NOTES", "QUEUE_COMMITTED"];
  const same = (a, b) => { const names = []; if (!a || !b) return ["no book"]; for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) if (!SKIP.includes(k)) { const x = a[k], y = b[k]; const key = (v) => Array.isArray(v) ? v.map((r) => canon(strip(r))).sort().join("|") : canon(strip(y === v ? v : v)); if (key(x) !== key(y)) names.push(k); } return names; };
  const strip = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v), (k, x) => (k === "note" ? undefined : x));
  const viewBook = async (B) => { const r = await B.read(), out = {}; for (const [k, v] of Object.entries(r.rows || {})) out[k] = v; for (const k of Object.keys(r.state.__arrays)) if (!(k in out)) out[k] = [];
    for (const [k, v] of Object.entries(r.state)) if (k !== "__arrays" && !["OPEN", "TERMS", "REWARD", "STOCK", "PRICING"].includes(k)) out[k] = v; return out; };
  const baseTables = (B) => JSON.stringify([B.os.db.prepare("SELECT coll,key,h,seq,booked_at,revised_at,gone_at FROM rows ORDER BY coll,key").all(), B.os.db.prepare("SELECT k,h,booked_at,revised_at FROM state ORDER BY k").all()]);

  /* 1: a tap books an entry beside an untouched base */
  const A = mk(); await A.load();
  const baseA = baseTables(A), plain = await A.read();
  ok(plain.booked === undefined && !("stuck" in plain) && (await A.at()).booked.length === 0, "with no open entry /read is the base byte for byte (no `booked` key) and /at names none");
  const maxS = Math.max(...frozen_s(fb()));
  function frozen_s(b) { return b.sales.map((r) => +String(r.rid).slice(1)).filter(Number.isFinite); }
  const s1 = sale(IDN(1), 2, T(2));
  const t1 = await A.tap([s1]);
  const expect = "s" + String(maxS + 1).padStart(3, "0");
  ok(t1.ok && t1.status === 200 && t1.booked.length === 1 && t1.booked[0].rids.join() === expect && t1.booked[0].seq === 1, "a tap books a sale at the next rid on the view: " + JSON.stringify(t1));
  const t1b = await A.tap([s1]);
  ok(t1b.ok && t1b.booked[0].again === true && t1b.booked[0].rids.join() === expect && t1b.booked[0].seq === 1 && A.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 1, "the same draft tapped again answers its own rids and books nothing more");
  const view1 = await A.read(), base1 = await A.read("?base=1");
  ok((view1.booked || []).join() === s1.id && view1.rows.sales.length === plain.rows.sales.length + 1 && view1.rows.sales.some((r) => r.rid === expect) && base1.rows.sales.length === plain.rows.sales.length && !("booked" in base1),
    "/read is the view with the entry named in `booked`, and /read?base=1 is the base alone");
  ok(baseTables(A) === baseA, "booking an entry writes neither the rows nor the documents: the base is a load's alone");
  ok((await A.at()).booked.join() === s1.id, "/at names the open entries from the same read");

  /* 2: the view is what the fold makes */
  const B = mk(); await B.load();
  const seq = [sale(IDN(1), 2, T(2)), count(IDN(2), 10.5, T(3)), fulfil(IDN(3), null, 0, T(4))];
  const target = fb().sales.find((r) => r.rid && E_openKey(r));
  function E_openKey(r) { const all = fb().sales; return (+r.total || 0) > 50 && !r.cancelled && !(+r.cash > 0) && !(+r.deliveredQty > 0) && all.filter((x) => ENG_key(x) === ENG_key(r)).length === 1; }
  seq[2] = fulfil(IDN(3), ENG_key(target), 50, T(4));
  function ENG_key(r) { return r.customer + "|" + r.date + "|" + r.total; }
  let allOk = true, last = null;
  for (const it of seq.slice(0, 2)) { const r = await B.tap([it]); allOk = allOk && r.ok && r.booked.length === 1; last = r; }
  const f2 = folded(seq.slice(0, 2)), v2 = await viewBook(B);
  ok(allOk && f2.ok && same(f2.book, v2).length === 0, "a sale then a count tapped one by one read as the fold's own batch of the two: " + JSON.stringify([allOk, f2.ok, f2.problems, same(f2.book, v2)]));
  const rv = await B.read();
  ok(rv.state.STATED_STOCK === 10.5 && f2.book.STATED_STOCK === 10.5, "the count tapped after the sale stands (10.5), in the view as in the fold");
  /* an amendment of a book row, and a two-row trip */
  const am = await B.tap([seq[2]]);
  const f3 = folded(seq), v3 = await viewBook(B);
  ok(am.ok && am.booked[0].rids.length === 0 && f3.ok && same(f3.book, v3).length === 0, "a fulfilment of a row on the book is booked with no rid and the view equals the fold's: " + JSON.stringify([am, f3.problems, same(f3.book, v3)]));
  const tr = (id, product, extra) => sale(id, 1, T(5), Object.assign({ trip: "t1791900000099", product, cash: 0, deliveredQty: 0, total: 100 }, extra || {}));
  const C = mk(); await C.load();
  const trip = [tr(IDN(4), "salt", { delivery: 10 }), tr(IDN(5), "oil")];
  const tt = await C.tap(trip), ft = folded(trip), vt = await viewBook(C);
  ok(tt.ok && tt.booked.length === 2 && tt.booked[0].rids[0] !== tt.booked[1].rids[0] && ft.ok && same(ft.book, vt).length === 0, "a trip of two rows books both in one tap and the view equals the fold's: " + JSON.stringify([tt, ft.problems, same(ft.book, vt)]));
  /* the view keeps the book's order: a row dated before the newest sits where the fold's sort puts it, not at the end */
  const OD = mk(); await OD.load();
  const early = sale(IDN(6), 1, "2026-06-30", { customer: "ZZ2-BBB" });
  await OD.tap([early]);
  const orderView = (await OD.read()).rows.sales.map((r) => r.rid).join(), orderFold = folded([early]).book.sales.map((r) => r.rid).join();
  ok(orderView === orderFold && orderView !== fb().sales.map((r) => r.rid).concat([expect]).join(), "an entry dated before the newest rows is placed in date order, as the fold's sort places it");
  const D = mk(); await D.load();
  const badTrip = await D.tap([tr(IDN(4), "salt", { delivery: 10 }), tr(IDN(5), "oil", { delivery: 5 })]);
  ok(!badTrip.ok && badTrip.status === 409 && badTrip.refused && badTrip.refused.length >= 1 && D.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0,
    "a trip with two deliveries is refused whole, the engine's own reason, and not one row of it is booked: " + JSON.stringify(badTrip));
  const E1 = mk(); await E1.load();
  const twinOf = fb().sales[fb().sales.length - 1];
  const twin = sale(IDN(6), +twinOf.qty, twinOf.date, { customer: twinOf.customer, total: twinOf.total, product: twinOf.product || "salt", cash: 0, deliveredQty: 0 });
  const tw = await E1.tap([twin]);
  ok(!tw.ok && tw.status === 409 && /replay/.test(JSON.stringify(tw.refused)) && E1.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0, "a twin of a booked row is refused by the plan and writes nothing: " + JSON.stringify(tw));

  /* 3: what stays the fold's */
  const F = mk(); await F.load();
  const ros = { id: IDN(7), status: "approved", collection: "roster", row: { code: "ZZ9-NEW", kind: "customer" } };
  const rn = { id: IDN(8), status: "approved", collection: "rename", row: { from: "ZZ1-AAA", to: "ZZ2-CCC" } };
  const ct = sale(IDN(9), 1, T(6), { customer: "ZZ7-NEW" }); ct.entry = { at: ct.id, makerRequest: "m1", payload: { mode: "new", party: "ZZ7-NEW" } };
  const fo = [await F.tap([ros]), await F.tap([rn]), await F.tap([ct]), await F.tap([sale(IDN(1), 1, T(7)), ros])];
  ok(fo.every((r) => r.ok && r.foldOnly && r.foldOnly.length >= 1 && !r.booked) && F.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0 && FOLD_ONLY.join() === "roster,rename",
    "a roster entry, a rename, a Counter trade naming an unknown party, and a trip holding one of them are the fold's: nothing booked: " + JSON.stringify(fo));

  /* 4: a load keeps an open entry, folds the ones the fold took, names the ones the base can no longer take */
  const G = mk(); await G.load();
  const gs = sale(IDN(1), 2, T(2)); const gt = await G.tap([gs]); const rid = gt.booked[0].rids[0];
  const other = { rid: "s9999", customer: "ZZ2-BBB", date: T(1), qty: 1, total: 55, cash: 55, deliveredQty: 1, product: "salt", note: "another fold's row" };
  const nb = fb(); nb.sales.push(other);
  const l2 = await G.load(nb, { v: "v1253" }, "");
  const v4 = await G.read(), ids4 = v4.rows.sales.map((r) => r.rid);
  ok(l2.ok && l2.tap && l2.tap.open === 1 && l2.tap.folded === 0 && (v4.booked || []).join() === gs.id && ids4.includes(rid) && ids4.includes("s9999"), "a load that does not carry the entry keeps it open and replays it on the new base: " + JSON.stringify(l2.tap));
  /* the fold took it: the new base holds the row under the rid the tap minted, notes written */
  const folded1 = folded([gs]).book; const withRow = structuredClone(folded1); withRow.sales = withRow.sales.map((r) => r.rid === rid ? { ...r, note: "the fold's note" } : r);
  const G2 = mk(); await G2.load(); await G2.tap([gs]);
  const l3 = await G2.load(withRow, { v: "v1253" });
  ok(l3.ok && l3.tap.folded === 1 && l3.tap.open === 0 && l3.tap.differ.length === 0 && (await G2.read()).booked === undefined, "a load whose base holds the entry's rid closes it by that fact alone, and the view is the base again: " + JSON.stringify(l3.tap));
  const G3 = mk(); await G3.load(); await G3.tap([gs]);
  const l4 = await G3.load(fb(), { v: "v1253" }, "?folded=" + encodeURIComponent(gs.id));
  ok(l4.ok && l4.tap.folded === 1, "an entry D1 says is committed is closed by the load that says so (`folded`)");
  const bad = structuredClone(withRow); bad.sales = bad.sales.map((r) => r.rid === rid ? { ...r, total: 999 } : r);
  const G4 = mk(); await G4.load(); await G4.tap([gs]);
  const l5 = await G4.load(bad, { v: "v1253" });
  ok(l5.ok && l5.tap.folded === 1 && l5.tap.differ.join() === rid, "a fold that booked the row differently (another total) is named by the tap check: " + JSON.stringify(l5.tap));
  /* the stock documents are compared only when the batch was nothing but entries (`pure`) */
  const cs = count(IDN(2), 4, T(3)), G5 = mk(); await G5.load(); await G5.tap([cs]);
  const wrongStock = folded([cs]).book; wrongStock.STATED_STOCK = 7;
  const impure = await G5.load(wrongStock, { v: "v1253" }, "?folded=" + encodeURIComponent(cs.id));
  const G6 = mk(); await G6.load(); await G6.tap([cs]);
  const pure = await G6.load(wrongStock, { v: "v1253" }, "?pure=1&folded=" + encodeURIComponent(cs.id));
  ok(impure.tap.differ.length === 0 && pure.tap.differ.join() === "STATED_STOCK", "a fold that rolled the stock otherwise is named only when the batch was all entries: " + JSON.stringify([impure.tap, pure.tap]));
  /* an entry the new base cannot take: a twin of its row landed under another rid */
  const H = mk(); await H.load(); const hs = sale(IDN(1), 2, T(2)); await H.tap([hs]);
  const tb = fb(); tb.sales.push({ rid: "s9998", customer: hs.row.customer, date: hs.row.date, qty: 2, total: 200, cash: 200, deliveredQty: 2, product: "salt", note: "x" });
  const lh = await H.load(tb, { v: "v1253" }), vh = await H.read();
  ok(lh.ok && lh.tap.stuck.join() === hs.id && vh.booked.length === 0 && vh.stuck.join() === hs.id && !vh.rows.sales.some((r) => r.rid === "s9999"), "an entry the new base refuses is left out of the view and of `booked` and named `stuck`; the read still answers: " + JSON.stringify(lh.tap));
  const after = await H.tap([sale(IDN(3), 1, T(8))]);
  ok(!after.ok && after.fallback === true && after.stuck && after.stuck.join() === hs.id, "a tap with an entry stuck falls back (the caller approves as today) and books nothing");

  /* 5: the verbs, a Book behind, void */
  const probe = async (b, path, method = "GET", body) => (await b.fetch(new Request("https://book" + path, { method, body: body === undefined ? undefined : JSON.stringify(body) }))).status;
  const TB = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); TB.state.id = { equals: (o) => o === "book-pitr-test" };
  const LB = new Book(objectState(), { BOOK: { idFromName: (n) => n } }); LB.state.id = { equals: (o) => o === "live" };
  const payload = { items: [sale(IDN(1), 1, T(2))], day: T(2) };
  ok((await probe(TB, "/tap", "POST", payload)) === 404 && (await probe(TB, "/void", "POST", { ids: [IDN(1)] })) === 404 && (await probe(TB, "/events")) === 404
    && (await probe(LB, "/tap", "POST", payload)) === 404 && (await probe(LB, "/events")) === 404, "the recovery test's object and the live-socket object answer none of tap, void or events");
  const wsrc = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(!/"\/book\/(tap|void|events)"|\/book\/tap|\/book\/void/.test(wsrc), "the Worker has no route for tap, void or events (S4d reaches them through the binding)");
  const empty = mk(); const noSnap = await empty.tap([sale(IDN(1), 1, T(2))]);
  ok(!noSnap.ok && noSnap.fallback === true && noSnap.status === 503, "a Book with no snapshot falls back");
  const behind = mk("v1252"); await behind.load();
  const bt = await behind.tap([sale(IDN(1), 1, T(2))], { v: "v1253" });
  ok(!bt.ok && bt.fallback === true && bt.behind === true && behind.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0, "a Book behind the mirror's version falls back and books nothing");
  const bad1 = await A.post("/tap", { items: [{ id: "x", status: "approved", collection: "sales" }], day: T(2) });
  const bad2 = await A.post("/tap", { items: [sale(IDN(1), 1, T(2))], day: "today" });
  ok(bad1.status === 400 && bad2.status === 400, "a malformed item or day is a 400");
  const V1 = mk(); await V1.load(); const vs = sale(IDN(1), 1, T(2)); await V1.tap([vs]);
  const vd = await (await V1.post("/void", { ids: [vs.id] })).json();
  const vr = await V1.read();
  ok(vd.ok && vd.voided === 1 && vr.booked === undefined && (await (await V1.post("/void", { ids: [vs.id] })).json()).voided === 0, "void takes an open entry back once, and the view is the base again");
  const re = await V1.tap([vs]);
  ok(re.ok && !re.booked[0].again && V1.os.db.prepare("SELECT COUNT(*) AS c FROM booked WHERE draft_id=?").get(vs.id).c === 2, "a draft voided and tapped again is booked afresh, the voided entry kept");
  /* the lift: the engine files carry no fs, the rid minter and the sort are the tools' own */
  const toolRid = await import("../tools/rid.mjs"), toolSort = await import("../tools/sort-ledger.mjs");
  ok(toolRid.nextRid === nextRid && toolSort.sortBook === sortBook && !["engine/rid.mjs", "engine/sort.mjs", "engine/apply.mjs"].some((f) => /node:fs|src\/drafter/.test(readFileSync(join(REPO, f), "utf8"))),
    "nextRid and sortBook live in engine/ (the tools re-export them), and engine/apply.mjs no longer imports the drafter");

  /* 6 (S4b): the fold takes what the tap booked */
  const maxP = Math.max(...fb().purchases.map((r) => +String(r.rid).slice(1)).filter(Number.isFinite));
  const top = "s" + String(maxS + 40).padStart(3, "0"), next = "s" + String(maxS + 41).padStart(3, "0");
  const bookedSale = sale(IDN(2), 2, T(2)); bookedSale.row.rids = [top]; bookedSale.row.booked_seq = 1;
  const plainSale = sale(IDN(1), 1, T(3));   /* drafted FIRST, not booked: the fold mints for it */
  const f6 = folded([plainSale, bookedSale]);
  const rowOf = (res, ridv) => res.book.sales.find((r) => r.rid === ridv);
  ok(f6.ok && rowOf(f6, top) && rowOf(f6, top).qty === 2 && !("rids" in rowOf(f6, top)) && !("booked_seq" in rowOf(f6, top)), "the fold takes a booked row's rid verbatim and leaves the tap's bookkeeping off the row: " + JSON.stringify(f6.problems));
  ok(f6.ok && rowOf(f6, next) && rowOf(f6, next).qty === 1, "an un-booked row beside a booked one is minted past the booked rid, wherever it stands in the batch (the staged rids count as taken)");
  const replayBook = fb(); replayBook.sales.push({ rid: top, customer: "ZZ2-BBB", date: T(1), qty: 1, total: 10, cash: 10, deliveredQty: 1, product: "salt", note: "x" });
  const rp = folded([bookedSale], replayBook);
  ok(!rp.ok && /would be a replay/.test(rp.problems.join()), "a booked row whose rid is already on the book is a replay, in the twin guard's words (so the replay check clears the handoff): " + JSON.stringify(rp.problems));
  const dup = sale(IDN(3), 3, T(4)); dup.row.rids = [top]; dup.row.booked_seq = 2;
  const dp = folded([bookedSale, dup]);
  ok(!dp.ok && /would be a replay/.test(dp.problems.join()), "two staged rows naming one rid are refused: the second is the replay");
  const lot = (id, extra) => ({ id, status: "approved", collection: "purchases", row: Object.assign({ supplier: "ZZ9-SUP", date: T(2), qty: 5, total: 250, cash: 0, receivedQty: 5, product: "salt", cost: 250 }, extra || {}) });
  const lotBooked = lot(IDN(4), { rids: ["p" + String(maxP + 40).padStart(3, "0")], booked_seq: 1 }), lotPlain = lot(IDN(5), { date: T(3), total: 260, cost: 260 });
  const sl = fb(); sl.roster.push("ZZ9-SUP");
  const fc = folded([lotBooked, lotPlain], sl, { [lotBooked.id]: { cost: 777 }, [lotPlain.id]: { cost: 777 } });
  ok(fc.ok && fc.book.purchases.find((r) => r.rid === lotBooked.row.rids[0]).cost === 250 && fc.book.purchases.find((r) => r.total === 260).cost === 777,
    "the drafter's cost stands for a booked purchase and the notes' cost does not move it, while an un-booked lot takes the notes' cost as ever: " + JSON.stringify(fc.problems));
  /* the order the fold reads: booked rows by the Book's seq, then the rest by when they were drafted (Fable: a count tapped before a sale it was drafted after) */
  const { APPROVED_SQL } = await import("../tools/drafts.mjs");
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
  const put = (id, drafted, row) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,flags,drafter,drafted_at,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, "approved", "sales", "{}", JSON.stringify(row), "r", "[]", "test", drafted, drafted);
  put("2031-01-02T01:00:00.000Z", "2031-01-02T01:00:00.000Z", { n: "sale drafted first, tapped second", booked_seq: 2 });
  put("2031-01-02T02:00:00.000Z", "2031-01-02T02:00:00.000Z", { n: "count drafted second, tapped first", booked_seq: 1 });
  put("2031-01-02T00:30:00.000Z", "2031-01-02T00:30:00.000Z", { n: "fold only, drafted before both" });
  put("2031-01-02T03:00:00.000Z", "2031-01-02T03:00:00.000Z", { n: "fold only, drafted last" });
  const order = db.prepare(APPROVED_SQL).all().map((r) => JSON.parse(r.row).n);
  ok(order.join("|") === "count drafted second, tapped first|sale drafted first, tapped second|fold only, drafted before both|fold only, drafted last", "the fold reads booked rows in the Book's tap order, then the rows it books itself in the order they were drafted: " + order.join("|"));
  /* and so the count tapped first stands, in the view as in the fold */
  const cnt = count(IDN(2), 10.5, T(3)), snd = sale(IDN(1), 2, T(2));
  const O = mk(); await O.load(); await O.tap([cnt]); await O.tap([snd]);
  const viewStock = (await O.read()).state.STATED_STOCK;
  const foldStock = folded([cnt, snd]).book.STATED_STOCK, drafted = folded([snd, cnt]).book.STATED_STOCK;
  ok(viewStock === 8.5 && foldStock === 8.5 && drafted === 10.5, "a count tapped before the sale it was drafted after reads 8.5 in the view and in a fold run in tap order, where drafted order would have said 10.5: " + JSON.stringify([viewStock, foldStock, drafted]));
  /* the law's inputs: the Worker reads the books that take a % off the engine's rules, the fold off the master's TIER_RULE lines; the two must name the same books */
  ok([...DRIFT_BOOKS].sort().join() === [...FOLD.planCtx.driftBooks].sort().join() && DRIFT_BOOKS.length >= 4, "the books that take a % are the same off engine/rules.mjs (the Book's) as off the master's TIER_RULE (the fold's): " + DRIFT_BOOKS.join());
  void tapDiffer;
}
