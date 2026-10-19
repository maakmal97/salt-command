/* test/test-surface-roads.mjs: P5 of the Counter test surface (his answers of 18 Oct 2026, Asks 1 and 8). The roads under /all/test.
   1. every /all/test road answers 401 without the Access JWT, and 401 with a valid JWT for another email;
   2. an empty ACCESS_AUD closes them for him too;
   3. bare /test is a 302 to /all/test and serves nothing;
   4. a real customer's session, and a real username at sign-in, are refused under /all/test/c;
   5. push, passkey, remembered phone, hand-over and slip answer 404 there, on a test account's session;
   6. GET /orders under /all/test/c reads the fixture alone: a stray real order of the account is not drawn;
   7. Counter Admin's review under /all/test reads no Desk route and lists the example orders alone;
   8. a real order id, and a real username's claim or thread, are 404 under /all/test/maker;
   9. a reply on a test account's thread under /all/test makes no Desk call, so no wake; on /all it goes round the Desk;
  10. Reset under /all/test restores one account, or all, and refuses Start empty for anyone but 0000-0002. */
import { surface } from "./test-surface-harness.mjs";
import * as O from "../stmt/orders.js";
import { exampleAccount, exampleThread } from "../stmt/testfix.js";

export async function run({ ok }) {
  const s = await surface();
  try {
    const at = new Date(Date.now() - 3600e3).toISOString(), digest = "surface-list";
    const base = { product: "salt", qty: 2, total: 190, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest };
    const ex = (u, k) => ({ ...O.decidePlace(u, { ...base, rid: "surface-road-" + k + "-padded" }, [], at, digest).ev.order, id: "20261019010000-ex" + k });
    const thread = { u: "0000-0002", msgs: [{ at, by: "customer", text: "Hello there" }] };
    await s.putFixture("0000-0002", { makerOrders: [ex("0000-0002", "bb1")], orders: [ex("0000-0002", "bb1")], prices: { digest }, thread });
    /* a stray real order of the test account, from before every Place went to the fixture, and a real customer's order */
    const stray = O.decidePlace("0000-0002", { ...base, rid: "surface-stray-0001-pad" }, [], at, digest).ev.order;
    stray.id = "20261019010000-r9"; s.harness.book.append(null, "0000-0002", stray.id, { kind: "place", at, order: stray }, null);
    const real = O.decidePlace("abcd-efgh", { ...base, rid: "surface-real-0001-pad" }, [], at, digest).ev.order;
    real.id = "20261019010000-r8"; s.harness.book.append(null, "abcd-efgh", real.id, { kind: "place", at, order: real }, null);

    /* 1 and 2: the two locks */
    const roads = [["GET", "/all/test/c/orders"], ["POST", "/all/test/c/open"], ["GET", "/all/test/maker/review"], ["POST", "/all/test/reset"],
      ["POST", "/all/test/maker/orders/20261019010000-exbb1/move"], ["GET", "/all/test/c/account"]];
    const other = await s.token("someone@example.test");
    const st = async (auth, env) => Promise.all(roads.map(async ([method, path]) => (await s.counter.fetch(new Request("https://counter.fixture.test" + path, {
      method, headers: { ...(auth ? { "cf-access-jwt-assertion": auth } : {}), "content-type": "application/json" }, ...(method === "POST" ? { body: "{}" } : {}) }), env || s.env)).status));
    const none = await st(""), wrong = await st(other), closed = await st(s.jwt, { ...s.env, ACCESS_AUD: "" });
    ok(none.every((x) => x === 401) && wrong.every((x) => x === 401), "Every /all/test road answers 401 without the Access JWT and 401 for another email: " + JSON.stringify([none, wrong]));
    ok(closed.every((x) => x === 401), "An empty ACCESS_AUD closes every /all/test road, his JWT included: " + JSON.stringify(closed));

    /* 3. /test */
    const t = await s.counter.fetch(new Request("https://counter.fixture.test/test"), s.env), tb = await t.text();
    ok(t.status === 302 && t.headers.get("location") === "/all/test" && tb === "", "Bare /test is a 302 to /all/test and serves nothing: " + [t.status, t.headers.get("location"), tb.length].join(","));

    /* 4 and 5: whose session */
    const tok = await O.mintSession(s.env, "0000-0002"), realTok = await O.mintSession(s.env, "abcd-efgh");
    const c = async (path, sess, method = "GET", body) => { const r = await s.owner("/all/test/c" + path, body, s.jwt, method, sess ? { "X-Stmt-Session": sess } : {}); return { status: r.status, body: await r.json().catch(() => null) }; };
    const realOrders = await c("/orders", realTok), realOpen = await c("/open", null, "POST", { u: "abcd-efgh", password: "abcd-efgh-jkmn-pqrs" });
    const testOpen = await c("/open", null, "POST", { u: "0000-0002", password: "0000-0000-0000-0000", master: "x" });
    ok(realOrders.status === 403 && realOpen.status === 403 && testOpen.status === 403,
      "Under /all/test/c a real customer's session and a real username at sign-in are refused, and a master is never taken: " + [realOrders.status, realOpen.status, testOpen.status].join(","));
    const shut = await Promise.all(["/push/subscribe", "/passkey/new", "/remember", "/handover", "/slip/key", "/devices", "/devices/signout"].map(async (p) => (await c(p, tok, "POST", {})).status));
    ok(shut.every((x) => x === 404), "Push, passkey, remembered phone, hand-over, slip and devices answer 404 under /all/test/c: " + shut.join(","));

    /* 6. the fixture alone */
    const mine = await c("/orders", tok), plain = await s.counter.fetch(new Request("https://counter.fixture.test/orders", { headers: { "X-Stmt-Session": tok } }), s.env);
    const plainIds = ((await plain.json()).orders || []).map((o) => o.id), ids = ((mine.body || {}).orders || []).map((o) => o.id);
    ok(mine.status === 200 && ids.includes("20261019010000-exbb1") && !ids.includes(stray.id) && plainIds.includes(stray.id),
      "GET /orders under /all/test/c reads the fixture alone; the stray real order shows only on the customer's own road: " + JSON.stringify([mine.status, ids, plainIds]));

    /* 7. the review */
    const bridged = s.bridge.length;
    const rv = await s.owner("/all/test/maker/review", undefined, s.jwt, "GET"), rb = await rv.json();
    ok(rv.status === 200 && s.bridge.length === bridged && rb.orders.length === 1 && rb.orders[0].test === true && !rb.orders.some((o) => o.id === real.id || o.id === stray.id),
      "Counter Admin's review under /all/test reads no Desk route and lists the example orders alone: " + JSON.stringify([rv.status, s.bridge.slice(bridged), rb.orders.map((o) => o.id)]));

    /* 8. real ids and usernames */
    const rmove = await s.owner("/all/test/maker/orders/" + real.id + "/move", { status: "declined", rid: "surface-road-move-0001" });
    const raction = await s.owner("/all/test/maker/orders/" + real.id + "/cash", { amount: 1, rid: "surface-road-cash-0001" });
    const rclaim = await s.owner("/all/test/maker/claims/abcd-efgh/a20261019010000-c1/preview", {});
    const rthread = await s.owner("/all/test/maker/threads/abcd-efgh", { message: "Hi", rid: "surface-road-thr-0001" });
    const rinput = await s.owner("/all/test/maker/inputs/sale", {});
    ok([rmove, raction, rclaim, rthread, rinput].every((r) => r.status === 404) && s.harness.book.order("abcd-efgh", real.id).status === "placed",
      "A real order id, a real username's claim or thread and any other Admin road are 404 under /all/test/maker: " + [rmove, raction, rclaim, rthread, rinput].map((r) => r.status).join(","));

    /* 9. a thread reply: no Desk call under /all/test */
    const b9 = s.bridge.length;
    const say = await s.owner("/all/test/maker/threads/0000-0002", { message: "Thanks, noted", rid: "surface-road-thr-0002" });
    const sayB = await say.json(), after9 = s.bridge.slice(b9), held = await exampleThread(s.env, "0000-0002");
    ok(say.status === 200 && !after9.some((p) => /threads/.test(p)) && !("push" in sayB) && held.msgs.some((x) => x.by === "desk" && x.text === "Thanks, noted"),
      "A reply on a test account's thread under /all/test is written in-process, with no Desk call and so no wake: " + JSON.stringify([say.status, sayB.error, after9]));
    const b9b = s.bridge.length;
    await s.owner("/all/maker/threads/0000-0002", { message: "And on the other road", rid: "surface-road-thr-0003" });
    ok(s.bridge.slice(b9b).includes("/_internal/maker/threads/0000-0002"), "On /all the same reply goes round the Desk, as before: " + JSON.stringify(s.bridge.slice(b9b)));

    /* 10. Reset */
    await s.owner("/all/test/maker/orders/20261019010000-exbb1/move", { status: "declined", rid: "surface-road-decl-0001" });
    const moved = (await exampleAccount(s.env, "0000-0002")).orders[0].status;
    const one = await s.owner("/all/test/reset", { u: "0000-0002" }), back = (await exampleAccount(s.env, "0000-0002")).orders[0].status;
    const all = await s.owner("/all/test/reset", { all: true }), e0 = await s.owner("/all/test/reset", { u: "0000-0000", empty: true });
    const real10 = await s.owner("/all/test/reset", { u: "abcd-efgh" });
    ok(moved === "declined" && one.status === 200 && back === "placed" && all.status === 200 && e0.status === 400 && real10.status === 400,
      "Reset under /all/test restores one account or all, and refuses Start empty for 0000-0000 and any real username: " + JSON.stringify([moved, one.status, back, all.status, e0.status, real10.status]));
  } finally { s.close(); }
}
