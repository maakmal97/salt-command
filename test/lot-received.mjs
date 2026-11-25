/* test/lot-received.mjs: A LOT'S UNITS RECEIVED, SET ON CORRECT A ROW, NAME THE UNITS THEY WERE READ WITH (25 Nov 2026, the open item v1567 left; his
 * answer of that day kept the field on Correct a row, since a lot has no Undo on Salt Admin). The figure is absolute, so a Receipt approved while the
 * Correction waited under Approve was written over and the shelf rolled back by the Correction's step. Now it carries `expect {receivedQty}`, read as
 * the engine reads a lot's units received, which the Desk, the drafter, the fold's plan and the writer check. Each check red under its own mutation
 * (test/lot-received.mutations.json), invented codes only (rule 2):
 *   U1  engine/expect.mjs reads a lot's units received exactly as poRecvUnits does, over every state a lot takes (it imports nothing, so it is a copy)
 *   U2  expectFault passes a lot still holding the units it was measured on, a lot stored with none on its whole qty, and refuses one that moved
 *   U3  and prints the figures it names as a person reads them, never a float's tail
 *   M1  the Desk's road refuses a lot's units received sent with no units read with, or with units the lot no longer holds (stale, naming the Desk's
 *       figure), and drafts one carrying the engine's reading; a lot stored with none carries its whole qty; a clear is refused (the review, finding 3)
 *   M2  a lowered cash and units received together name both; a figure the Correction does not set is refused
 *   D1  the drafter refuses it on a lot whose units moved since
 *   W1  the writer refuses it on a lot a Receipt reached since, leaving the lot as it was, and takes it on the lot as measured
 *   P1  the fold's plan refuses it behind a Receipt earlier in the same batch, and takes it alone, rolling the shelf by the difference
 *   F1  Correct a row sends a lot's units received with the units the row was read with; another field, or a sale, sends none
 *   F2  refused as moved, the next tap goes with the Desk's figure (the row is read once a page open; the review, finding 2)
 *   H1  through both Workers: drafted with its expect while a Receipt waits on another lot; held while one waits on its own lot, and a Receipt held while it
 *       waits (the review, finding 1: one approved after it would add its units to a figure that already counts them); a stale send reaches Salt Admin
 *       with `stale` and the Desk's figure, which stmt/maker.js relays (the re-check: F2's harness answers past it) */
import { applyAmend } from "../engine/apply.mjs";
import { expectFault, recvOf } from "../engine/expect.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerLedgerAmendment } from "../src/maker-inputs.js";
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { buildSeed } from "../tools/d1.mjs";
import { readBook } from "../tools/book.mjs";
import { draftRow } from "../src/drafter.js";
import { plan } from "../tools/fold.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify, E = POSITION_ENGINE;
const D = "2026-11-20", AMEND = "/all/maker/inputs/ledger-amend";
class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
/* the one owner the Counter's maker road admits, read from its own source rather than copied here */
const OWNER = /const OWNER_EMAIL = "([^"]+)"/.exec(readFileSync(new URL("../stmt/maker.js", import.meta.url), "utf8"))[1];
const lot = (rid, more = {}) => ({ rid, supplier: "SX9-ZED", product: "salt", qty: 4, total: 200, cash: 0, status: "unpaid", date: D, receivedOn: D, receivedQty: 2, inTransit: true, ...more });

export async function run({ ok, pageWork }) {
  /* U1 */
  const states = [{ qty: 4 }, { qty: 4, inTransit: true }, { qty: 4, receivedQty: 2 }, { qty: 4, receivedQty: 0 }, { qty: 4, receivedQty: 6 }, { qty: 4, receivedQty: -1 },
    { qty: 4, receivedQty: null }, { qty: 4, receivedQty: 2, inTransit: true }, { qty: 4, cancelled: true }, { qty: 4, defaulted: true, receivedQty: 3 },
    { qty: 4, pending: true }, { qty: 2.5, receivedQty: 1.25 }, { qty: 4, receivedQty: "3" }];
  const pairs = states.map((s) => [recvOf(s), E.poRecvUnits(s)]);
  ok(pairs.every(([a, b]) => a === +b), "U1: a lot's units received read here as the engine reads them, in every state: " + J(pairs));

  /* U2 */
  const u2 = [expectFault(lot("a"), { receivedQty: 2 }), expectFault({ qty: 3 }, { receivedQty: 3 }), expectFault({ qty: 3, inTransit: true }, { receivedQty: 0 }),
    expectFault(lot("a", { receivedQty: 3 }), { receivedQty: 2 }), expectFault({ qty: 3 }, { receivedQty: 0 }), expectFault(lot("a"), { receivedQty: "2" })];
  ok(u2[0] === "" && u2[1] === "" && u2[2] === "" && /goods moved since it was measured \(3 unit received, not 2\)/.test(u2[3]) && /\(3 unit received, not 0\)/.test(u2[4])
    && /a shape the desk does not make/.test(u2[5]),
    "U2: expectFault passes a lot on the units it was measured on, one stored with none on its whole qty, and refuses one that moved: " + J(u2));

  /* U3 */
  const u3 = expectFault({ qty: 4, receivedQty: 1.1 + 2.2 }, { receivedQty: 1.1 });
  ok(/\(3\.3 unit received, not 1\.1\)/.test(u3), "U3: the figures it names read as a person reads them: " + J(u3));

  /* M1, M2, D1 on the Desk's road over the live book with invented lots */
  const source = await readBook();
  const { w, version } = source;
  try {
    const copy = JSON.parse(JSON.stringify(source.ledger));
    const whole = lot("zv2", { qty: 3, total: 150, cash: 150, status: "paid", paidOn: D }); delete whole.receivedQty; delete whole.inTransit;
    copy.purchases = copy.purchases.concat([lot("zv1"), whole, lot("zv4", { cash: 50, status: "partial" })]);
    const book = { sales: copy.sales, purchases: copy.purchases, state: copy, version, pricing: copy.PRICING };
    const today = w.eval("TODAY.toISOString().slice(0,10)");
    let n = 0;
    const amend = (rid, extra) => makerLedgerAmendment({ at: "2026-11-25T04:00:" + String(n++).padStart(2, "0") + ".000Z", rid, kind: "Correction", date: today, ...extra }, book);

    /* M1 */
    const bare = amend("zv1", { fields: { receivedQty: 3 } }), stale = amend("zv1", { fields: { receivedQty: 3 }, expect: { receivedQty: 1 } });
    const good = amend("zv1", { fields: { receivedQty: 3 }, expect: { receivedQty: 2 } }), cleared = amend("zv1", { fields: { receivedQty: null } });
    const clearGood = amend("zv1", { fields: { receivedQty: null }, expect: { receivedQty: 2 } });
    const wholeLow = amend("zv2", { fields: { receivedQty: 2 }, expect: { receivedQty: 0 } }), wholeGood = amend("zv2", { fields: { receivedQty: 2 }, expect: { receivedQty: 3 } });
    ok(!bare.entry && /units received are set with the units it was read with/.test(bare.error || "")
      && !stale.entry && stale.stale === true && stale.received === 2 && /moved since it was read \(2 unit, not 1\)\. Send it again to set them from 2\./.test(stale.error || "")
      && good.entry && J(good.entry.payload.fields) === J({ receivedQty: 3 }) && J(good.entry.payload.expect) === J({ receivedQty: 2 })
      && !cleared.entry && /set to a figure, 0 included/.test(cleared.error || "") && !clearGood.entry && /set to a figure, 0 included/.test(clearGood.error || "")
      && !wholeLow.entry && wholeLow.stale === true && wholeGood.entry && J(wholeGood.entry.payload.expect) === J({ receivedQty: 3 }),
      "M1: a lot's units received go only with the units they were read with, the draft carrying the engine's reading, a lot stored with none on its whole qty, and a clear refused: "
      + J([bare.error, stale.error, good.error || good.entry.payload.expect, cleared.error, clearGood.error, wholeLow.error, wholeGood.error || wholeGood.entry.payload.expect]));

    /* M2 */
    const both = amend("zv4", { fields: { cash: 40, receivedQty: 3 }, expect: { cash: 50, receivedQty: 2 } }), half = amend("zv4", { fields: { cash: 40, receivedQty: 3 }, expect: { cash: 50 } });
    const extraRecv = amend("zv4", { fields: { cash: 40 }, expect: { cash: 50, receivedQty: 2 } }), other = amend("zv1", { fields: { total: 210 }, expect: { receivedQty: 2 } });
    ok(both.entry && J(both.entry.payload.expect) === J({ cash: 50, receivedQty: 2 }) && !half.entry && /units received are set with the units/.test(half.error || "")
      && !extraRecv.entry && /^Only a lower cash paid or units received on a lot/.test(extraRecv.error || "") && !other.entry && /^Only a lower cash paid or units received on a lot/.test(other.error || ""),
      "M2: a lowered cash and units received together name both, and a figure the Correction does not set is refused: " + J([both.error || both.entry.payload.expect, half.error, extraRecv.error, other.error]));

    /* D1 */
    const moved = { ...book, purchases: book.purchases.map((r) => r.rid === "zv1" ? { ...r, receivedQty: 3.5 } : r) };
    const d1 = good.entry ? draftRow(good.entry, moved) : { skip: "no entry" }, d1same = good.entry ? draftRow(good.entry, book) : { skip: "no entry" };
    ok(/goods moved since it was measured \(3\.5 unit received, not 2\)/.test(d1.skip || "") && !d1same.skip,
      "D1: the drafter refuses it on a lot whose units moved since, and drafts it on the lot as measured: " + J([d1.skip, d1same.skip]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { w.close(); }

  /* W1 */
  const reached = lot("zv1", { receivedQty: 3 }), same = lot("zv1");
  let threw = "";
  try { applyAmend(reached, { date: "2026-11-25", kind: "Correction", cash: 0, kg: 0, fields: { receivedQty: 2.5 }, expect: { receivedQty: 2 } }, "BUY", null); } catch (e) { threw = e.message; }
  let took = "";
  try { applyAmend(same, { date: "2026-11-25", kind: "Correction", cash: 0, kg: 0, fields: { receivedQty: 2.5 }, expect: { receivedQty: 2 } }, "BUY", null); } catch (e) { took = e.message; }
  ok(/goods moved since it was measured \(3 unit received, not 2\)/.test(threw) && reached.receivedQty === 3 && !reached.amend && !took && same.receivedQty === 2.5,
    "W1: the writer refuses it on a lot a Receipt reached since, leaving the lot as it was, and takes it on the lot as measured: " + J([threw, reached.receivedQty, took, same.receivedQty]));

  /* P1 */
  const receipt = { id: "p1a", collection: "purchases", amends: "zv1", amendKind: "Receipt", row: { rid: "zv1", qty: 4, total: 200, cash: 0 },
    entry: { payload: { mode: "amend", direction: "BUY", rid: "zv1", kind: "Receipt", date: "2026-11-25", cash: 0, kg: 1 } } };
  const correction = { id: "p1b", collection: "purchases", amends: "zv1", amendKind: "Correction", row: { rid: "zv1", qty: 4, total: 200, cash: 0 },
    entry: { payload: { mode: "amend", direction: "BUY", rid: "zv1", kind: "Correction", date: "2026-11-25", fields: { receivedQty: 2.5 }, expect: { receivedQty: 2 } } } };
  const behind = plan({ sales: [], purchases: [lot("zv1")] }, { approved: [receipt, correction] }), alone = plan({ sales: [], purchases: [lot("zv1")] }, { approved: [correction] });
  const shelf = (alone.moves || []).filter((m) => m.who === "SX9-ZED").map((m) => m.kg);
  ok(behind.refused.length === 1 && behind.refused[0].id === "p1b" && /goods moved since it was measured \(3 unit received, not 2\)/.test(behind.refused[0].why)
    && alone.refused.length === 0 && alone.items.length === 1 && J(shelf) === J([0.5]),
    "P1: the fold's plan refuses it behind a Receipt in the same batch, and takes it alone, rolling the shelf by the difference: " + J([behind.refused, alone.refused, shelf]));

  /* F1 */
  const p = await richOwnerPage({ pageWork,
    extra: (route, body) => route === AMEND && body.fields && body.fields.receivedQty === 3.5 && body.expect && body.expect.receivedQty === 2
      ? { refuse: "The lot's units received moved since it was read (3 unit, not 2). Send it again to set them from 3.", detail: { stale: true, received: 3 } } : undefined,
    inputsAnswer: (j) => {
    j.catalog.rows = [
      { rid: "zv1", party: "SX9-ZED", product: "salt", date: D, qty: 4, total: 200, direction: "BUY", cash: 0, movedUnits: 2, freight: 0, handover: null },
      { rid: "zs9", party: "CX9-ZED", product: "salt", date: D, qty: 2, total: 200, direction: "SELL", cash: 50, movedUnits: 1, delivery: 0, handover: "collected" }];
    j.catalog.correctionFields = [{ field: "total", kind: "number", required: true }, { field: "receivedQty", kind: "number" }];
    j.catalog.revivable = [];
    return j;
  } });
  try {
    await p.work.quiet();
    byAct(p.d, "nav.record").click(); await p.work.quiet();
    const ed = [...p.d.querySelectorAll("#makerInputs section.maker-input")].find((x) => x.querySelector("h3") && x.querySelector("h3").textContent === "Correct a row");
    const put = (c, v) => { c.value = v; c.dispatchEvent(new p.w.Event("input", { bubbles: true })); c.dispatchEvent(new p.w.Event("change", { bubbles: true })); };
    const send = async (rid, field, value) => {
      put(byAct(ed, "record.amend.row"), rid); put(byAct(ed, "record.amend.field"), field); put(byAct(ed, "record.amend.value"), value);
      byAct(ed, "record.amend.add-change").click(); await p.work.quiet();
      const from = p.posts.length;
      byAct(ed, "record.amend.send").click(); await p.work.quiet();
      return p.posts.slice(from).filter((x) => x.route === AMEND).map((x) => x.body);
    };
    const recv = await send("zv1", "receivedQty", "3"), total = await send("zv1", "total", "210"), sale = await send("zs9", "receivedQty", "1");
    ok(recv.length === 1 && J(recv[0].fields) === J({ receivedQty: 3 }) && J(recv[0].expect) === J({ receivedQty: 2 })
      && total.length === 1 && J(total[0].fields) === J({ total: 210 }) && total[0].expect === undefined && sale.length === 1 && sale[0].expect === undefined,
      "F1: Correct a row sends a lot's units received with the units the row was read with, and another field or a sale sends none: " + J([recv, total, sale]));
    const first = await send("zv1", "receivedQty", "3.5"), from = p.posts.length;
    byAct(ed, "record.amend.send").click(); await p.work.quiet();
    const again = p.posts.slice(from).filter((x) => x.route === AMEND).map((x) => x.body);
    ok(first.length === 1 && J(first[0].expect) === J({ receivedQty: 2 })
      && again.length === 1 && J(again[0].fields) === J({ receivedQty: 3.5 }) && J(again[0].expect) === J({ receivedQty: 3 }),
      "F2: refused as moved, the next tap goes with the Desk's figure: " + J([first, again]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* H1, through both Workers over a migrated in-memory D1, as test/admin-lot-cash.mjs does */
  try {
    const src = await readBook();
    const ledger = JSON.parse(JSON.stringify(src.ledger)), version = src.version;
    src.w.close();
    ledger.purchases.push(lot("zv1"), lot("zv5"));
    const db = new DatabaseSync(":memory:"), migrations = new URL("../migrations/", import.meta.url);
    for (const file of readdirSync(migrations).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()) db.exec(readFileSync(new URL(file, migrations), "utf8"));
    db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger }).sql);
    const D1 = {
      batch(statements) { db.exec("BEGIN IMMEDIATE"); try { const out = statements.map((x) => x.run()); db.exec("COMMIT"); return out; } catch (error) { db.exec("ROLLBACK"); throw error; } },
      prepare(sql) {
        const st = db.prepare(sql);
        const bind = (args) => ({ run() { return { meta: { changes: Number(st.run(...args).changes || 0) } }; }, first() { return st.get(...args) ?? null; }, all() { return { results: st.all(...args) }; } });
        return { ...bind([]), bind: (...args) => bind(args) };
      }
    };
    /* a Receipt of 1 unit on zv5 waiting under Approve: goods on their way to that lot */
    db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,party,product,amends,amend_kind,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("2026-11-25T01:00:00.000Z", "pending", "purchases", J({ at: "2026-11-25T01:00:00.000Z", type: "AMEND", payload: { mode: "amend", direction: "BUY", date: D, kind: "Receipt", rid: "zv5", cash: 0, kg: 1, party: "SX9-ZED" } }),
        J({ qty: 4, total: 200 }), "a receipt", "SX9-ZED", "salt", "zv5", "Receipt", "test", "2026-11-25T01:00:00.000Z", null);
    const key = "lot-received-local-capability-0123456789";
    const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: key, STMT_SITE: { fetch: async (url) => new URL(url).pathname === "/desk/orders" ? Response.json({ ok: true, orders: [] }) : Response.json({ ok: true }) }, STMT_DESK_KEY: "desk-key-for-the-fixture" };
    const env = { STMT: new Store(), COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
    const call = async (path, body) => {
      const res = await handleMaker(new Request("https://counter.test" + path, { method: "POST", headers: { "content-type": "application/json" }, body: J(body) }), env, path, { email: OWNER });
      return { status: res.status, j: await res.json() };
    };
    const drafts = () => db.prepare("SELECT amends,amend_kind,entry FROM draft WHERE status='pending' ORDER BY id").all().map((x) => ({ ...x, entry: JSON.parse(x.entry) }));
    const fine = await call(AMEND, { at: "2026-11-25T02:00:00.000Z", rid: "zv1", kind: "Correction", date: "2026-11-25", fields: { receivedQty: 3 }, expect: { receivedQty: 2 } });
    const made = drafts().filter((x) => x.amends === "zv1");
    const held = await call(AMEND, { at: "2026-11-25T02:00:01.000Z", rid: "zv5", kind: "Correction", date: "2026-11-25", fields: { receivedQty: 3 }, expect: { receivedQty: 2 } });
    const receipt = await call(AMEND, { at: "2026-11-25T02:00:02.000Z", rid: "zv1", kind: "Receipt", date: "2026-11-25", movedUnits: 1 });
    const stale = await call(AMEND, { at: "2026-11-25T02:00:03.000Z", rid: "zv1", kind: "Correction", date: "2026-11-25", fields: { receivedQty: 3 }, expect: { receivedQty: 1 } });
    ok(fine.status === 200 && made.length === 1 && J(made[0].entry.payload.expect) === J({ receivedQty: 2 })
      && held.status === 409 && /Goods are already on their way to this lot/.test(held.j.error || "") && !drafts().some((x) => x.amends === "zv5" && x.amend_kind === "Correction")
      && receipt.status === 409 && /units received waits under Approve/.test(receipt.j.error || "") && !drafts().some((x) => x.amends === "zv1" && x.amend_kind === "Receipt")
      && stale.status === 400 && stale.j.stale === true && stale.j.received === 2,
      "H1: drafted with its expect while a Receipt waits on another lot; held while one waits on its own, a Receipt held while it waits, and a stale send comes back to Salt Admin with the Desk's figure: "
      + J([fine.status, fine.j.error, made.map((x) => x.entry.payload.expect), held.status, held.j.error, receipt.status, receipt.j.error, stale.status, stale.j]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); }
}
