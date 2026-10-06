/* test/pool-join.mjs: THE POOL, B2. The customer's two routes, on a session, through the real Worker; and a test account's join
 * in its fixture alone. Every assertion was proved red by its own mutation (see the fold's commit). */
import { rig, U1, U2, rid, sqlite } from "./pool.mjs";

export async function join({ ok, KV, skipOff }) {
  if (!(await sqlite())) { skipOff("node:sqlite is unavailable here, so the join routes were not driven"); return; }
  const stmtW = (await import("../stmt/worker.js")).default, T = await import("../stmt/testfix.js");
  const { O, env, bk, kv } = await rig(KV);
  env.STMT_DESK_KEY = "desk-key";
  const tok = await O.mintSession(env, U1);
  const call = async (path, body, h, e) => {
    const r = await stmtW.fetch(new Request("https://k7m3p2.example" + path, body === undefined ? { headers: h || { "X-Stmt-Session": tok } }
      : { method: "POST", headers: Object.assign({ "content-type": "application/json" }, h || { "X-Stmt-Session": tok }), body: JSON.stringify(body) }), e || env);
    const text = await r.text();
    let b = null; try { b = JSON.parse(text); } catch (e) { b = text; }
    return { status: r.status, b };
  };
  const nOrd = () => bk.db.prepare("SELECT COUNT(*) AS n FROM ord").get().n;
  const pid = (await O.poolOpen(env, { product: "salt", q: 2, target: 10 })).pool.id;
  const list = await call("/pools");
  ok(list.status === 200 && list.b.pools.length === 1 && list.b.pools[0].id === pid && list.b.pools[0].unitsIn === 0 && list.b.pools[0].joined === null
    && !("joins" in list.b.pools[0]) && (await call("/pools", undefined, {})).status === 401,
    "GET /pools reads the open pools on their session, bare: no joins, none of his marks, and no session no read: " + JSON.stringify(list.b));
  const body = { q: 2, total: 90, unit: 45, digest: "d1", rid: rid("a1"), forFriend: false };
  const stale = await call("/pools/" + pid + "/join", { ...body, digest: "old", rid: rid("a2") });
  ok(stale.status === 409 && stale.b.code === "pricesMoved" && stale.b.prices && stale.b.prices.digest === "d1" && nOrd() === 0,
    "a join on a list that moved answers 409 with the list as it stands, as Place does, and makes no order: " + JSON.stringify(stale.b));
  const j = await call("/pools/" + pid + "/join", body), again = await call("/pools/" + pid + "/join", body);
  ok(j.status === 200 && j.b.order.pool === pid && j.b.order.mode === "collect" && again.status === 200 && again.b.order.id === j.b.order.id
    && nOrd() === 1 && !("ledgerKey" in j.b.order),
    "a join under their sealed price lands one collected order, a retry under its id once, and the answer is the customer's view: " + JSON.stringify(j.b));
  const read = await call("/pools"), mine = await call("/orders");
  ok(read.b.pools[0].unitsIn === 2 && read.b.pools[0].joined === j.b.order.id && mine.b.orders.length === 1 && mine.b.orders[0].pool === pid,
    "the page's reads then carry the join on the pool and the pool on the order: " + JSON.stringify(read.b.pools));
  const twice = await call("/pools/" + pid + "/join", { ...body, rid: rid("a3") });
  ok(twice.status === 409 && twice.b.code === "poolTwice" && twice.b.error === "You are already in this group order.", "a second join is refused in its own words");
  await O.poolClose(env, pid, {});
  const tok2 = await O.mintSession(env, U2), shut = await call("/pools/" + pid + "/join", { ...body, rid: rid("b1") }, { "X-Stmt-Session": tok2 });
  const closedView = await call("/pools", undefined, { "X-Stmt-Session": tok2 }), mineClosed = await call("/pools");
  ok(shut.status === 409 && shut.b.code === "poolClosed" && shut.b.error === "This group order has closed." && closedView.b.pools.length === 0 && mineClosed.b.pools.length === 1 && mineClosed.b.pools[0].state === "closed",
    "a closed pool refuses a join and is shown to nobody but the ones who joined: " + JSON.stringify([shut.b, closedView.b]));
  const bad = await call("/pools/not-a-pool/join", body);
  ok(bad.status === 404, "a path that is no pool's is the site's 404: " + bad.status);

  /* a test account: its own fixture's pool, the join written there alone, and no real pool shown */
  const U0 = T.TEST_USER, fixSalt = "invented-wrap";
  await kv.put("u:" + U0, JSON.stringify({ test: true, wrap: { salt: fixSalt } }));
  const fpool = { id: "p20261001000000-ex1", kind: "pool", at: "2026-10-01T00:00:00.000Z", product: "salt", q: 2, target: 10, state: "open", joins: [], seedUnits: 4 };
  await kv.put(T.fixKey(U0), JSON.stringify({ v: T.FIX_VERSION, salt: fixSalt, at: "2026-10-01T00:00:00.000Z", env: { iv: "iv" }, orders: [], claims: [], pools: [fpool],
    prices: { digest: "fd1", products: [] } }));
  const t0 = await O.mintSession(env, U0), h0 = { "X-Stmt-Session": t0 };
  const fl = await call("/pools", undefined, h0);
  ok(fl.b.pools.length === 1 && fl.b.pools[0].id === fpool.id && fl.b.pools[0].unitsIn === 4, "a test account reads its fixture's pool and never a real one: " + JSON.stringify(fl.b));
  const fjBody = (r) => ({ q: 2, total: 90, unit: 45, digest: "fd1", rid: rid(r) });
  const fj = await call("/pools/" + fpool.id + "/join", fjBody("f1"), h0);
  const fl2 = await call("/pools", undefined, h0), fj2 = await call("/pools/" + fpool.id + "/join", fjBody("f2"), h0);
  const real = bk.db.prepare("SELECT COUNT(*) AS n FROM ord WHERE u = ?").get(U0).n;
  ok(fj.status === 200 && T.EXAMPLE_ID.test(fj.b.order.id) && fj.b.order.pool === fpool.id && fl2.b.pools[0].unitsIn === 6 && fl2.b.pools[0].joined === fj.b.order.id
    && fj2.b.code === "poolTwice" && real === 0,
    "its join lands in its fixture alone, an example order, units 4 and 2 are 6, a second refused, and no real order is made: " + JSON.stringify([fj.b, fl2.b, real]));
}
