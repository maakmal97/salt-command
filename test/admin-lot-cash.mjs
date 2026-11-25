/* test/admin-lot-cash.mjs: SALT ADMIN, A LOT'S CASH PAID SET LOWER, AND FIND (25 Nov 2026, his answers: a purchase lot's cash may be set lower, a sale's
 * still only by Undo; and "a much easier entry to modify rows"). Prompted by p059, whose freight was typed into its cash (RM 164 on a RM 150 lot with
 * RM 14 freight beside it). What is proved here, each check red under its own mutation (test/admin-lot-cash.mutations.json), invented codes only (rule 2):
 *   L1  a purchase row's Cash paid typed lower asks first, naming the figure now and after; Keep it posts nothing
 *   L2  Lower it posts ONE Correction whose fields are the cash alone; units received with it go as a Fulfilment carrying no cash
 *   L3  a sale's Cash paid typed lower still posts nothing and points to Undo; a lot's units typed lower still posts nothing
 *   L4  a lowering the Desk refuses is not kept to retry: the next tap asks again (the review standing in for Fable, finding 2); one under the total clears paidOn
 *   F1  Find narrows Row to the rows whose reference, code, book or date holds what is typed, and says how many
 *   F2  a reference typed whole opens that row; one row left opens it; nothing matching leaves Row at New alone and says so
 *   F3  while a move waits to go after a refused change, Find opens no other row (the review's note 4)
 *   R1  the Desk's road drafts the lowered cash as a Correction under Approve
 *   R2  and holds it while money is on its way to the lot, naming why
 *   R3  a lowering names the cash it was read with: none, or a figure the lot no longer holds, is refused; the draft carries the stored figure as expect
 *   R4  a lot stored paid with no cash field is checked on its paid figure and carries the stored 0, which the writer then takes (the re-check's note 2)
 *   E1  the writer (the fold and the Book's tap alike) sets the cash, keeps the lot paid, and records the figure it replaced
 *   E2  and refuses it, as the fold's plan does, on a lot whose cash moved since it was measured (a payment approved first is never written over)
 * Drawn by the maker harness (test/maker-act.mjs) and a migrated in-memory D1, as test/admin-undo.mjs does. */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { readBook as toolsBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { readBook } from "../src/drafter.js";
import { makerAmendmentRoom } from "../src/maker-inputs.js";
import { applyAmend } from "../engine/apply.mjs";
import { plan } from "../tools/fold.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { richOwnerPage, byAct, enter, answerSheets } from "./maker-act.mjs";

const J = JSON.stringify, E = POSITION_ENGINE;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const AMEND = "/all/maker/inputs/ledger-amend";
const D = "2026-11-20";

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
/* the lot as p059 stood: RM 150 of goods, RM 14 freight beside it, and RM 164 typed as its cash */
const lot = (rid) => ({ rid, supplier: "SX9-ZED", product: "salt", qty: 3, total: 150, freight: 14, cash: 164, status: "paid", date: D, paidOn: D, receivedOn: D, receivedQty: 3 });

async function fixture() {
  const source = await toolsBook();
  const ledger = JSON.parse(JSON.stringify(source.ledger)), version = source.version;
  source.w.close();
  const bare = lot("zq3"); delete bare.cash;
  ledger.purchases.push(lot("zq1"), { ...lot("zq2"), cash: 100, status: "partial" }, bare);
  const db = new DatabaseSync(":memory:"), migrations = new URL("../migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter((f) => /^\d+_.*\.sql$/.test(f)).sort()) db.exec(readFileSync(new URL(file, migrations), "utf8"));
  db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger }).sql);
  const D1 = {
    batch(statements) { db.exec("BEGIN IMMEDIATE"); try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (error) { db.exec("ROLLBACK"); throw error; } },
    prepare(sql) {
      const st = db.prepare(sql);
      const bind = (args) => ({ run() { return { meta: { changes: Number(st.run(...args).changes || 0) } }; }, first() { return st.get(...args) ?? null; }, all() { return { results: st.all(...args) }; } });
      return { ...bind([]), bind: (...args) => bind(args) };
    }
  };
  /* a payment to zq2 waiting under Approve: money on its way to that lot */
  db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,party,product,amends,amend_kind,drafter,drafted_at,committed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("2026-11-25T01:00:00.000Z", "pending", "purchases", J({ at: "2026-11-25T01:00:00.000Z", type: "AMEND", payload: { mode: "amend", direction: "BUY", date: D, kind: "Payment", rid: "zq2", cash: 20, kg: 0, party: "SX9-ZED" } }),
      J({ qty: 3, total: 150 }), "a payment", "SX9-ZED", "salt", "zq2", "Payment", "test", "2026-11-25T01:00:00.000Z", null);
  const key = "lot-cash-local-capability-0123456789ab";
  const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: key, STMT_SITE: { fetch: async (url) => new URL(url).pathname === "/desk/orders" ? Response.json({ ok: true, orders: [] }) : Response.json({ ok: true }) }, STMT_DESK_KEY: "desk-key-for-the-fixture" };
  const env = { STMT: new Store(), COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
  const call = async (path, body) => {
    const res = await handleMaker(new Request("https://counter.test" + path, { method: "POST", headers: { "content-type": "application/json" }, body: J(body) }), env, path, { email: "maakmal97@icloud.com" });
    return { status: res.status, j: await res.json() };
  };
  const drafts = () => db.prepare("SELECT id,amends,amend_kind,entry FROM draft WHERE status='pending' ORDER BY id").all().map((r) => ({ ...r, entry: JSON.parse(r.entry) }));
  return { D1, call, drafts, mirror: () => readBook(D1) };
}

/* the catalog's rows, as the Desk serves them: two lots of SX1-ZED's and a sale of CX1-ZED's */
const catalogWith = (j) => {
  j.catalog.rows = [
    { rid: "zq1", party: "SX1-ZED", product: "salt", date: "2026-11-20", qty: 3, total: 150, direction: "BUY", cash: 164, movedUnits: 2, freight: 14, handover: "delivered" },
    { rid: "zq10", party: "SX1-ZED", product: "salt", date: "2026-11-21", qty: 2, total: 100, direction: "BUY", cash: 0, movedUnits: 2, freight: 0, handover: null },
    { rid: "zs1", party: "CX1-ZED", product: "salt", date: "2026-11-19", qty: 2, total: 200, direction: "SELL", cash: 50, movedUnits: 1, delivery: 0, handover: "collected" }];
  j.catalog.revivable = [];
  return j;
};

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, inputsAnswer: catalogWith });
  try {
    await p.work.quiet();
    const d = p.d, w = p.w, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const f = d.querySelector('#makerInputs section.maker-input[data-form="sale-or-purchase"]');
    const A = (a, k) => byAct(f, a, k);
    const fire = (c, type) => c.dispatchEvent(new w.Event(type, { bubbles: true }));
    const put = (act, v) => { const c = A(act); c.value = v; fire(c, "input"); fire(c, "change"); return c; };
    const amends = (from) => p.posts.slice(from).filter((x) => x.route === AMEND).map((x) => x.body);
    const choose = async (rid) => { const pick = A("record.trade.edit"); pick.value = rid; fire(pick, "change"); await quiet(); };
    const status = () => t(f.querySelector(":scope > p[role=status]"));
    const asked = []; let yes = false;
    answerSheets(w, asked, () => yes);

    /* L1, L2 */
    await choose("zq1");
    put("record.trade.cash", "150"); put("record.trade.moved", "3");
    const keep0 = p.posts.length; yes = false;
    A("record.trade.send").click(); await quiet();
    const kept = [amends(keep0).length, asked.slice()];
    ok(kept[0] === 0 && asked.length === 1 && /Lower the cash paid on zq1\?/.test(asked[0]) && /Paid now: RM 164\.00\. After: RM 150\.00, with RM 0\.00 left to pay\./.test(asked[0]),
      "L1: a lot's Cash paid typed lower asks first, naming the figure now and after, and Keep it posts nothing: " + J(kept));
    const go0 = p.posts.length; yes = true;
    A("record.trade.send").click(); await quiet();
    const sent = amends(go0);
    ok(sent.length === 2 && sent[0].kind === "Correction" && sent[0].rid === "zq1" && J(sent[0].fields) === J({ cash: 150 })
      && J(sent[0].expect) === J({ cash: 164 }) && sent[1].kind === "Fulfilment" && sent[1].expect === undefined && sent[1].rid === "zq1" && sent[1].cash === 0 && sent[1].movedUnits === 1 && /wait under Approve/.test(status()),
      "L2: Lower it posts one Correction setting the cash alone, and the unit received with it as a Fulfilment carrying no cash: " + J([sent, status()]));

    /* L3 */
    await choose("zs1"); put("record.trade.cash", "40");
    const s0 = p.posts.length, n0 = asked.length;
    A("record.trade.send").click(); await quiet();
    const sale = [amends(s0).length, asked.length - n0, status()];
    await choose("zq1"); put("record.trade.moved", "1");
    const u0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const units = [amends(u0).length, status()];
    ok(sale[0] === 0 && sale[1] === 0 && /Undo under History/.test(sale[2]) && units[0] === 0 && /less than the book holds/.test(units[1]),
      "L3: a sale's Cash paid typed lower posts nothing and points to Undo, unasked; a lot's units typed lower post nothing: " + J([sale, units]));

    /* L4 */
    await choose("zq1"); put("record.trade.cash", "120");
    p.refuse[AMEND] = "Money is already on its way to this row. Decide it before lowering what it holds paid.";
    A("record.trade.send").click(); await quiet();
    const kept4 = [w.localStorage.getItem("saltMakerPending:" + AMEND), status(), asked.length];
    delete p.refuse[AMEND];
    const l4 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    ok(kept4[0] === null && /on its way/.test(kept4[1]) && asked.length === kept4[2] + 1 && amends(l4).length === 1 && J(amends(l4)[0].fields) === J({ cash: 120, paidOn: null }),
      "L4: a lowering the Desk refuses is not kept to retry, and the next tap asks again: " + J([kept4, asked.length, amends(l4).length]));

    /* F1, F2 */
    await choose("");
    const find = A("record.trade.find"), opts = () => [...A("record.trade.edit").options].map((o) => o.value);
    const hint = () => t(find.closest(".amb-field").nextElementSibling);
    const type = async (v) => { find.value = v; fire(find, "input"); await quiet(); };
    await type("sx1-zed");
    const byCode = [opts(), hint(), A("record.trade.edit").value];
    ok(J(byCode[0]) === J(["", "zq10", "zq1"]) && byCode[1] === "2 rows" && byCode[2] === "" && find.tagName === "INPUT" && find.closest(".amb-field") && (find.compareDocumentPosition(A("record.trade.edit")) & 4) === 4,
      "F1: Find stands before Row and narrows it to a code's rows, saying how many, opening none while two are left: " + J(byCode));
    await type("zq1");
    const whole = [A("record.trade.edit").value, A("record.trade.cash").value];
    await type("");
    await choose("");
    await type("2026-11-19");
    const oneLeft = [A("record.trade.edit").value, A("record.trade.party").value];
    await choose("");
    await type("nothing-here");
    const none = [opts(), hint()];
    ok(whole[0] === "zq1" && whole[1] === "164" && oneLeft[0] === "zs1" && oneLeft[1] === "CX1-ZED" && J(none[0]) === J([""]) && none[1] === "No row matches that.",
      "F2: a reference typed whole opens that row, a date leaving one row opens it, and nothing matching leaves Row at New and says so: " + J([whole, oneLeft, none]));

    /* F3 */
    await type(""); await choose("zq10"); put("record.trade.total", "110"); put("record.trade.cash", "10");
    p.refuse[AMEND] = "Refused for the fixture.";
    A("record.trade.send").click(); await quiet();
    await type("zs1");
    const held = [A("record.trade.edit").value, A("record.trade.party").value];
    delete p.refuse[AMEND];
    const f3 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const went = amends(f3).map((b) => [b.rid, b.kind]);
    ok(J(held) === J(["zq10", "SX1-ZED"]) && J(went) === J([["zq10", "Correction"], ["zq10", "Fulfilment"]]),
      "F3: while a move waits after a refused change, Find opens no other row, and the retry sends both: " + J([held, went]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); }

  /* R1, R2 */
  const fx = await fixture();
  try {
    const n0 = fx.drafts().length;
    const bare = await fx.call(AMEND, { at: "2026-11-25T01:59:58.000Z", rid: "zq1", kind: "Correction", date: "2026-11-25", fields: { cash: 150 } });
    const stale = await fx.call(AMEND, { at: "2026-11-25T01:59:59.000Z", rid: "zq1", kind: "Correction", date: "2026-11-25", fields: { cash: 150 }, expect: { cash: 160 } });
    const raise = await fx.call(AMEND, { at: "2026-11-25T01:59:57.000Z", rid: "zq1", kind: "Correction", date: "2026-11-25", fields: { cash: 170 }, expect: { cash: 164 } });
    ok(bare.status === 400 && /read with/.test(bare.j.error || "") && stale.status === 400 && /moved since it was read \(RM 164\.00, not RM 160\.00\)/.test(stale.j.error || "")
      && raise.status === 400 && /Only a lower cash/.test(raise.j.error || "") && fx.drafts().length === n0,
      "R3: a lowering naming no cash, or a cash the lot no longer holds, is refused, and only a lowering names one: " + J([bare.j.error, stale.j.error, raise.j.error]));
    const r1 = await fx.call(AMEND, { at: "2026-11-25T02:00:00.000Z", rid: "zq1", kind: "Correction", date: "2026-11-25", fields: { cash: 150 }, expect: { cash: 164 } });
    const made = fx.drafts().filter((x) => x.amends === "zq1");
    ok(r1.status === 200 && made.length === 1 && made[0].amend_kind === "Correction" && J(made[0].entry.payload.fields) === J({ cash: 150 }) && J(made[0].entry.payload.expect) === J({ cash: 164 }) && fx.drafts().length === n0 + 1,
      "R1: the Desk drafts a lot's lowered cash as one Correction under Approve: " + J([r1.status, r1.j.error, made.map((x) => x.entry.payload.fields)]));
    const r2 = await fx.call(AMEND, { at: "2026-11-25T02:00:01.000Z", rid: "zq2", kind: "Correction", date: "2026-11-25", fields: { cash: 90 }, expect: { cash: 100 } });
    const book = await fx.mirror();
    const room = await makerAmendmentRoom(fx.D1, E.ledgerAmendmentEntry({ at: "2026-11-25T02:00:02.000Z", row: book.purchases.find((x) => x.rid === "zq2"), direction: "BUY", kind: "Correction", date: "2026-11-25", fields: { cash: 90 } }), book);
    const free = await makerAmendmentRoom(fx.D1, E.ledgerAmendmentEntry({ at: "2026-11-25T02:00:03.000Z", row: book.purchases.find((x) => x.rid === "zq1"), direction: "BUY", kind: "Correction", date: "2026-11-25", fields: { cash: 150 } }), book);
    ok(r2.status === 409 && /lowering what it holds paid/.test(r2.j.error || "") && fx.drafts().filter((x) => x.amends === "zq2" && x.amend_kind === "Correction").length === 0
      && /Money is already on its way to this row\. Decide it before lowering what it holds paid\./.test(room) && free === "",
      "R2: a lowered cash is held while a payment is on its way to the lot, and passes on a lot with none: " + J([r2.status, r2.j.error, room, free]));
    /* R4 */
    const r4 = await fx.call(AMEND, { at: "2026-11-25T02:00:04.000Z", rid: "zq3", kind: "Correction", date: "2026-11-25", fields: { cash: 140 }, expect: { cash: 150 } });
    const made4 = fx.drafts().filter((x) => x.amends === "zq3");
    const row4 = lot("zq3"); delete row4.cash;
    applyAmend(row4, { date: "2026-11-25", kind: "Correction", cash: 0, kg: 0, fields: { cash: 140 }, expect: made4.length ? made4[0].entry.payload.expect : undefined }, "BUY", null);
    ok(r4.status === 200 && made4.length === 1 && J(made4[0].entry.payload.expect) === J({ cash: 0 }) && row4.cash === 140 && row4.status === "partial",
      "R4: a lot stored paid with no cash field is read on its paid figure, carries the stored 0, and the writer takes it: " + J([r4.status, r4.j.error, made4.map((x) => x.entry.payload.expect), row4.cash, row4.status]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); }

  /* E1 */
  const row = lot("zq1");
  applyAmend(row, { date: "2026-11-25", kind: "Correction", cash: 0, kg: 0, fields: { cash: 150 } }, "BUY", null);
  const last = row.amend[row.amend.length - 1];
  ok(row.cash === 150 && row.status === "paid" && E.poCash(row) === 150 && row.freight === 14 && last.kind === "Correction" && J(last.was) === J({ cash: 164 }) && last.cash === 0 && last.kg === 0
    && row.amend[0].note === "as booked" && row.amend[0].cash === 164,
    "E1: the writer sets the lot's cash, keeps it paid with its freight beside it, and records the figure it replaced: " + J([row.cash, row.status, last, row.amend[0]]));

  /* E2 */
  const paidSince = { ...lot("zq1"), cash: 184 };
  let threw = "";
  try { applyAmend(paidSince, { date: "2026-11-25", kind: "Correction", cash: 0, kg: 0, fields: { cash: 150 }, expect: { cash: 164 } }, "BUY", null); } catch (e) { threw = e.message; }
  const item = { id: "e2", collection: "purchases", amends: "zq1", amendKind: "Correction", row: { rid: "zq1", qty: 3, total: 150, cash: 164 },
    entry: { payload: { mode: "amend", direction: "BUY", rid: "zq1", kind: "Correction", date: "2026-11-25", fields: { cash: 150 }, expect: { cash: 164 } } } };
  const pPaid = plan({ sales: [], purchases: [{ ...lot("zq1"), cash: 184 }] }, { approved: [item] }), pSame = plan({ sales: [], purchases: [lot("zq1")] }, { approved: [item] });
  ok(/money moved since it was measured \(RM 184\.00, not RM 164\.00\)/.test(threw) && paidSince.cash === 184
    && pPaid.refused.length === 1 && /money moved since/.test(pPaid.refused[0].why) && pSame.refused.length === 0 && pSame.items.length === 1,
    "E2: the writer and the fold's plan refuse a lowering on a lot whose cash moved since, and take it on the lot as measured: " + J([threw, pPaid.refused, pSame.refused]));
}
