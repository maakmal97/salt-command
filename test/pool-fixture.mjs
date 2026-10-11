/* test/pool-fixture.mjs: THE POOL, B6. The test accounts show a group order open and joined and one closed with its order
 * acknowledged, sealed for the account alone and read back through the Worker. Every assertion was proved red by its own mutation. */
import { rig, U1, sqlite } from "./pool.mjs";

export async function fixture({ ok, KV, skipOff }) {
  const T = await import("../tools/testfix.mjs"), TF = await import("../stmt/testfix.js"), O = await import("../stmt/orders.js"), C = await import("../tools/stmt-crypto.mjs");
  const now = new Date("2026-10-05T04:00:00Z"), all = T.buildAll(now), f = all[TF.TEST_USER];
  const names = ["a group order open, joined (Pool)", "a group order closed, its order confirmed (Pool)"];
  const lines = T.FEATURES.filter(([n]) => names.includes(n));
  ok(lines.length === 2 && lines.every(([, t]) => Object.values(all).some((x) => t(x))) && !T.missing(all).some((n) => names.includes(n)),
    "the fixture holds a case of each group order line the suite asks of it: " + JSON.stringify(T.missing(all)));
  const [open, shut] = [f.pools.find((p) => p.state === "open"), f.pools.find((p) => p.state === "closed")];
  const order = (p) => f.orders.find((o) => o.id === p.joins[0].oid);
  ok(f.pools.length === 2 && open && shut && f.pools.every((p) => O.isPoolId(p.id) && p.joins.length === 1 && p.joins[0].u === TF.TEST_USER && order(p).pool === p.id && order(p).mode === "collect")
    && order(open).status === "placed" && open.closesOn > "2026-10-05" && order(shut).status === "acknowledged" && shut.closedAt && !!shut.seedUnits && !!open.seedUnits && open.seedUnits + open.q < open.target,
    "one pool is open with the account's placed order in it and a closing day ahead, one closed with its order confirmed, each order collected and carrying its pool: " + JSON.stringify(f.pools.map((p) => [p.state, order(p).status])));
  const view = O.customerView(order(open));
  ok(view.pool === open.id && Object.values(all).every((x) => x.pools.length === 2), "the order's view carries the pool, and the locked account has the same two");
  /* the lines are the suite's: a fixture with no pools fails them */
  const bare = { ...f, pools: [] };
  ok(lines.every(([, t]) => !t(bare)) && lines.every(([, t]) => !t({ ...f, pools: undefined })), "and each line is red without its pool");

  /* sealed for the account alone, then read back through the real Worker: the units in are the fixture's others and the live joined orders */
  if (!(await sqlite())) { skipOff("node:sqlite is unavailable here, so the sealed pools were not read back"); return; }
  const stmtW = (await import("../stmt/worker.js")).default;
  const { env, kv } = await rig(KV);
  env.STMT_DESK_KEY = "desk-key";
  const pass = TF.TEST_PASS, ck = await C.contentKey("test-secret", TF.TEST_USER), rec = { test: true, wrap: await C.wrapKey(pass, ck) };
  const sealed = await T.sealFixture(f, rec, pass);
  ok(JSON.stringify(sealed.pools) === JSON.stringify(f.pools), "the sealed fixture carries its pools as the account's own record");
  await kv.put("u:" + TF.TEST_USER, JSON.stringify(rec)); await kv.put(TF.fixKey(TF.TEST_USER), JSON.stringify(sealed));
  const tok = await O.mintSession(env, TF.TEST_USER);
  const r = await stmtW.fetch(new Request("https://k7m3p2.example/pools", { headers: { "X-Stmt-Session": tok } }), env), b = await r.json();
  const mine = b.pools.find((p) => p.id === open.id), done = b.pools.find((p) => p.id === shut.id);
  ok(r.status === 200 && b.pools.length === 2 && mine.joined === open.joins[0].oid && mine.unitsIn === open.seedUnits + open.q && mine.state === "open" && mine.closesOn === open.closesOn
    && done.state === "closed" && done.joined === shut.joins[0].oid && done.unitsIn === shut.seedUnits + shut.q && !("joins" in mine) && !("seedUnits" in mine),
    "the Worker reads them back for the account: 5 others and 2.5 of theirs is 7.5 units in the open one, the closed one carries its join, and no fixture mark rides: " + JSON.stringify(b.pools));
  void U1;
}
