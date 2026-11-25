/* test/s5f-compact-rename.mjs: A RENAME OF A CODE THE BASE HOLDS COMPACTS (25 Nov 2026). The day's export refused at compaction with gone 1: the Amend ID that re-keyed
 * CN3-TBC to CN3-PJ took a roster row out of the base. A roster code carries no rid, so it is keyed by its content, and a rename can only remove one row and add another;
 * the strict load read that as a row lost. A rename folded by the same load now accounts for the rows it moved (src/book.js `load`: `goneRows`, `fresh`, `n.renamed`), and nothing else does.
 * Each check red under its own mutation (test/s5f-compact-rename.mutations.json):
 *   1  a rename of a code the base holds compacts: the old code leaves the roster, the new one is there, its loan with no rid and its contact move too, the entry is closed, a dry run
 *      says so first
 *   2  a reseller's rename moves its -R account and its place among the associates, and every row leaving is accounted for
 *   3  still refused, by the row-loss guard alone (the strict load reads the lossy view as its own, as a compaction does), each on a Book of its own: a roster row no folded
 *      rename names, a money row lost beside a rename, a contact the rename does not name, the renamed code's contact lost rather than moved, a twin lost beside its moved twin
 *      (each new row matched once), a moved row lost beside a row the base already held in its renamed form; and a renamed code whose new code is not in the base
 *   Known and left (Opus's re-check): another folded entry that mints a row identical to a moved row's renamed form can stand in for that row if the view also lost it.
 *   4  a refund with no rid under the renamed code moves too, and compacts */
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, prepare } from "../src/book.js";

const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const T = (n) => "2031-01-0" + n;
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const fb = () => {
    const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB", "ZZ8-RES", "ZZ8-RES-R"); b.associates = (b.associates || []).concat(["ZZ8-RES"]); b.STATED_STOCK = 10;
    /* as the live book holds them: a loan with no rid, and contacts (a list the view check does not compare), under the code a rename moves and under another */
    const loan = Object.assign({}, b.loans.find((l) => !l.rid) || b.loans[0], { party: "ZZ1-AAA" }); delete loan.rid; b.loans.push(loan);
    b.contacts = (b.contacts || []).concat([{ date: T(1), party: "ZZ1-AAA", how: "call", outcome: "asked", next: null, note: "n1" }, { date: T(1), party: "ZZ2-BBB", how: "call", outcome: "asked", next: null, note: "n2" }]);
    b.customerRefunds = (b.customerRefunds || []).concat([{ party: "ZZ1-AAA", amount: 10, since: T(1), paidOn: T(1), note: "r1" }]);
    return b;
  };
  const mk = () => {
    const os = objectState(), b = new Book(os, {}); let t = 0;
    b.clock = () => "2026-10-28T10:00:" + String(10 + (t++ % 50)).padStart(2, "0") + ".000Z";
    const call = async (path, init) => { const r = await b.fetch(new Request("https://book" + path, init)); return { status: r.status, ...(await r.json()) }; };
    const load = (book = fb()) => call("/load", { method: "POST", body: JSON.stringify({ rev: "r", book, pricing, derived, v: V, stamped: AT_STAMP }) });
    const tap = (items) => call("/tap", { method: "POST", body: JSON.stringify({ items, day: T(2), v: V, roster: true }) });
    const read = () => call("/read");
    return { os, b, call, load, tap, read };
  };
  const rename = (id, from, to) => ({ id, status: "approved", collection: "rename", row: { from, to } });
  const sale = (id, qty, d) => ({ id, status: "approved", collection: "sales", row: { customer: "ZZ2-BBB", date: d, qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" } });
  const open = (B) => B.os.db.prepare("SELECT COUNT(*) AS c FROM booked WHERE folded_at IS NULL AND voided_at IS NULL").get().c;
  const rosterRows = (B) => B.os.db.prepare("SELECT doc FROM rows WHERE coll = 'roster' AND gone_at IS NULL").all().map((r) => JSON.parse(r.doc));

  /* 1: a rename of a code the base holds compacts */
  const A = mk(); await A.load();
  const tA = await A.tap([rename(IDN(1), "ZZ1-AAA", "ZZ3-NEW")]);
  ok(tA.ok && tA.booked && tA.booked.length === 1 && rosterRows(A).includes("ZZ1-AAA"), "the rename books as an open entry on a base that holds the old code: " + JSON.stringify([tA.error, tA.refused]));
  const dA = await A.call("/compact?dry=1", { method: "POST" });
  ok(dA.ok && dA.dry && dA.compactable === 1 && open(A) === 1, "a dry compaction says it would hold over the rename: " + JSON.stringify(dA));
  const cA = await A.call("/compact", { method: "POST" });
  const rA = rosterRows(A);
  ok(cA.ok && cA.compacted === 1 && open(A) === 0 && !rA.includes("ZZ1-AAA") && rA.includes("ZZ3-NEW"), "and compacts: the old code leaves the base's roster, the new one is in it, the entry is closed: " + JSON.stringify([cA.error, cA.compacted, open(A)]));
  const listOf = (B, coll) => B.os.db.prepare("SELECT doc FROM rows WHERE coll = ? AND gone_at IS NULL").all(coll).map((r) => JSON.parse(r.doc));
  ok(listOf(A, "loans").some((l) => l.party === "ZZ3-NEW") && !listOf(A, "loans").some((l) => l.party === "ZZ1-AAA") && listOf(A, "contacts").some((c) => c.party === "ZZ3-NEW" && c.note === "n1"),
    "its loan with no rid and its contact moved to the new code in the base as well");

  /* 2: a reseller's rename moves its -R account too */
  const R = mk(); await R.load();
  const tR = await R.tap([rename(IDN(1), "ZZ8-RES", "ZZ7-NEW")]);
  const cR = await R.call("/compact", { method: "POST" });
  const rR = rosterRows(R);
  ok(tR.ok && cR.ok && cR.compacted === 1 && !rR.includes("ZZ8-RES") && !rR.includes("ZZ8-RES-R") && rR.includes("ZZ7-NEW") && rR.includes("ZZ7-NEW-R"),
    "a reseller's rename takes its -R account with it, and both roster rows leaving compact: " + JSON.stringify([tR.error, tR.refused, cR.error, rR.filter((c) => /^ZZ/.test(c))]));

  /* 3: still refused, and rolled back. Each case on a Book of its own (a load that passed would commit and leave the next case nothing to fold), the lossy view handed in as the
     view read, as compaction hands in its own: the view check then compares it with itself, so it finds no difference and the row-loss guard alone decides */
  const tables = (B) => JSON.stringify(B.os.db.prepare("SELECT coll,key,h,gone_at FROM rows ORDER BY coll,key").all());
  const lossy = async (mut, book = fb()) => {
    const B = mk(); await B.load(book); await B.tap([rename(IDN(1), "ZZ1-AAA", "ZZ3-NEW")]);
    const snap = B.os.db.prepare("SELECT v, stamped FROM snap").get(), was = tables(B);
    const view = B.b.viewOf(B.b.events()); mut(view.book); const { PRICING, ...rest } = view.derived;
    const p = await prepare(view.book, PRICING, { v: snap.v, stamped: snap.stamped, derived: rest });
    let e = null; try { B.b.load(p, "t", { folded: B.b.events().map((x) => x.draft_id), pure: true, strict: true, pre: view }); } catch (x) { e = x.message; }
    return { e, kept: tables(B) === was && open(B) === 1 };
  };
  const guardAlone = (r) => /compaction refused/.test(r.e || "") && r.e.includes('"differ":[]') && r.kept;
  const e1 = await lossy((b) => { b.roster = b.roster.filter((c) => c !== "ZZ2-BBB"); });
  ok(guardAlone(e1), "a roster row no folded rename names, lost beside the rename, is refused by the row-loss guard alone and rolled back: " + e1.e);
  const e2 = await lossy((b) => { b.roster = b.roster.filter((c) => c !== "ZZ3-NEW"); });
  ok(/compaction refused/.test(e2.e || "") && e2.kept, "a renamed code whose new code is not in the base is refused (the view check's per-pair test and the row-loss guard both stand): " + e2.e);
  const e3 = await lossy((b) => { b.sales.shift(); });
  ok(guardAlone(e3), "a money row lost beside a rename is refused by the row-loss guard alone: " + e3.e);
  const e4 = await lossy((b) => { b.contacts = b.contacts.filter((c) => c.note !== "n2"); });
  ok(guardAlone(e4), "a contact the rename does not name, lost beside it, is refused: " + e4.e);
  const e5 = await lossy((b) => { b.contacts = b.contacts.filter((c) => c.note !== "n1"); });
  ok(guardAlone(e5), "the renamed code's contact, lost rather than moved, is refused: " + e5.e);
  /* a twin: two identical contacts under the renamed code, and a view that keeps one; one new row accounts for one moved row */
  const twin = () => { const b = fb(); b.contacts.push(Object.assign({}, b.contacts.find((c) => c.note === "n1"))); return b; };
  const dropOne = (b) => { const i = b.contacts.findIndex((c) => c.note === "n1"); b.contacts.splice(i, 1); };
  const e6 = await lossy(dropOne, twin());
  ok(guardAlone(e6), "a twin lost beside its moved twin is refused: one new row is matched to one moved row: " + e6.e);
  /* the renamed form already in the base: a row it held all along is no new row, so the moved row lost beside it is not excused */
  const held = () => { const b = fb(); b.contacts.push(Object.assign({}, b.contacts.find((c) => c.note === "n1"), { party: "ZZ3-NEW" })); return b; };
  const e7 = await lossy(dropOne, held());
  ok(guardAlone(e7), "a moved row lost beside a row the base already held in its renamed form is refused: " + e7.e);
  const W = mk(); await W.load(twin()); await W.tap([rename(IDN(1), "ZZ1-AAA", "ZZ3-NEW")]);
  const cW = await W.call("/compact", { method: "POST" });
  ok(cW.ok && cW.compacted === 1 && listOf(W, "contacts").filter((c) => c.party === "ZZ3-NEW" && c.note === "n1").length === 2, "and both twins move when nothing is lost: " + JSON.stringify([cW.error]));

  /* 4: a refund with no rid moves with its code */
  ok(listOf(A, "customerRefunds").some((r) => r.party === "ZZ3-NEW" && r.note === "r1") && !listOf(A, "customerRefunds").some((r) => r.party === "ZZ1-AAA"), "the renamed code's refund with no rid moved in the compacted base too");
  const M = mk(); await M.load(); await M.tap([sale(IDN(1), 2, T(2))]);
  const cM = await M.call("/compact", { method: "POST" });
  ok(cM.ok && cM.compacted === 1, "a compaction with no rename in it is as it was: " + JSON.stringify([cM.error]));
}
