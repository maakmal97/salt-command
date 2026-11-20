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
  const { deskImport, deskUnimport } = await import("../src/orders.js");
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
    const q = { m, get: async (k, t) => (over && over.failFixed && k === "orders:fixed" ? (() => { throw new Error("kv down"); })() : m.has(k) ? (t === "json" ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { log.push("put " + k); m.set(k, v); }, delete: async (k) => { log.push("delete " + k); m.delete(k); } };
    const W = world(), sent = [];
    const STMT_SITE = { fetch: async (url, init) => {
      if (String(url).includes("/desk/orders?")) return Response.json({ ok: true, orders: orderList });
      if (String(url).endsWith("/desk/import")) {
        log.push("site /desk/import");
        const b = JSON.parse(init.body); sent.push(...b.orders);
        if (over && over.status) return Response.json({ ok: false, error: "down" }, { status: over.status });
        return Response.json({ ok: true, results: b.orders.map((o) => (over && over.refuse === o.rid ? { id: o.id, ok: false, why: "an order already names its row" } : { id: o.id, ok: true })) });
      }
      if (String(url).endsWith("/desk/unimport")) {
        log.push("site /desk/unimport");
        const b = JSON.parse(init.body); sent.push(...b.ids);
        if (over && over.status) return Response.json({ ok: false, error: "down" }, { status: over.status });
        return Response.json({ ok: true, results: b.ids.map((id) => (over && over.touched === id ? { id, ok: false, why: "a move has touched it since its import: money" } : { id, ok: true })) });
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
  /* R8: a failed read of the fixed marks sends nothing */
  {
    const E = envOf([], { failFixed: true }), r = await call(E, rows(), { rids: ["s297"], dry: false });
    ok(r.ok === false && r.status === 503 && /fixed marks/.test(r.error) && !E.sent.length && !E.log.some((x) => /put orders:fixed|site/.test(x)), "R8: a failed read of orders:fixed answers 503 and writes and sends nothing: " + J([r, E.log]));
  }
  /* R9: the way back */
  {
    const E = envOf([]), post = (body, key, method) => worker.fetch(new Request("https://salt.test/orders/unimport", { method: method || "POST", headers: Object.assign({ "content-type": "application/json" }, key ? { "X-Salt-Key": key } : {}), body: method === "GET" ? undefined : J(body) }), E.env, { waitUntil() {} });
    ok((await post({ ids: ["a"] })).status === 401 && !E.log.length, "R9: the way back needs the write key");
    ok((await post({ ids: [] }, "wk")).status === 400 && (await post({ ids: Array.from({ length: 21 }, (_, i) => "i" + i) }, "wk")).status === 400 && !E.log.length, "R9: none and over 20 ids are refused 400");
    ok((await post(null, "wk", "GET")).status === 405, "R9: a GET is 405");
    const r = await post({ ids: ["20261101000000-i401", "20261102000000-i402"] }, "wk"), j = await r.json();
    ok(r.status === 200 && j.ok && j.results.length === 2 && j.results.every((x) => x.ok) && E.sent.length === 2 && E.log.includes("site /desk/unimport"), "R9: the ids go to the Counter and its answer comes back a id: " + J(j));
    const E2 = envOf([], { touched: "20261102000000-i402" }), r2 = await deskUnimport(E2.env, { ids: ["20261101000000-i401", "20261102000000-i402"] });
    ok(r2.ok && r2.results[0].ok && !r2.results[1].ok && /money/.test(r2.results[1].why), "R9: a refusal is answered for that id alone, saying what touched it: " + J(r2));
    const E3 = envOf([], { status: 500 }), r3 = await deskUnimport(E3.env, { ids: ["x"] });
    ok(!r3.ok && r3.status === 502, "R9: the Counter down is 502");
  }
  /* T: the laptop tool's pure parts, and its drive over the real route */
  {
    const T = await import("../tools/orders-import.mjs");
    const many = Array.from({ length: 19 }, (_, i) => ({ rid: "a" + i, trip: null })).concat([{ rid: "t1", trip: "T" }, { rid: "t2", trip: "T" }, { rid: "t3", trip: "T" }], Array.from({ length: 25 }, (_, i) => ({ rid: "b" + i, trip: null })));
    const bs = T.batches(many);
    ok(bs.every((b) => b.length <= 20) && bs.flat().length === 47 && new Set(bs.flat()).size === 47 && bs.some((b) => b.includes("t1") && b.includes("t2") && b.includes("t3")) && bs[0].length === 19,
      "T1: batches of 20 at most, every rid once, a trip never split: " + J(bs.map((b) => b.length)));
    const apart = T.batches([{ rid: "x", trip: "Q" }, { rid: "y", trip: null }, { rid: "z", trip: "Q" }]);
    ok(J(apart) === J([["x", "z", "y"]]), "T1: a trip's lines are brought together: " + J(apart));
    let threw = false; try { T.batches(Array.from({ length: 3 }, (_, i) => ({ rid: "q" + i, trip: "Z" })), 2); } catch (e) { threw = true; }
    ok(threw, "T1: a trip longer than a batch is an error, not a split");
    const t = T.tally([{ verdict: "import" }, { verdict: "refused", why: "cancelled" }, { verdict: "refused", why: "cancelled" }, { verdict: "refused", why: "a test account" }]);
    ok(t.import === 1 && t.refused === 3 && t.why.cancelled === 2 && t.why["a test account"] === 1, "T2: the tally counts verdicts and reasons: " + J(t));
    ok(T.runGuards({ runs: [{ status: "completed" }], approved: { count: 0, held: 0 } }).length === 0, "T3: nothing running and nothing approved is a go");
    ok(/in progress/.test(T.runGuards({ runs: [{ status: "in_progress" }], approved: { count: 0 } })[0] || "") && /in progress/.test(T.runGuards({ runs: [{ status: "queued" }], approved: { count: 0 } })[0] || ""), "T3: a run in progress or queued stops it");
    ok(/approved row/.test(T.runGuards({ runs: [], approved: { count: 2 } })[0] || "") && /approved row/.test(T.runGuards({ runs: [], approved: { count: 0, held: 1 } })[0] || ""), "T3: an approved row unfolded stops it, held under the Book too");
    ok(T.runGuards({ runs: null, approved: { count: 0 } }).length === 1 && T.runGuards({ runs: [], approved: null }).length === 1, "T3: what cannot be read stops it");
    const w = { id: "i1", u: "u", status: "done", rid: "s1", paid: 5 }, g = Object.assign({}, w, { importedAt: "2026-11-20T03:00:00.000Z" });
    ok(T.diffOrder(w, g).length === 0 && T.diffOrder(w, Object.assign({}, g, { paid: 6 })).join() === "paid" && T.diffOrder(w, w).join() === "importedAt" && T.diffOrder(w, undefined).length === 1, "T4: a read back differs on a field, or lacks importedAt, or is missing");
    ok(T.FIELDS.includes("queued") && T.FIELDS.includes("rateAsk") && T.FIELDS.includes("history"), "T4: the read back compares queued, rateAsk and history too");
    {
      const calls = [], c = { async orders() { return { ok: true, orders: [{ id: "i1", imported: true }, { id: "p1" }, { id: "i2", imported: true }] }; }, async unimp(ids) { calls.push(ids); return { ok: true, results: ids.map((id) => ({ id, ok: id !== "bad", why: id === "bad" ? "touched" : undefined })) }; } };
      const u1 = await T.undo(c, []);
      ok(u1.ok && J(calls) === J([["i1", "i2"]]), "T6: --undo with no ids reads the imported orders off the Desk and takes only those back: " + J(calls));
      const u2 = await T.undo(c, ["a", "bad"]);
      ok(!u2.ok && u2.results.length === 2, "T6: a refusal stops it, saying why");
    }
    /* the drive over the real route: a client whose calls are deskImport on a fake site */
    const clientOf = (E, rs, hold = {}) => ({ calls: [],
      async imp(rids, dry) { this.calls.push((dry ? "dry " : "run ") + rids.join(",")); const r = await deskImport(E.env, { rids, dry }, async () => bookOf(rs), NOW); return r.ok ? { ok: true, results: r.results } : { ok: false, error: r.error }; },
      async orders() { return { ok: true, orders: E.sent.map((o) => Object.assign({}, o, hold.alter && o.rid === hold.alter ? { paid: 1 } : {})) }; } });
    const say = [], mk = () => ({ say: (s) => say.push(s) });
    const E = envOf([]), c = clientOf(E, rows()), d = await T.drive(c, [["s401", "s403"], ["s297"]], Object.assign({ run: false }, mk()));
    ok(d.ok && d.results.length === 3 && c.calls.every((x) => x.startsWith("dry")) && !E.log.length, "T5: a dry drive asks dry only and writes nothing: " + J([c.calls, E.log]));
    const E2 = envOf([]), c2 = clientOf(E2, rows()), r2 = await T.drive(c2, [["s401", "s403"], ["s297"]], Object.assign({ run: true }, mk()));
    ok(r2.ok && c2.calls.join("|") === "dry s401,s403|run s401,s403|dry s297|run s297" && E2.sent.length === 2, "T5: a run asks each batch dry, then real, in turn: " + J(c2.calls));
    const E3 = envOf([], { refuse: "s401" }), c3 = clientOf(E3, rows()), r3 = await T.drive(c3, [["s401", "s402"], ["s297"]], Object.assign({ run: true }, mk()));
    ok(!r3.ok && !c3.calls.some((x) => /s297/.test(x)) && say.some((s) => /STOP: 1 order\(s\) failed/.test(s)), "T5: it stops at the first batch with a failed order, the next never asked: " + J(c3.calls));
    const E4 = envOf([]), c4 = clientOf(E4, rows(), { alter: "s401" }), r4 = await T.drive(c4, [["s401"], ["s297"]], Object.assign({ run: true }, mk()));
    ok(!r4.ok && !c4.calls.some((x) => /s297/.test(x)) && say.some((s) => /read back differs: s401 \(paid\)/.test(s)), "T5: it stops on a read back that differs, the next batch never asked: " + J(say.slice(-2)));
  }
}
