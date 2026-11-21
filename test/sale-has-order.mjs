/* test/sale-has-order.mjs: EVERY SALE HAS ITS ORDER (21 Nov 2026, item 2 of docs/plan-ledger-simplify.html; the roads: docs/DESK.md "Every road that
 * mints a sale"). A live customer row no live site order names is listed on the Ledger check, outside its differences, unless it needs no order or is
 * on the known list; Salt Admin's sale with no order is refused unless he asks for recovery while D1 sale_recovery is on, and then its card says so.
 *   X1  one check a reason a row needs no order: a gift or reward unit, a loyalty unit, the fold's road, cancelled, written off, nothing to carry,
 *       a purchase, no customer
 *   X2  a known row is not listed; any other row no order names is
 *   N1  a live order's rid names its row; a cancelled, declined or test order's does not
 *   N2  the key's row as rowIndex reads it: s395's shape (the live site row, a cancelled twin after it) is named; of two live twins only the newest
 *   N3  a shared group, two orders naming one row, names it
 *   T1  the tie-out lists a planted orderless row in plain words, and leaves clean, faults and waiting as they were
 *   T2  a settled orderless row can still be imported (deskImport's clean gate ignores the list)
 *   R1  Salt Admin's sale is refused 409 "Order for them" without recovery, and with recovery while the switch is off; nothing is queued
 *   R2  with recovery and the switch on it is taken, and its card carries the noOrder flag, frozen in the draft; an order's draft carries none
 *   R3  the switch reads off when its table is missing
 *   P1  Salt Admin draws the list under its own head, and the Ledger check's count leaves it out
 * Every assertion is red under its own mutation (test/sale-has-order.mutations.json). Invented codes only. */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { frozenBook } from "./frozen.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1552", J = JSON.stringify;
const CODE = "ZQ4-ZEN";
const row = (rid, over) => Object.assign({ customer: CODE, date: "2026-11-01", product: "salt", qty: 2, total: 190, delivery: 15, cash: 205, deliveredQty: 2, deliveredOn: "2026-11-01",
  paidOn: "2026-11-01", handover: "delivered", rid, road: "admin" }, over || {});
const keyOf = (s) => POSITION_ENGINE.ovKey(s);
const order = (id, over) => Object.assign({ id, u: "abcd-efgh", status: "done", product: "salt", qty: 2, total: 190, delivery: 15, paid: 205, moved: 2, at: "2026-11-01T02:00:00.000Z",
  history: [], payments: [] }, over || {});

export async function run({ ok, pageWork }) {
  const { orderlessSales, ORDERLESS_KNOWN, ORDER_NOT_NEEDED } = await import("../engine/stages.mjs");
  const { rowIndex, tieOut, deskImport, ORDERLESS_SAY } = await import("../src/orders.js");
  const list = (sales, orders) => orderlessSales({ sales }, orders, rowIndex(sales)).map((s) => s.rid);

  /* X1 */
  {
    const cases = [["a gift", { goodwill: true, total: 40, cash: 0, settledRM: 40 }], ["a reward unit", { rewardOf: "s001", total: 40 }], ["a loyalty unit", { loyal: true, total: 0 }],
      ["the fold's road", { road: "fold" }], ["cancelled", { cancelled: true }], ["written off", { defaulted: true, cash: 0 }], ["nothing to carry", { total: 0, cash: 0 }],
      ["a purchase", { supplier: "SX1-ZED", customer: undefined }], ["no customer", { customer: undefined }]];
    for (const [name, over] of cases) {
      const got = list([row("s501", over)], []);
      ok(got.length === 0, "X1: " + name + " needs no order, so it is not listed: " + J(got));
    }
    let hole; try { hole = orderlessSales({ sales: [null, 7] }, [], rowIndex([])); } catch (e) { hole = e; }
    ok(Array.isArray(hole) && hole.length === 0, "X1: a hole in the book is passed over: " + String(hole));
    ok(ORDER_NOT_NEEDED.length === 6, "X1: the reasons a row needs no order are importOf's six: " + J(ORDER_NOT_NEEDED));
  }
  /* X2 */
  {
    const known = Object.keys(ORDERLESS_KNOWN);
    ok(["s053", "s208", "s182", "s234", "s235", "s236"].every((r) => known.includes(r)) && known.length === 6 && known.every((r) => /\w/.test(ORDERLESS_KNOWN[r])),
      "X2: the known list is s053, s208, s182, s234, s235 and s236, each with its reason: " + J(known));
    const got = list([row("s182", { cash: 0 }), row("s502"), row("s503", { cash: 0, deliveredQty: 0 })], []);
    ok(J(got) === J(["s502", "s503"]), "X2: a known row is not listed, a settled and an owing row no order names are: " + J(got));
  }
  /* N1 */
  {
    const s = [row("s511"), row("s512", { date: "2026-11-02" }), row("s513", { date: "2026-11-03" }), row("s514", { date: "2026-11-04" })];
    const got = list(s, [order("a1", { rid: "s511", imported: true }), order("a2", { rid: "s512", status: "cancelled" }), order("a3", { rid: "s513", status: "declined" }), order("a4", { rid: "s514", test: true })]);
    ok(J(got) === J(["s512", "s513", "s514"]), "N1: a live order's rid names its row; a cancelled, declined or test account's order does not: " + J(got));
  }
  /* N2 */
  {
    const live = row("s395", { road: "site", cash: 110, total: 110, delivery: 0, qty: 10, product: "oil", date: "2026-11-18", deliveredQty: 10, customer: CODE + "-R" });
    const dead = Object.assign({}, live, { rid: "s393", cancelled: true, cash: 0, deliveredQty: 0 });
    const o = order("b1", { product: "oil", ledgerKey: keyOf(live) });
    const got = list([live, dead], [o]);
    ok(got.length === 0, "N2: s395's shape: the live site row at a key whose twin is cancelled (after it) is the key's row, named by the live order: " + J(got));
    const a = row("s521", { road: "hand" }), b = row("s522", { road: "hand" });
    const twins = list([a, b], [order("b2", { ledgerKey: keyOf(a) })]);
    ok(J(twins) === J(["s521"]), "N2: of two live twins at the key one order names, only the key's row (the newest) is named: " + J(twins));
    const other = list([row("s523")], [order("b3", { ledgerKey: keyOf(row("s523", { total: 191 })) })]);
    ok(J(other) === J(["s523"]), "N2: an order naming another key names nothing: " + J(other));
  }
  /* N3 */
  {
    const r = row("s531", { qty: 2, total: 16, delivery: 0, cash: 16, product: "rice" });
    const got = list([r], [order("c1", { ledgerKey: keyOf(r), qty: 1, total: 8 }), order("c2", { ledgerKey: keyOf(r), qty: 1, total: 8 })]);
    ok(got.length === 0, "N3: a shared group, two live orders naming one row, names it: " + J(got));
  }

  /* the tie-out's and the import's world, as test/order-import-route.mjs builds it */
  const { buildSeed } = await import("../tools/d1.mjs");
  const db0 = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = frozenBook();
    db.exec(buildSeed({ v: V, stamped: "20 Nov 2026, 03:00 KL", ledger: { ...bookless, PRICING: { v: V, floors: {}, sizes: [1] }, OPEN: { v: V, count: 0, byKey: {} }, TERMS: {}, REWARD: { stated: {} }, STOCK: { books: {} } } }).sql);
    db.exec("UPDATE snapshot SET at='2026-11-19T23:00:00.000Z'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return Promise.resolve({ results: st.all(...a) }); } }; };
    return { D1: { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } } };
  };
  const envOf = (orders) => {
    const m = new Map([["stmt-users", J({ "abcd-efgh": CODE })], ["orders:told", V], ["orders:fixed", "{}"]]);
    const q = { get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } };
    const STMT_SITE = { fetch: async (url) => (String(url).includes("/desk/orders?") ? Response.json({ ok: true, orders }) : Response.json({ ok: true })) };
    return { SALT_LEDGER: db0().D1, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" };
  };
  const NOW = new Date("2026-11-20T03:00:00.000Z");
  const bookOf = (sales) => async () => ({ version: V, sales, state: { OPEN: { byKey: {} } } });
  /* T1 */
  {
    const named = row("s541", { road: "site" }), loose = row("s542", { date: "2026-11-05", total: 100, delivery: 0, cash: 100, qty: 1 });
    const t = await tieOut(envOf([order("d1", { ledgerKey: keyOf(named) })]), bookOf([named, loose]), NOW);
    ok(t.ok && t.clean === true && t.faults.length === 0 && t.waiting.length === 0, "T1: an orderless row leaves the tie-out clean, with no fault and nothing waiting: " + J({ clean: t.clean, f: t.faults, w: t.waiting }));
    ok(J(t.orderless) === J([{ rid: "s542", who: CODE + ", Salt, 1 unit, RM 100, sold 05 Nov 2026", what: [ORDERLESS_SAY] }]),
      "T1: the orderless row is listed by who it is and what cures it: " + J(t.orderless));
    ok(!/\||\brows?\b|\bkeys?\b|ledgerKey/.test(ORDERLESS_SAY + t.orderless[0].who), "T1: its words are plain: " + ORDERLESS_SAY);
  }
  /* T2 */
  {
    const loose = row("s551");
    const r = await deskImport(envOf([]), { rids: ["s551"] }, bookOf([loose]), NOW);
    ok(r.ok && r.dry && r.results.length === 1 && r.results[0].verdict === "import" && r.results[0].order && r.results[0].order.rid === "s551",
      "T2: a settled row the tie-out lists as orderless can still be imported: " + J(r.results || r));
  }

  /* R1 to R3: Salt Admin's sale through the real Counter bridge and Desk Worker */
  const { world } = await import("./maker-trades.mjs");
  const { draftRow, NO_ORDER_FLAG } = await import("../src/drafter.js");
  const { saleRecoveryOn, SALE_ORDER_FOR_THEM } = await import("../src/worker.js");
  const sale = (at, over) => Object.assign({ at, product: "salt", party: "CX1-ZED", date: "2099-10-05", qty: 1, total: 130, cash: 0, movedUnits: 0, handover: null, delivery: 0 }, over || {});
  {
    const wd = world({ strict: true });
    try {
      const a = await wd.call("/all/maker/inputs/sale", sale("2099-10-05T01:00:00.000Z")), ja = await a.json();
      ok(a.status === 409 && ja.error === SALE_ORDER_FOR_THEM && /Order for them/.test(ja.error) && wd.drafts().length === 0 && !wd.puts.some(([k]) => k.startsWith("q:")),
        "R1: Salt Admin's sale with no order is refused 409, Order for them, and nothing is queued: " + J({ s: a.status, ja }));
      const b = await wd.call("/all/maker/inputs/sale", sale("2099-10-05T01:01:00.000Z", { recovery: true })), jb = await b.json();
      ok(b.status === 409 && jb.error === SALE_ORDER_FOR_THEM && wd.drafts().length === 0, "R1: asking for recovery while the switch is off is refused too: " + J({ s: b.status, jb }));
      const p = await wd.call("/all/maker/inputs/purchase", { at: "2099-10-05T01:02:00.000Z", product: "salt", party: "SX1-ZED", date: "2099-10-05", qty: 1, total: 40, cash: 0, movedUnits: 0, handover: null, freight: 0 });
      ok(p.status === 200, "R1: a purchase is not touched: " + p.status);
      wd.sqlite.exec("UPDATE sale_recovery SET mode='on' WHERE one=1");
      const c = await wd.call("/all/maker/inputs/sale", sale("2099-10-05T01:03:00.000Z")), jc = await c.json();
      ok(c.status === 409 && jc.error === SALE_ORDER_FOR_THEM, "R1: with the switch on, a sale that does not ask for recovery is refused: " + J({ s: c.status, jc }));
      const d = await wd.call("/all/maker/inputs/sale", sale("2099-10-05T01:04:00.000Z", { recovery: true })), jd = await d.json();
      const mine = wd.drafts().filter((x) => x.collection === "sales");
      ok(d.status === 200 && jd.ok && mine.length === 1 && mine[0].flags.includes(NO_ORDER_FLAG) && !("recovery" in mine[0].entry.payload),
        "R2: with recovery and the switch on the sale is taken, its draft's flags carry noOrder: " + J({ s: d.status, jd, f: mine[0] && mine[0].flags }));
      const site = draftRow({ at: "2099-10-05T01:05:00.000Z", orderId: "20991005010500-abcdef", type: "SELL", party: "CX1-ZED", qty: 1, total: 130,
        payload: Object.assign({}, mine[0].entry.payload) }, wd.b);
      ok(site && !site.skip && Array.isArray(site.flags) && !site.flags.includes(NO_ORDER_FLAG), "R2: a site order's draft of the same sale carries no noOrder flag: " + J(site && (site.skip || site.flags)));
    } finally { wd.sqlite.close(); }
  }
  {
    const off = await saleRecoveryOn({ prepare() { throw new Error("no such table: sale_recovery"); } });
    const on = await saleRecoveryOn({ prepare() { return { first: async () => ({ mode: "on" }) }; } });
    const none = await saleRecoveryOn({ prepare() { return { first: async () => null }; } });
    ok(off === false && on === true && none === false, "R3: the switch reads off when its table is missing or its row is gone, on only when its row says on: " + J({ off, on, none }));
  }

  /* P1 */
  if (pageWork) {
    const { richOwnerPage, byAct } = await import("./maker-act.mjs");
    const tie = { ok: true, at: "2026-11-20T03:00:00.000Z", v: "book@600", orders: 4, clean: true, waiting: [], faults: [],
      orderless: [{ rid: "s542", who: CODE + ", Salt, 1 unit, RM 100, sold 05 Nov 2026", what: [ORDERLESS_SAY] }] };
    const p = await richOwnerPage({ pageWork, extra: (route) => route === "/all/maker/ledger" ? { ok: true, version: 3, orders: 9, open: [], pending: [], recent: [], tieout: tie } : undefined });
    try {
      byAct(p.d, "nav.orders").click(); await p.work.quiet();
      byAct(p.d, "part.orders.ledger").click(); await p.work.quiet();
      const root = p.d.getElementById("led-tie"), heads = [...root.querySelectorAll("h3")].map((x) => x.textContent), lines = [...root.querySelectorAll("p.maker-facts")].map((x) => x.textContent);
      ok(heads.includes("Sales no order names") && lines.includes(CODE + ", Salt, 1 unit, RM 100, sold 05 Nov 2026 · s542: " + ORDERLESS_SAY + "."),
        "P1: Salt Admin draws the orderless sale under its own head: " + J({ heads, lines }));
      ok(/Every site order matches its row on the book/.test(root.textContent), "P1: the check still reads clean with an orderless sale listed: " + J(root.textContent.slice(0, 160)));
      const n = [...p.d.querySelectorAll("[data-ledger-n]")];
      ok(n.every((c) => c.hidden && !c.textContent), "P1: the Ledger check's count leaves the orderless sale out: " + J(n.map((c) => [c.hidden, c.textContent])));
    } catch (e) { ok(false, "P1 stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  }
}
