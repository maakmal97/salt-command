/* test/admin-flow.mjs: HIS FLOW (docs/order-flow-map.html, 17 Oct 2026). Every live row of the book is an order on Counter Admin, at the stage
 * its figures put it, and every move an earlier stage had stays offered at the later ones where it applies. What is proved here, each check red
 * under its own mutation (test/admin-flow.mutations.json), with invented codes only (rule 2):
 *   A  the Desk's stage rule (flowStage) and its read of every row with no trip card: agreed, delivered or paid, completed, ended, as the row
 *      will stand once the moves waiting fold
 *   B  Counter Admin's review read drops a row a live site order holds (by its key), and keeps one whose site order ended
 *   C  the page: a row under its stage with its figure; a site order paid or handed in full under Delivered or paid; the row card's handover,
 *      payment, change and cancel, each Record's own ledger-amend; Completed paged fifty at a time
 *   D  his answer: a cancel once goods are out cancels the rest, closing the order at what was handed over (a row's at the Desk's closeAt, a
 *      site order's by the close Finish at fewer units sends), anything paid above it a refund
 *   E  his answer: a completed order keeps Amend, on the site, the Desk's restate and the ledger's road, and figures that leave it owing open
 *      it again at Ready
 *   F  what the book ended, the order ends: the order book's refusals for the book's cancel and write-off, and a written-off order under Ended */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { readBook as toolsBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { flowStage, makerLedgerAmendment } from "../src/maker-inputs.js";
import { handoverTap, restateTap } from "../engine/stages.mjs";
import { decideDesk, applyEvent } from "../stmt/orders.js";
import { readBook } from "../src/drafter.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const D = "2026-10-14", T = "t1791900000000";
class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}
const sale = (rid, customer, qty, total, more = {}) => ({ rid, customer, product: "salt", date: D, qty, total, cost: +(total * 0.5).toFixed(2), cash: 0, deliveredQty: 0, ...more });

async function fixture() {
  const source = await toolsBook();
  const ledger = JSON.parse(JSON.stringify(source.ledger)), version = source.version;
  source.w.close();
  ledger.sales.push(
    sale("fa1", "CQ9-ZED", 1, 110),
    sale("fp1", "CQ9-ZED", 1, 110, { cash: 110 }),
    sale("fh1", "CQ9-ZED", 2, 200, { deliveredQty: 2 }),
    sale("fd1", "CQ9-ZED", 1, 110, { cash: 110, deliveredQty: 1 }),
    sale("fc1", "CQ9-ZED", 1, 110, { cancelled: true }),
    sale("fw1", "CQ9-ZED", 1, 110, { deliveredQty: 1, defaulted: true }),
    sale("ft1", "CQ8-ZED", 1, 110, { delivery: 10, trip: T }), sale("ft2", "CQ8-ZED", 2, 30, { product: "oil", trip: T }),
    sale("fs1", "CQ7-ZED", 1, 110), sale("fs2", "CQ6-ZED", 1, 110),
    sale("fx1", "CQ5-ZED", 2, 200, { deliveredQty: 1, cash: 150 }));
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
      const bind = (args) => ({
        run() { return { meta: { changes: Number(st.run(...args).changes || 0) } }; },
        first() { return st.get(...args) ?? null; },
        all() { return { results: st.all(...args) }; }
      });
      return { ...bind([]), bind: (...args) => bind(args) };
    }
  };
  const key = "flow-local-capability-0123456789abcdef";
  const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: key };
  const env = { STMT: new Store(), COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
  const call = async (path, body) => {
    const res = await handleMaker(new Request("https://counter.test" + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: J(body) }),
      env, path, { email: "maakmal97@icloud.com" });
    return { status: res.status, j: await res.json() };
  };
  const deskGet = async (path) => (await desk.fetch(new Request("https://desk" + path, { headers: { "X-Counter-Maker-Key": key } }), deskEnv, { waitUntil() {} })).json();
  return { env, call, deskGet, mirror: () => readBook(D1) };
}

export async function run({ ok, pageWork }) {
  /* A. THE STAGE RULE AND THE DESK'S READ */
  const fs = (f) => flowStage({ qty: 1, handed: 0, paid: 0, owed: 110, ...f });
  ok(J([fs({}), fs({ ready: true }), fs({ paid: 110, owed: 0 }), fs({ handed: 1 }), fs({ handed: 1, paid: 110, owed: 0 }), fs({ handed: 1, owed: 0, paid: 0 }), fs({ ended: true, handed: 1, owed: 0 })])
    === J(["confirmed", "ready", "paid", "paid", "done", "done", "ended"]),
  "the stage rule: agreed, ready when told, delivered or paid when one side is whole, completed when both are (a free order handed over too), ended over all");
  const f = await fixture();
  const r0 = await f.deskGet("/_internal/maker/drafts"), mine = (r0.rows || []).filter((r) => /^CQ[6-9]-ZED$/.test(r.party));
  const by = Object.fromEntries(mine.map((r) => [r.rid, r]));
  ok(J(["fa1", "fp1", "fh1", "fd1", "fc1", "fw1"].map((rid) => by[rid] && by[rid].stage)) === J(["confirmed", "paid", "paid", "done", "ended", "ended"])
    && by.fc1.cancelled === true && by.fw1.writtenOff === true && by.fa1.owed === 110 && by.fa1.left === 1 && by.fa1.key === "CQ9-ZED|2026-10-14|110",
  "the Desk reads every row with no trip card as an order at its stage, with its key and what it owes: " + J(mine.map((r) => [r.rid, r.stage, r.owed, r.left, r.key])));
  ok(!by.ft1 && !by.ft2 && (r0.trips || []).some((t) => t.trip === T), "a row on a trip card is that card's, never a second order: " + J(Object.keys(by)));

  /* B. A ROW A LIVE SITE ORDER HOLDS IS THAT ORDER */
  await f.env.STMT.put("order:u-flow-1:20261014010000-flowaa", J({ id: "20261014010000-flowaa", u: "u-flow-1", status: "acknowledged", ledgerKey: "CQ7-ZED|2026-10-14|110", qty: 1, total: 110, product: "salt", at: D + "T01:00:00.000Z" }));
  await f.env.STMT.put("order:u-flow-2:20261014010001-flowab", J({ id: "20261014010001-flowab", u: "u-flow-2", status: "cancelled", ledgerKey: "CQ6-ZED|2026-10-14|110", qty: 1, total: 110, product: "salt", at: D + "T01:00:00.000Z" }));
  const rv = await f.call("/all/maker/review"), got = (rv.j.rows || []).map((r) => r.rid);
  ok(rv.status === 200 && !got.includes("fs1") && got.includes("fs2") && got.includes("fa1"),
    "the review read drops the row a live site order holds and keeps one whose site order ended: " + J({ status: rv.status, error: rv.j.error, fs: got.filter((x) => /^f/.test(x)) }));

  const pay = await f.call("/all/maker/inputs/ledger-amend", { at: "2026-10-16T02:00:01.000Z", rid: "fa1", kind: "Fulfilment", date: "2026-10-16", cash: 50, movedUnits: 0 });
  const fa = ((await f.deskGet("/_internal/maker/drafts")).rows || []).find((r) => r.rid === "fa1") || {};
  ok(pay.status === 200 && fa.paid === 50 && fa.owed === 60 && fa.waiting === 1 && fa.stage === "confirmed",
    "a row reads as it will stand once the moves waiting on it fold, so a payment is never asked for twice: " + J({ status: pay.status, error: pay.j.error, fa }));

  /* D. CANCEL THE REST: the Desk's figure for a row, and a site order's close at what is already out */
  ok(by.fx1 === undefined && (r0.rows || []).some((r) => r.rid === "fx1" && r.closeAt === 100 && r.stage === "confirmed") && !("closeAt" in by.fa1) && !("closeAt" in by.fh1),
    "a row with goods out and some left reads what it closes at, the same rate for what went; one with none out, or all out, reads none: " + J((r0.rows || []).filter((r) => r.rid === "fx1")));
  const so = { id: "20261014010002-flowac", code: "CQ5-ZED", u: "u-flow-5", product: "salt", qty: 2, total: 200, delivery: 0, mode: "collect", paid: 150, moved: 1, movedOn: D, status: "ready",
    ledgerKey: "CQ5-ZED|2026-10-14|200", payments: [], history: [] };
  const close = handoverTap(so, { qty: 1, close: true }, new Date("2026-10-17T02:00:00.000Z"));
  ok(close.entry && close.entry.status === "Close" && close.entry.total === 100 && close.refund === 50 && close.site.handover.close === true,
    "a site order closed at the unit already out is a close of its own, its total restated at the same rate, and the RM 50 paid above it a refund: " + J({ status: close.entry && close.entry.status, total: close.entry && close.entry.total, refund: close.refund, error: close.error }));

  /* E. A COMPLETED ORDER KEEPS AMEND */
  const done = { ...so, qty: 1, total: 110, paid: 110, moved: 1, status: "done", history: [{ at: "x", status: "ready", by: "desk" }, { at: "y", status: "done", by: "desk" }] };
  const up = decideDesk(JSON.parse(J(done)), { restate: { qty: 1, total: 130, delivery: 0 } }, "2026-10-17T02:00:01.000Z");
  const reopened = up.ev && applyEvent(JSON.parse(J(done)), up.ev).order;
  const down = decideDesk(JSON.parse(J(done)), { restate: { qty: 1, total: 100, delivery: 0 } }, "2026-10-17T02:00:02.000Z");
  const still = down.ev && applyEvent(JSON.parse(J(done)), down.ev).order;
  ok(reopened && reopened.status === "ready" && reopened.total === 130 && still && still.status === "done" && still.total === 100,
    "the order book takes his Amend on a completed order, opening it again at Ready when it leaves RM 20 owing, and leaving it completed when it owes nothing: " + J({ up: up.error || (reopened && reopened.status), down: down.error || (still && still.status) }));
  const tap = restateTap(done, new Date("2026-10-17T02:00:03.000Z"), { total: 130 }, { book: null, room: null, earlier: [], live: null });
  ok(tap.status === 503 && /mirror/.test(tap.error || ""), "the Desk's Amend no longer turns a completed order away for its status: " + J(tap));
  const mb = await f.mirror();
  const viaLedger = makerLedgerAmendment({ at: "2026-10-17T02:00:04.000Z", rid: "fd1", kind: "Correction", date: "2026-10-17", fields: { total: 120 } }, mb,
    { order: { ...done, id: "20261014010003-flowad", qty: 1, total: 110, delivery: 0 } });
  ok(viaLedger.restate && viaLedger.restate.order === "20261014010003-flowad" && viaLedger.restate.total === 120,
    "a Correction of a completed site order's price on the ledger's road is sent as its Amend, so the order and the row change together: " + J(viaLedger));

  /* F. WHAT THE BOOK ENDED, THE ORDER ENDS: the order book's side (the return leg is proved in "28 Sep 2026, fix 3") */
  const ag = { ...so, paid: 0, moved: 0, status: "acknowledged" };
  const bc = decideDesk(JSON.parse(J(ag)), { bookEnd: "cancelled" }, "2026-10-17T02:00:05.000Z");
  const bcOut = decideDesk(JSON.parse(J({ ...ag, moved: 1 })), { bookEnd: "cancelled" }, "2026-10-17T02:00:06.000Z");
  const bcClaim = decideDesk(JSON.parse(J({ ...ag, payments: [{ at: "x", amount: 5, claim: "waiting" }] })), { bookEnd: "cancelled" }, "2026-10-17T02:00:07.000Z");
  const wo = decideDesk(JSON.parse(J(so)), { bookEnd: "writtenOff" }, "2026-10-17T02:00:08.000Z");
  const woTwice = decideDesk(JSON.parse(J({ ...so, writtenOff: "x" })), { bookEnd: "writtenOff" }, "2026-10-17T02:00:09.000Z");
  const placedEnd = decideDesk(JSON.parse(J({ ...ag, status: "placed" })), { bookEnd: "cancelled" }, "2026-10-17T02:00:10.000Z");
  ok(bc.ev && bc.ev.status === "cancelled" && bc.ev.book === true && /already out/.test(bcOut.error || "") && /waits on this order/.test(bcClaim.error || "")
    && wo.ev && wo.ev.kind === "writeoff" && wo.ev.on === true && woTwice.none === true && /agreed order/.test(placedEnd.error || ""),
  "the order book takes the book's cancel of an agreed order with nothing out and no claim waiting, and its write-off once: " + J({ bc, bcOut: bcOut.error, bcClaim: bcClaim.error, wo, woTwice, placedEnd: placedEnd.error }));

  /* C. THE PAGE */
  const ROWS = [
    { rid: "fa1", party: "CQ9-ZED", product: "salt", date: D, key: "k1", qty: 1, total: 110, delivery: 0, paid: 0, owed: 110, handed: 0, left: 1, waiting: 0, stage: "confirmed" },
    { rid: "fp1", party: "CQ9-ZED", product: "salt", date: D, key: "k2", qty: 1, total: 110, delivery: 0, paid: 110, owed: 0, handed: 0, left: 1, waiting: 0, stage: "paid" },
    { rid: "fx1", party: "CQ5-ZED", product: "salt", date: D, key: "k3", qty: 2, total: 200, delivery: 0, paid: 150, owed: 50, handed: 1, left: 1, waiting: 0, stage: "confirmed", closeAt: 100 }]
    .concat(Array.from({ length: 60 }, (_, i) => ({ rid: "fz" + i, party: "CQ9-ZED", product: "salt", date: D, key: "kz" + i, qty: 1, total: 110, delivery: 0, paid: 110, owed: 0, handed: 1, left: 0, waiting: 0, stage: "done" })));
  const PART = { id: "20261014010004-flowae", u: "u-flow-4", status: "ready", qty: 2, total: 200, delivery: 0, paid: 0, moved: 1, product: "salt", mode: "collect", at: D + "T01:00:00.000Z", payments: [], msgs: [], history: [] };
  const DONE = { id: "20261014010005-flowaf", u: "u-flow-6", status: "done", qty: 1, total: 110, delivery: 0, paid: 110, moved: 1, product: "salt", mode: "collect", at: D + "T01:00:00.000Z", payments: [], msgs: [], history: [] };
  const WOFF = { id: "20261014010006-flowag", u: "u-flow-7", status: "ready", qty: 1, total: 110, delivery: 0, paid: 0, moved: 1, product: "salt", mode: "collect", at: D + "T01:00:00.000Z", payments: [], msgs: [], history: [], writtenOff: "2026-10-16T00:00:00.000Z" };
  const ORDER = { id: "o-pay", u: "u-flow-3", status: "acknowledged", qty: 1, total: 100, delivery: 0, paid: 100, moved: 0, product: "salt", at: D + "T01:00:00.000Z", payments: [], msgs: [] };
  const open = async () => {
    const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: [ORDER, PART, DONE, WOFF], drafts: [], queue: [], trips: [], sameDay: [], rows: ROWS }),
      extra: (route, body) => route === "/all/maker/inputs/ledger-amend" ? { ok: true, draft: body.at, status: "pending" }
        : /^[/]all[/]maker[/]orders[/][^/]+[/]handed$/.test(route) ? { ok: true, order: PART } : undefined });
    await p.work.quiet();
    p.tap = async (act, key) => { const e = byAct(p.d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    p.sent = (route) => p.posts.filter((x) => x.route === route).map((x) => x.body);
    return p;
  };
  const text = (n) => (n && n.textContent || "").replace(/\s+/g, " ").trim();
  const p = await open();
  try {
    await p.tap("nav.orders");
    const rowOf = (k) => p.d.querySelector('[data-act="order.open"][data-key="' + k + '"]');
    ok(/orders\.confirmed/.test((rowOf("row:fa1") || { getAttribute: () => "" }).getAttribute("data-in")) && /RM 110\.00/.test(text(rowOf("row:fa1")))
      && /orders\.paid/.test((rowOf("row:fp1") || { getAttribute: () => "" }).getAttribute("data-in")),
    "a row of the book is a row under its stage, Agreed or Delivered or paid, with its figure: " + text(rowOf("row:fa1")));
    const seen = (n) => { for (let e = n; e; e = e.parentElement) if (e.hidden) return false; return !!n; };
    await p.tap("part.orders.paid");
    ok(seen(rowOf("row:fp1")) && seen(rowOf("o-pay")) && !seen(rowOf("row:fa1")),
      "Delivered or paid shows its own orders, a row of the book and a site order, and none of Agreed's: " + J([seen(rowOf("row:fp1")), seen(rowOf("o-pay")), seen(rowOf("row:fa1"))]));
    await p.tap("part.orders.confirmed");
    ok(/orders\.paid/.test((rowOf("o-pay") || { getAttribute: () => "" }).getAttribute("data-in")),
      "a site order paid in full and not handed over is under Delivered or paid: " + ((rowOf("o-pay") || { getAttribute: () => "" }).getAttribute("data-in")));
    ok(!!p.d.querySelector('[data-part="paid"]') && /Delivered or paid/.test(text(p.d.querySelector('[data-part="paid"]'))) && /Received/.test(text(p.d.querySelector('[data-part="placed"]'))),
      "the stages read Received, Agreed, Ready, Delivered or paid, Completed and Ended");
    const done = () => [...p.d.querySelectorAll('[data-act="order.open"]')].filter((b) => /orders\.done/.test(b.getAttribute("data-in"))).length;
    const n0 = done();
    await p.tap("orders.more", "done");
    ok(n0 === 50 && done() === 61, "Completed shows fifty and Show 50 more the rest: " + J([n0, done()]));
    await p.tap("order.open", "row:fa1");
    const card = p.card("row:fa1");
    ok(!!card && /Owed RM 110\.00 Paid RM 0\.00 Handed 0 of 1 unit/.test(text(card.querySelector(".salt-metrics"))) && !!byAct(card, "row.cancel", "fa1"),
      "the row's card reads owed, paid and handed, with Cancel while nothing is out: " + text(card && card.querySelector(".salt-metrics")));
    await p.tap("row.handover", "fa1");
    p.type(byAct(p.card("row:fa1"), "row.pay-amount", "fa1"), "60");
    await p.tap("row.pay", "fa1");
    p.type(byAct(p.card("row:fa1"), "row.change-total", "fa1"), "95");
    await p.tap("row.change", "fa1");
    const sent = p.sent("/all/maker/inputs/ledger-amend").map((b) => [b.rid, b.kind, b.cash, b.movedUnits, b.fields]);
    ok(J(sent) === J([["fa1", "Fulfilment", 0, 1, undefined], ["fa1", "Fulfilment", 60, 0, undefined], ["fa1", "Correction", undefined, undefined, { total: 95 }]]),
      "the card's handover, payment and change are Record's own ledger-amend, each under Approve: " + J(sent));
    await p.tap("order.open", "row:fx1");
    const fx = p.card("row:fx1");
    ok(!!fx && !byAct(fx, "row.cancel", "fx1") && !!byAct(fx, "row.cancel-rest", "fx1"), "a row with goods out has Cancel the rest in place of Cancel");
    await p.tap("row.cancel-rest", "fx1"); await p.tap("ask.go", "row.cancel-rest:fx1");
    const rest = p.sent("/all/maker/inputs/ledger-amend").filter((b) => b.rid === "fx1").map((b) => [b.kind, b.fields]);
    ok(J(rest) === J([["Correction", { qty: 1, total: 100 }]]), "Cancel the rest on a row sends one Correction closing it at what went, at the Desk's figure: " + J(rest));
    await p.tap("part.orders.ready");
    await p.tap("order.open", PART.id);
    const pc = p.card(PART.id);
    ok(!!pc && !byAct(pc, "order.cancel") && !!byAct(pc, "order.cancel-rest"), "a site order with a unit out has Cancel the rest in place of Cancel");
    await p.tap("order.cancel-rest"); await p.tap("order.ask-go", PART.id);
    const closes = p.posts.filter((x) => /[/]handed$/.test(x.route)).map((x) => [x.route.split("/")[4], x.body.qty, x.body.close]);
    ok(J(closes) === J([[PART.id, 1, true]]), "and it sends the close at the unit already out: " + J(closes));
    ok(/orders\.ended/.test((rowOf(WOFF.id) || { getAttribute: () => "" }).getAttribute("data-in")), "an order written off on the book is under Ended");
    await p.tap("part.orders.done");
    await p.tap("order.open", DONE.id);
    ok(!!byAct(p.card(DONE.id), "order.amend"), "a completed order's card keeps Change the order");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
