/* test/pool.mjs: THE POOL, A GROUP ORDER (his plan of 05 Oct 2026). One exported function a fold, each run as a section of
 * test/verify.mjs. Every assertion here was proved red by its own mutation (see the fold's commit). */
const U1 = "abcd-efgh", U2 = "jklm-npqr", rid = (s) => s.repeat(16).slice(0, 32);

async function sqlite() {
  try { return (await import("node:sqlite")).DatabaseSync; } catch (e) { return null; }
}

/* a customer with a list stamped d1, and the site's book on the object road */
export async function rig(KV) {
  const O = await import("../stmt/orders.js"), H = await import("./orderbook-harness.mjs");
  const kv = new KV(), bk = H.orderBook({}), env = { STMT: kv, ORDERBOOK: bk.ns, ORDER_STORE: "object" };
  for (const u of [U1, U2]) await kv.put("u:" + u, JSON.stringify({ prices: { digest: "d1" } }));
  const join = (u, id, extra) => O.poolJoin(env, u, id, Object.assign({ q: 2, total: 90, unit: 45, digest: "d1", rid: rid(u[0] + "1") }, extra || {}));
  return { O, env, bk, kv, join };
}

export async function store({ ok, KV, skipOff }) {
  if (!(await sqlite())) { skipOff("node:sqlite is unavailable here, so the pool was not driven through the order book"); return; }
  const { O, env, bk, join } = await rig(KV);
  const count = (t) => bk.db.prepare("SELECT COUNT(*) AS n FROM " + t).get().n;
  const bad = [await O.poolOpen(env, { product: "salt", q: 2, target: 1 }), await O.poolOpen(env, { product: "Salt", q: 2, target: 10 }),
    await O.poolOpen(env, { product: "salt", q: 2, target: 10, price: 5 }), await O.poolOpen(env, { product: "salt", q: 0, target: 10 }),
    await O.poolOpen(env, { product: "salt", q: 2, target: 10, closesOn: "2020-01-01" })];
  ok(bad.every((r) => r.error && r.status === 400) && count("pool") === 0,
    "a group order is a product, a size, a target of at least that size and a future closing day: anything else is refused and nothing is kept: " + JSON.stringify(bad.map((r) => r.error)));
  const opened = await O.poolOpen(env, { product: "salt", q: 2, target: 10 });
  const pid = opened.pool && opened.pool.id;
  ok(O.POOL_ID_RE.test(pid) && O.isPoolId(pid) && !O.isPoolId("a20261003070000-ex1") && !O.isPoolId("20261003070000-abcd")
    && opened.pool.state === "open" && opened.pool.joins.length === 0 && count("pool") === 1 && count("ord") === 0,
    "opening one files a pool under its own id in its own table, never an order: " + JSON.stringify(opened));

  /* a join: one order, collect, at their own price, and the join beside it */
  const j1 = await join(U1, pid);
  ok(j1.order && j1.order.pool === pid && j1.order.mode === "collect" && j1.order.status === "placed" && j1.order.total === 90 && j1.order.qty === 2
    && j1.pool.joins.length === 1 && j1.pool.joins[0].oid === j1.order.id && count("ord") === 1,
    "a join makes one collected order carrying the pool's id and puts the join on the pool: " + JSON.stringify(j1));
  const evs = bk.db.prepare("SELECT oid, kind FROM ev ORDER BY seq").all().map((x) => x.kind).join();
  ok(evs === "popen,place,pjoin", "and the book holds its moves as events under the pool's id: " + evs);

  /* the same customer twice, and a retry of the first tap */
  const twice = await join(U1, pid, { rid: rid("z2") }), retry = await join(U1, pid);
  ok(twice.error && twice.status === 409 && twice.code === "poolTwice" && count("ord") === 1,
    "a second join by the same customer is refused and makes no order: " + JSON.stringify(twice));
  ok(retry.order && retry.order.id === j1.order.id && count("ord") === 1 && (await O.allPools(env))[0].joins.length === 1,
    "a retry of the first tap under its id lands once, answered with the order it made");

  /* units are read live, never stored */
  const j2 = await join(U2, pid, { rid: rid("k1") });
  let p = (await O.allPools(env))[0];
  ok(p.unitsIn === 4 && p.target === 10 && !("unitsIn" in JSON.parse(bk.db.prepare("SELECT doc FROM pool").get().doc)),
    "two joins of 2 are 4 of 10 units in, read off the orders and never kept on the pool: " + p.unitsIn);
  const cancel = await O.customerMove(env, U1, j1.order.id, "cancel", {});
  p = (await O.allPools(env))[0];
  const mine = (await O.poolsOf(env, U1))[0], theirs = (await O.poolsOf(env, U2))[0];
  ok(cancel.order && cancel.order.status === "cancelled" && p.unitsIn === 2 && p.joins.length === 2 && mine.mine === null && theirs.mine === j2.order.id,
    "a join withdrawn leaves the units in at once, the pool keeping the line of it, and the page's read names only the join that stands: " + JSON.stringify([p.unitsIn, mine.mine]));
  const again = await join(U1, pid, { rid: rid("z3") });
  ok(again.order && again.order.id !== j1.order.id && (await O.allPools(env))[0].unitsIn === 4,
    "and a customer who withdrew may join again");

  /* the close is his; a join after it is refused */
  const closed = await O.poolClose(env, pid, {});
  const twiceClosed = await O.poolClose(env, pid, {});
  ok(closed.closed === true && closed.pool.state === "closed" && closed.joined.length === 2 && closed.joined.every((x) => x.status === "placed")
    && twiceClosed.closed === false && twiceClosed.joined.length === 2,
    "Close closes it once and answers the joined orders still standing; a second Close changes nothing and answers them again: " + JSON.stringify([closed.joined, twiceClosed.closed]));
  const late = await join(U2, pid, { rid: rid("k9") }), before = count("ord");
  const late2 = await O.poolJoin(env, "wxyz-2345", pid, { q: 2, total: 90, unit: 45, digest: "d1", rid: rid("w1") });
  ok(late.error && late2.error && late2.status === 409 && late2.code === "poolClosed" && count("ord") === before,
    "a join after the close is refused and makes no order: " + JSON.stringify(late2));
  const none = await O.poolJoin(env, U2, "p20260101000000-aaaa", { q: 2, total: 90, unit: 45, digest: "d1", rid: rid("n1") });
  ok(none.status === 404 && none.code === "poolNone", "and one with no such pool is refused in its own words");

  /* a join is one step: the order and the join are appended together, or neither is */
  const b2 = await rig(KV), op2 = (await b2.O.poolOpen(b2.env, { product: "salt", q: 2, target: 10 })).pool.id;
  const orig = b2.bk.book.append.bind(b2.bk.book);
  b2.bk.book.append = (eid, u, oid, ev, ...r) => { if (ev.kind === "pjoin") throw new Error("the second write failed"); return orig(eid, u, oid, ev, ...r); };
  const broke = await b2.join(U1, op2);
  b2.bk.book.append = orig;
  const n = (t) => b2.bk.db.prepare("SELECT COUNT(*) AS n FROM " + t).get().n;
  ok(broke.error && n("ord") === 0 && (await b2.O.allPools(b2.env))[0].joins.length === 0 && n("ev") === 1,
    "a join is atomic: the join failing after the order was written leaves no order and no event: " + JSON.stringify([broke.error, n("ord"), n("ev")]));
  const fine = await b2.join(U1, op2);
  ok(fine.order && n("ord") === 1, "and the same tap, tried again, lands");

  /* the customer's view: `pool` and nothing else new */
  const o = j2.order, view = O.customerView(o), bare = O.customerView(Object.assign({}, o, { pool: undefined }));
  ok(view.pool === pid && JSON.stringify(Object.keys(view).filter((k) => !(k in bare))) === '["pool"]',
    "customerView carries the order's pool and no other new field: " + JSON.stringify(Object.keys(view).filter((k) => !(k in bare))));
  const ev = O.poolView(Object.assign({}, p, { mine: "x" }));
  ok(!("joins" in ev) && !("closeLeft" in ev) && ev.unitsIn === 2 && ev.joined === "x", "and the pool's view carries no joins, no names and none of his marks");

  /* a pooled order is not amended, and a join is made only from the pool's own road */
  const rep = O.decideReplace(o, { product: "salt", qty: 2, mode: "collect", rid: rid("r1"), digest: "d1", forFriend: false }, [o], "2026-10-05T02:00:00Z", "d1");
  ok(rep.status === 409 && rep.code === "amendClosed", "a pooled order is left by Cancel, not replaced: " + JSON.stringify(rep.code));
  const plain = O.decidePlace(U1, { product: "salt", qty: 2, mode: "collect", total: 90, unit: 45, pool: pid }, [], "2026-10-05T02:00:00Z", "");
  ok(plain.error && /group order/.test(plain.error), "a plain Place that names a pool is refused: " + JSON.stringify(plain.error));
  const delivered = O.decidePoolJoin(U1, Object.assign({}, p, { state: "open", joins: [] }), { q: 2, total: 90, unit: 45 }, [], "2026-10-05T02:00:00Z", "");
  ok(delivered.place && delivered.place.order.mode === "collect" && delivered.place.order.place === "", "the order a join makes is always collected, with no place");

  /* the KV road keeps no pool */
  const kv2 = new KV(), env2 = { STMT: kv2 };
  const k1 = await O.poolOpen(env2, { product: "salt", q: 2, target: 10 }), k2 = await O.poolJoin(env2, U1, pid, { q: 2, total: 90, unit: 45 });
  ok(k1.status === 503 && k1.error === O.POOL_ON_KV && k2.status === 503 && (await O.poolsOf(env2, U1)).length === 0 && ![...kv2.m.keys()].some((k) => /^(pool|order)/.test(k)),
    "on the KV road a pool is refused and nothing is kept in a second place");
}
