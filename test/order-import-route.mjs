/* test/order-import-route.mjs: THE DESK IMPORTS AN OLDER SALE'S ORDER ONLY ON A CLEAN BOOK, UNDOS FIRST (20 Nov 2026, docs/plan-order-import.html, Part 5).
 *   R1 the keyed route: no key is 401, no rids, over 20 and an unnamed rid are refused, a refused rid is answered through the real Worker
 *   R2 a dirty tie-out refuses the whole call (409), writes nothing and calls no site
 *   R3 dry (the default) answers a verdict a rid, the order built for a good one, and writes and sends nothing
 *   R4 a run writes orders:fixed BEFORE the site call, stamps importedAt, and answers the Counter's result a rid
 *   R5 a refused rid among good ones is answered with its reason and never sent
 *   R6 the Counter refusing one order is answered for that rid alone
 *   R7 a trip asked in part is refused whole; a row with a draft on its way is refused
 * Every group is red under its own mutation (test/order-import-route.mutations.json). */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenBook } from "./frozen.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1552", J = JSON.stringify;
const plain = (n, over) => Object.assign({ customer: "CQ4-ZEN", date: "2026-11-0" + n, product: "salt", qty: 2, total: 190, delivery: 15, cash: 205, deliveredQty: 2, deliveredOn: "2026-11-0" + n, paidOn: "2026-11-0" + n,
  handover: "delivered", rid: "s40" + n, road: "admin" }, over || {});
const s297 = () => ({ customer: "CZ4-MK", date: "2026-10-27", product: "oil", qty: 10, total: 120, delivery: 0, cash: 120, cost: 78.6, deliveredOn: "2026-10-27", deliveredQty: 10, paidOn: "2026-10-27",
  handover: "collected", rid: "s297", road: "admin",
  amend: [{ cash: 0, date: "2026-10-27", kg: 0, kind: "Fulfilment", note: "as booked" },
    { cash: 120, date: "2026-10-27", kg: 10, kind: "Fulfilment", note: "paid", undone: "2026-10-27" },
    { cash: 0, date: "2026-10-27", kg: 0, kind: "Correction", note: "undoes step 2", took: { cash: 120, units: 10 }, undoes: 2 },
    { cash: 120, date: "2026-10-27", kg: 10, kind: "Fulfilment", note: "paid again" }] });

export async function run({ ok }) {
  const { buildSeed } = await import("../tools/d1.mjs");
  const { deskImport } = await import("../src/orders.js");
  const worker = (await import("../src/worker.js")).default;
  const world = () => {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(join(REPO, "migrations")).filter((x) => /^\d+_.*\.sql$/.test(x)).sort()) db.exec(readFileSync(join(REPO, "migrations", f), "utf8"));
    const { NOTES, ...bookless } = frozenBook();
    db.exec(buildSeed({ v: V, stamped: "20 Nov 2026, 03:00 KL", ledger: { ...bookless, PRICING: { v: V, floors: {}, sizes: [1] }, OPEN: { v: V, count: 0, byKey: {} }, TERMS: {}, REWARD: { stated: {} }, STOCK: { books: {} } } }).sql);
    db.exec("UPDATE snapshot SET at='2026-11-19T23:00:00.000Z'");
    const mkq = (a, sql) => { const st = db.prepare(sql); return { run() { const x = st.run(...a); return { meta: { changes: Number(x.changes || 0) } }; }, first() { const x = st.get(...a); return x === undefined ? null : x; }, all() { return Promise.resolve({ results: st.all(...a) }); } }; };
    return { db, D1: { prepare(sql) { const o = mkq([], sql); o.bind = (...a) => mkq(a, sql); return o; } } };
  };
  const bookOf = (sales) => ({ version: V, sales, state: { OPEN: { byKey: {} } } });
  const NOW = new Date("2026-11-20T03:00:00.000Z");
  /* the site: its orders and a log of every call in the order made, KV puts included; /desk/import answers per order as the order book does */
  const envOf = (orderList, over) => {
    const log = [], m = new Map();
    m.set("stmt-users", J({ "abcd-efgh": "CQ4-ZEN", "ijkl-mnop": "CZ4-MK" })); m.set("orders:told", V); m.set("orders:fixed", "{}");
    const q = { m, get: async (k, t) => (m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { log.push("put " + k); m.set(k, v); }, delete: async (k) => { log.push("delete " + k); m.delete(k); } };
    const W = world(), sent = [];
    const STMT_SITE = { fetch: async (url, init) => {
      if (String(url).includes("/desk/orders?")) return Response.json({ ok: true, orders: orderList });
      if (String(url).endsWith("/desk/import")) {
        log.push("site /desk/import");
        const b = JSON.parse(init.body); sent.push(...b.orders);
        if (over && over.status) return Response.json({ ok: false, error: "down" }, { status: over.status });
        return Response.json({ ok: true, results: b.orders.map((o) => (over && over.refuse === o.rid ? { id: o.id, ok: false, why: "an order already names its row" } : { id: o.id, ok: true })) });
      }
      log.push("site " + url); return Response.json({ ok: true });
    } };
    return { env: { REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", SALT_LEDGER: W.D1, SALT_QUEUE: q, STMT_SITE, STMT_DESK_KEY: "k" }, log, q, sent, W };
  };
  const call = (E, rows, b) => deskImport(E.env, b, async () => bookOf(rows), NOW);
  const rows = () => [plain(1), plain(2, { customer: "CQ4-ZEN-R", handover: "collected", delivery: 0, total: 205, cash: 205 }), s297(), plain(3, { cancelled: true, rid: "s403" }), plain(4, { cash: 100, rid: "s404" })];

  /* R1: the real Worker */
  {
    const E = envOf([]), post = (body, key) => worker.fetch(new Request("https://salt.test/orders/import", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, key ? { "X-Salt-Key": key } : {}), body: J(body) }), E.env, { waitUntil() {} });
    const r0 = await post({ rids: ["s401"] });
    ok(r0.status === 401 && !E.log.length, "R1: no write key is 401 and touches nothing");
    const r1 = await post({ rids: ["s401"] }, "bad");
    ok(r1.status === 401, "R1: a wrong key is 401");
    const many = await post({ rids: Array.from({ length: 21 }, (_, i) => "s" + i) }, "wk"), none = await post({ rids: [] }, "wk");
    ok(many.status === 400 && none.status === 400 && !E.log.length, "R1: 21 rids and none are refused 400, nothing touched");
    const g = await worker.fetch(new Request("https://salt.test/orders/import", { headers: { "X-Salt-Key": "wk" } }), E.env, { waitUntil() {} });
    ok(g.status === 405, "R1: a GET is 405");
    const r2 = await post({ rids: ["zz9999"] }, "wk"), j2 = await r2.json();
    ok(r2.status === 200 && j2.ok && j2.dry === true && j2.results.length === 1 && j2.results[0].rid === "zz9999" && j2.results[0].verdict === "refused" && /no such sale/.test(j2.results[0].why),
      "R1: through the Worker, dry by default, an unknown rid is refused with a reason: " + J(j2));
  }
  /* R2: a dirty tie-out */
  {
    const gone = { id: "20261101000000-i401", u: "abcd-efgh", status: "done", product: "salt", qty: 2, total: 190, delivery: 15, mode: "deliver", ledgerKey: "CQ4-ZEN|2026-11-01|205", rid: "s401", imported: true, paid: 205, moved: 2,
      queued: { ack: "2026-10-31T16:00:00.000Z", paid: 205, moved: 2 }, payments: [], msgs: [], history: [] };
    const E = envOf([gone]);
    const r = await call(E, [plain(2)], { rids: ["s402"], dry: false });
    ok(r.ok === false && r.status === 409 && /do not agree/.test(r.error) && !E.log.length && !E.sent.length, "R2: a dirty tie-out refuses the whole call and writes and sends nothing: " + J([r, E.log]));
    const rd = await call(E, [plain(2)], { rids: ["s402"] });
    ok(rd.ok === false && rd.status === 409, "R2: and a dry run is refused the same: " + J(rd));
  }
  /* R3: dry */
  {
    const E = envOf([]), r = await call(E, rows(), { rids: ["s401", "s402", "s297", "s403", "s404"], dry: true });
    const by = Object.fromEntries((r.results || []).map((x) => [x.rid, x]));
    ok(r.ok && r.dry === true && r.results.length === 5 && by.s401.verdict === "import" && by.s401.order && by.s401.order.id === "20261101000000-i401" && by.s297.verdict === "import" && by.s402.verdict === "import",
      "R3: each good rid is an import with its order built: " + J(r));
    ok(by.s403.verdict === "refused" && /cancelled/.test(by.s403.why) && by.s404.verdict === "refused" && /owing/.test(by.s404.why) && !by.s403.order, "R3: each bad rid is refused with its reason: " + J([by.s403, by.s404]));
    ok(by.s402.order.forFriend === true && by.s402.order.u === "abcd-efgh", "R3: a -R row is the associate's order for a friend, on the associate's username: " + J(by.s402.order));
    ok(!E.log.length && !E.sent.length && (await E.q.get("orders:fixed")) === "{}", "R3: dry writes nothing and calls no site: " + J(E.log));
    const dflt = await call(E, rows(), { rids: ["s401"] });
    ok(dflt.dry === true && !E.log.length, "R3: dry is the default when the body says nothing");
  }
  /* R4: a run */
  {
    const E = envOf([]), r = await call(E, rows(), { rids: ["s297", "s401"], dry: false });
    const fixed = await E.q.get("orders:fixed", "json");
    ok(r.ok && r.dry === false && r.results.length === 2 && r.results.every((x) => x.verdict === "import" && x.ok === true && !x.order && x.id), "R4: each answered imported by the Counter, with its id, no order echoed: " + J(r));
    ok(E.log.join("|") === "put orders:fixed|site /desk/import", "R4: orders:fixed is written BEFORE the site call: " + J(E.log));
    ok(fixed["un-s297-2"] && Object.keys(fixed).length === 1, "R4: s297's past undo is in the mark: " + J(fixed));
    ok(E.sent.length === 2 && E.sent.every((o) => o.importedAt === NOW.toISOString() && o.imported === true), "R4: every order is sent stamped importedAt: " + J(E.sent.map((o) => o.importedAt)));
    const E2 = envOf([]), r2 = await call(E2, [plain(1)], { rids: ["s401"], dry: false });
    ok(r2.ok && E2.log.join("|") === "site /desk/import", "R4: a row with no past undo writes no mark: " + J(E2.log));
    const E3 = envOf([], { status: 503 }), r3 = await call(E3, rows(), { rids: ["s297"], dry: false });
    ok(r3.ok === false && r3.status === 502 && /would not take/.test(r3.error) && (await E3.q.get("orders:fixed", "json"))["un-s297-2"], "R4: a Counter that is down is a 502 (the marked undo stays, harmless): " + J(r3));
  }
  /* R5: a refused rid among good ones */
  {
    const E = envOf([]), r = await call(E, rows(), { rids: ["s401", "s403", "s297", "s404"], dry: false });
    const by = Object.fromEntries(r.results.map((x) => [x.rid, x]));
    ok(by.s401.verdict === "import" && by.s401.ok === true && by.s297.ok === true && by.s403.verdict === "refused" && by.s404.verdict === "refused" && !by.s403.ok, "R5: good rids imported, refused rids answered with their reason: " + J(r.results));
    ok(E.sent.length === 2 && E.sent.every((o) => o.rid === "s401" || o.rid === "s297"), "R5: only the good rids reach the Counter: " + J(E.sent.map((o) => o.rid)));
    const E2 = envOf([]), r2 = await call(E2, rows(), { rids: ["s403"], dry: false });
    ok(r2.ok && r2.results[0].verdict === "refused" && !E2.log.length, "R5: a batch of refusals alone writes and sends nothing");
  }
  /* R6: the Counter refuses one */
  {
    const E = envOf([], { refuse: "s401" }), r = await call(E, rows(), { rids: ["s401", "s402"], dry: false });
    const by = Object.fromEntries(r.results.map((x) => [x.rid, x]));
    ok(r.ok && by.s401.ok === false && /already names/.test(by.s401.why) && by.s402.ok === true, "R6: the Counter's refusal answers that rid alone: " + J(r.results));
  }
  /* R7: a trip asked in part, a draft on its way */
  {
    const trip = [plain(1, { rid: "s410", trip: "t1791145053619", delivery: 0, cash: 190 }), plain(1, { rid: "s411", trip: "t1791145053619", product: "rice", total: 10, qty: 2, delivery: 40, cash: 50 })];
    const E = envOf([]), r = await call(E, trip, { rids: ["s410"], dry: false });
    ok(r.ok && r.results[0].verdict === "refused" && /trip/.test(r.results[0].why) && !E.log.length, "R7: a trip line asked without its sibling is refused, nothing written: " + J(r.results));
    const rw = await call(envOf([]), trip, { rids: ["s410", "s411"] });
    ok(rw.results.every((x) => x.verdict === "import") && rw.results[0].order.sheet === rw.results[1].order.sheet, "R7: both lines asked import on one sheet: " + J(rw.results.map((x) => x.verdict)));
    const E2 = envOf([]);
    E2.W.db.prepare("INSERT INTO draft (id,status,collection,entry,row,reasoning,party,product,amends,amend_kind,drafter,drafted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run("2026-11-20T01:00:00.000Z", "pending", "sales", J({ at: "x", type: "AMEND", payload: { mode: "amend", direction: "SELL", kind: "Fulfilment", rid: "s401", cash: 0, kg: 1 } }), J({ qty: 1, total: 1 }), "a move", "CQ4-ZEN", "salt", "s401", "Fulfilment", "test", "2026-11-20T01:00:00.000Z");
    const r2 = await call(E2, rows(), { rids: ["s401", "s402"], dry: false });
    const by = Object.fromEntries(r2.results.map((x) => [x.rid, x]));
    ok(by.s401.verdict === "refused" && /on its way/.test(by.s401.why) && by.s402.verdict === "import", "R7: a row with a draft on its way is refused, its neighbour is not: " + J(r2.results));
  }
}
