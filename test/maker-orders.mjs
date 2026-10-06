/* test/maker-orders.mjs: Counter Admin's order moves (Ready, Decline, Cancel, a reply, No reply needed, Not found), through
   the verified owner, the private Desk capability and the order book, on real orders and on an acceptance account's. */
import { webcrypto } from "node:crypto";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { siteWords } from "../src/orders.js";
import { orderBook } from "./orderbook-harness.mjs";
import * as O from "../stmt/orders.js";
import { TEST_USER, FIX_VERSION, fixKey, exampleAccount } from "../stmt/testfix.js";

class Store {
  values = new Map();
  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return value === null || type !== "json" ? value : JSON.parse(value);
  }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

export async function run({ ok }) {
  const store = new Store(), queue = new Store(), team = "maker-orders-fixture", audience = "maker-orders-audience", kid = "maker-orders-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "orders-local-master",
    STMT_DESK_KEY: "orders-desk-test-capability-0001", COUNTER_MAKER_KEY: "orders-maker-test-capability-00001", ORDER_STORE: "object" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  /* a Desk mirror of just the draft rows a claim answer touches; any other statement is a fault in the test */
  const drafts = new Map(), sqls = [];
  const d1 = { prepare(sql) {
    let args = [];
    const q = { bind(...a) { args = a; return q; },
      async first() {
        sqls.push(sql);
        if (/SELECT entry FROM draft WHERE id/.test(sql)) return drafts.has(args[0]) ? { entry: drafts.get(args[0]).entry } : null;
        if (/SELECT status FROM draft WHERE id/.test(sql)) return drafts.has(args[0]) ? { status: drafts.get(args[0]).status } : null;
        throw new Error("unexpected D1 read " + sql);
      },
      async run() {
        sqls.push(sql);
        if (/INSERT OR IGNORE INTO draft/.test(sql)) { if (!drafts.has(args[0])) drafts.set(args[0], { status: "rejected", entry: args[1] }); return {}; }
        if (/UPDATE draft SET status='rejected'/.test(sql)) return {};
        throw new Error("unexpected D1 write " + sql);
      },
      async all() { sqls.push(sql); return { results: [] }; } };
    return q;
  } };
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: d1, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  const bridge = [];
  env.DESK_MAKER = { fetch: (request) => {
    bridge.push(new URL(request.url).pathname);
    return desk.fetch(request, deskEnv, {});
  } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected order-moves fixture request: " + url);
  };
  try {
    const token = async (email) => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
      const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email,
        exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
      return header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
        signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
    };
    const jwt = await token("maakmal97@icloud.com");
    const owner = (path, body, auth = jwt, method = "POST") => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method, headers: { "cf-access-jwt-assertion": auth, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }), env);
    const u = "abcd-efgh", at = new Date().toISOString(), digest = "orders-list";
    await queue.put("stmt-users", JSON.stringify({ [u]: "CX1-AB" }));
    const base = { product: "salt", qty: 2, total: 190, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest, rid: "orders-fixture-base-01" };
    let serial = 10;
    /* a real order in the book, brought to the state asked; an acknowledged one has its row's key, as the Desk marks it */
    const make = (state = "placed", patch = {}) => {
      const order = O.decidePlace(u, { ...base, rid: "orders-fixture-" + (++serial) + "-pad-pad" }, [], at, digest).ev.order;
      order.id = "20261003070" + String(serial).padStart(3, "0") + "-r" + serial;
      harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
      if (state !== "placed") harness.book.run("desk", { u, id: order.id, body: { status: "acknowledged", mode: "collect" } });
      if (state === "ready") harness.book.run("desk", { u, id: order.id, body: { status: "ready" } });
      for (const [key, value] of Object.entries(patch)) {
        const now = harness.book.order(u, order.id);
        if (key === "cash") harness.book.run("desk", { u, id: order.id, body: { cash: { amount: value } } });
        else if (key === "claim") harness.book.append(null, u, order.id, { kind: "claim", at: new Date().toISOString(), amount: value, method: "transfer", account: "maybiz" }, now);
        else if (key === "customerSays") harness.book.append(null, u, order.id, { kind: "say", at: new Date().toISOString(), by: "customer", text: value }, now);
        else if (key === "handed") harness.book.run("desk", { u, id: order.id, body: { handover: { units: value } } });
      }
      return order.id;
    };
    const rid = (n) => "orders-move-request-" + n + "-padded";
    const move = (id, body, auth) => owner("/all/maker/orders/" + id + "/move", body, auth);
    const book = (id) => harness.book.order(u, id);
    const events = (id) => harness.db.prepare("SELECT COUNT(*) AS n FROM ev WHERE oid=?").get(id).n;

    /* identity and the private capability */
    const idA = make("placed");
    const denied = await move(idA, { status: "declined", rid: rid(1) }, "");
    const other = await move(idA, { status: "declined", rid: rid(2) }, await token("other@example.test"));
    const privateDenied = await desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + idA + "/move", {
      method: "POST", body: JSON.stringify({ status: "declined", rid: rid(3) }) }), deskEnv, {});
    const privateWrong = await desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + idA + "/move", {
      method: "POST", headers: { "X-Counter-Maker-Key": "wrong-capability-wrong-capability-0001" }, body: JSON.stringify({ status: "declined", rid: rid(3) }) }), deskEnv, {});
    ok(denied.status === 401 && other.status === 401 && privateDenied.status === 404 && privateWrong.status === 404
      && book(idA).status === "placed" && bridge.length === 0,
      "Order moves refuse a missing or non-owner identity and a missing or wrong private capability, and move nothing.");

    /* Ready */
    const readyEarly = await move(idA, { status: "ready", rid: rid(4) });
    ok(readyEarly.status === 409 && book(idA).status === "placed", "Ready is refused on an order not yet acknowledged.");
    const idB = make("acknowledged");
    const readyBody = { status: "ready", rid: rid(5) };
    const first = await move(idB, readyBody), second = await move(idB, readyBody);
    const afterRetry = book(idB);
    ok(first.status === 200 && book(idB).status === "ready" && second.status === 200 && (await second.json()).again === true
      && afterRetry.history.filter((h) => h.status === "ready").length === 1,
      "Ready moves an acknowledged order once, and a retry under the same request id is answered without a second move.");
    const changed = await move(idB, { status: "cancelled", rid: readyBody.rid });
    ok(changed.status === 409 && book(idB).status === "ready", "The same request id with other content is refused and changes nothing.");
    const restart = harness.restart();
    const afterRestart = await move(idB, readyBody);
    ok(afterRestart.status === 200 && (await afterRestart.json()).again === true && restart.order(u, idB).history.filter((h) => h.status === "ready").length === 1,
      "A retry after the order book restarts still lands once: the request id is kept with the order.");

    /* Decline, with and without a reason */
    const reason = "Out of stock this week";
    const declined = await move(idA, { status: "declined", note: reason, rid: rid(6) });
    const gone = book(idA);
    ok(declined.status === 200 && gone.status === "declined" && gone.history.at(-1).note === reason && gone.history.at(-1).by === "desk",
      "Decline from Maker writes the reason onto the order's history as the desk's.");
    const declineAgain = await move(idA, { status: "declined", rid: rid(7) });
    ok(declineAgain.status === 409 && book(idA).status === "declined", "Decline is refused on an order already declined.");
    const idC = make("acknowledged");

    /* Cancel: paid or not, never once goods are out or a claim waits */
    const why = "Customer changed their plan";
    const cancelled = await move(idC, { status: "cancelled", note: why, rid: rid(8) });
    const done = book(idC);
    ok(cancelled.status === 200 && done.status === "cancelled" && done.history.at(-1).note === why && done.history.at(-1).by === "desk",
      "Cancel from Maker moves an acknowledged unpaid order and writes its reason onto the order.");
    const cancelAgain = await move(idC, { status: "cancelled", note: why, rid: rid(8) });
    const cancelOther = await move(make("placed"), { status: "cancelled", rid: rid(9) });
    ok(cancelAgain.status === 200 && (await cancelAgain.json()).again === true && done.history.filter((h) => h.status === "cancelled").length === 1,
      "A Cancel retried under its request id lands once.");
    ok(cancelOther.status === 200, "Cancel also takes a placed order that nothing has been agreed on.");
    const idPaid = make("acknowledged", { cash: 25 });
    const eventsPaid = events(idPaid);
    const cancelPaid = await move(idPaid, { status: "cancelled", rid: rid(10) });
    ok(cancelPaid.status === 200 && book(idPaid).status === "cancelled" && book(idPaid).paid === 25,
      "Cancel takes an order with money paid on it and leaves the paid figure for the fold to refund.");
    const cancelPaidAgain = await move(idPaid, { status: "cancelled", rid: rid(10) });
    ok(cancelPaidAgain.status === 200 && (await cancelPaidAgain.json()).again === true && book(idPaid).history.filter((h) => h.status === "cancelled").length === 1,
      "A paid Cancel retried under its request id lands once.");
    const idClaim = make("acknowledged", { claim: 30 });
    const cancelClaim = await move(idClaim, { status: "cancelled", rid: rid(11) });
    ok(cancelClaim.status === 409 && book(idClaim).status === "acknowledged", "Cancel is refused while a claim of theirs waits on the order.");
    const idOut = make("ready", { handed: 1 });
    const cancelOut = await move(idOut, { status: "cancelled", rid: rid(12) });
    ok(cancelOut.status === 409 && book(idOut).status === "ready", "Cancel is refused once goods have gone out.");
    /* the order book's own check, which holds even when the Desk's read of the order was a moment old */
    const racedId = make("acknowledged", { cash: 5 });
    const raced = harness.book.run("desk", { u, id: racedId, body: { status: "cancelled", maker: true } });
    ok(raced.ok === true, "The order book takes a flagged Cancel on a paid order, as the Desk's own unflagged Cancel does.");
    const cancelDone = await move(idA, { status: "cancelled", rid: rid(13) });
    ok(cancelDone.status === 409 && book(idA).status === "declined", "Cancel is refused on an order already declined.");

    /* a reply and No reply needed */
    const idD = make("acknowledged", { customerSays: "Can I collect after five?" });
    const reply = { message: "Yes, until seven.", rid: rid(14) };
    const answered = await move(idD, reply), repeated = await move(idD, reply);
    ok(answered.status === 200 && repeated.status === 200 && book(idD).msgs.filter((m) => m.by === "desk" && m.text === reply.message).length === 1,
      "A reply lands on the order's thread once, however often the same request id is sent.");
    const bad = "Your Platinum price is lower";
    const blocked = await move(idD, { message: bad, rid: rid(15) });
    ok(!!siteWords(bad) && blocked.status === 400 && !book(idD).msgs.some((m) => m.text === bad),
      "A reply that names a level is refused by siteWords before it reaches the order.");
    const blockedNote = await move(make("placed"), { status: "declined", note: "Ask CX1-AB about it", rid: rid(16) });
    ok(blockedNote.status === 400, "A reason that carries a roster code is refused by siteWords.");
    const idQ = make("acknowledged", { customerSays: "Thanks" });
    const quiet = await move(idQ, { noReply: true, rid: rid(17) });
    const quieted = book(idQ);
    ok(quiet.status === 200 && quieted.quiet === quieted.msgs.filter((m) => m.by === "customer").at(-1).at,
      "No reply needed marks the customer's last line answered without a word to them.");
    const quietRetry = await move(idQ, { noReply: true, rid: rid(17) });
    ok(quietRetry.status === 200 && (await quietRetry.json()).again === true, "No reply needed retried under its request id is answered from the order book.");

    /* shape refusals */
    const shapes = [[{ status: "ready" }, "no request id"], [{ status: "ready", rid: "short" }, "a short request id"],
      [{ rid: rid(20) }, "no move"], [{ status: "ready", message: "x", rid: rid(21) }, "two moves"],
      [{ status: "done", rid: rid(22) }, "an unsupported status"], [{ status: "ready", note: "x", rid: rid(23) }, "a reason on Ready"],
      [{ message: " ", rid: rid(24) }, "an empty reply"], [{ message: "x".repeat(201), rid: rid(25) }, "a long reply"],
      [{ noReply: false, rid: rid(26) }, "No reply needed false"], [{ status: "ready", rid: rid(27), total: 1 }, "an extra field"],
      [{ status: "declined", note: "x".repeat(141), rid: rid(28) }, "a long reason"]];
    const refused = await Promise.all(shapes.map(([body]) => move(idB, body)));
    ok(refused.every((r) => r.status === 400) && book(idB).status === "ready",
      "Every malformed move is refused with 400 before any order changes: " + shapes.map(([, name], i) => name + "=" + refused[i].status).join(", "));
    const deskDirect = (id, body) => desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + id + "/move", {
      method: "POST", headers: { "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" }, body: JSON.stringify(body) }), deskEnv, {});
    const deskRefused = await Promise.all(shapes.map(([body]) => deskDirect(idB, body)));
    ok(deskRefused.every((r) => r.status === 400) && book(idB).status === "ready",
      "The Desk's own route refuses every malformed move too, whatever the Counter let through: " + shapes.map(([, name], i) => name + "=" + deskRefused[i].status).join(", "));
    /* the order book's own once-only rule, under the Counter's pre-read of it */
    const idR = make("acknowledged"), keep = { status: "ready", rid: rid(60) };
    const r1 = harness.book.run("desk", { u, id: idR, body: keep });
    let r2; try { r2 = harness.book.run("desk", { u, id: idR, body: keep }); } catch (error) { r2 = { ok: false, error: error.message }; }
    let r3; try { r3 = harness.book.run("desk", { u, id: idR, body: { status: "cancelled", rid: keep.rid } }); } catch (error) { r3 = { ok: false, error: error.message }; }
    ok(r1.ok && !r1.again && r2.ok && r2.again === true && r3.ok === false && r3.status === 409
      && book(idR).history.filter((h) => h.status === "ready").length === 1,
      "The order book answers a repeated request id once and refuses the same id with other content.");
    const idGone = await move("20261003070999-nope", { status: "ready", rid: rid(29) });
    ok(idGone.status === 404, "A move on an order the Counter does not hold is a 404.");

    /* Not found on a claim */
    const idN = make("acknowledged", { claim: 30 });
    const claimAt = book(idN).payments.find((p) => p.claim === "waiting").at;
    const nf = { claim: claimAt, amount: 30, rid: rid(30) };
    const noMatch = await owner("/all/maker/orders/" + idN + "/notfound", { ...nf, amount: 29, rid: rid(31) });
    ok(noMatch.status === 409 && book(idN).payments[0].claim === "waiting", "Not found names the claim's own amount, or is refused and the claim keeps waiting.");
    const nfOne = await owner("/all/maker/orders/" + idN + "/notfound", nf), nfTwo = await owner("/all/maker/orders/" + idN + "/notfound", nf);
    const after = book(idN);
    ok(nfOne.status === 200 && nfTwo.status === 200 && (await nfTwo.json()).again === true && after.payments[0].claim === "notfound"
      && after.claimed === 0 && after.paid === 0 && after.history.filter((h) => h.note === "not found 30.00").length === 1,
      "Not found answers a waiting claim once; the retry is answered from the order book and nothing is counted twice.");
    const nfAfter = await owner("/all/maker/orders/" + idN + "/notfound", { ...nf, rid: rid(32) });
    const nfShape = await owner("/all/maker/orders/" + idN + "/notfound", { claim: claimAt, rid: rid(33) });
    const nfExtra = await owner("/all/maker/orders/" + idN + "/notfound", { ...nf, status: "ready", rid: rid(34) });
    ok(nfAfter.status === 409 && nfShape.status === 400 && nfExtra.status === 400, "Not found on an answered claim is 409; a missing amount or an extra field is 400.");

    /* Cancel after the claim is answered, since nothing is waiting or paid any more */
    const cancelAfterNf = await move(idN, { status: "cancelled", rid: rid(35) });
    ok(cancelAfterNf.status === 200 && book(idN).status === "cancelled", "Cancel is open again once the only claim has been answered Not found.");

    /* the Desk phone's own move route never carries `maker`: a paid order is cancelled there, as before */
    const idPhone = make("acknowledged", { cash: 15 });
    const phone = await desk.fetch(new Request("https://desk.fixture.test/orders/" + u + "/" + idPhone, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "cancelled", maker: true }) }), deskEnv, {});
    ok(phone.status === 200 && book(idPhone).status === "cancelled",
      "The Desk phone's move route strips `maker`, so its Cancel on a paid order still goes through.");

    /* the helper routes */
    const words = (body, key = env.COUNTER_MAKER_KEY, path = "/_internal/maker/words") => desk.fetch(new Request("https://desk.fixture.test" + path, {
      method: "POST", headers: { "X-Counter-Maker-Key": key, "content-type": "application/json" }, body: JSON.stringify(body) }), deskEnv, {});
    const wOk = await words({ texts: ["Ready at five"] }), wBad = await words({ texts: [bad] }), wExtra = await words({ texts: ["x"], more: 1 });
    const wKey = await words({ texts: ["x"] }, "wrong-capability-wrong-capability-0001");
    const again = await words({ ids: [idA] }, env.COUNTER_MAKER_KEY, "/_internal/maker/order-again"), againBad = await words({ ids: ["not-an-id"] }, env.COUNTER_MAKER_KEY, "/_internal/maker/order-again");
    ok(wOk.status === 200 && wBad.status === 400 && wExtra.status === 400 && wKey.status === 404
      && again.status === 200 && (await again.json()).again && againBad.status === 400,
      "The words and order-again helper routes need the capability, take only their one list and check each text through siteWords.");

    /* the review answer carries the acceptance orders, marked */
    const exId = "20261003070000-exaa1", exCancel = "20261003070000-exaa2", exPaid = "20261003070000-exaa3", exClaim = "20261003070000-exaa4";
    const exOrder = (id, patch = {}) => ({ ...O.decidePlace(TEST_USER, { ...base, rid: "orders-fixture-" + id.slice(-4) + "-pad-pad" }, [], at, digest).ev.order,
      id, status: "acknowledged", history: [{ at, status: "placed", by: "customer" }, { at, status: "acknowledged", by: "desk" }], ...patch });
    const claim = { at: "2026-10-03T07:05:00.000Z", amount: 30, method: "transfer", account: "maybiz", claim: "waiting" };
    const initial = { v: FIX_VERSION, salt: "orders-wrap", at: "2026-10-03T07:00:00.000Z", env: { iv: "orders-iv" }, claims: [],
      orders: [], makerBook: { sales: [] }, makerOrders: [exOrder(exId), exOrder(exCancel), exOrder(exPaid, { paid: 20 }),
        exOrder(exClaim, { payments: [claim], claimed: 30 }), exOrder("20261003070000-exaa5", { status: "placed", history: [{ at, status: "placed", by: "customer" }],
          msgs: [{ at, by: "customer", text: "Hello" }] })] };
    await store.put("u:" + TEST_USER, JSON.stringify({ test: true, wrap: { salt: initial.salt } }));
    await store.put(fixKey(TEST_USER), JSON.stringify(initial));
    const review = await (await owner("/all/maker/review", undefined, jwt, "GET")).json();
    ok(review.ok && review.orders.some((o) => o.id === exId && o.test === true) && !review.orders.some((o) => o.id === idA && o.test),
      "The review lists an acceptance account's orders marked as examples, and no real order is marked.");

    /* an acceptance order moves in its fixture alone */
    const realEvents = harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n, realOrders = harness.db.prepare("SELECT COUNT(*) AS n FROM ord").get().n;
    const sqlBefore = sqls.length;
    const exReadyBody = { status: "ready", rid: rid(40) };
    const exReady = await move(exId, exReadyBody), exRetry = await move(exId, exReadyBody);
    const exChanged = await move(exId, { status: "cancelled", rid: exReadyBody.rid });
    const exState = (await exampleAccount(env, TEST_USER)).orders;
    ok(exReady.status === 200 && (await exReady.json()).test === true && exRetry.status === 200 && exChanged.status === 409
      && exState.find((o) => o.id === exId).status === "ready" && exState.find((o) => o.id === exId).history.filter((h) => h.status === "ready").length === 1,
      "An acceptance order's Ready lands once in its fixture; a retry is answered, other content under its id refused: "
      + JSON.stringify([exReady.status, exRetry.status, exChanged.status, exState.find((o) => o.id === exId)]));
    const exCancelled = await move(exCancel, { status: "cancelled", note: "Example reason", rid: rid(41) });
    const exPaidRefused = await move(exPaid, { status: "cancelled", rid: rid(42) });
    const exClaimRefused = await move(exClaim, { status: "cancelled", rid: rid(43) });
    const exReadyEarly = await move("20261003070000-exaa5", { status: "ready", rid: rid(44) });
    const exState2 = (await exampleAccount(env, TEST_USER)).orders;
    ok(exCancelled.status === 200 && exState2.find((o) => o.id === exCancel).status === "cancelled"
      && exState2.find((o) => o.id === exCancel).history.at(-1).note === "Example reason"
      && exPaidRefused.status === 200 && exState2.find((o) => o.id === exPaid).status === "cancelled"
      && exClaimRefused.status === 409 && exReadyEarly.status === 409,
      "The Cancel rule (paid taken, claimed refused) and the Ready rule hold on an acceptance order, the same as on a real one.");
    /* a retried example move is idempotent, as on the real road: answered again, one event, other content refused */
    const exCancelBody = { status: "cancelled", note: "Example reason", rid: rid(41) };
    const exCancelAgain = await move(exCancel, exCancelBody), exCancelOther = await move(exCancel, { ...exCancelBody, note: "Another reason" });
    const exCancelAgainBody = await exCancelAgain.json();
    const exHist = (await exampleAccount(env, TEST_USER)).orders.find((o) => o.id === exCancel).history;
    ok(exCancelAgain.status === 200 && exCancelAgainBody.again === true && exCancelOther.status === 409
      && exHist.filter((h) => h.status === "cancelled").length === 1,
      "A retried Cancel on an acceptance order is answered again and lands once; the same id with another reason is refused.");
    const exReplyBody = { message: "An example reply", rid: rid(45) };
    const exR1 = await move(exId, exReplyBody), exR2 = await move(exId, exReplyBody), exR3 = await move(exId, { ...exReplyBody, message: "Another reply" });
    ok(exR1.status === 200 && exR2.status === 200 && (await exR2.json()).again === true && exR3.status === 409
      && (await exampleAccount(env, TEST_USER)).orders.find((o) => o.id === exId).msgs.filter((m) => m.text === exReplyBody.message).length === 1,
      "A retried reply on an acceptance order lands once, and the same id with other words is refused.");
    const exDecl = { status: "declined", rid: rid(52) }, exPlaced = "20261003070000-exaa5";
    const exD1 = await move(exPlaced, exDecl), exD2 = await move(exPlaced, exDecl);
    ok(exD1.status === 200 && exD2.status === 200 && (await exD2.json()).again === true,
      "A retried Decline on an acceptance order is answered again, not refused for the order having moved on.");
    const exReply = await move(exId, { message: "An example reply", rid: rid(53) });
    const exQuiet = await move("20261003070000-exaa5", { noReply: true, rid: rid(46) });
    const exBadWords = await move(exId, { message: bad, rid: rid(47) });
    const exNfWrong = await owner("/all/maker/orders/" + exClaim + "/notfound", { claim: claim.at, amount: 29, rid: rid(50) });
    const exNfStale = await owner("/all/maker/orders/" + exClaim + "/notfound", { claim: "2026-10-03T07:06:00.000Z", amount: 30, rid: rid(51) });
    ok(exNfWrong.status === 409 && exNfStale.status === 409
      && (await exampleAccount(env, TEST_USER)).orders.find((o) => o.id === exClaim).payments[0].claim === "waiting",
      "Not found on an acceptance order names a claim that waits, at its own amount, or is refused.");
    const exNf = await owner("/all/maker/orders/" + exClaim + "/notfound", { claim: claim.at, amount: 30, rid: rid(48) });
    const exState3 = (await exampleAccount(env, TEST_USER)).orders;
    ok(exReply.status === 200 && exState3.find((o) => o.id === exId).msgs.some((m) => m.text === "An example reply")
      && exQuiet.status === 200 && exBadWords.status === 400 && exNf.status === 200
      && exState3.find((o) => o.id === exClaim).payments[0].claim === "notfound",
      "A reply, No reply needed and Not found work on an acceptance order, and its words are checked by siteWords.");
    ok(harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n === realEvents && harness.db.prepare("SELECT COUNT(*) AS n FROM ord").get().n === realOrders
      && sqls.length === sqlBefore && queue.values.size === 1,
      "Acceptance order moves write no real order event, order row, D1 statement or queue entry.");
    const exRefused = await Promise.all(shapes.map(([body]) => move(exId, body)));
    ok(exRefused.every((r) => r.status === 400) && (await exRefused[0].json()).error === "Send the action's immutable request id.", "The Counter refuses every malformed move on an acceptance order itself, where the Desk never sees it: "
      + shapes.map(([, name], i) => name + "=" + exRefused[i].status).join(", "));
    const exAction = await owner("/all/maker/orders/" + exId + "/accept", {});
    ok(exAction.status === 409, "An acceptance order still cannot use the real stage routes.");
    const realViaDesk = await desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + exId + "/move", {
      method: "POST", headers: { "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" },
      body: JSON.stringify({ status: "ready", rid: rid(49) }) }), deskEnv, {});
    ok(realViaDesk.status === 404 || realViaDesk.status === 409, "The Desk's own move route cannot reach an acceptance order.");
  } finally { globalThis.fetch = originalFetch; }
}
