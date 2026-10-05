/* test/pool-maker.mjs: THE POOL, B3. His routes under /all/maker: read, open, and Close, which closes in the order book first and then
 * previews and accepts each joined order through the Desk. Every assertion was proved red by its own mutation. */
import { rig, U1, U2, rid, sqlite } from "./pool.mjs";

export async function maker({ ok, KV, skipOff }) {
  if (!(await sqlite())) { skipOff("node:sqlite is unavailable here, so the maker's pool routes were not driven"); return; }
  const { handleMaker } = await import("../stmt/maker.js");
  const { O, env, bk } = await rig(KV);
  env.COUNTER_MAKER_KEY = "pool-maker-test-capability-0000001";
  const owner = { email: "maakmal97@icloud.com" };
  /* the Desk, as a stub that records what it is asked: a preview gives a hash, an accept answers as the Desk does */
  const calls = [], hashOf = (id) => id.replace(/[^0-9]/g, "").padEnd(64, "c").slice(0, 64);   /* a preview's digest is its order's own */
  let differs = new Set(), down = new Set();
  const ownerOf = {};   /* order id to its customer, so an accept can move the order as the Desk does */
  env.DESK_MAKER = { fetch: async (request) => {
    const path = new URL(request.url).pathname, id = (/orders\/([^/]+)\//.exec(path) || [])[1], body = request.method === "POST" ? await request.json() : null;
    calls.push({ path, body });
    if (down.has(id)) return new Response(JSON.stringify({ ok: false, error: "the Desk is not answering" }), { status: 503 });
    if (/\/preview$/.test(path)) return new Response(JSON.stringify({ ok: true, hash: hashOf(id) }), { status: 200 });
    if (differs.has(id)) return new Response(JSON.stringify({ ok: false, differs: true, error: "the row has changed since the card drew it: look at it again before you accept" }), { status: 409 });
    await O.deskMove(env, ownerOf[id], id, { status: "acknowledged", mode: "collect" });
    return new Response(JSON.stringify({ ok: true, approved: true }), { status: 200 });
  } };
  const call = async (path, body, identity = owner, method) => {
    const request = new Request("https://counter.test" + path, body === undefined && !method ? { method: "GET" }
      : { method: method || "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    const r = await handleMaker(request, env, path, identity);
    return { status: r.status, b: await r.json() };
  };
  for (const u of [U1, U2, "wxyz-2345"]) await env.STMT.put("u:" + u, JSON.stringify({ prices: { digest: "d1" } }));

  /* who may, and what is a field */
  const denied = await call("/all/maker/pools", { product: "salt", q: 2, target: 6 }, { email: "someone@example.test" }), none = await call("/all/maker/pools", { product: "salt", q: 2, target: 6 }, null);
  const field = await call("/all/maker/pools", { product: "salt", q: 2, target: 6, price: 1 }), small = await call("/all/maker/pools", { product: "salt", q: 2, target: 1 });
  ok(denied.status === 403 && none.status === 403 && field.status === 400 && small.status === 400
    && bk.db.prepare("SELECT COUNT(*) AS n FROM pool").get().n === 0,
    "only the verified owner opens a pool, a field outside the four is refused, and nothing is kept for a refusal: " + JSON.stringify([denied.status, none.status, field.status, small.status]));
  const closeDenied = await call("/all/maker/pools/p20261001000000-aaaa/close", {}, { email: "someone@example.test" });
  ok(closeDenied.status === 403 && calls.length === 0, "and only the verified owner closes one, the Desk never asked");
  const opened = await call("/all/maker/pools", { product: "salt", q: 2, target: 6 }), pid = opened.b.pool && opened.b.pool.id;
  const read = await call("/all/maker/pools");
  ok(opened.status === 200 && O.isPoolId(pid) && read.status === 200 && read.b.pools.length === 1 && read.b.pools[0].id === pid && read.b.pools[0].joins.length === 0,
    "he opens one and reads it back with its joins: " + JSON.stringify(read.b));

  /* three join, short of the target of 6 by nothing: 2+2+2 is the target; then one fewer elsewhere for the under-target close */
  const ids = [];
  for (const u of [U1, U2, "wxyz-2345"]) { const id = (await O.poolJoin(env, u, pid, { q: 2, total: 90, unit: 45, digest: "d1", rid: rid(u[0] + "j") })).order.id; ids.push(id); ownerOf[id] = u; }
  const bad = await call("/all/maker/pools/" + pid + "/close", { force: true });
  ok(bad.status === 400 && calls.length === 0 && (await O.allPools(env))[0].state === "open", "Close takes an empty object and nothing else: " + JSON.stringify(bad.b));

  /* one of the three differs at its accept */
  differs = new Set([ids[1]]);
  const closed = await call("/all/maker/pools/" + pid + "/close", {});
  const paths = calls.map((c) => c.path.replace("/_internal/maker/orders/", ""));
  const pairs = ids.every((id) => paths.includes(id + "/preview") && paths.includes(id + "/accept")) && paths.length === 6;
  const accepts = calls.filter((c) => /accept$/.test(c.path));
  ok(closed.status === 200 && closed.b.pool.state === "closed" && pairs && accepts.every((c) => c.body.hash === hashOf((/orders\/([^/]+)\//.exec(c.path) || [])[1]) && Object.keys(c.body).join() === "hash")
    && paths.indexOf(ids[0] + "/preview") < paths.indexOf(ids[0] + "/accept"),
    "Close closes it and previews then accepts each joined order, the accept carrying the preview's own digest and nothing else: " + JSON.stringify(paths));
  ok(closed.b.accepted.length === 2 && !closed.b.accepted.includes(ids[1]) && closed.b.left.length === 1 && closed.b.left[0].id === ids[1]
    && /changed/.test(closed.b.left[0].why) && (closed.b.pool.closeLeft || []).length === 1 && closed.b.pool.closeLeft[0].id === ids[1],
    "the one the Desk says differs is written on the pool as closeLeft with its reason and the other two are accepted: " + JSON.stringify([closed.b.accepted, closed.b.left]));
  ok(bk.db.prepare("SELECT kind FROM ev ORDER BY seq").all().map((x) => x.kind).filter((k) => k === "pclose").length === 2,
    "and the close and the note of what was left are the pool's own two events");

  /* a Close again retries only the one left, and clears it once it lands */
  calls.length = 0; differs = new Set();
  const again = await call("/all/maker/pools/" + pid + "/close", {});
  ok(again.status === 200 && calls.length === 2 && calls.every((c) => c.path.includes(ids[1])) && again.b.accepted.join() === ids[1] && again.b.left.length === 0 && !("closeLeft" in again.b.pool),
    "Close again retries only the order left, and a landing clears it from the pool: " + JSON.stringify([calls.map((c) => c.path), again.b]));
  calls.length = 0;
  const third = await call("/all/maker/pools/" + pid + "/close", {});
  ok(third.status === 200 && calls.length === 0 && third.b.accepted.length === 0, "and a Close with nothing left asks the Desk for nothing");

  /* a Desk that is down names the order and carries on; under the target it still closes and accepts */
  const p2 = (await call("/all/maker/pools", { product: "salt", q: 2, target: 40 })).b.pool.id, j2 = [];
  for (const u of [U1, U2]) { const id = (await O.poolJoin(env, u, p2, { q: 2, total: 90, unit: 45, digest: "d1", rid: rid(u[0] + "k") })).order.id; j2.push(id); ownerOf[id] = u; }
  calls.length = 0; down = new Set([j2[0]]);
  const short = await call("/all/maker/pools/" + p2 + "/close", {});
  ok(short.status === 200 && short.b.pool.state === "closed" && (await O.allPools(env)).find((p) => p.id === p2).unitsIn === 4 && short.b.accepted.join() === j2[1]
    && short.b.left.length === 1 && short.b.left[0].id === j2[0] && /not answering/.test(short.b.left[0].why),
    "closed at 4 of 40 units it still closes and accepts, a Desk that is down for one order names it and carries on: " + JSON.stringify([short.b.accepted, short.b.left]));
  const noPool = await call("/all/maker/pools/p20260101000000-aaaa/close", {});
  ok(noPool.status === 404 && noPool.b.code === "poolNone", "and a pool that is not there is refused in its own words");

  /* a crash between the book's close and the note of what was left: the pool is closed with no closeLeft, and Close again takes every
     joined order still at placed, not none */
  const p3 = (await call("/all/maker/pools", { product: "salt", q: 2, target: 40 })).b.pool.id, j3 = [];
  for (const u of [U1, U2]) { const id = (await O.poolJoin(env, u, p3, { q: 2, total: 90, unit: 45, digest: "d1", rid: rid(u[0] + "m") })).order.id; j3.push(id); ownerOf[id] = u; }
  await O.poolClose(env, p3, {});
  calls.length = 0; down = new Set(); differs = new Set();
  const crashed = await call("/all/maker/pools/" + p3 + "/close", {});
  ok(crashed.status === 200 && crashed.b.accepted.length === 2 && j3.every((id) => crashed.b.accepted.includes(id)) && calls.filter((c) => /accept$/.test(c.path)).length === 2,
    "a Close after a crash between the close and the note, with nothing written as left, still accepts every joined order at placed: " + JSON.stringify([crashed.b.accepted, calls.length]));
}
