/* test/roster-road.mjs: S5 OF THE BOOK PLAN, THE ROSTER ROAD (28 Oct 2026). Dormant: the flag D1 book_roster ships off, and the flip's export step is not wired. Each check red under its own
 * mutation (test/roster-road.mutations.json):
 *   1  engine/pinned.mjs is the master's scan written down: every code the master quotes is pinned, a bucket with its owner, and the Book refuses a rename of one with the fold's own reason
 *   2  with the flag off a roster entry and a rename are the fold's; with it on the tap books them, the view equals the fold's own batch (an Add ID, an appointment, a rename after a sale, a sale
 *      under the old code tapped after its rename), and what each did to the files git holds is recorded with the entry
 *   3  a rename onto a taken code is refused; the roster flag is read from D1 and shipped off; the net books roster drafts only with it on
 *   4  a load that folds a roster or rename entry is compared document by document (roster, associates, partners, places, %s), and a base that lacks what the tap booked is named
 *   5  GET /book/roster: a CI route behind the Book's key, read only, effects only (no row, no figure), after-filtered, voided entries left out, the highest booking order carried
 *   6  sideFiles: a registration takes the next spare and it is not free for the next, a rename moves the account, the override and the fixtures, a replay changes nothing, a non-statement kind
 *      mints nothing, and with no spare a bare username is minted and said
 *   7  fetchRoster: the keys it sends, a 4xx final, a 5xx retried; the migration ships off */
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, canon, lawCtx, namedCodes } from "../src/book.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";
const IDM = (n) => "2031-01-03T" + String(n).padStart(2, "0") + ":00:00.000Z";

export async function run({ ok }) {
  const ENG = await import("../engine/apply.mjs"), POS = (await import("../engine/position.mjs")).default;
  const { PINNED_CODES, isPinned } = await import("../engine/pinned.mjs");
  const { nextRid } = await import("../engine/rid.mjs"), { sortBook } = await import("../engine/sort.mjs");
  const FOLD = await import(pathToFileURL(join(REPO, "tools", "fold.mjs")).href + "?s5roster");
  const worker = (await import("../src/worker.js")).default;
  const { sideFiles, fetchRoster, openEntries } = await import("../tools/roster-export.mjs");
  const { rosterMode } = await import("../src/book-tap.js");
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const mk = (env = {}) => {
    const os = objectState(), b = new Book(os, env); let t = 0;
    b.clock = () => "2026-10-28T10:00:" + String(10 + t++).padStart(2, "0") + ".000Z";
    const load = async (book = fb(), over = {}, q = "") => (await b.fetch(new Request("https://book/load" + q, { method: "POST", body: JSON.stringify({ rev: "r", book, pricing: { ...pricing, v: over.v || V }, derived, v: V, stamped: AT_STAMP, ...over }) }))).json();
    const tap = async (items, extra = { roster: true }) => { try { const r = await b.fetch(new Request("https://book/tap", { method: "POST", body: JSON.stringify({ items, day: T(2), v: V, ...extra }) })); return { status: r.status, ...(await r.json()) }; } catch (e) { return { ok: false, status: 500, error: "threw: " + String((e && e.message) || e) }; } };
    const read = async (q = "") => (await b.fetch(new Request("https://book/read" + q))).json();
    return { os, b, load, tap, read, ns: { idFromName: (n) => n, get: () => ({ fetch: (r) => b.fetch(r) }) } };
  };
  const sale = (id, qty, d, extra) => ({ id, status: "approved", collection: "sales", row: Object.assign({ customer: "ZZ1-AAA", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" }, extra || {}) });
  const roster = (id, code, kind) => ({ id, status: "approved", collection: "roster", row: { code, kind } });
  const rename = (id, from, to) => ({ id, status: "approved", collection: "rename", row: { from, to } });
  const folded = (rows, book = fb()) => {
    const st = { ok: true, count: rows.length, approved: rows }, nt = { version: "v9999", rows: Object.fromEntries(rows.map((r) => [r.id, { note: "n" }])) };
    return ENG.applyBatch(book, st, nt, { ...lawCtx(derived, T(2)), nextRid, sortBook });   /* the Book's own law context, so the reward scheme and the pricing the full suite loads for the fold are not a difference */
  };
  const strip = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v), (k, x) => (k === "note" ? undefined : x));
  const SKIP = ["NOTES", "QUEUE_COMMITTED"];
  const same = (a, b) => { const names = []; for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) if (!SKIP.includes(k)) { const key = (v) => Array.isArray(v) ? v.map((r) => canon(strip(r))).sort().join("|") : canon(strip(v)); if (key(a[k]) !== key(b[k])) names.push(k); } return names; };
  const viewBook = async (B) => { const r = await B.read(), out = {}; for (const [k, v] of Object.entries(r.rows || {})) out[k] = v; for (const k of Object.keys(r.state.__arrays)) if (!(k in out)) out[k] = [];
    for (const [k, v] of Object.entries(r.state)) if (k !== "__arrays" && !["OPEN", "TERMS", "REWARD", "STOCK", "PRICING"].includes(k)) out[k] = v; return out; };

  /* 1: the pinned codes */
  const masterLines = readFileSync(join(REPO, "master", "salt_command.html"), "utf8").split("\n");
  let gen = false; const quoted = new Set();
  for (const l of masterLines) {
    if (/^\/\* ==== (BOOK|GEO|ENGINE|DESIGN)\b/.test(l)) { gen = true; continue; }
    if (/^\/\* ==== END (BOOK|GEO|ENGINE|DESIGN)\b/.test(l)) { gen = false; continue; }
    if (gen || /^(const evolution=\[)?\{\s*"?v"?\s*:/.test(l)) continue;
    for (const m of l.matchAll(/(['"])([A-Z]{2}\d-[A-Z0-9]+(?:-[A-Z0-9]+)*)\1/g)) quoted.add(m[2]);
  }
  ok(quoted.size >= 1 && [...quoted].every((c) => isPinned(c)), "every party code the master quotes outside its generated blocks is in engine/pinned.mjs (" + [...quoted].join(", ") + "), so the Book never books a rename the fold would leave for a hand fold");
  const rosterNow = fb().roster;
  ok(rosterNow.every((c) => !FOLD.pinnedInMaster(c) || isPinned(c)) && rosterNow.filter((c) => FOLD.pinnedInMaster(c)).length >= 1, "and for every code on the book the fold's own scan answers pinned only where the list does");
  const answers = (v) => { try { return isPinned(v); } catch (e) { return "threw"; } };
  ok(PINNED_CODES.every((c) => isPinned(c) && isPinned(c + "-R")) && !isPinned("ZZ1-AAA") && !isPinned("ZZ1-AAA-R") && answers(null) === false && answers(undefined) === false && answers(7) === false, "a bucket is pinned with its owner, a stranger is not, and a non-code is not");
  const P = mk(); await P.load();
  const pinnedTap = await P.tap([rename(IDN(1), "CJ4-OKR", "ZZ3-NEW")]);
  ok(!pinnedTap.ok && pinnedTap.status === 409 && /written into the desk's own code/.test(JSON.stringify(pinnedTap.refused)) && P.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0, "a rename of a pinned code is refused with the fold's own reason and nothing is booked: " + JSON.stringify(pinnedTap));

  /* 2: flag off, flag on */
  const O = mk(); await O.load();
  const off = await O.tap([roster(IDN(1), "ZZ9-NEW", "customer")], {});
  const offR = await O.tap([rename(IDN(2), "ZZ1-AAA", "ZZ3-NEW")], { roster: false });
  ok(off.ok && off.foldOnly && !off.booked && offR.ok && offR.foldOnly && !offR.booked && O.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0, "with the flag off (or no word of it) a roster entry and a rename are the fold's alone, nothing booked");
  const A = mk(); await A.load();
  const baseA = JSON.stringify([A.os.db.prepare("SELECT coll,key,h FROM rows ORDER BY coll,key").all(), A.os.db.prepare("SELECT k,h FROM state ORDER BY k").all()]);
  const addId = roster(IDN(1), "ZZ9-NEW", "customer");
  const ta = await A.tap([addId]);
  const fa = folded([addId]), va = await viewBook(A);
  ok(ta.ok && ta.booked && ta.booked.length === 1 && ta.booked[0].rids.length === 0 && fa.ok && same(fa.book, va).length === 0 && va.roster.includes("ZZ9-NEW"),
    "with the flag on an Add ID is booked in the Book and the view equals the fold's own batch of it: " + JSON.stringify([ta, fa.problems, same(fa.book, va)]));
  ok(JSON.stringify([A.os.db.prepare("SELECT coll,key,h FROM rows ORDER BY coll,key").all(), A.os.db.prepare("SELECT k,h FROM state ORDER BY k").all()]) === baseA, "and the base is untouched (a load alone writes it)");
  const ev = await (await A.b.fetch(new Request("https://book/events?all=1"))).json();
  ok(ev.entries.length === 1 && canon(ev.entries[0].effects) === canon({ renames: [], roster: [{ code: "ZZ9-NEW", kind: "customer", register: true }] }), "the entry records what it did to the files git holds: " + JSON.stringify(ev.entries[0] && ev.entries[0].effects));
  const reseller = roster(IDN(2), "ZZ8-RES", "reseller");
  const tr = await A.tap([reseller]);
  const fr = folded([addId, reseller]), vr = await viewBook(A);
  ok(tr.ok && tr.booked && fr.ok && same(fr.book, vr).length === 0 && vr.associates.includes("ZZ8-RES") && vr.roster.includes("ZZ8-RES-R"), "an appointment (a reseller, with its -R account) equals the fold's batch, associates and roster: " + JSON.stringify([tr.error, fr.problems, same(fr.book, vr)]));
  const dup = await A.tap([roster(IDN(3), "ZZ9-NEW", "customer")]);
  ok(!dup.ok && dup.status === 409 && /already on the roster/.test(JSON.stringify(dup.refused)), "an Add ID for a code already on the roster is refused by the plan, as the fold refuses it");

  const R = mk(); await R.load();
  const s1 = sale(IDN(1), 2, T(2)), rn = rename(IDN(2), "ZZ1-AAA", "ZZ3-NEW");
  const tS = await R.tap([s1]), tR = await R.tap([rn]);
  const fR = folded([s1, rn]), vR = await viewBook(R);
  ok(tS.ok && tR.ok && tR.booked && fR.ok && same(fR.book, vR).length === 0 && !vR.roster.includes("ZZ1-AAA") && vR.roster.includes("ZZ3-NEW") && vR.sales.some((r) => r.customer === "ZZ3-NEW") && !vR.sales.some((r) => r.customer === "ZZ1-AAA"),
    "a sale then a rename of its customer, tapped one by one, read as the fold's batch of the two: every row under the new code: " + JSON.stringify([tR.error, fR.problems, same(fR.book, vR)]));
  const evR = await (await R.b.fetch(new Request("https://book/events?all=1"))).json();
  ok(canon(evR.entries[1].effects) === canon({ renames: [{ from: "ZZ1-AAA", to: "ZZ3-NEW", pairs: [["ZZ1-AAA", "ZZ3-NEW"]], geo: null }], roster: [] }) && evR.entries[0].effects === null, "the rename records its pairs as the Book applied them; a sale records none: " + JSON.stringify(evR.entries.map((e) => e.effects)));
  /* a code a rename retired is refused: a sale drafted under the old code and approved after the rename, whether the rename is still open or already folded, would otherwise land by timing */
  const late = sale(IDN(3), 1, T(3));
  const tL = await R.tap([late]), nBefore = R.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c;
  ok(!tL.ok && tL.status === 409 && /ZZ1-AAA is now ZZ3-NEW/.test(JSON.stringify(tL.refused)) && nBefore === 2, "a sale under the old code, tapped after its rename, is refused with the new code named and nothing booked: " + JSON.stringify(tL));
  const viaPayload = sale(IDN(6), 1, T(3), { customer: "ZZ2-BBB" }); viaPayload.entry = { at: viaPayload.id, payload: { mode: "new", party: "ZZ2-BBB", assoc: "ZZ1-AAA" } };
  ok(JSON.stringify(namedCodes(viaPayload).sort()) === JSON.stringify(["ZZ1-AAA", "ZZ2-BBB"]) && JSON.stringify(namedCodes({ row: { customer: 7, total: 1 } })) === "[]" && JSON.stringify(namedCodes(null)) === "[]", "the codes a row names are its customer, party, supplier, associate and end buyer, from the row and from a Counter trade's payload, and nothing that is not a string");
  const tripOld = await R.tap([sale(IDN(7), 1, T(3), { customer: "ZZ2-BBB" }), sale(IDN(8), 1, T(3))]);
  ok(!tripOld.ok && tripOld.status === 409 && R.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 2, "a trip holding such a row is refused whole: not even its other row is booked");
  /* folded, the rename still retires its code; put back on the roster, the code is the roster's again */
  const RF = mk(); await RF.load(); await RF.tap([s1, rn]);
  await RF.load(fR.book, { v: "v1253" }, "?folded=" + encodeURIComponent(s1.id + "," + rn.id) + "&pure=1");
  const afterFold = await RF.tap([sale(IDN(3), 1, T(3))]);
  ok(!afterFold.ok && afterFold.status === 409 && /ZZ1-AAA is now ZZ3-NEW/.test(JSON.stringify(afterFold.refused)), "once the load has folded the rename the old code is still refused, whenever the sale is tapped: " + JSON.stringify(afterFold));
  const back = await RF.tap([roster(IDN(9), "ZZ1-AAA", "customer")]);
  const resold = await RF.tap([sale(IDM(10), 1, T(3))]);
  ok(back.ok && back.booked && resold.ok && resold.booked, "a code registered again afterwards is the roster's again and its sales are booked: " + JSON.stringify([back.error, resold.error]));
  const RT2 = mk(); await RT2.load();
  const tripRename2 = await RT2.tap([rename(IDM(11), "ZZ1-AAA", "ZZ5-NEW"), sale(IDM(12), 1, T(3))]);
  ok(!tripRename2.ok && tripRename2.status === 409 && /ZZ1-AAA is now ZZ5-NEW/.test(JSON.stringify(tripRename2.refused)) && RT2.os.db.prepare("SELECT COUNT(*) AS c FROM booked").get().c === 0, "a trip that renames a code and sells under it is refused whole, its own rename counted as retiring it: " + JSON.stringify(tripRename2));
  const taken = await R.tap([rename(IDN(4), "ZZ3-NEW", "ZZ2-BBB")]);
  ok(!taken.ok && taken.status === 409 && /taken|already/.test(JSON.stringify(taken.refused)), "a rename onto a code already on the roster is refused: " + JSON.stringify(taken.refused));
  const geoR = mk(); await geoR.load();
  const withGeo = rename(IDN(5), "ZZ1-AAA", "ZZ4-GEO"); withGeo.row.geo = { lat: 3.15, lng: 101.7 };
  const tG = await geoR.tap([withGeo]), vG = await viewBook(geoR), fG = folded([withGeo]);
  ok(tG.ok && vG.PLACED && vG.PLACED["ZZ4-GEO"] && fG.ok && same(fG.book, vG).length === 0, "a rename with a new place files it under the new code, as the fold does: " + JSON.stringify([tG.error, fG.problems, same(fG.book, vG)]));

  /* 3: the flag in D1, the net */
  const fake = (rows) => ({ prepare: () => ({ first: async () => rows }) });
  ok(await rosterMode(fake({ mode: "on" })) === "on" && await rosterMode(fake({ mode: "off" })) === "off" && await rosterMode(fake(null)) === "off" && await rosterMode({ prepare: () => { throw new Error("no table"); } }) === "off", "the flag reads on only when D1 says on; a missing table, an empty row or an error read off");
  const mig = readFileSync(join(REPO, "migrations", "0021_book_roster.sql"), "utf8");
  ok(/CREATE TABLE IF NOT EXISTS book_roster/.test(mig) && /VALUES \(1, 'off'\)/.test(mig) && !/DROP|DELETE|ALTER/i.test(mig.replace(/--[^\n]*/g, "")), "migration 0021 creates the one-row flag shipped off and touches nothing else");
  /* the minute net: the candidate query leaves roster and rename drafts out while the flag is off and takes them with it on; and the Book is told the flag with each tap */
  const { bookNet, bookTap } = await import("../src/book-tap.js"), { bindBook } = await import("../src/book-read.js");
  const modes = { tap: "on", roster: "off" }, sqls = [], bodies = [];
  const draftRow = { id: IDN(1), collection: "roster", row: "{}", entry: null, reasoning: null, flags: "[]", decided_at: "x", decided_by: "y" };
  const netDb = { prepare: (s) => ({ first: async () => ({ mode: /book_roster/.test(s) ? modes.roster : /book_tap/.test(s) ? modes.tap : null, v: "v1" }), bind() { return this; }, all: async () => { sqls.push(s); return { results: /FROM draft WHERE/.test(s) ? [draftRow] : [] }; } }), batch: async () => [] };
  bindBook(netDb, { idFromName: (n) => n, get: () => ({ fetch: async (rq) => { if (rq.method === "POST") bodies.push(JSON.parse(await rq.text())); return Response.json({ ok: true, ids: [], booked: [] }); } }) });
  await bookNet(netDb); const offSql = sqls.filter((s) => /FROM draft WHERE/.test(s)).join("|");
  sqls.length = 0; modes.roster = "on"; bodies.length = 0; await bookNet(netDb); const onSql = sqls.filter((s) => /FROM draft WHERE/.test(s)).join("|");
  ok(/collection NOT IN \('roster','rename'\)/.test(offSql) && onSql.length > 0 && !/collection NOT IN \('roster','rename'\)/.test(onSql), "the net leaves roster and rename drafts to the fold while the flag is off, and picks them up with it on");
  ok(bodies.length >= 1 && bodies.every((b) => b.roster === true), "with the flag on every tap tells the Book so: " + JSON.stringify(bodies.map((b) => b.roster)));
  bodies.length = 0; modes.roster = "off"; await bookTap(netDb, [draftRow], "me", "x");
  ok(bodies.length === 1 && bodies[0].roster === false, "and with it off the Book is told false");

  /* 4: a load that folds a roster or rename entry is compared document by document */
  const L = mk(); await L.load(); await L.tap([addId]);
  const goodBase = fa.book; goodBase.sales = goodBase.sales.map((x) => x);
  const lg = await L.load(goodBase, { v: "v1253" }, "?folded=" + encodeURIComponent(addId.id) + "&pure=1");
  ok(lg.ok && lg.tap && lg.tap.folded === 1 && lg.tap.differ.length === 0, "a fold that booked the Add ID as the tap did closes the entry and the check finds nothing: " + JSON.stringify(lg.tap));
  const L2 = mk(); await L2.load(); await L2.tap([addId]);
  const lb = await L2.load(fb(), { v: "v1253" }, "?folded=" + encodeURIComponent(addId.id) + "&pure=1");
  ok(lb.ok && lb.tap.folded === 1 && lb.tap.differ.includes("roster"), "a base that lacks the roster entry the tap booked is named (roster): " + JSON.stringify(lb.tap && lb.tap.differ));
  const L3 = mk(); await L3.load(); await L3.tap([s1, rn]);
  const lr = await L3.load(fR.book, { v: "v1253" }, "?folded=" + encodeURIComponent(s1.id + "," + rn.id) + "&pure=1");
  ok(lr.ok && lr.tap.folded === 2 && lr.tap.differ.length === 0, "a sale and its customer's rename folded as the tap booked them close with nothing named: " + JSON.stringify(lr.tap));
  const L4 = mk(); await L4.load(); await L4.tap([s1, rn]);
  const half = structuredClone(fR.book); half.roster = half.roster.map((c) => (c === "ZZ3-NEW" ? "ZZ1-AAA" : c));
  const lh = await L4.load(half, { v: "v1253" }, "?folded=" + encodeURIComponent(s1.id + "," + rn.id) + "&pure=1");
  ok(lh.ok && lh.tap.differ.includes("roster"), "a base where the rename did not reach the roster is named: " + JSON.stringify(lh.tap && lh.tap.differ));

  /* an entry that mints no rid closes by its effects too: the new base holds the code it registered, or has moved the codes it renamed, with no word from D1 */
  const E1 = mk(); await E1.load(); await E1.tap([addId]);
  const e1 = await E1.load(fa.book, { v: "v1253" });
  ok(e1.ok && e1.tap.folded === 1 && e1.tap.open === 0 && e1.tap.differ.length === 0, "an Add ID the new base holds closes with no word from D1: " + JSON.stringify(e1.tap));
  const E2 = mk(); await E2.load(); await E2.tap([addId]);
  const e2 = await E2.load(fb(), { v: "v1253" });
  ok(e2.ok && e2.tap.folded === 0 && e2.tap.open === 1, "and one the new base does not hold stays open");
  const E3 = mk(); await E3.load(); await E3.tap([s1, rn]);
  const e3 = await E3.load(fR.book, { v: "v1253" });
  ok(e3.ok && e3.tap.folded >= 1 && e3.tap.open === 1 && /./.test(JSON.stringify(e3.tap)), "a rename the new base has made closes with no word from D1 (the sale it moved, which mints a rid the base holds too, closes by its rid): " + JSON.stringify(e3.tap));
  const E4 = mk(); await E4.load(); await E4.tap([rn]);
  const halfMoved = structuredClone(fR.book); halfMoved.roster = halfMoved.roster.concat(["ZZ1-AAA"]);
  const e4 = await E4.load(halfMoved, { v: "v1253" });
  ok(e4.ok && e4.tap.folded === 0 && e4.tap.open === 1, "a base that holds the new code and still the old one has not made the rename: the entry stays open");
  const E5 = mk(); await E5.load(); await E5.tap([rn]);
  const e5 = await E5.load(fb(), { v: "v1253" }, "?folded=" + encodeURIComponent(rn.id));
  ok(e5.ok && e5.tap.folded === 1 && e5.tap.differ.some((d) => /ZZ1-AAA to ZZ3-NEW/.test(d)), "by D1's word, in a load that is not a pure one, a base where the rename was not made is named with its codes: " + JSON.stringify(e5.tap.differ));
  const E6 = mk(); await E6.load(); await E6.tap([addId]);
  const e6 = await E6.load(fb(), { v: "v1253" }, "?folded=" + encodeURIComponent(addId.id));
  ok(e6.ok && e6.tap.differ.some((d) => /ZZ9-NEW/.test(d)), "and so is an Add ID the base lacks: " + JSON.stringify(e6.tap.differ));
  const E7 = mk(); await E7.load(); await E7.tap([addId]); await E7.tap([rename(IDN(5), "ZZ9-NEW", "ZZ9-NEO")]);
  const both = structuredClone(fb()); both.roster.push("ZZ9-NEO");
  const e7 = await E7.load(both, { v: "v1253" }, "?folded=" + encodeURIComponent(addId.id + "," + IDN(5)));
  ok(e7.ok && e7.tap.folded === 2 && e7.tap.differ.length === 0, "an Add ID and the rename of that code folded in one load are not named: the code moved on, as the later entry says: " + JSON.stringify(e7.tap));
  ok(isPinned("CJ4-OKR-R") && isPinned("CJ4-OKR-1-SEN") && !isPinned("CJ4-OKRX") && !isPinned("XCJ4-OKR"), "a pinned code carries everything under it (its bucket and an end buyer's code), and not a code that merely begins with it");
  ok(openEntries([{ seq: 1, folded: true }, { seq: 2, folded: false }, { seq: 3 }]).map((e) => e.seq).join() === "2,3" && openEntries([]).length === 0 && openEntries(undefined).length === 0, "the entries booked and not folded are named (the flip's --init refuses while any stands)");

  /* 5: the route */
  const env = (ns, extra = {}) => ({ REQUIRE_ACCESS: "0", SALT_BOOK_KEY: "bk", SALT_WRITE_KEY: "wk", BOOK: ns, ...extra });
  const get = async (path, headers, e, method = "GET") => { const r = await worker.fetch(new Request("https://salt.test" + path, { method, headers }), e, { waitUntil() {} }); return { status: r.status, text: await r.text() }; };
  const j = (x) => { try { return JSON.parse(x.text); } catch (e) { return null; } };
  const good = { "X-Book-Key": "bk" };
  const RT = mk(); await RT.load(); await RT.tap([sale(IDN(4), 2, T(2))]); await RT.tap([addId]); await RT.tap([rename(IDN(3), "ZZ1-AAA", "ZZ3-NEW")]);
  await RT.b.fetch(new Request("https://book/void", { method: "POST", body: JSON.stringify({ ids: [] }) })).catch(() => null);
  const g1 = await get("/book/roster", good, env(RT.ns)), b1 = j(g1);
  ok(g1.status === 200 && b1.ok && b1.events.length === 2 && b1.events.every((e) => e.effects && typeof e.seq === "number") && b1.max === 3 && b1.events[0].effects.roster[0].code === "ZZ9-NEW",
    "it answers the entries that carried effects (the Add ID and the rename, not the sale) and the highest booking order: " + g1.text.slice(0, 200));
  const within = (o, keys) => o && typeof o === "object" && Object.keys(o).every((k) => keys.includes(k));
  ok(within(b1, ["ok", "rev", "at", "max", "events"]) && b1.events.every((e) => within(e, ["seq", "draft_id", "effects", "folded"]) && within(e.effects, ["renames", "roster"])
    && e.effects.roster.every((x) => within(x, ["code", "kind", "register"])) && e.effects.renames.every((x) => within(x, ["from", "to", "pairs"]))), "it carries codes, kinds and pairs only: no row, no item, no figure and no place (the shape is checked key by key)");
  const g2 = j(await get("/book/roster?after=2", good, env(RT.ns)));
  ok(g2.ok && g2.events.length === 1 && g2.events[0].seq === 3 && g2.max === 3, "?after= keeps the later entries only and still names the highest order");
  const g3 = j(await get("/book/roster?after=9", good, env(RT.ns)));
  ok(g3.ok && g3.events.length === 0 && g3.max === 3, "a quiet run (nothing after) still answers the highest order, so the watermark can move");
  RT.os.db.prepare("UPDATE booked SET voided_at = 'x' WHERE seq = 3").run();
  const g4 = j(await get("/book/roster", good, env(RT.ns)));
  ok(g4.ok && g4.events.length === 1 && g4.events[0].seq === 2, "a voided entry is left out");
  ok((await get("/book/roster", {}, env(RT.ns))).status !== 200 && (await get("/book/roster", { "X-Book-Key": "wrong" }, env(RT.ns))).status !== 200, "no key, or the wrong one, is refused");
  ok((await get("/book/roster", good, env(RT.ns), "POST")).status === 405 && (await get("/book/roster?after=-1", good, env(RT.ns))).status === 400 && (await get("/book/roster?after=x", good, env(RT.ns))).status === 400 && (await get("/book/roster", good, env(undefined))).status === 503, "it is read only (a POST is 405), a bad `after` is 400, no Book bound is 503");
const gated = await get("/book/roster", good, { REQUIRE_ACCESS: "1", ACCESS_TEAM: "t", ACCESS_AUD: "a", SALT_BOOK_KEY: "bk", BOOK: RT.ns });
  ok(gated.status === 401 && /not authenticated/.test((j(gated) || {}).error || ""), "behind Access, with no login, it answers 401 as JSON, not the locked page");
  const wsrc = readFileSync(join(REPO, "src", "worker.js"), "utf8");
  ok(/CI_ROUTES = new Set\([^)]*"GET \/book\/roster"/.test(wsrc), "it is a CI route (the service token reaches it, behind the Book's key)");

  /* 6: sideFiles */
  const places = () => ({ LOCS: { "ZZ9-NEW": "Kuala Lumpur-X", "ZZ5-OLD": "Kuala Lumpur-X", "ZZ9-OLDPLACE": "Elsewhere" } });
  const files = () => ({ users: { "ZZ5-OLD": "olduser" }, places: places(), suite: "a ZZ9-NEW b ZZ9-NEWER c ZZ9-NEW" });
  const events = [
    { seq: 1, draft_id: "d1", effects: { roster: [{ code: "ZZ9-NEW", kind: "customer", register: true }], renames: [] } },
    { seq: 2, draft_id: "d2", effects: { roster: [{ code: "ZZ8-SUP", kind: "supplier", register: true }], renames: [] } },
    { seq: 3, draft_id: "d3", effects: { roster: [{ code: "ZZ7-TWO", kind: "reseller", register: true }], renames: [] } },
    { seq: 4, draft_id: "d4", effects: { roster: [], renames: [{ from: "ZZ9-NEW", to: "ZZ4-NEW", pairs: [["ZZ9-NEW", "ZZ4-NEW"]], geo: null }] } }
  ];
  const safeSide = (...a) => { try { return sideFiles(...a); } catch (e) { return { users: {}, places: { LOCS: {} }, suite: null, report: { minted: [], bound: [], waiting: [], renamed: [], moved: { locs: 0, users: 0, suite: false } }, threw: String((e && e.message) || e) }; } };
  const sf = safeSide(events, files(), ["spare1", "spare2", "spare3"]);
  ok(sf.users["ZZ4-NEW"] === "spare1" && !sf.users["ZZ9-NEW"] && sf.users["ZZ7-TWO"] === "spare2" && !sf.users["ZZ8-SUP"] && sf.users["ZZ5-OLD"] === "olduser" && sf.report.bound.join() === "ZZ9-NEW,ZZ7-TWO",
    "a registration takes the next spare and it is not free for the next; the account moves with a rename to the new code, its username unchanged; a supplier gets none: " + JSON.stringify(sf.users));
  ok(sf.places.LOCS["ZZ4-NEW"] === "Kuala Lumpur-X" && !("ZZ9-NEW" in sf.places.LOCS) && sf.places.LOCS["ZZ5-OLD"] === "Kuala Lumpur-X" && sf.report.moved.locs === 1, "the place override follows the code while it ends in the same place (the fold's own renameLocs)");
  const moved = safeSide([{ seq: 1, draft_id: "m", effects: { roster: [], renames: [{ from: "ZZ9-NEW", to: "ZZ9-NEO", pairs: [["ZZ9-NEW", "ZZ9-NEO"]], geo: null }] } }], files(), []);
  ok(!("ZZ9-NEO" in moved.places.LOCS) && !("ZZ9-NEW" in moved.places.LOCS), "and goes when the place part of the code changed, as the fold drops it");
  ok(sf.suite === "a ZZ4-NEW b ZZ9-NEWER c ZZ4-NEW" && sf.report.moved.suite === true, "the suite's fixtures change on whole codes only (ZZ9-NEWER stands)");
  const again = safeSide(events, { users: sf.users, places: sf.places, suite: sf.suite }, ["spare3"]);
  ok(canon(again.users) === canon(sf.users) && canon(again.places) === canon(sf.places) && again.suite === sf.suite && again.report.minted.length === 0 && !again.report.moved.suite, "a replay of the same entries changes nothing: an account that exists is never touched, a code already moved has nothing left to move");
  const given = files(); sideFiles(events, given, ["spare1"]);
  ok(canon(given) === canon(files()), "it mutates nothing it was handed");
  const none = safeSide([events[0]], { users: {}, places: {}, suite: null }, []);
  ok(none.users["ZZ9-NEW"] && /^[a-z0-9]{3,}/i.test(none.users["ZZ9-NEW"]) && none.report.waiting.join() === "ZZ9-NEW" && none.report.bound.length === 0 && none.suite === null, "with no spare free a bare username is minted and the code is said to be waiting for the laptop's next update");
  const shuffled = safeSide(events.slice().reverse(), files(), ["spare1", "spare2", "spare3"]);
  ok(canon(shuffled.users) === canon(sf.users), "the entries are applied in booking order whatever order they arrive in");
  const twoSame = safeSide([{ seq: 1, draft_id: "a", effects: { roster: [{ code: "ZZ6-AAA", kind: "customer", register: true }], renames: [] } }, { seq: 2, draft_id: "b", effects: { roster: [{ code: "ZZ6-BBB", kind: "customer", register: true }], renames: [] } }], { users: {}, places: {}, suite: null }, ["only-one"]);
  ok(twoSame.users["ZZ6-AAA"] === "only-one" && twoSame.users["ZZ6-BBB"] !== "only-one" && twoSame.report.waiting.join() === "ZZ6-BBB", "one spare is never given to two codes");

  let shared = null; try { sideFiles([], { users: { "ZZ1-AAA": "same", "ZZ2-BBB": "same" }, places: {}, suite: null }, []); } catch (e) { shared = String(e.message); }
  ok(shared && /one username to two codes/.test(shared), "a users file that gives one username to two codes is refused, nothing is written: " + shared);

  /* 7: fetchRoster */
  const keys = { SALT_BOOK_KEY: "bk", CF_ACCESS_CLIENT_ID: "id", CF_ACCESS_CLIENT_SECRET: "sec" };
  const seen = [];
  const answer = (...rs) => async (url, init) => { seen.push({ url, headers: init.headers }); const x = rs[Math.min(seen.length - 1, rs.length - 1)]; if (x instanceof Error) throw x; return { status: x.status, json: async () => x.body }; };
  const f1 = await fetchRoster("https://x.test/", keys, 7, { fetchImpl: answer({ status: 200, body: { ok: true, max: 9, events: [] } }), wait: 0 });
  ok(f1.max === 9 && seen[0].url === "https://x.test/book/roster?after=7" && seen[0].headers["X-Book-Key"] === "bk" && seen[0].headers["CF-Access-Client-Id"] === "id" && seen[0].headers["CF-Access-Client-Secret"] === "sec", "it asks /book/roster after the watermark with the Book's key and the service token: " + JSON.stringify(seen[0]));
  seen.length = 0;
  const f2 = await fetchRoster("https://x.test", keys, 0, { fetchImpl: answer({ status: 403, body: { error: "no" } }), wait: 0 });
  ok(f2.error && /HTTP 403/.test(f2.error) && seen.length === 1, "a 4xx is final: one call");
  seen.length = 0;
  const f3 = await fetchRoster("https://x.test", keys, 0, { fetchImpl: answer({ status: 503, body: {} }, new Error("lost"), { status: 200, body: { ok: true, max: 1, events: [] } }), wait: 0 });
  ok(f3.max === 1 && seen.length === 3, "a 5xx and a lost connection are retried");
  ok((await fetchRoster("https://x.test", {}, 0, { fetchImpl: answer({ status: 200, body: {} }) })).error.includes("SALT_BOOK_KEY"), "a missing key is said, not sent");
}
