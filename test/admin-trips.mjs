/* test/admin-trips.mjs: ORDERS ACROSS SEVERAL BOOKS, COUNTER ADMIN'S HALF (plan 3 of docs/plans-counter-admin.html, 16 Oct 2026).
 *
 * Prompted 15 Oct 2026: a buyer's salt, oil and rice of 14 Oct were three cards, each handed over and paid on its own. What is proved here,
 * each check red under its own mutation (test/admin-trips.mutations.json), with invented codes only (rule 2):
 *   A  the Desk reads each open trip as one card (owed, paid, lines handed in full, one line a book) and the same-day rows that could be one,
 *      never two of one book or two deliveries, and the rows as they will stand once the moves waiting on them are approved
 *   B  one payment, split by the Desk oldest first by the engine's claimAlloc, refused past what the order owes, refused whole if the split
 *      moved since he read it, sent as one Fulfilment a share, and refused whole when one share is more than its row can take (rowRoom)
 *   C  These are one order: a Correction a row setting one trip, refused for two deliveries or a book twice, refused while a join waits,
 *      and never offered by Correct a row; the engine, the drafter and the fold each hold a trip together
 *   D  the card on Counter Admin: the head and a line a book, marks and no product word; Handover all and a part, one handover a line, a
 *      refused line holding only itself; the split shown before Record; the join's one tap; and the approve card, one card for the moves */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { readBook as toolsBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { readBook, draftRow } from "../src/drafter.js";
import { approveFigures } from "../src/approve-figures.js";
import { plan } from "../tools/fold.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify, E = POSITION_ENGINE;
const D = "2026-10-14", T = "t1791900000000", T3 = "t1791900000003";
class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}
const sale = (rid, customer, product, qty, total, more = {}) => ({ rid, customer, product, date: D, qty, total, cost: +(total * 0.5).toFixed(2), cash: 0, deliveredQty: 0, ...more });

async function fixture() {
  const source = await toolsBook();
  const ledger = JSON.parse(JSON.stringify(source.ledger)), version = source.version;
  source.w.close();
  ledger.sales.push(
    sale("zt1", "CX9-ZED", "salt", 1, 110, { delivery: 10, trip: T }), sale("zt2", "CX9-ZED", "oil", 10, 116, { trip: T }), sale("zt3", "CX9-ZED", "rice", 5, 35, { trip: T }),
    sale("yd1", "CX8-ZED", "salt", 1, 110, { delivery: 10 }), sale("yd2", "CX8-ZED", "oil", 2, 30),
    sale("xd1", "CX7-ZED", "salt", 1, 110), sale("xd2", "CX7-ZED", "salt", 2, 200),
    sale("wd1", "CX6-ZED", "salt", 1, 110, { delivery: 10 }), sale("wd2", "CX6-ZED", "oil", 2, 30, { delivery: 5 }),
    sale("vt1", "CX4-ZED", "salt", 1, 110, { delivery: 10, trip: T3 }), sale("vt2", "CX4-ZED", "oil", 2, 30, { trip: T3 }), sale("vt3", "CX4-ZED", "rice", 5, 35));
  const db = new DatabaseSync(":memory:"), migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((f) => /^\d+_.*\.sql$/.test(f)).sort())
    db.exec(readFileSync(new URL(file, migrations), "utf8"));
  db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger }).sql);
  const hooks = [];
  const D1 = {
    batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    prepare(sql) {
      const st = db.prepare(sql);
      const bind = (args) => ({
        run() { return { meta: { changes: Number(st.run(...args).changes || 0) } }; },
        first() { return st.get(...args) ?? null; },
        /* a hook runs once, after the first read whose SQL it names has answered: a move landing between that read and the next */
        all() { const out = { results: st.all(...args) }; const i = hooks.findIndex((h) => sql.includes(h.after)); if (i >= 0) hooks.splice(i, 1)[0].run(); return out; }
      });
      return { ...bind([]), bind: (...args) => bind(args) };
    }
  };
  const key = "trips-local-capability-0123456789abcdef";
  const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: key };
  const env = { STMT: new Store(), COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
  const call = async (path, body) => {
    const res = await handleMaker(new Request("https://counter.test" + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: J(body) }),
      env, path, { email: "maakmal97@icloud.com" });
    return { status: res.status, j: await res.json() };
  };
  const deskGet = async (path) => (await desk.fetch(new Request("https://desk" + path, { headers: { "X-Counter-Maker-Key": key } }), deskEnv, { waitUntil() {} })).json();
  const drafts = () => db.prepare("SELECT id,status,amends,amend_kind,entry FROM draft WHERE status='pending' ORDER BY id").all().map((r) => ({ ...r, entry: JSON.parse(r.entry) }));
  return { db, D1, hooks, call, deskGet, drafts, mirror: () => readBook(D1) };
}

export async function run({ ok, pageWork }) {
  const f = await fixture();
  const mine = (list, code) => (list || []).filter((t) => t.party === code);
  const at = (n) => new Date(Date.parse("2026-10-16T02:00:00.000Z") + n * 1000).toISOString();

  /* A. THE DESK'S READ */
  const r0 = await f.deskGet("/_internal/maker/drafts");
  const trip0 = mine(r0.trips, "CX9-ZED")[0] || {};
  ok(trip0.trip === T && trip0.owed === 271 && trip0.paid === 0 && trip0.handedLines === 0 && trip0.waiting === 0
    && J((trip0.lines || []).map((l) => [l.rid, l.product, l.qty, l.total, l.delivery, l.owed, l.left])) === J([["zt1", "salt", 1, 110, 10, 120, 1], ["zt2", "oil", 10, 116, 0, 116, 10], ["zt3", "rice", 5, 35, 0, 35, 5]]),
  "an open trip is one card on the review read: owed RM 271 across its three lines, the delivery on its one row, each line its book, units, total and what is left: " + J(trip0));
  ok(J(mine(r0.sameDay, "CX8-ZED").map((t) => t.rids)) === J([["yd1", "yd2"]]) && !mine(r0.sameDay, "CX7-ZED").length && !mine(r0.sameDay, "CX6-ZED").length && !mine(r0.sameDay, "CX9-ZED").length,
    "a buyer's same-day rows of two books with one delivery are offered as one order; two rows of one book, two deliveries or rows already on a trip are not: " + J((r0.sameDay || []).filter((t) => /^CX[6-9]-ZED$/.test(t.party)).map((t) => [t.party, t.rids])));

  ok(J(mine(r0.sameDay, "CX4-ZED").map((t) => t.rids)) === J([["vt1", "vt2", "vt3"]]),
    "a row left beside a trip of its buyer's day (a join that landed in part) is offered with that trip's rows: " + J(mine(r0.sameDay, "CX4-ZED")));

  const rv = await f.call("/all/maker/review");
  ok(rv.status === 200 && J(mine(rv.j.trips, "CX9-ZED")) === J([trip0]) && mine(rv.j.sameDay, "CX8-ZED").length === 1 && !("tripsError" in rv.j),
    "Counter Admin's review read carries them as the Desk read them, and no failure: " + J({ status: rv.status, error: rv.j.error, tripsError: rv.j.tripsError }));

  /* B. ONE PAYMENT */
  const s200 = await f.call("/all/maker/trip-split", { trip: T, amount: 200 });
  ok(s200.status === 200 && J(s200.j.split.shares.map((s) => [s.rid, s.rm, s.owed])) === J([["zt1", 120, 120], ["zt2", 80, 116]]),
    "RM 200 for the order is split by the Desk oldest first, each line owing all that is left on it, the delivery's line taking its delivery: " + J(s200.j));
  const s300 = await f.call("/all/maker/trip-split", { trip: T, amount: 300 });
  ok(s300.status !== 200 && /more than this order still owes \(RM 271\.00\)/.test(s300.j.error || ""), "a payment past what the order owes is refused, never split: " + J(s300.j));
  const before = f.drafts().length;
  const stale = await f.call("/all/maker/inputs/trip-pay", { at: at(1), trip: T, date: "2026-10-16", amount: 200, shares: [{ rid: "zt1", rm: 100 }, { rid: "zt2", rm: 100 }] });
  ok(stale.status === 400 && /split changed/.test(stale.j.error || "") && f.drafts().length === before, "a payment sent with a split other than the Desk's is refused whole and nothing is drafted: " + J(stale.j));
  const paid = await f.call("/all/maker/inputs/trip-pay", { at: at(2), trip: T, date: "2026-10-16", amount: 200, shares: [{ rid: "zt1", rm: 120 }, { rid: "zt2", rm: 80 }] });
  const pays = f.drafts().filter((d) => d.entry.makerRequest && ["zt1", "zt2", "zt3"].includes(d.amends));
  ok(paid.status === 200 && J(pays.map((d) => [d.amends, d.amend_kind, d.entry.payload.cash, d.entry.payload.kg])) === J([["zt1", "Fulfilment", 120, 0], ["zt2", "Fulfilment", 80, 0]]),
    "the split he read is sent as one Fulfilment a share, cash only, each waiting under Approve: " + J({ status: paid.status, j: paid.j, drafts: pays.map((d) => [d.amends, d.entry.payload.cash]) }));
  const r1 = await f.deskGet("/_internal/maker/drafts"), trip1 = mine(r1.trips, "CX9-ZED")[0] || {};
  const s71 = await f.call("/all/maker/trip-split", { trip: T, amount: 71 });
  ok(trip1.owed === 71 && trip1.paid === 200 && trip1.waiting === 2 && J(s71.j.split && s71.j.split.shares.map((s) => [s.rid, s.rm])) === J([["zt2", 36], ["zt3", 35]]),
    "the order then reads as it will stand once those wait under Approve: RM 71 owed, and the next split asks nothing twice: " + J({ owed: trip1.owed, waiting: trip1.waiting, split: s71.j }));
  /* a claim against the account lands on the third line between the split and the check: the share it leaves no room for refuses the batch */
  f.hooks.push({ after: "SELECT entry FROM draft WHERE committed_at IS NULL AND status IN ('pending','approved')", run: () => {
    const zt3 = { customer: "CX9-ZED", date: D, total: 35, product: "rice" };
    f.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,party,product,amends,amend_kind,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("2026-10-16T02:00:30.000Z", "pending", "sales", J({ at: "2026-10-16T02:00:30.000Z", type: "AMEND", claimId: "c-x", payload: { mode: "amend", direction: "SELL", kind: "Fulfilment", orderKey: E.ovKey(zt3), cash: 35, kg: 0, date: "2026-10-16" } }),
        J({ qty: 5, total: 35 }), "a claim", "CX9-ZED", "rice", null, "Fulfilment", "test", "2026-10-16T02:00:30.000Z");
  } });
  const n2 = f.drafts().length;
  const raced = await f.call("/all/maker/inputs/trip-pay", { at: at(3), trip: T, date: "2026-10-16", amount: 71, shares: [{ rid: "zt2", rm: 36 }, { rid: "zt3", rm: 35 }] });
  ok(raced.status === 409 && /^zt3: /.test(raced.j.error || "") && /Nothing was sent/.test(raced.j.error || "") && f.drafts().length === n2 + 1
    && !f.drafts().some((d) => d.amends === "zt2" && d.entry.payload.cash === 36),
  "a share its row can no longer take refuses the whole payment, the line that could take its share included: " + J(raced.j));

  /* C. THESE ARE ONE ORDER */
  const joined = await f.call("/all/maker/inputs/trip-join", { at: at(4), date: "2026-10-16", rids: ["yd1", "yd2"] });
  const joins = f.drafts().filter((d) => ["yd1", "yd2"].includes(d.amends));
  const tj = "t" + Date.parse(at(4));
  ok(joined.status === 200 && J(joins.map((d) => [d.amends, d.amend_kind, J(d.entry.payload.fields)])) === J([["yd1", "Correction", J({ trip: tj })], ["yd2", "Correction", J({ trip: tj })]]),
    "These are one order sets one trip on each row, a Correction each, the delivery left where it is: " + J({ j: joined.j, joins: joins.map((d) => [d.amends, d.entry.payload.fields]) }));
  const r2 = await f.deskGet("/_internal/maker/drafts");
  const again = await f.call("/all/maker/inputs/trip-join", { at: at(5), date: "2026-10-16", rids: ["yd1", "yd2"] });
  ok(!mine(r2.sameDay, "CX8-ZED").length && again.status === 409 && /already waits to join/.test(again.j.error || ""),
    "rows waiting to join are offered no more, and a second join of them is refused: " + J(again.j));
  const two = await f.call("/all/maker/inputs/trip-join", { at: at(6), date: "2026-10-16", rids: ["wd1", "wd2"] });
  const twice = await f.call("/all/maker/inputs/trip-join", { at: at(7), date: "2026-10-16", rids: ["xd1", "xd2"] });
  ok(two.status === 400 && /delivery on 2 rows/.test(two.j.error || "") && twice.status === 400 && /names a book twice/.test(twice.j.error || ""),
    "rows with two deliveries, or two rows of one book, are never one order: " + J([two.j.error, twice.j.error]));
  const ext = await f.call("/all/maker/inputs/trip-join", { at: at(10), date: "2026-10-16", rids: ["vt1", "vt2", "vt3"] });
  const exts = f.drafts().filter((d) => ["vt1", "vt2", "vt3"].includes(d.amends));
  ok(ext.status === 200 && J(exts.map((d) => [d.amends, J(d.entry.payload.fields)])) === J([["vt3", J({ trip: T3 })]]),
    "naming a row with the trip beside it extends that trip: one Correction, on the row not yet on it: " + J({ j: ext.j, drafts: exts.map((d) => [d.amends, d.entry.payload.fields]) }));
  const cat = await f.call("/all/maker/inputs");
  const typed = await f.call("/all/maker/inputs/ledger-amend", { at: at(8), rid: "xd1", kind: "Correction", date: "2026-10-16", fields: { trip: "t1791900000001" } });
  ok(!(cat.j.catalog.correctionFields || []).some((x) => x.field === "trip") && typed.status === 400,
    "Correct a row never offers the trip, and refuses one typed: only These are one order sets it: " + J(typed.j));
  ok(E.correctionFaults({ customer: "CX1-ZED", qty: 1, total: 1 }, { trip: "x1" }, true).length === 1 && E.correctionFaults({ customer: "CX1-ZED", qty: 1, total: 1 }, { trip: T }, true).length === 0
    && E.correctionFaults({ supplier: "SX1-ZED", qty: 1, total: 1 }, { trip: T }, false).length === 1 && E.CORRECT_TEXT.includes("trip"),
  "the engine holds a trip to the desk's own id, and on a sale alone");
  const book = await f.mirror(), yd1 = book.sales.find((s) => s.rid === "yd1");
  const crossed = draftRow(E.ledgerAmendmentEntry({ at: at(9), row: yd1, direction: "SELL", kind: "Correction", date: "2026-10-16", fields: { trip: T } }), book);
  ok(!!crossed.skip && /more than one customer/.test(crossed.skip), "the drafter refuses a row joining another buyer's trip: " + J(crossed.skip));
  const zt2 = book.sales.find((s) => s.rid === "zt2");
  const second = draftRow(E.ledgerAmendmentEntry({ at: at(11), row: zt2, direction: "SELL", kind: "Correction", date: "2026-10-16", fields: { delivery: 5 } }), book);
  ok(!!second.skip && /delivery on 2 rows/.test(second.skip), "the drafter refuses a correction putting a second delivery on a trip: " + J(second.skip || second.draft && second.draft.reasoning));
  const row = (rid, product, delivery) => ({ rid, customer: "CX5-ZED", date: D, qty: 1, total: 100, product, ...(delivery ? { delivery } : {}) });
  const fix = (id, rid) => ({ id, collection: "sales", amends: rid, amendKind: "Correction", row: { rid, qty: 1, total: 100 },
    entry: { payload: { mode: "amend", kind: "Correction", direction: "SELL", rid, date: "2026-10-16", fields: { trip: "t1791900000002" } } } });
  const fbook = () => ({ sales: [row("vd1", "salt", 10), row("vd2", "salt"), row("vd3", "oil", 5), row("vd4", "rice")], purchases: [] });
  const pBook = plan(fbook(), { approved: [fix("a1", "vd1"), fix("a2", "vd2")] }), pDel = plan(fbook(), { approved: [fix("b1", "vd1"), fix("b2", "vd3")] }),
    pOk = plan(fbook(), { approved: [fix("c1", "vd1"), fix("c2", "vd4")] });
  ok(pBook.refused.length === 1 && pBook.refused[0].id === "a2" && /book twice/.test(pBook.refused[0].why) && pDel.refused.length === 1 && /delivery on 2 rows/.test(pDel.refused[0].why)
    && pOk.refused.length === 0 && pOk.items.length === 2,
  "the fold holds a trip set across one batch together: a book twice or a second delivery is refused, two books and one delivery fold: " + J([pBook.refused, pDel.refused, pOk.refused]));
  const tbook = { sales: [{ ...row("ud1", "salt", 10), trip: "t1791900000004" }, { ...row("ud2", "oil"), trip: "t1791900000004" }], purchases: [] };
  const delFix = { id: "d1", collection: "sales", amends: "ud2", amendKind: "Correction", row: { rid: "ud2", qty: 1, total: 100 },
    entry: { payload: { mode: "amend", kind: "Correction", direction: "SELL", rid: "ud2", date: "2026-10-16", fields: { delivery: 5 } } } };
  const pTrip = plan(tbook, { approved: [delFix] });
  ok(pTrip.refused.length === 1 && /delivery on 2 rows/.test(pTrip.refused[0].why), "the fold refuses a correction putting a second delivery on a trip: " + J(pTrip.refused));

  /* D. THE CARD ON COUNTER ADMIN */
  const lines = [{ rid: "zt1", product: "salt", qty: 1, total: 110, delivery: 10, paid: 0, owed: 120, handed: 0, left: 1, waiting: 0, open: true },
    { rid: "zt2", product: "oil", qty: 10, total: 116, delivery: 0, paid: 0, owed: 116, handed: 0, left: 10, waiting: 0, open: true },
    { rid: "zt3", product: "rice", qty: 5, total: 35, delivery: 0, paid: 0, owed: 35, handed: 0, left: 5, waiting: 0, open: true }];
  const TRIP = { trip: T, party: "CX9-ZED", date: D, owed: 271, paid: 0, handedLines: 0, waiting: 0, lines };
  const DAY = { rids: ["yd1", "yd2"], party: "CX8-ZED", date: D, owed: 150, paid: 0, handedLines: 0, waiting: 0, lines: [
    { rid: "yd1", product: "salt", qty: 1, total: 110, delivery: 10, paid: 0, owed: 120, handed: 0, left: 1, waiting: 0, open: true },
    { rid: "yd2", product: "oil", qty: 2, total: 30, delivery: 0, paid: 0, owed: 30, handed: 0, left: 2, waiting: 0, open: true }] };
  const SPLIT = { trip: T, party: "CX9-ZED", amount: 200, shares: [{ rid: "zt1", product: "salt", rm: 120, owed: 120 }, { rid: "zt2", product: "oil", rm: 80, owed: 116 }] };
  const open = async (opts = {}) => {
    const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: [], drafts: opts.drafts || [], queue: [], trips: [TRIP], sameDay: [DAY], ...(opts.review || {}) }),
      extra: (route, body) => route === "/all/maker/trip-split" ? { ok: true, split: SPLIT }
        : route === "/all/maker/inputs/ledger-amend" && opts.refuse && body.rid === opts.refuse ? { refuse: "only 2 unit is on the shelf" }
          : /^\/all\/maker\/inputs\/(ledger-amend|trip-pay|trip-join)$/.test(route) ? { ok: true, draft: body.at, status: "pending" } : undefined });
    await p.work.quiet();
    p.tap = async (act, key) => { const e = byAct(p.d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    p.sent = (route) => p.posts.filter((x) => x.route === route).map((x) => x.body);
    return p;
  };
  let p = await open();
  try {
    await p.tap("nav.orders");
    const card = p.card("trip:" + T), rowEl = p.d.querySelector('[data-act="order.open"][data-key="trip:' + T + '"]');
    const text = (n) => (n && n.textContent || "").replace(/\s+/g, " ").trim();
    ok(!!rowEl && /orders\.confirmed/.test(rowEl.getAttribute("data-in")) && rowEl.querySelectorAll("svg.psym").length === 3 && /RM 271\.00/.test(text(rowEl)),
      "the order of several books is one row under Agreed, a mark a line and what it owes: " + text(rowEl));
    /* 18 Oct 2026, his screenshot: the marks stand in the tile column, so the line is not squeezed into 84px and the figure keeps the right */
    const tile = rowEl && rowEl.firstElementChild, what = rowEl && rowEl.querySelector(".salt-inbox-row__what");
    ok(!!tile && tile.classList.contains("mtile") && tile.querySelectorAll("svg.psym").length === 3 && !!what && !what.querySelector("svg.psym") && text(what) === "one order",
      "and its marks are the row's tile, its line the words alone: " + text(what));
    ok(!!card && text(card.querySelector("h3")) === "CX9-ZED, 3 books, 14 Oct 2026" && text(card.querySelector(".salt-metrics")) === "Owed RM 271.00 Paid RM 0.00 Handed 0 of 3 lines",
      "its card's head reads owed, paid and the lines handed over across every line: " + text(card && card.querySelector(".salt-metrics")));
    const ls = card ? [...card.querySelectorAll(".tripline")] : [];
    ok(ls.length === 3 && ls.every((l) => l.querySelector("svg.psym")) && text(ls[0].querySelector(".maker-facts")).endsWith("1 unit, RM 110.00 + RM 10.00 delivery, handed 0 of 1 unit")
      && !/\b(salt|oil|rice)\b/i.test([...card.querySelectorAll(":scope > :not(.rdet)")].map(text).join(" ")),
    "then one line a book, its mark, units, total and handed, and no word for a book: " + ls.map((l) => text(l.querySelector(".maker-facts"))).join(" | "));
    await p.tap("trip.handover", T);
    const hands = p.sent("/all/maker/inputs/ledger-amend");
    ok(J(hands.map((b) => [b.rid, b.kind, b.cash, b.movedUnits])) === J([["zt1", "Fulfilment", 0, 1], ["zt2", "Fulfilment", 0, 10], ["zt3", "Fulfilment", 0, 5]])
      && new Set(hands.map((b) => b.at)).size === 3, "Handover all sends one handover a line, every line in full, each its own request: " + J(hands));
    /* 18 Oct 2026, his screenshot: the line over the list counts the cards of the stage in view, never the site's open orders across every stage */
    const shown = (st) => [...p.d.querySelectorAll("#makerOrderList .ordrow")].filter((r) => r.getAttribute("data-in") === "orders." + st).length;
    const line = () => text(p.d.getElementById("makerReviewStatus"));
    await p.tap("part.orders.confirmed");
    const nAgreed = shown("confirmed"), atAgreed = line();
    await p.tap("part.orders.placed");
    const nPlaced = shown("placed"), atPlaced = line();
    ok(nAgreed >= 2 && atAgreed === nAgreed + " orders" && atPlaced === nPlaced + (nPlaced === 1 ? " order" : " orders") && nPlaced !== nAgreed,
      "the line over the list counts the stage in view, and moves with the stage: " + J({ atAgreed, nAgreed, atPlaced, nPlaced }));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  p = await open({ refuse: "zt3" });
  try {
    await p.tap("nav.orders");
    const card = p.card("trip:" + T), units = byAct(card, "trip.hand-units", "zt2");
    p.type(units, "4");
    const label = byAct(card, "trip.handover", T).textContent;
    await p.tap("trip.handover", T);
    const hands = p.sent("/all/maker/inputs/ledger-amend"), said = (p.d.querySelector('[data-maker-say="trip:' + T + '"]') || {}).textContent || "";
    ok(label === "Hand over as typed" && J(hands.map((b) => [b.rid, b.movedUnits])) === J([["zt1", 1], ["zt2", 4], ["zt3", 5]])
      && /^Sent for zt1 and zt2\./.test(said) && /Held: zt3: .*shelf/.test(said),
    "a line's field hands over a part, and a line the Desk refuses holds only itself: " + J({ label, hands: hands.map((b) => [b.rid, b.movedUnits]), said }));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  p = await open();
  try {
    await p.tap("nav.orders");
    let card = p.card("trip:" + T);
    p.type(byAct(card, "trip.pay-amount", T), "200");
    const noRecord = !byAct(card, "trip.pay", T);
    await p.tap("trip.pay-split", T);
    card = p.card("trip:" + T);
    const shown = [...card.querySelectorAll("[data-share]")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
    ok(noRecord && J(p.sent("/all/maker/trip-split")) === J([{ trip: T, amount: 200 }]) && shown.length === 2 && /zt1, RM 120\.00, all it owes$/.test(shown[0]) && /zt2, RM 80\.00 of RM 116\.00 owed$/.test(shown[1])
      && byAct(card, "trip.pay", T) && byAct(card, "trip.pay", T).textContent === "Record RM 200.00",
    "the payment is split by the Desk and shown before Record is offered: " + J(shown));
    await p.tap("trip.pay", T);
    const sent = p.sent("/all/maker/inputs/trip-pay");
    ok(sent.length === 1 && J(sent[0].shares) === J([{ rid: "zt1", rm: 120 }, { rid: "zt2", rm: 80 }]) && sent[0].amount === 200 && sent[0].trip === T,
      "Record sends the split he was shown, as the Desk read it, nothing reckoned here: " + J(sent));
    card = p.card("trip:" + T);
    p.type(byAct(card, "trip.pay-amount", T), "200");
    await p.tap("trip.pay-split", T);
    card = p.card("trip:" + T);
    const readAgain = !!byAct(card, "trip.pay", T) && !!card.querySelector("[data-share]");
    p.type(byAct(card, "trip.pay-amount", T), "150");
    ok(readAgain && !byAct(card, "trip.pay", T) && !card.querySelector("[data-share]"), "a new figure takes the split and Record away until it is read again");
    await p.tap("nav.orders");
    const day = p.card("day:yd1+yd2");
    await p.tap("trip.join", "yd1+yd2");
    const j = p.sent("/all/maker/inputs/trip-join");
    ok(!!day && /delivery staying on yd1/.test(day.textContent) && j.length === 1 && J(j[0].rids) === J(["yd1", "yd2"]),
      "a buyer's same-day rows are offered as one order, one tap sending both rows: " + J(j));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  p = await open({ review: { trips: [], sameDay: [], tripsError: "Orders of several books could not be read." } });
  try {
    await p.tap("nav.orders"); await p.tap("part.orders.confirmed");
    ok(!!p.d.querySelector("[data-trips-error]") && /could not be read/.test(p.d.querySelector("[data-trips-error]").textContent),
      "orders of several books that could not be read are said, never read as none");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* the approve card: the handovers of an order's lines are one card, and so is a join */
  const mb = { sales: lines.map((l) => sale(l.rid, "CX9-ZED", l.product, l.qty, l.total, { trip: T, ...(l.delivery ? { delivery: l.delivery } : {}) }))
    .concat([sale("yd1", "CX8-ZED", "salt", 1, 110, { delivery: 10 }), sale("yd2", "CX8-ZED", "oil", 2, 30)]), purchases: [], state: { TERMS: { ceiling: 250 } } };
  const hand = (rid, n, i) => ({ id: at(20 + i), status: "pending", collection: "sales", party: "CX9-ZED", product: lines.find((l) => l.rid === rid).product, amends: rid, amendKind: "Fulfilment",
    entry: { at: at(20 + i), makerRequest: "f".repeat(64), payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", rid, cash: 0, kg: n, date: "2026-10-16" } }, row: { qty: n, total: 1 }, flags: [] });
  const join = (rid, i) => ({ id: at(30 + i), status: "pending", collection: "sales", party: "CX8-ZED", product: rid === "yd1" ? "salt" : "oil", amends: rid, amendKind: "Correction",
    entry: { at: at(30 + i), makerRequest: "e".repeat(64), payload: { mode: "amend", kind: "Correction", direction: "SELL", rid, date: "2026-10-16", fields: { trip: tj } } },
    row: { rid, qty: 1, total: 1, changes: [{ field: "trip", from: null, to: tj }] }, flags: [] });
  const ds = [hand("zt1", 1, 0), hand("zt2", 10, 1), hand("zt3", 5, 2), join("yd1", 0), join("yd2", 1)];
  approveFigures(mb, ds, []);
  p = await open({ drafts: ds });
  try {
    await p.tap("nav.orders"); await p.tap("part.orders.approve");
    const cards = [...p.d.querySelectorAll("#makerDrafts [data-maker-card]")];
    const c1 = cards[0], c2 = cards[1], btn = (c) => byAct(c, "draft.approve").textContent;
    ok(cards.length === 2 && ds.every((d) => d.figures) && ds.slice(0, 3).every((d) => d.figures.trip === T)
      && c1.querySelector(".apverb").textContent === "Handover" && btn(c1) === "Approve: handover on 3 lines" && c1.querySelectorAll(".apnow").length === 3
      && c2.querySelector(".apverb").textContent === "These are one order" && btn(c2) === "Approve: one order of 2 lines",
    "the handovers of an order's three lines land as one card with one Approve, each line's Now and After, and a join as one card: "
      + J(cards.map((c) => [c.querySelector(".apverb").textContent, btn(c), c.querySelectorAll(".apnow").length])));
    byAct(c1, "draft.approve").click(); await p.work.quiet(); p.d.getElementById("ynGo").click(); await p.work.quiet();
    ok(J(p.posts.filter((x) => /\/approve$/.test(x.route)).map((x) => decodeURIComponent(x.route.split("/")[4]))) === J(ds.slice(0, 3).map((d) => d.id)),
      "his one yes approves each line's handover in the order entered: " + J(p.posts.map((x) => x.route)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
