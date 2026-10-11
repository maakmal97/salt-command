/* test/maker-order-controls.mjs: Counter Admin's remaining order controls: a handover, a close and a stage offered again
   under an immutable request id the Desk keeps; Ready with collect or deliver; the review offering a rejected stage again
   on a closed order; and the owner page's own controls (Ready to collect or deliver, Close at these units, Offer again,
   the reasons and quick replies), driven in the actual owner script. */
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { makerOrderOnce, makerRequestFingerprint } from "../src/maker-request.js";
import { orderBook } from "./orderbook-harness.mjs";
import * as O from "../stmt/orders.js";
import { landingPage } from "../stmt/page.js";
import { TEST_USER, FIX_VERSION, fixKey, exampleAccount } from "../stmt/testfix.js";

export class Store {
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

/* the Desk's D1, as far as these roads read it: the request-id store, the rejected rows an order carries, and nothing else */
export function ledger() {
  const requests = new Map(), rejected = [], faults = [], sqls = [];
  const db = { prepare(sql) {
    let args = [];
    const q = { bind(...a) { args = a; return q; },
      async first() {
        sqls.push(sql);
        if (/^SELECT operation,fingerprint,response,entry FROM maker_request WHERE id=\?1$/.test(sql)) {
          const row = requests.get(args[0]); return row ? { ...row } : null;
        }
        if (/^SELECT v,stamped FROM snapshot WHERE one=1$/.test(sql)) return null;
        faults.push(sql); throw new Error("unexpected D1 read " + sql);
      },
      async run() {
        sqls.push(sql);
        if (/^INSERT OR IGNORE INTO maker_request/.test(sql)) {
          if (requests.has(args[0])) return { meta: { changes: 0 } };
          requests.set(args[0], { operation: args[1], fingerprint: args[2], entry: args[3], response: null }); return { meta: { changes: 1 } };
        }
        if (/^UPDATE maker_request SET entry=\?3 WHERE id=\?1 AND entry=\?2 AND response IS NULL$/.test(sql)) {
          const row = requests.get(args[0]);
          if (!row || row.entry !== args[1] || row.response !== null) return { meta: { changes: 0 } };
          row.entry = args[2]; return { meta: { changes: 1 } };
        }
        if (/^UPDATE maker_request SET response=\?3 WHERE id=\?1 AND fingerprint=\?2$/.test(sql)) {
          const row = requests.get(args[0]);
          if (!row || row.fingerprint !== args[1]) return { meta: { changes: 0 } };
          row.response = args[2]; return { meta: { changes: 1 } };
        }
        if (/^DELETE FROM maker_request WHERE id=\?1 AND response IS NULL$/.test(sql)) {
          const row = requests.get(args[0]);
          if (row && row.response === null) { requests.delete(args[0]); return { meta: { changes: 1 } }; }
          return { meta: { changes: 0 } };
        }
        faults.push(sql); throw new Error("unexpected D1 write " + sql);
      },
      async all() {
        sqls.push(sql);
        if (/^SELECT entry FROM draft WHERE status='rejected' AND entry LIKE/.test(sql))
          return { results: rejected.filter((r) => r.status === "rejected").map((r) => ({ entry: r.entry })) };
        if (/^SELECT id,status,decided_by,entry FROM draft WHERE entry LIKE \?1/.test(sql)) {
          const needle = String(args[0]).slice(1, -1);
          return { results: rejected.filter((r) => r.entry.includes(needle)) };
        }
        return { results: [] };
      } };
    return q;
  } };
  return { db, requests, rejected, faults, sqls };
}

export async function run({ ok }) {
  /* ---- the request-id store, as a unit ---- */
  {
    const { db, requests } = ledger();
    let count = 0;
    const done = () => ({ ok: true, n: ++count });
    const rid = "unit-request-000000000001", body = { id: "20261003070001-r1", qty: 1 };
    const one = await makerOrderOnce(db, rid, "handed", body, done), two = await makerOrderOnce(db, rid, "handed", body, done);
    ok(one.ok && !one.again && two.ok && two.again === true && two.n === 1 && count === 1,
      "A tap under a request id runs its road once; a retry under the id is answered from the first answer: " + JSON.stringify([one, two, count]));
    const other = await makerOrderOnce(db, rid, "handed", { ...body, qty: 2 }, done);
    const otherAction = await makerOrderOnce(db, rid, "again", body, done);
    ok(other.status === 409 && otherAction.status === 409 && count === 1,
      "Other content, or another action, under a request id already kept is refused and runs nothing.");
    let tries = 0;
    const refuse = () => { tries++; return { ok: false, status: 409, error: "the native road refused it" }; };
    const r1 = await makerOrderOnce(db, "unit-request-000000000002", "handed", body, refuse);
    const r2 = await makerOrderOnce(db, "unit-request-000000000002", "handed", body, refuse);
    ok(r1.error === "the native road refused it" && r2.error === "the native road refused it" && tries === 2
      && !requests.has("order:unit-request-000000000002"),
      "A refusal is not kept: the same request is judged afresh by the native road when it is tried again.");
    let thrown = null;
    try { await makerOrderOnce(db, "unit-request-000000000003", "again", body, () => { throw new Error("broken road"); }); }
    catch (error) { thrown = error.message; }
    const afterThrow = await makerOrderOnce(db, "unit-request-000000000003", "again", body, done);
    ok(thrown === "broken road" && afterThrow.ok && !afterThrow.again && count === 2,
      "A road that throws leaves no claim behind, so the same request may be sent again.");
    let inner = null;
    const nested = await makerOrderOnce(db, "unit-request-000000000004", "handed", body, async () => {
      inner = await makerOrderOnce(db, "unit-request-000000000004", "handed", body, done);
      return { ok: true, outer: true };
    });
    ok(nested.outer && inner.status === 409 && /still being recorded/.test(inner.error) && count === 2,
      "A second send while the first is still being recorded is refused, and runs nothing.");
    const now = Date.now();
    requests.set("order:unit-request-000000000005", { operation: "order-handed",
      fingerprint: await makerRequestFingerprint("order-handed", body), entry: JSON.stringify(String(now - 180000)), response: null });
    const taken = await makerOrderOnce(db, "unit-request-000000000005", "handed", body, done, now);
    const replay = await makerOrderOnce(db, "unit-request-000000000005", "handed", body, done, now);
    ok(taken.ok && !taken.again && replay.again === true && count === 3,
      "A claim left unanswered for over two minutes is taken over once, and its answer kept.");
  }

  /* ---- the real roads, through the verified owner and the private capability ---- */
  const store = new Store(), queue = new Store(), team = "maker-controls-fixture", audience = "maker-controls-audience", kid = "maker-controls-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "controls-local-master",
    STMT_DESK_KEY: "controls-desk-test-capability-0001", COUNTER_MAKER_KEY: "controls-maker-test-capability-00001", ORDER_STORE: "object" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const L = ledger();
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: L.db, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  env.DESK_MAKER = { fetch: (request) => desk.fetch(request, deskEnv, {}) };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected order-controls fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email: "maakmal97@icloud.com",
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwt = header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
    const owner = (path, body, method = "POST") => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method, headers: { "cf-access-jwt-assertion": jwt, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }), env);
    const deskDirect = (id, action, body) => desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + id + "/" + action, {
      method: "POST", headers: { "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" }, body: JSON.stringify(body) }), deskEnv, {});
    const u = "abcd-efgh", at = new Date().toISOString(), digest = "controls-list";
    await queue.put("stmt-users", JSON.stringify({ [u]: "CX1-AB" }));
    const base = { product: "salt", qty: 3, total: 285, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest, rid: "controls-fixture-base-01" };
    let serial = 10;
    const make = (state = "placed") => {
      const order = O.decidePlace(u, { ...base, rid: "controls-fixture-" + (++serial) + "-pad-pad" }, [], at, digest).ev.order;
      order.id = "20261003080" + String(serial).padStart(3, "0") + "-c" + serial;
      harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
      if (state !== "placed") harness.book.run("desk", { u, id: order.id, body: { status: "acknowledged", mode: "collect" } });
      if (state === "ready") harness.book.run("desk", { u, id: order.id, body: { status: "ready" } });
      if (state === "cancelled") harness.book.run("desk", { u, id: order.id, body: { status: "cancelled" } });
      return order.id;
    };
    const book = (id) => harness.book.order(u, id);
    const rid = (n) => "controls-request-" + n + "-padded";
    const tap = (id, action, body) => owner("/all/maker/orders/" + id + "/" + action, body);

    /* a request id is required on a handover, a close and a stage offered again */
    const idReady = make("ready");
    const noRid = await Promise.all([tap(idReady, "handed", { qty: 1 }), tap(idReady, "handed", { qty: 1, close: true }),
      tap(idReady, "again", { stage: "move" }), tap(idReady, "handed", { qty: 1, rid: "short" })]);
    ok(noRid.every((r) => r.status === 400) && (+book(idReady).moved || 0) === 0 && L.requests.size === 0,
      "A handover, a close or a stage offered again without its immutable request id is refused with 400: " + noRid.map((r) => r.status).join(","));

    /* a retry under a kept id is answered from the Desk's record, the native road untouched */
    const kept = { id: idReady, qty: 1 }, keptRid = rid(1);
    L.requests.set("order:" + keptRid, { operation: "order-handed", fingerprint: await makerRequestFingerprint("order-handed", kept),
      entry: JSON.stringify(String(Date.now())), response: JSON.stringify({ ok: true, order: { id: idReady }, kept: "first answer" }) });
    const sqlBefore = L.sqls.length;
    const replayed = await tap(idReady, "handed", { qty: 1, rid: keptRid });
    const replayedBody = await replayed.json();
    const touched = L.sqls.slice(sqlBefore).filter((sql) => !/maker_request/.test(sql));
    ok(replayed.status === 200 && replayedBody.again === true && replayedBody.kept === "first answer"
      && touched.length === 0 && (+book(idReady).moved || 0) === 0,
      "A handover retried under its request id is answered from the Desk's record without touching the order or its rows: "
      + JSON.stringify([replayed.status, replayedBody, touched]));
    const otherQty = await tap(idReady, "handed", { qty: 2, rid: keptRid });
    const asClose = await tap(idReady, "handed", { qty: 1, close: true, rid: keptRid });
    ok(otherQty.status === 409 && asClose.status === 409 && /another order action/.test((await asClose.json()).error)
      && (+book(idReady).moved || 0) === 0,
      "The same request id with other units, or as a close, is refused and changes nothing.");

    /* a refusal by the native road leaves no claim, so the same request is judged afresh */
    const idPlaced = make("placed");
    const p1 = await tap(idPlaced, "handed", { qty: 1, rid: rid(2) }), p2 = await tap(idPlaced, "handed", { qty: 1, rid: rid(2) });
    const p2Body = await p2.json();
    ok(p1.status === 409 && p2.status === 409 && /nothing to record/.test(p2Body.error) && !L.requests.has("order:" + rid(2)),
      "A handover the native road refuses is not kept under its id: the retry reaches the road again and hears its own answer: " + p2Body.error);
    const a1 = await tap(idReady, "again", { stage: "move", rid: rid(3) });
    ok(a1.status === 409 && /no rejected handover/.test((await a1.json()).error) && !L.requests.has("order:" + rid(3)),
      "Offer again reaches the Desk's own againOrder, which refuses a stage with nothing rejected.");

    /* Ready with how the goods go */
    const idAck = make("acknowledged");
    const readyDeliver = { status: "ready", mode: "deliver", rid: rid(4) };
    const m1 = await owner("/all/maker/orders/" + idAck + "/move", readyDeliver), m2 = await owner("/all/maker/orders/" + idAck + "/move", readyDeliver);
    ok(m1.status === 200 && book(idAck).status === "ready" && book(idAck).mode === "deliver" && m2.status === 200 && (await m2.json()).again === true,
      "Ready to deliver moves an acknowledged collect order to ready and to deliver, once: " + JSON.stringify([m1.status, book(idAck).mode]));
    const m3 = await owner("/all/maker/orders/" + idAck + "/move", { ...readyDeliver, mode: "collect" });
    ok(m3.status === 409 && book(idAck).mode === "deliver", "The same request id with the other mode is refused.");
    const modeShapes = [{ status: "declined", mode: "deliver", rid: rid(5) }, { status: "ready", mode: "fly", rid: rid(6) },
      { message: "Ready soon", mode: "deliver", rid: rid(7) }, { noReply: true, mode: "collect", rid: rid(8) }];
    const idModes = make("acknowledged");
    const counterModes = await Promise.all(modeShapes.map((body) => owner("/all/maker/orders/" + idModes + "/move", body)));
    const deskModes = await Promise.all(modeShapes.map((body) => deskDirect(idModes, "move", body)));
    ok(counterModes.every((r) => r.status === 400) && deskModes.every((r) => r.status === 400) && book(idModes).status === "acknowledged",
      "A mode goes only with Ready, collect or deliver, on the Counter and on the Desk's own route: "
      + counterModes.map((r) => r.status).join(",") + "/" + deskModes.map((r) => r.status).join(","));

    /* the review offers a rejected stage again on an order no longer open */
    const idCancelled = make("cancelled");
    L.rejected.push({ id: "2026-10-03T08:30:00.000Z", status: "rejected", decided_by: "owner",
      entry: JSON.stringify({ orderId: idCancelled, status: "Cancellation" }) });
    const review = await (await owner("/all/maker/review", undefined, "GET")).json();
    const shown = review.orders.find((o) => o.id === idCancelled);
    ok(review.ok && shown && JSON.stringify(shown.again) === '["cancel"]',
      "The review carries a rejected cancellation on a cancelled order, so it can be offered again: " + JSON.stringify(shown && shown.again));

    /* an acceptance order: Ready with a mode moves its fixture alone */
    const exId = "20261003080000-exbb1";
    const exOrder = { ...O.decidePlace(TEST_USER, { ...base, rid: "controls-fixture-ex-pad-pad" }, [], at, digest).ev.order,
      id: exId, status: "acknowledged", history: [{ at, status: "placed", by: "customer" }, { at, status: "acknowledged", by: "desk" }] };
    await store.put("u:" + TEST_USER, JSON.stringify({ test: true, wrap: { salt: "controls-wrap" } }));
    await store.put(fixKey(TEST_USER), JSON.stringify({ v: FIX_VERSION, salt: "controls-wrap", at: "2026-10-03T08:00:00.000Z",
      env: { iv: "controls-iv" }, claims: [], orders: [], makerBook: { sales: [] }, makerOrders: [exOrder] }));
    const realEvents = harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n;
    const exMove = await owner("/all/maker/orders/" + exId + "/move", { status: "ready", mode: "deliver", rid: rid(9) });
    const exNow = (await exampleAccount(env, TEST_USER)).orders.find((o) => o.id === exId);
    const exBad = await owner("/all/maker/orders/" + exId + "/move", { status: "declined", mode: "deliver", rid: rid(10) });
    ok(exMove.status === 200 && exNow.status === "ready" && exNow.mode === "deliver" && exBad.status === 400
      && harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n === realEvents,
      "An acceptance order's Ready to deliver lands in its fixture alone; a mode on Decline is refused there too: " + JSON.stringify([exMove.status, exNow.mode, exBad.status]));
  } finally { globalThis.fetch = originalFetch; }

  /* ---- the owner page's own controls, in the actual owner script ---- */
  const posts = [], scrolls = [];
  let failNext = 0;
  const orderOf = (id, status, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 3, total: 285, status, mode: "collect", history: [], ...patch });
  const draftId = "2026-10-03T09:00:00.000Z";
  const reviewBody = { ok: true, orders: [
    orderOf("20261003090001-ack", "acknowledged"),
    orderOf("20261003090002-rdy", "ready"),
    orderOf("20261003090003-del", "placed", { mode: "deliver" }),
    orderOf("20261003090004-can", "cancelled", { again: ["cancel"] }),
    orderOf("20261003090005-gone", "done")],
  drafts: [{ id: draftId, status: "pending", collection: "sales", product: "salt", qty: 1, total: 130,
    entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-03" } }] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => true;
      window.HTMLElement.prototype.scrollIntoView = function (options) { scrolls.push({ id: this.getAttribute("data-maker-say"), options }); };
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          posts.push({ path: String(path), body: JSON.parse(init.body) });
          if (failNext > 0) { failNext--; return Response.json({ ok: false, error: "The Desk did not answer." }, { status: 503 }); }
          return Response.json({ ok: true });
        }
        if (path === "/all/maker/review") return Response.json(reviewBody);
        if (path === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (path === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (path === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (path === "/all/maker/inputs") return Response.json({ ok: true, catalog: { products: [], parties: [], loans: [], rewards: [], ledger: [] } });
        if (path === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, accounts: [] });
      };
    }
  });
  try {
    const window = browser.window, doc = window.document;
    const until = async (predicate) => {
      for (let i = 0; i < 200 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      return !!predicate();
    };
    /* an order's card is drawn for the order opened alone (Phase 1c), so asking for it opens it; a Desk row's card is Record > Approve's and stands */
    const card = (id) => cardOf(doc, id) || [...doc.querySelectorAll("#makerDrafts article")].find((a) => a.querySelector("h3") && a.querySelector("h3").textContent === id);
    const button = (id, text) => card(id) && [...card(id).querySelectorAll("button")].find((b) => b.textContent === text);
    const field = (id, label) => {
      const wrap = card(id) && [...card(id).querySelectorAll("label")].find((l) => l.querySelector(".lbl") && l.querySelector(".lbl").textContent === label);
      return wrap && wrap.querySelector("input");
    };
    const settle = async (n) => { await until(() => posts.length >= n); await new Promise((resolve) => setTimeout(resolve, 40)); };
    /* an answer lands in the foot of the card it was asked of; #makerReviewStatus keeps the list's own words */
    const say = (id) => card(id)?.querySelector("[data-maker-say]");
    const list = () => doc.getElementById("makerReviewStatus").textContent;
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => button("20261003090001-ack", "Ready to deliver"));

    ok(!!button("20261003090001-ack", "Ready to collect") && !!button("20261003090001-ack", "Ready to deliver")
      && !button("20261003090001-ack", "Mark ready"),
      "An acknowledged order offers Ready to collect and Ready to deliver.");
    button("20261003090001-ack", "Ready to deliver").click(); await settle(1);
    ok(posts[0] && posts[0].path === "/all/maker/orders/20261003090001-ack/move" && posts[0].body.status === "ready"
      && posts[0].body.mode === "deliver" && /^[0-9a-f]{32}$/.test(posts[0].body.rid),
      "Ready to deliver sends Ready with the deliver mode under a request id: " + JSON.stringify(posts[0]));
    await until(() => say("20261003090001-ack")?.textContent);
    ok(say("20261003090001-ack")?.textContent === "Order marked ready to deliver."
      && say("20261003090001-ack").getAttribute("role") === "status" && say("20261003090001-ack").getAttribute("aria-live") === "polite"
      && !/ready to deliver/.test(list()) && /open orders/.test(list()) && !say("20261003090002-rdy")?.textContent
      && scrolls.some((s) => s.id === "20261003090001-ack" && s.options && s.options.block === "nearest"),
      "An order's answer lands in the foot of the card tapped, a polite status line, not on the list's line and not on another card: "
      + JSON.stringify({ card: say("20261003090001-ack")?.textContent, other: say("20261003090002-rdy")?.textContent, list: list() }));

    await until(() => button("20261003090002-rdy", "Close at these units"));
    const units = field("20261003090002-rdy", "Units handed over");
    units.value = "3"; button("20261003090002-rdy", "Close at these units").click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    ok(posts.length === 1, "Close at the full size sends nothing: a close is under the units ordered.");
    ok(say("20261003090002-rdy")?.textContent === "A close is above 0 and under the 3 units ordered." && !/A close is above/.test(list()),
      "A refusal made on the page itself, before anything is sent, is said on the card it was made on");
    failNext = 1;
    field("20261003090002-rdy", "Units handed over").value = "2";
    button("20261003090002-rdy", "Close at these units").click(); await settle(2);
    await until(() => /did not answer/.test(say("20261003090002-rdy")?.textContent || ""));
    ok(say("20261003090002-rdy")?.textContent === "The Desk did not answer." && !/did not answer/.test(list())
      && !say("20261003090001-ack")?.textContent.includes("did not answer"),
      "A refused action says so in the foot of its own card, beside the buttons it was tapped on, and not on the list's line");
    await until(() => button("20261003090002-rdy", "Close at these units"));
    field("20261003090002-rdy", "Units handed over").value = "2";
    button("20261003090002-rdy", "Close at these units").click(); await settle(3);
    ok(posts[1].path === "/all/maker/orders/20261003090002-rdy/handed" && posts[1].body.qty === 2 && posts[1].body.close === true
      && /^[0-9a-f]{32}$/.test(posts[1].body.rid) && posts[2].body.rid === posts[1].body.rid,
      "Close at these units sends a close at the units in the box, and its retry after a failure carries the same request id: "
      + JSON.stringify(posts.slice(1, 3)));
    await until(() => button("20261003090002-rdy", "Record handover"));
    button("20261003090002-rdy", "Record handover").click(); await settle(4);
    ok(posts[3].path === "/all/maker/orders/20261003090002-rdy/handed" && posts[3].body.close === undefined
      && /^[0-9a-f]{32}$/.test(posts[3].body.rid) && posts[3].body.rid !== posts[1].body.rid,
      "Record handover carries its own request id: " + JSON.stringify(posts[3]));

    await until(() => button("20261003090004-can", "Offer the cancellation again"));
    ok(!!card("20261003090005-gone") && card("20261003090005-gone").querySelectorAll("button, input").length === 0,
      "A closed order with nothing rejected has a card of its figures and nothing to move it by (it had none at all before Phase 1c).");
    button("20261003090004-can", "Offer the cancellation again").click(); await settle(5);
    ok(posts[4].path === "/all/maker/orders/20261003090004-can/again" && posts[4].body.stage === "cancel" && /^[0-9a-f]{32}$/.test(posts[4].body.rid),
      "A cancelled order carrying a rejected cancellation offers it again, under a request id: " + JSON.stringify(posts[4]));

    await until(() => button("20261003090003-del", "We cannot deliver there."));
    ok(!!button("20261003090003-del", "We cannot deliver there.") && !button("20261003090001-ack", "We cannot deliver there.")
      && !!button("20261003090001-ack", "Our prices have changed."),
      "The reason for a place delivery cannot reach is offered only on an order to be delivered.");
    button("20261003090003-del", "We do not have enough in hand this week.").click(); await new Promise((resolve) => setTimeout(resolve, 20));
    ok(field("20261003090003-del", "Reason to the customer (Decline or Cancel, optional)").value === "We do not have enough in hand this week.",
      "A reason picked fills the reason box.");
    reviewBody.orders = reviewBody.orders.filter((o) => o.id !== "20261003090003-del");   /* the Desk's next read no longer lists it */
    button("20261003090003-del", "Decline").click(); await settle(6);
    ok(posts[5].body.status === "declined" && posts[5].body.note === "We do not have enough in hand this week.",
      "Decline sends the reason picked: " + JSON.stringify(posts[5]));
    await until(() => /Order declined/.test(list()));
    ok(!card("20261003090003-del") && list() === "Order declined.",
      "An answer whose card has gone, the order having left the open list, falls to the list's own line and is not lost: " + list());
    await until(() => button(draftId, "Approve row"));
    button(draftId, "Approve row").click();
    await until(() => say(draftId)?.textContent);
    ok(say(draftId)?.textContent === "Row approved." && !/Row approved/.test(list()),
      "A Desk row's answer lands on the row's own card too: " + JSON.stringify({ card: say(draftId)?.textContent, list: list() }));
    await until(() => field("20261003090001-ack", "Reply to the customer"));
    button("20261003090001-ack", "Amend order").click();
    ok(say("20261003090001-ack")?.textContent === "Change a figure first." && !/Change a figure/.test(list()),
      "Amend with no figure changed says so on its own card");
    await until(() => !button("20261003090001-ack", "Keep as a quick reply").disabled);   /* the card's controls come back once the tap has run */
    const reply = field("20261003090001-ack", "Reply to the customer");
    reply.value = "Ready after five."; reply.dispatchEvent(new window.Event("input", { bubbles: true }));
    button("20261003090001-ack", "Keep as a quick reply").click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    ok(JSON.parse(window.localStorage.getItem("saltQuickReplies")).includes("Ready after five.")
      && !!button("20261003090001-ack", "Forget this quick reply"),
      "Keep as a quick reply keeps the line on this device, and the button then offers to forget it.");
    ok(say("20261003090001-ack")?.textContent === "Kept as a quick reply on this device." && !/Kept as/.test(list()),
      "Keep as a quick reply answers on its own card");
    button("20261003090001-ack", "Send reply").click(); await settle(7);
    await until(() => say("20261003090001-ack")?.textContent === "Reply sent.");
    ok(say("20261003090001-ack")?.textContent === "Reply sent." && !/Reply sent/.test(list()),
      "Send reply answers on the card replied on, after the redraw that follows it");
    await until(() => button("20261003090002-rdy", "Ready after five."));
    button("20261003090002-rdy", "Ready after five.").click(); await new Promise((resolve) => setTimeout(resolve, 20));
    ok(field("20261003090002-rdy", "Reply to the customer").value === "Ready after five.",
      "A quick reply is offered on every card once kept, and picking it fills the reply box.");
    button("20261003090002-rdy", "Forget this quick reply").click();
    ok(JSON.parse(window.localStorage.getItem("saltQuickReplies")).length === 0, "Forget this quick reply drops it from the device.");
  } finally { browser.window.close(); }
}
