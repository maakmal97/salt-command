/* test/admin-undo.mjs: EASY REVERT (plan 4 of docs/plans-counter-admin.html, 16 Oct 2026; his answers: the newest move only, and a site
 * order's customer told by a banner).
 *
 * Prompted 15 Oct 2026: s267's RM 220 cash booked by mistake, undone by a hand Correction of each field. What is proved here, each check
 * red under its own mutation (test/admin-undo.mutations.json), with invented codes only (rule 2), s267 as it stood before that hand fix:
 *   A  the engine: undoOf reads the newest move alone and what undoing it sets (a payment, a handover, a Correction from its own record),
 *      refuses an older move or one kept for a hand fold, and a step undone is passed over by the late-payer walk
 *   B  the fold: an undo is checked again on the row as its batch leaves it, refused when a move landed since, and marks its step
 *   C  the drafter: drafts an undo only when it is the newest move with exactly its figures, and says a refund it strands and a count
 *   D  the Desk: History newest first; nothing undone while money is on its way, a move waits on the row or the site order is behind; a
 *      site order's change of terms goes by restateOrder; rowRoom still holds a payment on the row to what the mirror says
 *   E  the site: the undo fix takes back what the book took back, the line with it, reopens a done order and wakes them with a banner
 *   F  Salt Admin: History on the order card and each trip line, Undo on the newest move alone, its Sheet's Now and After, and the
 *      approve card's verb and button */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { readBook as toolsBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { readBook, draftRow, withRefunds } from "../src/drafter.js";
import { makerAmendmentRoom, makerLedgerAmendment } from "../src/maker-inputs.js";
import { undoFixes } from "../src/orders.js";
import { restateTap, termsFromRow, settledFromRow } from "../engine/stages.mjs";
import { applyAmend } from "../engine/apply.mjs";
import { decideFix, decideDesk, applyEvent, wakes } from "../stmt/orders.js";
import { NEWS } from "../stmt/sw.js";
import { approveFigures } from "../src/approve-figures.js";
import { plan } from "../tools/fold.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify, E = POSITION_ENGINE;
const D = "2026-10-15", D0 = "2026-10-02";
class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}
const step = (date, kind, cash, kg, more = {}) => ({ date, kind, cash, kg, note: "n", ...more });
const seed = (date) => step(date, "Fulfilment", 0, 0, { note: "as booked" });
/* s267 before the hand fix: handed over by a Correction that kept no record, then RM 220 in cash */
const s267 = () => ({ rid: "zu1", customer: "CX9-ZED", qty: 2, total: 220, cash: 220, date: D, deliveredQty: 2, deliveredOn: D, handover: "collected", paidOn: D, cost: 116,
  amend: [seed(D), step(D, "Correction", 0, 2), step(D, "Fulfilment", 220, 0)] });
/* paid, then one unit collected by a Fulfilment: the newest move is the handover; a site order's row */
const zu2 = () => ({ rid: "zu2", customer: "CX8-ZED", qty: 1, total: 110, cash: 110, date: D0, deliveredQty: 1, deliveredOn: D0, handover: "collected", paidOn: D0, cost: 58,
  amend: [seed(D0), step(D0, "Fulfilment", 110, 0), step(D0, "Fulfilment", 0, 1)] });
/* a site order whose goods' price was restated by a Correction that says what it replaced */
const zu3 = () => ({ rid: "zu3", customer: "CX7-ZED", qty: 1, total: 100, cash: 0, date: D, deliveredQty: 0, cost: 58,
  amend: [seed(D), step(D, "Correction", 0, 0, { was: { total: 110 } })] });
/* paid by a Fulfilment, nothing waiting on it in the book, but money folded since the mirror was seeded */
const zu4 = () => ({ rid: "zu4", customer: "CX6-ZED", qty: 1, total: 110, cash: 50, date: D, deliveredQty: 0, cost: 58, amend: [seed(D), step(D, "Fulfilment", 50, 0)] });
/* paid by a Fulfilment, a handover waiting under Approve */
const zu5 = () => ({ rid: "zu5", customer: "CX5-ZED", qty: 1, total: 110, cash: 50, date: D, deliveredQty: 0, cost: 58, amend: [seed(D), step(D, "Fulfilment", 50, 0)] });
const ORDER = (id, row, more) => ({ id, u: "ux0u-un" + id.slice(-1), code: row.customer, product: "salt", qty: row.qty, total: row.total, delivery: 0, mode: "collect",
  ledgerKey: E.ovKey(row), paid: row.cash, moved: row.deliveredQty, queued: { paid: row.cash, moved: row.deliveredQty }, payments: [], history: [], ...more });

async function fixture(opts = {}) {
  const source = await toolsBook();
  const ledger = JSON.parse(JSON.stringify(source.ledger)), version = source.version;
  source.w.close();
  ledger.sales.push(s267(), zu2(), zu3(), zu4(), zu5());
  ledger.customerRefunds = (ledger.customerRefunds || []).concat([{ party: "CX9-ZED", rid: "zu1", amount: 20, since: D, note: "an invented refund" }]);
  ledger.COUNT_ON = Object.assign({}, ledger.COUNT_ON, { salt: "2026-10-03" });
  const db = new DatabaseSync(":memory:"), migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((f) => /^\d+_.*\.sql$/.test(f)).sort())
    db.exec(readFileSync(new URL(file, migrations), "utf8"));
  db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger }).sql);
  const D1 = {
    batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    prepare(sql) {
      const st = db.prepare(sql);
      const bind = (args) => ({ run() { return { meta: { changes: Number(st.run(...args).changes || 0) } }; }, first() { return st.get(...args) ?? null; }, all() { return { results: st.all(...args) }; } });
      return { ...bind([]), bind: (...args) => bind(args) };
    }
  };
  const draftIn = (id, status, payload, committed = null) => db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,party,product,amends,amend_kind,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, status, "sales", J({ at: id, type: "AMEND", payload: { mode: "amend", direction: "SELL", date: D, ...payload } }), J({ qty: 1, total: 1 }), "a move", payload.party || "CX6-ZED", "salt", payload.rid, payload.kind, "test", id, committed);
  /* folded after the mirror was seeded: on its way until the mirror has it (rowRoom), and no longer waiting under Approve */
  draftIn("2026-10-16T01:00:00.000Z", "approved", { kind: "Fulfilment", rid: "zu4", cash: 60, kg: 0 }, "2099-01-01T00:00:00.000Z");
  draftIn("2026-10-16T01:00:01.000Z", "pending", { kind: "Fulfilment", rid: "zu5", cash: 0, kg: 1, party: "CX5-ZED" });
  const orders = opts.orders || [ORDER("20261002000000-un2", zu2(), { status: "done" }), ORDER("20261015000000-un3", zu3(), { status: "acknowledged" })];
  const site = { fetch: async (url, init) => {
    const u = new URL(url);
    if (u.pathname === "/desk/orders") return opts.siteDown ? new Response("down", { status: 503 }) : Response.json({ ok: true, orders });
    return Response.json({ ok: true });
  } };
  const key = "undo-local-capability-0123456789abcdef";
  const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: key, STMT_SITE: site, STMT_DESK_KEY: "desk-key-for-the-fixture" };
  const env = { STMT: new Store(), COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
  const call = async (path, body) => {
    const res = await handleMaker(new Request("https://counter.test" + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: J(body) }),
      env, path, { email: "maakmal97@icloud.com" });
    return { status: res.status, j: await res.json() };
  };
  const drafts = () => db.prepare("SELECT id,status,amends,amend_kind,entry,flags FROM draft WHERE status='pending' ORDER BY id").all().map((r) => ({ ...r, entry: JSON.parse(r.entry), flags: JSON.parse(r.flags || "[]") }));
  return { db, D1, call, drafts, mirror: () => readBook(D1) };
}

export async function run({ ok, pageWork }) {
  /* A. THE ENGINE */
  const u1 = E.undoOf(s267());
  ok(u1.i === 2 && u1.kind === "pay" && J(u1.fields) === J({ cash: 0, paidOn: null }),
    "s267's newest move is its RM 220 payment, and undoing it sets cash to nothing and clears the day it was paid: " + J(u1));
  const u2 = E.undoOf(zu2());
  ok(u2.i === 2 && u2.kind === "hand" && J(u2.fields) === J({ deliveredQty: 0, deliveredOn: null, handover: null }),
    "a handover undone takes its units off what was handed over, and at none clears the day and the way: " + J(u2));
  const part = { ...zu2(), qty: 2, deliveredQty: 2, amend: [seed(D0), step(D0, "Fulfilment", 0, 1), step(D0, "Fulfilment", 110, 1)] };
  const u2b = E.undoOf(part);
  ok(u2b.kind === "payhand" && J(u2b.fields) === J({ cash: 0, deliveredQty: 1, paidOn: null }),
    "a payment and a handover in one step come back together, the day handed over kept while units remain: " + J(u2b));
  const u3 = E.undoOf(zu3());
  ok(u3.i === 1 && u3.kind === "terms" && J(u3.fields) === J({ total: 110 }),
    "a Correction is undone from its own record, the figure it replaced: " + J(u3));
  ok(!!E.undoOf(s267(), 1).fault && /newest/.test(E.undoOf(s267(), 1).fault),
    "an older move is never undone: only the newest, so undos peel back in order");
  const party = { ...zu3(), amend: [seed(D), step(D, "Correction", 0, 0, { was: { party: "CX1-ZED" } })] };
  const legacy = { ...s267(), amend: [seed(D), step(D, "Correction", 0, 2)] };
  ok(/by hand/.test(E.undoOf(party).fault || "") && /by hand/.test(E.undoOf(legacy).fault || "") && /by hand/.test(E.undoOf({ ...zu2(), amend: [seed(D0), step(D0, "Modification", 0, 0)] }).fault || ""),
    "a change of party, a Correction that kept no record and a Modification are undone by hand: " + J([E.undoOf(party).fault, E.undoOf(legacy).fault]));
  const after = s267();
  applyAmend(after, { date: "2026-10-16", kind: "Correction", cash: 0, kg: 0, fields: u1.fields, undo: u1.i }, "SELL", "undo");
  const last = after.amend[after.amend.length - 1];
  ok(after.cash === 0 && !("paidOn" in after) && after.amend[2].undone === "2026-10-16" && last.undoes === 2 && last.kg === 0 && J(last.was) === J({ cash: 220, paidOn: D })
    && J(last.took) === J({ cash: 220 }),
  "the fold writes the undo, marks the step undone, names it on the undo's own step and says what it took back: " + J(after.amend.slice(2)));
  const next = E.undoOf(after);
  ok(next.i === 1 && /by hand/.test(next.fault || ""), "the next Undo is the move before it, here a handover kept for a hand fold: " + J(next));
  const hand = zu2();
  applyAmend(hand, { date: "2026-10-16", kind: "Correction", cash: 0, kg: 0, fields: u2.fields, undo: 2 }, "SELL", "undo");
  let threw = "";
  try { applyAmend(s267(), { date: "2026-10-16", kind: "Correction", cash: 0, kg: 0, fields: { cash: 100 }, undo: 2 }, "SELL", "undo"); } catch (e) { threw = e.message; }
  ok(hand.deliveredQty === 0 && hand.amend[2].undone && hand.amend[3].kg === 0 && J(hand.amend[3].took) === J({ units: 1 }) && /does not set what undoing/.test(threw),
    "an undone handover's own step moves nothing on the walk, says the units it took back, and the writer refuses other figures: " + J([hand.amend.slice(2), threw]));
  const late = (r) => E.payDelays([r], r.customer, "2026-10-20", {});
  /* paid on time on 01 Oct, which was a mistake taken back, then really paid on 12 Oct: late, ten days from the handover */
  const undone = { ...zu2(), deliveredOn: D0, paidOn: "2026-10-12", amend: [seed(D0), step(D0, "Fulfilment", 0, 1), step("2026-10-01", "Fulfilment", 110, 0, { undone: "2026-10-11" }),
    step("2026-10-11", "Correction", 0, 0, { undoes: 2 }), step("2026-10-12", "Fulfilment", 110, 0)] };
  ok(late(undone)[0].days === 10, "the late-payer walk passes an undone payment over: the payment taken back no longer pays the row on time: " + J(late(undone)));
  /* really paid on 01 Oct; a second payment on 12 Oct was a mistake taken back: the row was paid on the 1st */
  const paidOn = { ...zu2(), paidOn: "2026-10-01", amend: [seed(D0), step(D0, "Fulfilment", 0, 1), step("2026-10-01", "Fulfilment", 110, 0), step("2026-10-12", "Fulfilment", 110, 0, { undone: D }),
    step(D, "Correction", 0, 0, { undoes: 3 })] };
  ok(E.txDates(paidOn).pOn === "2026-10-01" && J(E.txHandSteps({ ...zu2(), amend: [seed(D0), step(D0, "Fulfilment", 0, 1, { undone: D }), step(D, "Correction", 0, 0, { undoes: 1 }), step("2026-10-16", "Fulfilment", 0, 1)], deliveredQty: 1 }).map((x) => x.d)) === J(["2026-10-16"]),
    "the day a row was paid passes an undone payment over, and an undone handover holds no units: " + J(E.txDates(paidOn)));
  const SNAP = (await import("../engine/snapshot.mjs")).default;
  const leakBook = { defaultProd: "salt", counts: [{ product: "salt", date: "2026-10-01", drift: 0 }, { product: "salt", date: "2026-10-10", drift: -2 }],
    sales: [{ customer: "CX9-ZED", qty: 1, total: 110, date: "2026-10-04", deliveredQty: 1, deliveredOn: "2026-10-20",
      amend: [seed("2026-10-04"), step("2026-10-05", "Fulfilment", 0, 1, { undone: "2026-10-06" }), step("2026-10-06", "Correction", 0, 0, { undoes: 1 }), step("2026-10-20", "Fulfilment", 0, 1)] }] };
  ok(SNAP.leakCharge({ B: leakBook }, "salt") === null, "the leak's units sold pass an undone handover over: " + J(SNAP.leakCharge({ B: leakBook }, "salt")));
  try {
    const { openMaster } = await import("../tools/payload.mjs");
    const { w } = await openMaster();
    const rep = w.replayAmend(paidOn);
    ok(Array.isArray(rep) && rep.length === 4 && !rep.some((x) => x && x.date === "2026-10-12"), "the Desk's ledger card replays a trail without the step undone: " + J(rep && rep.map((x) => x.date)));
  } catch (e) { ok(false, "the Desk's ledger card could not be read: " + (e && e.stack)); }

  /* B. THE FOLD */
  const item = (id, rid, payload) => ({ id, collection: "sales", amends: rid, amendKind: payload.kind, row: { rid, qty: 2, total: 220, cash: 220 },
    entry: { payload: { mode: "amend", direction: "SELL", rid, date: "2026-10-16", ...payload } } });
  const fbook = () => ({ sales: [s267()], purchases: [] });
  const pOk = plan(fbook(), { approved: [item("a1", "zu1", { kind: "Correction", fields: u1.fields, undo: 2 })] });
  const pWrong = plan(fbook(), { approved: [item("b1", "zu1", { kind: "Correction", fields: { cash: 100 }, undo: 2 })] });
  const pStale = plan({ sales: [{ ...s267(), cash: 200, paidOn: undefined, amend: [seed(D), step(D, "Correction", 0, 2), step(D, "Fulfilment", 200, 0)] }], purchases: [] },
    { approved: [item("c0", "zu1", { kind: "Fulfilment", cash: 20, kg: 0 }), item("c1", "zu1", { kind: "Correction", fields: { cash: 0 }, undo: 2 })] });
  ok(pOk.refused.length === 0 && pOk.items.length === 1 && pWrong.refused.length === 1 && /does not set what undoing/.test(pWrong.refused[0].why)
    && pStale.refused.length === 1 && pStale.refused[0].id === "c1" && /newest/.test(pStale.refused[0].why),
  "the fold takes an undo with its figures, and refuses other figures or a move folded before it in the batch: " + J([pOk.refused, pWrong.refused, pStale.refused]));

  /* C. THE DRAFTER, D. THE DESK */
  const f = await fixture();
  try {
    const book = await withRefunds(f.D1, await f.mirror()), row1 = book.sales.find((s) => s.rid === "zu1");
    const asEntry = (fields, undo) => E.ledgerAmendmentEntry({ at: "2026-10-16T02:00:00.000Z", row: row1, direction: "SELL", kind: "Correction", date: "2026-10-16", fields, undo });
    const d1 = draftRow(asEntry(u1.fields, 2), book), dOld = draftRow(asEntry({ deliveredQty: 0 }, 1), book), dOff = draftRow(asEntry({ cash: 10 }, 2), book);
    ok(!d1.skip && /Undoes the newest move/.test(d1.reasoning) && d1.flags.some((x) => /open refund of RM 20 on zu1/.test(x))
      && /newest/.test(dOld.skip || "") && /does not set what undoing/.test(dOff.skip || ""),
    "the drafter drafts the newest move's undo, says the refund it would strand, and refuses an older move or other figures: " + J([d1.flags, dOld.skip, dOff.skip]));
    const d2 = draftRow(E.ledgerAmendmentEntry({ at: "2026-10-16T02:00:01.000Z", row: book.sales.find((s) => s.rid === "zu2"), direction: "SELL", kind: "Correction", date: "2026-10-16", fields: u2.fields, undo: 2 }), book);
    ok(!d2.skip && d2.flags.some((x) => /A count of this book on 2026-10-03 came after this handover of 1 unit/.test(x)),
      "a handover undone after a count of its book is said: " + J(d2.flags));

    const h1 = await f.call("/all/maker/undo", { rid: "zu1" });
    const hist = h1.j.history || {};
    ok(h1.status === 200 && J(hist.moves.map((m) => [m.i, m.kind, m.cash, m.kg])) === J([[2, "Fulfilment", 220, 0], [1, "Correction", 0, 2]])
      && hist.undo && hist.undo.i === 2 && J(hist.undo.fields) === J(u1.fields) && hist.undo.route === "ledger" && !hist.undo.blocked
      && J([hist.undo.now.paid, hist.undo.now.owed, hist.undo.after.paid, hist.undo.after.owed]) === J([220, 0, 0, 220]) && hist.undo.notes.length === 1,
    "History reads the row's moves newest first and the newest one's undo, its Now and After and what he must know: " + J(hist));
    const n0 = f.drafts().length;
    const moved = await f.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T02:00:09.000Z", rid: "zu1", kind: "Correction", date: "2026-10-16", fields: { cash: 10 }, undo: 2 });
    ok(moved.status === 400 && /changed since you read it/.test(moved.j.error || "") && f.drafts().length === n0,
      "an undo carrying other figures than the Desk reads is refused, and nothing is drafted: " + J(moved.j));
    const stale = await f.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T02:00:10.000Z", rid: "zu1", kind: "Correction", date: "2026-10-16", fields: { deliveredQty: 0 }, undo: 1 });
    const sent = await f.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T02:00:11.000Z", rid: "zu1", kind: "Correction", date: "2026-10-16", fields: u1.fields, undo: 2 });
    const made = f.drafts().filter((d) => d.amends === "zu1");
    ok(stale.status === 400 && /no longer the move you read/.test(stale.j.error || "") && sent.status === 200 && made.length === 1
      && made[0].entry.payload.undo === 2 && J(made[0].entry.payload.fields) === J(u1.fields) && f.drafts().length === n0 + 1,
    "an undo of a move that is not the newest is refused, and the newest one's is drafted as one Correction naming its step: " + J([stale.j, sent.j, made.map((d) => d.entry.payload)]));
    const again = await f.call("/all/maker/undo", { rid: "zu1" });
    ok(again.j.history.undo && /waits under Approve/.test(again.j.history.undo.blocked || ""),
      "while the undo waits under Approve, the row offers no other: " + J(again.j.history.undo));
    const h4 = await f.call("/all/maker/undo", { rid: "zu4" }), h5 = await f.call("/all/maker/undo", { rid: "zu5" });
    const s4 = await f.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T02:00:12.000Z", rid: "zu4", kind: "Correction", date: "2026-10-16", fields: { cash: 0 }, undo: 1 });
    ok(/Money is already on its way/.test(h4.j.history.undo.blocked || "") && /waits under Approve/.test(h5.j.history.undo.blocked || "")
      && s4.status === 400 && /Money is already on its way/.test(s4.j.error || ""),
    "nothing is undone while money is on its way to the row, or a move on it waits under Approve; sent anyway, it is refused: " + J([h4.j.history.undo, h5.j.history.undo, s4.j]));
    const room = await makerAmendmentRoom(f.D1, E.ledgerAmendmentEntry({ at: "2026-10-16T02:00:13.000Z", row: book.sales.find((s) => s.rid === "zu4"), direction: "SELL", kind: "Correction",
      date: "2026-10-16", fields: { cash: 0 }, undo: 1 }), book);
    const pay = await makerAmendmentRoom(f.D1, E.ledgerAmendmentEntry({ at: "2026-10-16T02:00:14.000Z", row: row1, direction: "SELL", kind: "Fulfilment", date: "2026-10-16", cash: 50, movedUnits: 0 }), book);
    ok(/Money is already on its way to this row\. Decide it before undoing a move\./.test(room) && /can still take RM 0\.00/.test(pay),
      "the room check refuses an undo over money on its way, and a payment on a row an undo waits on is still held to what the mirror says it can take: " + J([room, pay]));
    /* 27 Oct 2026, his word: a payment past what the row owes passes as a refund only while no move waits on the row, and with the moves read */
    const payEntry = E.ledgerAmendmentEntry({ at: "2026-10-16T02:00:16.000Z", row: row1, direction: "SELL", kind: "Fulfilment", date: "2026-10-16", cash: 50, movedUnits: 0 });
    const payFree = await makerAmendmentRoom(f.D1, payEntry, book, []), payUndo = await makerAmendmentRoom(f.D1, payEntry, book, [made[0].entry]);
    ok(payFree === "" && /can still take RM 0\.00/.test(payUndo),
      "a payment past what the row owes passes with no move waiting on the row, and is held while its undo waits: " + J([payFree, payUndo]));
    const h2 = await f.call("/all/maker/undo", { order: "20261002000000-un2" }), h3 = await f.call("/all/maker/undo", { rid: "zu3" });
    const s3 = await f.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T02:00:15.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { total: 110 }, undo: 1 });
    ok(h2.status === 200 && h2.j.history.rid === "zu2" && h2.j.history.order === "20261002000000-un2" && h2.j.history.undo.route === "ledger"
      && h3.j.history.undo.route === "restate" && J(h3.j.history.undo.restate) === J({ qty: 1, total: 110, delivery: 0 })
      && s3.status === 400 && /order card/.test(s3.j.error || ""),
    "a site order's card reads its row's History; a change of its terms is undone by restateOrder, and refused by the ledger's road: " + J([h2.j.history.undo, h3.j.history.undo, s3.j]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); }
  /* 16 Oct 2026, CR3-DAM's s263: a Correction of an agreed site order's units, price or delivery is refused by the ledger's road, naming the
     order and the figures its Amend takes; anything else on it, or a row whose order is done, goes by the ledger as before */
  const fT = await fixture();
  try {
    const n0 = fT.drafts().length;
    const cut = await fT.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T06:00:00.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { total: 95 } });
    const mixed = await fT.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T06:00:01.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { total: 95, handover: "collected" } });
    const other = await fT.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T06:00:02.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { handover: "collected" } });
    const doneRow = await fT.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T06:00:03.000Z", rid: "zu2", kind: "Correction", date: "2026-10-16", fields: { total: 120 } });
    const made = fT.drafts().slice(n0).map((d) => [d.amends, J(d.entry.payload.fields)]);
    ok(cut.status === 409 && J(cut.j.restate) === J({ order: "20261015000000-un3", qty: 1, total: 95, delivery: 0 }) && /customer's order/.test(cut.j.error || "")
      && mixed.status === 400 && /on their own/.test(mixed.j.error || "") && !mixed.j.restate
      && other.status === 200 && doneRow.status === 409 && J(doneRow.j.restate) === J({ order: "20261002000000-un2", qty: 1, total: 120, delivery: 0 })
      && J(made) === J([["zu3", J({ handover: "collected" })]]),
    "a Correction of an agreed site order's price is refused by the ledger's road and names the order's Amend, and so is one whose order is completed (his answer "
      + "of 17 Oct 2026: a completed order keeps Amend); mixed with another field it is refused; another field is drafted as before: " + J({ cut: cut.j, mixed: mixed.j.error, other: other.status, done: doneRow.status, made }));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); }
  /* a trip row's delivery is the trip's, and a caller that asked for no site order is not told the site could not be read */
  const tBook = await fT.mirror(), z3 = tBook.sales.find((s) => s.rid === "zu3");
  const oT = ORDER("20261015000000-un3", zu3(), { status: "acknowledged" });
  z3.trip = "t1791900000009";
  const onTrip = makerLedgerAmendment({ at: "2026-10-16T06:00:05.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { delivery: 5 } }, tBook, { order: oT });
  delete z3.trip;
  const noCtx = makerLedgerAmendment({ at: "2026-10-16T06:00:06.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { total: 95 } }, tBook);
  ok(/trip's/.test(onTrip.error || "") && !onTrip.restate && !/could not be read/.test(noCtx.error || ""),
    "a delivery Correction on a trip row is refused, never sent to one order, and a caller that asked for no site order is not told the site was down: " + J([onTrip, noCtx.error || "ok"]));
  /* a settled order's reading: the row's money and goods too, never while the site holds a move the book has not heard or a claim waits */
  const sRow = { ...zu2(), total: 100, cash: 100 }, sO = ORDER("20261002000000-un2", zu2(), { status: "done" });
  ok(J(settledFromRow(sO, sRow)) === J({ qty: 1, total: 100, delivery: 0, paid: 100, moved: 1 }) && settledFromRow(sO, zu2()) === null
    && J(settledFromRow(sO, { ...zu2(), cash: 60 })) === J({ qty: 1, total: 110, delivery: 0, paid: 60, moved: 1 })
    && settledFromRow({ ...sO, status: "ready" }, sRow) === null
    && settledFromRow({ ...sO, paid: 120, queued: { paid: 110, moved: 1 } }, sRow) === null
    && settledFromRow({ ...sO, moved: 1, queued: { paid: 110, moved: 0 } }, sRow) === null
    && settledFromRow({ ...sO, payments: [{ at: "x", amount: 5, claim: "waiting" }] }, sRow) === null
    && settledFromRow(sO, { ...sRow, total: 2000000 }) === null && settledFromRow(sO, { ...sRow, delivery: 9 }) === null
    && settledFromRow({ ...sO, closed: { qty: 2, total: 200 } }, { ...sRow, qty: 2, deliveredQty: 2 }) === null
    && J(settledFromRow({ ...sO, mode: "deliver", delivery: 7 }, { ...sRow, trip: "t1", delivery: 0 })) === J({ qty: 1, total: 100, delivery: 7, paid: 100, moved: 1 }),
  "a settled order takes its row's size, goods, delivery, money and goods handed over; never when they agree, it is not settled, the site holds a "
    + "move the book has not heard, a claim waits, past the bounds, a charge on a collection or a closed order's size; a trip row leaves its delivery: " + J(settledFromRow(sO, sRow)));
  /* and the order book: the book's figures whole on a settled order alone, a move it has not told refusing them, and owing after them it opens again */
  const sd = { ...JSON.parse(J(sO)), status: "done", history: [{ at: "x", status: "ready", by: "desk" }, { at: "y", status: "done", by: "site" }] };
  const bk1 = decideDesk(JSON.parse(J(sd)), { restate: { qty: 1, total: 120, delivery: 0, paid: 110, moved: 1, book: true } }, "2026-10-17T01:00:00.000Z");
  const bo = applyEvent(JSON.parse(J(sd)), bk1.ev).order;
  const bk2 = decideDesk({ ...JSON.parse(J(sd)), status: "placed" }, { restate: { qty: 1, total: 120, delivery: 0, paid: 110, moved: 1, book: true } }, "2026-10-17T01:00:01.000Z");
  const bk3 = decideDesk({ ...JSON.parse(J(sd)), paid: 130 }, { restate: { qty: 1, total: 120, delivery: 0, paid: 110, moved: 1, book: true } }, "2026-10-17T01:00:02.000Z");
  const bk4 = applyEvent(JSON.parse(J(sd)), decideDesk(JSON.parse(J(sd)), { restate: { qty: 1, total: 90, delivery: 0, paid: 90, moved: 1, book: true } }, "2026-10-17T01:00:03.000Z").ev).order;
 const bk5 = applyEvent({ ...JSON.parse(J(sd)), history: [{ at: "x", status: "acknowledged", by: "desk" }, { at: "y", status: "done", by: "site" }] },
    decideDesk(JSON.parse(J(sd)), { restate: { qty: 1, total: 120, delivery: 0, paid: 110, moved: 1, book: true } }, "2026-10-17T01:00:04.000Z").ev).order;
  const bk6 = applyEvent({ ...JSON.parse(J(sd)), movedOn: "2026-10-02", movedAt: "z" },
    decideDesk(JSON.parse(J(sd)), { restate: { qty: 1, total: 110, delivery: 0, paid: 110, moved: 0, book: true } }, "2026-10-17T01:00:05.000Z").ev).order;
  ok(bk5.status === "ready" && bk6.moved === 0 && !bk6.movedOn && !bk6.movedAt && bk6.status === "ready",
    "a settled order with goods out opens again at Ready, and one the book says moved nothing keeps no handover day: " + J([bk5.status, bk6.moved, bk6.movedOn || null, bk6.status]));
  ok(bk1.ev && bo.status === "ready" && bo.total === 120 && bo.paid === 110 && bo.queued.paid === 110 && bk2.status === 409 && bk3.status === 409
    && bk4.status === "done" && bk4.paid === 90 && bk4.queued.paid === 90 && wakes(bk1.ev, bo, false) === null,
  "the order book takes the book's figures whole on an agreed or settled order alone (17 Oct 2026: an agreed one too), never over a move it has not told, opens one left owing at its state before, "
    + "and a cut with its money stays settled: " + J([bo.status, bo.total, bo.paid, bk2.error, bk3.error, bk4.status, bk4.paid]));
  const fTDown = await fixture({ siteDown: true });
  const cutDown = await fTDown.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T06:00:04.000Z", rid: "zu3", kind: "Correction", date: "2026-10-16", fields: { total: 95 } });
  ok(cutDown.status === 400 && /could not be read/.test(cutDown.j.error || "") && !fTDown.drafts().some((d) => d.amends === "zu3"),
    "while the site's orders cannot be read, a change of a sale's units, price or delivery waits: " + J(cutDown.j));
  /* the return leg's reading: an agreed order takes its row's figures, or nothing when it cannot */
  const ag = ORDER("20261015000000-un3", zu3(), { status: "acknowledged", total: 110 }), rowT = zu3();
  ok(J(termsFromRow(ag, rowT)) === J({ qty: 1, total: 100, delivery: 0 }) && termsFromRow({ ...ag, total: 100 }, rowT) === null
    && termsFromRow({ ...ag, status: "done" }, rowT) === null
    && termsFromRow({ ...ag, payments: [{ at: "x", amount: 5, claim: "waiting" }] }, rowT) === null
    && termsFromRow(ag, { ...rowT, delivery: 8 }) === null && J(termsFromRow({ ...ag, mode: "deliver" }, { ...rowT, delivery: 8 })) === J({ qty: 1, total: 100, delivery: 8 })
    && J(termsFromRow({ ...ag, mode: "deliver", delivery: 8 }, { ...rowT, trip: "t1", delivery: 0 })) === J({ qty: 1, total: 100, delivery: 8 })
    && termsFromRow({ ...ag, moved: 0 }, { ...rowT, qty: 0.5 }, 1) === null
    && termsFromRow(ag, { ...rowT, total: 2000000 }) === null
    && termsFromRow({ ...ag, closed: { qty: 2, total: 220 } }, { ...rowT, qty: 2 }) === null && J(termsFromRow({ ...ag, closed: { qty: 2, total: 220 } }, rowT)) === J({ qty: 1, total: 100, delivery: 0 }),
  "an agreed order takes its row's size, goods and delivery; never when they agree, it is not agreed, a claim waits, a charge would sit on a collection "
    + "or the size under what is out, past the site's bounds or a closed order's size; a row on a trip leaves the order its delivery: " + J(termsFromRow(ag, rowT)));
  const fBehind = await fixture({ orders: [ORDER("20261002000000-un2", zu2(), { status: "done", paid: 160, queued: { paid: 110, moved: 1 } })] });
  const fDown = await fixture({ siteDown: true });
  const fWait = await fixture({ orders: [ORDER("20261002000000-un2", zu2(), { status: "done", payments: [{ at: "2026-10-03T00:00:00.000Z", amount: 5, claim: "waiting" }] })] });
  const waitH = await fWait.call("/all/maker/undo", { rid: "zu2" });
  ok(/A payment they say they sent waits/.test(waitH.j.history.undo.blocked || ""), "nothing is undone while a payment they say they sent waits on the order: " + J(waitH.j.history.undo));
  const behind = await fBehind.call("/all/maker/undo", { rid: "zu2" }), down = await fDown.call("/all/maker/undo", { rid: "zu1" });
  ok(/has a move on the site the book has not heard/.test(behind.j.history.undo.blocked || "") && /could not be read/.test(down.j.history.undo.blocked || ""),
    "nothing is undone while the site order has a move the book has not heard, or while the site's orders cannot be read: " + J([behind.j.history.undo.blocked, down.j.history.undo.blocked]));
  const fbook3 = await (await fixture()).mirror();
  const o3 = ORDER("20261015000000-un3", zu3(), { status: "acknowledged" });
  const tap = restateTap(o3, new Date("2026-10-16T03:00:00.000Z"), { qty: 1, total: 110, delivery: 0, undo: 1 }, { book: fbook3, room: null, earlier: [], live: null });
  const tapOff = restateTap(o3, new Date("2026-10-16T03:00:00.000Z"), { qty: 1, total: 120, delivery: 0, undo: 1 }, { book: fbook3, room: null, earlier: [], live: null });
  ok(tap.entry && tap.entry.payload.undo === 1 && J(tap.entry.payload.fields) === J({ total: 110 }) && tap.site.restate.undo === true && /changed since/.test(tapOff.error || ""),
    "restateOrder carries an undo of the order's terms as exactly what undoing it sets, and tells the site it is one: " + J([tap.entry && tap.entry.payload, tap.site, tapOff.error]));

  /* E. THE SITE */
  const done = { id: "20261002000000-un2", status: "done", mode: "collect", qty: 1, total: 110, delivery: 0, paid: 110, moved: 1, movedOn: D0,
    queued: { paid: 110, moved: 1 }, payments: [{ at: "2026-10-02T03:00:00.000Z", amount: 110, method: "cod", by: "desk" }],
    history: [{ at: "x", status: "ready", by: "desk" }, { at: "y", status: "done", by: "desk" }] };
  const fx = undoFixes([{ ...done, ledgerKey: E.ovKey(zu2()) }], new Map([[E.ovKey(zu2()), { ...zu2(), deliveredQty: 0, amend: [seed(D0), step(D0, "Fulfilment", 110, 0), step(D0, "Fulfilment", 0, 1, { undone: D }),
    step(D, "Correction", 0, 0, { undoes: 2, took: { units: 1 } })] }]]), new Map([[E.ovKey(zu2()), 1]]));
  ok(J(fx) === J([{ id: "un-zu2-3", order: done.id, undo: true, unmove: 1 }]), "the Desk sends each undo on a site order's row as its undo fix, what it took back, by its own id: " + J(fx));
  const pv = decideDesk(JSON.parse(J(done)), { fix: { id: "un-zu2-9", undo: true, unpay: 110 } }, "2026-10-16T04:00:00.000Z");
  const o = JSON.parse(J(done)), r = applyEvent(o, pv.ev);
  ok(pv.ev && pv.ev.fix.line === "2026-10-02T03:00:00.000Z" && r.order.paid === 0 && r.order.queued.paid === 0 && !r.order.payments.length && r.order.status === "ready"
    && r.order.history.some((h) => h.note === "payment of 110.00 taken back"),
  "the order book takes back what the book took back: the payment's line, what it holds and what the ledger was told, reopening a done order: " + J(r.order));
  const w = wakes(pv.ev, r.order, r.done), mv = applyEvent(JSON.parse(J(done)), decideDesk(JSON.parse(J(done)), { fix: { id: "un-zu2-8", undo: true, unmove: 1 } }, "2026-10-16T04:00:01.000Z").ev);
  ok(J(w) === J({ k: "corrected", o: done.id, v: "owed" }) && typeof NEWS.corrected === "string" && mv.order.moved === 0 && mv.order.queued.moved === 0 && !mv.order.movedOn,
    "and wakes them with a banner of its own, its body the case; a handover taken back comes off what they hold: " + J([w, mv.order.moved]));
  const over = decideFix(JSON.parse(J(done)), { id: "un-zu2-7", undo: true, unpay: 200 }, "2026-10-16T04:00:02.000Z");
  const two = { ...JSON.parse(J(done)), qty: 2, total: 220, paid: 220, moved: 2, queued: { paid: 220, moved: 2 },
    payments: [{ at: "2026-10-02T03:00:00.000Z", amount: 110, method: "cod", by: "desk" }, { at: "2026-10-02T04:00:00.000Z", amount: 110, claim: "received", method: "transfer" }] };
  const halfP = applyEvent(JSON.parse(J(two)), decideDesk(JSON.parse(J(two)), { fix: { id: "un-zu2-6", undo: true, unpay: 110 } }, "2026-10-16T04:00:04.000Z").ev).order;
  const halfM = applyEvent(JSON.parse(J(two)), decideDesk(JSON.parse(J(two)), { fix: { id: "un-zu2-5", undo: true, unmove: 1 } }, "2026-10-16T04:00:05.000Z").ev).order;
  ok(halfP.paid === 110 && halfP.payments.length === 1 && halfP.payments[0].by === "desk" && halfM.moved === 1 && halfM.queued.moved === 1 && !!halfM.movedOn,
    "a part taken back takes that part alone, the newest line of its amount: " + J([halfP.paid, halfP.payments, halfM.moved]));
  const rest = decideDesk({ ...JSON.parse(J(done)), status: "acknowledged", moved: 0 }, { restate: { qty: 1, total: 100, delivery: 0, undo: true } }, "2026-10-16T04:00:03.000Z");
  ok(over.status === 409 && /fix refused: /.test(over.error) && rest.ev && rest.ev.undo === true && (wakes(rest.ev, { ...done, total: 100 }, false) || {}).k === "corrected"
    && wakes({ kind: "restate", at: "z", qty: 1, total: 100, delivery: 0 }, done, false) === null,
  "never more than the order holds; an undone change of terms wakes them, an amendment of his does not: " + J([over, rest.ev]));

  /* F. SALT ADMIN */
  const HIST = { rid: "zt1", party: "CX9-ZED", product: "salt", handover: "collected", order: null, moves: [{ i: 2, date: D, kind: "Fulfilment", cash: 220, kg: 0, undone: false, changed: null },
    { i: 1, date: D, kind: "Correction", cash: 0, kg: 2, undone: false, changed: null }], undo: { i: 2, kind: "pay", date: D, cash: 220, kg: 0, fields: { cash: 0, paidOn: null },
    now: { paid: 220, owed: 0, handed: 2, qty: 2 }, after: { paid: 0, owed: 220, handed: 2, qty: 2 }, notes: ["An open refund of RM 20 on zt1 is more than the row is paid past once this is undone."], route: "ledger" } };
  const TERMS = { rid: "zr1", party: "CX1-ZED", product: "salt", handover: null, order: "ord-r1", moves: [{ i: 1, date: D, kind: "Correction", cash: 0, kg: 0, undone: false, changed: ["total"] }],
    undo: { i: 1, kind: "terms", date: D, cash: 0, kg: 0, fields: { total: 110 }, now: { paid: 0, owed: 100, handed: 0, qty: 1, total: 100, delivery: 0 }, after: { paid: 0, owed: 110, handed: 0, qty: 1, total: 110, delivery: 0 }, notes: [], route: "restate",
      restate: { qty: 1, total: 110, delivery: 0 } } };
  const T = "t1791900000000";
  const TRIP = { trip: T, party: "CX9-ZED", date: D, owed: 220, paid: 220, handedLines: 2, waiting: 0, lines: [
    { rid: "zt1", product: "salt", qty: 2, total: 220, delivery: 0, paid: 220, owed: 0, handed: 2, left: 0, waiting: 0, open: false },
    { rid: "zt2", product: "oil", qty: 1, total: 20, delivery: 0, paid: 0, owed: 20, handed: 1, left: 0, waiting: 0, open: true }] };
  const open = async (hist) => {
    const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, drafts: [], queue: [], trips: [TRIP], sameDay: [] }),
      extra: (route, body) => route === "/all/maker/undo" ? { ok: true, history: body.rid === "zt2" ? { ...HIST, rid: "zt2", undo: { ...HIST.undo, blocked: "Money is already on its way to this row. Decide it before undoing a move." } }
        : body.order === "ord-r1" ? TERMS : hist }
        : /^\/all\/maker\/(inputs\/ledger-amend|orders\/ord-r1\/restate)$/.test(route) ? { ok: true, draft: body.at || "x", status: "pending" } : undefined });
    await p.work.quiet();
    p.tap = async (act, key) => { const e = byAct(p.d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    p.sent = (route) => p.posts.filter((x) => x.route === route).map((x) => x.body);
    return p;
  };
  const text = (n) => (n && n.textContent || "").replace(/\s+/g, " ").trim();
  let p = await open(HIST);
  try {
    await p.tap("nav.orders"); await p.tap("part.orders.confirmed");
    let card = p.card("trip:" + T);
    const lineH = card && [...card.querySelectorAll(".tripline")].map((l) => !!byAct(l, "undo.history"));
    await p.tap("undo.history", "line:zt1");
    card = p.card("trip:" + T);
    const moves = [...card.querySelectorAll('[data-history="line:zt1"] .undomove')];
    ok(J(lineH) === J([true, true]) && J(p.sent("/all/maker/undo")) === J([{ rid: "zt1" }]) && moves.length === 2
      && text(moves[0].querySelector(".maker-facts")) === "RM 220.00 paid, 15 Oct 2026" && text(moves[1].querySelector(".maker-facts")) === "2 units collected, 15 Oct 2026"
      && !!byAct(moves[0], "undo.open") && !byAct(moves[1], "undo.open"),
    "each line of an order of several books has its History, read from the Desk, newest first, and Undo on the newest move alone: " + moves.map(text).join(" | "));
    await p.tap("undo.history", "line:zt2");
    card = p.card("trip:" + T);
    const z2 = card.querySelector('[data-history="line:zt2"]');
    ok(!!z2.querySelector("[data-undo-blocked]") && !byAct(z2, "undo.open") && /Money is already on its way/.test(text(z2)),
      "a move that waits on something offers no Undo, and says why: " + text(z2));
    await p.tap("undo.open", "line:zt1");
    const sheet = p.d.getElementById("ynSheet"), go = p.d.getElementById("ynGo");
    const rowsNA = sheet ? [...sheet.querySelectorAll(".apnow tbody tr")].map((tr) => [...tr.children].map(text).join(" | ")) : [];
    ok(!!sheet && /Undo this move\?/.test(text(sheet)) && J(rowsNA) === J(["Paid | RM 220.00 | RM 0.00", "Owed | RM 0.00 | RM 220.00", "Handed over | 2 of 2 units | 2 of 2 units"])
      && /open refund of RM 20/.test(text(sheet)) && text(go) === "Undo: zt1 owes RM 220.00" && !p.sent("/all/maker/inputs/ledger-amend").length,
    "Undo opens the Sheet: Now and After as the Desk read them, what he must know, and one action saying the result; nothing is sent yet: " + J({ rowsNA, go: text(go) }));
    go.click(); await p.work.quiet();
    const sentU = p.sent("/all/maker/inputs/ledger-amend");
    ok(sentU.length === 1 && sentU[0].rid === "zt1" && sentU[0].kind === "Correction" && sentU[0].undo === 2 && J(sentU[0].fields) === J({ cash: 0, paidOn: null }),
      "his yes sends one Correction carrying the figures the Desk read and the step it undoes: " + J(sentU));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  p = await open(HIST);
  try {
    await p.tap("nav.orders"); await p.tap("part.orders.ready");
    const card = p.card("ord-r1");
    ok(!!card && !!byAct(card, "undo.history", "order:ord-r1"), "an agreed order's card has its History");
    /* 18 Oct 2026: the customer's fold, shut until a tap */
    const fold = card && card.querySelector('[data-history="order:ord-r1"]');
    ok(!!fold && fold.tagName === "DETAILS" && fold.classList.contains("salt-plan") && !fold.open && text(fold.querySelector(".salt-plan__title")) === "Order log",
      "its History is the customer's fold, named Order log on an order (canvas V16), shut: " + (fold && fold.outerHTML.slice(0, 120)));
    await p.tap("undo.history", "order:ord-r1");
    ok(J(p.sent("/all/maker/undo")) === J([{ order: "ord-r1" }]), "read by its order: " + J(p.sent("/all/maker/undo")));
    await p.tap("undo.open", "order:ord-r1");
    const go = p.d.getElementById("ynGo"), label = text(go);
    go.click(); await p.work.quiet();
    const rs = p.sent("/all/maker/orders/ord-r1/restate");
    ok(label === "Undo: zr1 at RM 110.00" && rs.length === 1 && rs[0].undo === 1 && rs[0].total === 110 && rs[0].qty === 1 && rs[0].delivery === 0
      && !p.sent("/all/maker/inputs/ledger-amend").length,
    "a change of a site order's terms is undone by the order's own restate, so the order keeps its row: " + J({ label, rs }));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* the Corrections form: a change the Desk names as a site order's goes as the order's Amend, once, and the form says so */
  const pc = await richOwnerPage({ pageWork,
    extra: (route, body) => route === "/all/maker/inputs/ledger-amend" && body.fields && body.fields.qty === 3
      ? { refuse: "This row is a customer's order, so its units, price or delivery change on the order and the row together.",
        detail: { restate: { order: "20261015000000-un3", qty: 3, total: 200, delivery: 0 } } }
      : /^\/all\/maker\/orders\/[0-9]{14}-[a-z0-9]+\/restate$/.test(route) ? { ok: true, draft: "x", status: "pending" } : undefined });
  try {
    await pc.work.quiet();
    byAct(pc.d, "nav.record").click(); await pc.work.quiet();
    const ed = [...pc.d.querySelectorAll("#makerInputs section.maker-input")].find((x) => x.querySelector("h3").textContent === "Correct a row");
    const put = (c, v) => { c.value = v; c.dispatchEvent(new pc.w.Event("input", { bubbles: true })); c.dispatchEvent(new pc.w.Event("change", { bubbles: true })); };
    put(byAct(ed, "record.amend.row"), "row-1"); put(byAct(ed, "record.amend.field"), "qty"); put(byAct(ed, "record.amend.value"), "3");
    byAct(ed, "record.amend.add-change").click(); await pc.work.quiet();
    byAct(ed, "record.amend.send").click(); await pc.work.quiet();
    const rs = pc.posts.filter((x) => /\/restate$/.test(x.route)), tried = pc.posts.filter((x) => x.route === "/all/maker/inputs/ledger-amend");
    const said = ed.textContent.replace(/\s+/g, " ");
    ok(tried.length === 1 && rs.length === 1 && rs[0].route === "/all/maker/orders/20261015000000-un3/restate" && rs[0].body.total === 200 && rs[0].body.qty === 3
      && rs[0].body.delivery === 0 && /^[0-9a-f]{32}$/.test(rs[0].body.rid) && /amendment of their order/.test(said),
    "a Correction the Desk names as a site order's is sent once as that order's Amend, under its own request id, and the form says so: " + J({ tried: tried.length, rs }));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { pc.w.close(); }

  /* 17 Oct 2026, CR3-DAM's order: a Ready order with every unit handed over asks for no handover; one with units left still does */
  const handAsk = async (moved) => {
    const ph = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: (j.orders || []).map((o) => o.id === "ord-r1" ? { ...o, moved } : o), drafts: [], queue: [], trips: [], sameDay: [] }) });
    try {
      await ph.work.quiet();
      byAct(ph.d, "nav.orders").click(); await ph.work.quiet(); byAct(ph.d, "part.orders.ready").click(); await ph.work.quiet();
      const c = ph.card("ord-r1");
      return c ? [!!byAct(c, "order.handed-units"), !!byAct(c, "order.handed")] : null;
    } finally { ph.w.close(); }
  };
  const allOut = await handAsk(1), partOut = await handAsk(0.5);
  ok(J(allOut) === J([false, false]) && J(partOut) === J([true, true]),
    "a Ready order with every unit handed over offers no handover field or button, and one with units left still does: " + J({ allOut, partOut }));

  /* the approve card: an undo is one card with its own verb, and the button says the result */
  const mb = { sales: [s267()], purchases: [], state: { TERMS: { ceiling: 250 } } };
  const ud = { id: "2026-10-16T05:00:00.000Z", status: "pending", collection: "sales", party: "CX9-ZED", product: "salt", amends: "zu1", amendKind: "Correction",
    entry: { at: "2026-10-16T05:00:00.000Z", makerRequest: "f".repeat(64), payload: { mode: "amend", kind: "Correction", direction: "SELL", rid: "zu1", date: "2026-10-16", fields: { cash: 0, paidOn: null }, undo: 2 } },
    row: { rid: "zu1", qty: 2, total: 220, cash: 220, changes: [{ field: "cash", from: 220, to: 0 }, { field: "paidOn", from: D, to: null }] }, flags: [] };
  approveFigures(mb, [ud], []);
  p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: [], drafts: [ud], queue: [], trips: [], sameDay: [] }) });
  try {
    await p.work.quiet();
    byAct(p.d, "nav.orders").click(); await p.work.quiet(); byAct(p.d, "part.orders.approve").click(); await p.work.quiet();
    const c = p.d.querySelector("#makerDrafts [data-maker-card]");
    ok(!!c && text(c.querySelector(".apverb")) === "Undo a payment" && text(byAct(c, "draft.approve")) === "Approve: zu1 owes RM 220.00",
      "an undo lands under Approve as one card, saying what it undoes, and its button the result: " + (c && [text(c.querySelector(".apverb")), text(byAct(c, "draft.approve"))]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
