/* test/maker-cash-purchase.mjs: Salt Admin's money taps and a purchase lot's own amendments. Cash and a Received
   carry an immutable request id the Desk keeps (makerOrderOnce), so a retry is answered from the first answer and never
   books the money twice; the owner page holds one id per tap until it lands. A purchase lot (BUY) takes Payment, Receipt
   and Default from the ledger editor, each sending only its own figure to the Desk's native ledger amendment; a sale
   row never offers them. Driven through the verified owner, the private capability and the actual owner script. */
import { webcrypto } from "node:crypto";
import { cardOf, tile, tileValues } from "./maker-act.mjs";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { makerRequestFingerprint } from "../src/maker-request.js";
import { orderBook } from "./orderbook-harness.mjs";
import * as O from "../stmt/orders.js";
import { landingPage } from "../stmt/page.js";
import { Store, ledger } from "./maker-order-controls.mjs";

export async function run({ ok }) {
  /* ---- the real roads, through the verified owner and the private capability ---- */
  const store = new Store(), queue = new Store(), team = "maker-cash-fixture", audience = "maker-cash-audience", kid = "maker-cash-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "cash-local-master",
    STMT_DESK_KEY: "cash-desk-test-capability-000000001", COUNTER_MAKER_KEY: "cash-maker-test-capability-0000001", ORDER_STORE: "object" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const L = ledger();
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: L.db, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  env.DESK_MAKER = { fetch: (request) => desk.fetch(request, deskEnv, {}) };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected cash fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email: "maakmal97@icloud.com",
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwt = header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
    const owner = (path, body) => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method: "POST", headers: { "cf-access-jwt-assertion": jwt, "content-type": "application/json" }, body: JSON.stringify(body)
    }), env);
    const deskDirect = (id, action, body) => desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + id + "/" + action, {
      method: "POST", headers: { "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" }, body: JSON.stringify(body) }), deskEnv, {});
    const u = "abcd-efgh", at = new Date().toISOString(), digest = "cash-list";
    await queue.put("stmt-users", JSON.stringify({ [u]: "CX1-AB" }));
    const base = { product: "salt", qty: 3, total: 285, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest };
    let serial = 10;
    const make = () => {
      const order = O.decidePlace(u, { ...base, rid: "cash-fixture-" + (++serial) + "-pad-pad-pad" }, [], at, digest).ev.order;
      order.id = "2026" + "1004" + "080" + String(serial).padStart(3, "0") + "-m" + serial;
      harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
      harness.book.run("desk", { u, id: order.id, body: { status: "acknowledged", mode: "collect" } });
      harness.book.run("desk", { u, id: order.id, body: { status: "ready" } });
      /* the pending row is on the ledger, as the reconcile marks it, so a money tap has a row to answer to */
      harness.book.append(null, u, order.id, { kind: "mark", at, mark: { ledgerKey: "CX1-AB|" + at.slice(0, 10) + "|salt|" + order.id } }, harness.book.order(u, order.id));
      return order.id;
    };
    const paid = (id) => +harness.book.order(u, id).paid || 0;
    const rid = (n) => "cash-request-" + n + "-padded-id";
    const tap = (id, action, body) => owner("/all/maker/orders/" + id + "/" + action, body);
    const idReady = make();

    /* a request id is required on cash and on a Received, at the Counter and on the Desk's own route */
    const shapes = [["cash", { amount: 10 }], ["received", { amount: 10 }], ["received", { amount: 10, claim: at }],
      ["cash", { amount: 10, rid: "short" }], ["received", { amount: 10, rid: "has a space in it ok" }]];
    const viaCounter = await Promise.all(shapes.map(([action, body]) => tap(idReady, action, body)));
    const viaDesk = await Promise.all(shapes.map(([action, body]) => deskDirect(idReady, action, body)));
    ok(viaCounter.every((r) => r.status === 400) && viaDesk.every((r) => r.status === 400)
      && paid(idReady) === 0 && L.requests.size === 0,
      "Cash or a Received without its immutable request id is refused with 400, on the Counter and on the Desk's route: "
      + viaCounter.map((r) => r.status).join(",") + "/" + viaDesk.map((r) => r.status).join(","));

    /* a retry under a kept id is answered from the Desk's record, the native road untouched */
    for (const [action, n] of [["cash", 1], ["received", 2]]) {
      const kept = { id: idReady, amount: 40 }, keptRid = rid(n);
      L.requests.set("order:" + keptRid, { operation: "order-" + action, fingerprint: await makerRequestFingerprint("order-" + action, kept),
        entry: JSON.stringify(String(Date.now())), response: JSON.stringify({ ok: true, kept: "first " + action }) });
      const before = L.sqls.length;
      const replayed = await tap(idReady, action, { amount: 40, rid: keptRid });
      const body = await replayed.json();
      const touched = L.sqls.slice(before).filter((sql) => !/maker_request/.test(sql));
      ok(replayed.status === 200 && body.again === true && body.kept === "first " + action && touched.length === 0 && paid(idReady) === 0,
        "A " + action + " retried under its request id is answered from the Desk's record, no row read and nothing paid again: "
        + JSON.stringify([replayed.status, body, touched]));
      const other = await tap(idReady, action, { amount: 41, rid: keptRid });
      const otherBody = await other.json();
      ok(other.status === 409 && /another order action/.test(otherBody.error) && paid(idReady) === 0,
        "The same request id with another " + action + " amount is refused and pays nothing: " + otherBody.error);
    }
    const crossed = await tap(idReady, "received", { amount: 40, rid: rid(1) });
    ok(crossed.status === 409 && paid(idReady) === 0, "A cash request id reused for a Received is refused.");

    /* a refusal by the native road leaves no claim, so the same request is judged afresh */
    const c1 = await tap(idReady, "cash", { amount: 1000, rid: rid(3) }), c2 = await tap(idReady, "cash", { amount: 1000, rid: rid(3) });
    const c2Body = await c2.json();
    /* 27 Oct 2026: cash past what is owed is taken now (the refund the fold raises), so this one is refused by the Desk for its row, not drafted yet */
    ok(!c1.ok && !c2.ok && /pending row is not drafted yet/.test(c2Body.error) && !L.requests.has("order:" + rid(3)) && paid(idReady) === 0,
      "Cash the Desk refuses reaches its own cashOrder, and is not kept under its id: " + c2Body.error);
    const r1 = await tap(idReady, "received", { amount: 25, rid: rid(4) }), r2 = await tap(idReady, "received", { amount: 25, rid: rid(4) });
    const r2Body = await r2.json();
    ok(r1.status === 409 && r2.status === 409 && /nothing they recorded is waiting/.test(r2Body.error) && !L.requests.has("order:" + rid(4)),
      "A Received with nothing of theirs waiting reaches the Desk's own receivedOrder, which refuses it, and is not kept: " + r2Body.error);
  } finally { globalThis.fetch = originalFetch; }

  /* ---- the owner page's own controls, in the actual owner script ---- */
  const posts = [], cashTimers = [], cashRids = new Set();
  let failNext = 0;
  const claimAt = "2026-10-04T08:15:00.000Z";
  const reviewBody = { ok: true, drafts: [], orders: [
    { id: "20261004090001-rdy", u: "abcd-efgh", product: "salt", qty: 3, total: 285, status: "ready", mode: "collect", history: [],
      payments: [{ at: claimAt, amount: 40, claim: "waiting" }] }] };
  const catalog = { parties: [], loans: [], rewards: [], correctionFields: [], rows: [
    { rid: "lot-buy-0001", direction: "BUY", party: "SP1-AB", product: "salt", date: "2026-10-01", qty: 10, total: 500 },
    { rid: "row-sell-0001", direction: "SELL", party: "CX1-AB", product: "salt", date: "2026-10-02", qty: 2, total: 190 }] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      const timeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, ms, ...args) => {
        if (ms === 10000) { cashTimers.push(fn); return 9000 + cashTimers.length; }
        return timeout(fn, ms, ...args);
      };
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        const where = String(path);
        if (init && init.method === "POST" && (where.startsWith("/all/maker/orders/") || where === "/all/maker/inputs/ledger-amend")) {
          posts.push({ path: where, body: JSON.parse(init.body) });
          if (failNext > 0) { failNext--; return Response.json({ ok: false, error: "The Desk did not answer." }, { status: 503 }); }
          if (where.endsWith("/cash") && !cashRids.has(posts.at(-1).body.rid)) {
            cashRids.add(posts.at(-1).body.rid);
            reviewBody.orders[0].paid = (reviewBody.orders[0].paid || 0) + posts.at(-1).body.amount;
          }
          return Response.json({ ok: true });
        }
        if (where === "/all/maker/review") return Response.json(reviewBody);
        if (where === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (where === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (where === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (where === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog });
        if (where === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
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
    const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
    const id = "20261004090001-rdy";
    const card = () => cardOf(doc, id);
    const button = (test) => card() && [...card().querySelectorAll("button")].find((b) => test(b.textContent));
    const fieldIn = (root, label) => {
      const wrap = root && [...root.querySelectorAll("label")].find((l) => l.querySelector(".lbl, .salt-settings__label") && l.querySelector(".lbl, .salt-settings__label").textContent === label);
      return wrap && wrap.querySelector("input, select");
    };
    const settle = async (n) => { await until(() => posts.length >= n); await pause(); };
    const isRid = (value) => /^[0-9a-f]{32}$/.test(value);
    /* 11 Oct 2026: the cards are in Orders and the ledger-row editor in Record, so both places are entered */
    doc.querySelector('[data-act="nav.record"]').click();
    doc.querySelector('[data-act="nav.orders"]').click();
    /* plan 5 (16 Oct 2026): Bank and Cash are two tiles over one amount and one button; payBy() types the figure and picks the road as he does */
    const payBtn = () => card() && card().querySelector('button[data-act="order.pay"]');
    const payBy = (road, amount) => { fieldIn(card(), "Amount, RM").value = amount; card().querySelector('input[data-act="order.pay-by"][data-key="' + road + '"]').click(); return payBtn(); };
    await until(() => payBtn());

    /* Record cash: one id, kept across a failure */
    failNext = 1;
    payBy("cash", "60").click(); cashTimers.shift()(); await settle(1);
    await until(() => button((t) => t === "Retry cash") && !button((t) => t === "Retry cash").disabled);
    button((t) => t === "Retry cash").click(); await settle(2);
    ok(posts[0].path === "/all/maker/orders/" + id + "/cash" && posts[0].body.amount === 60 && isRid(posts[0].body.rid)
      && posts[1].body.rid === posts[0].body.rid && Object.keys(posts[0].body).sort().join() === "amount,rid",
      "Record cash sends the amount under a request id, and its retry after a failure carries the same id: " + JSON.stringify(posts.slice(0, 2)));
    await until(() => payBtn());
    payBy("cash", "60").click(); cashTimers.shift()(); await settle(3);
    ok(isRid(posts[2].body.rid) && posts[2].body.rid !== posts[0].body.rid,
      "Once cash has landed, the next Record cash is a new request with its own id: " + JSON.stringify(posts[2]));

    /* Receive claimed and Confirm received: each its own id, the claim named */
    await until(() => button((t) => t.startsWith("Yes, I got")));
    /* 12 Oct 2026 (Phase 2b): the claim's Received asks on the page's Sheet, whose one action sends it */
    button((t) => t.startsWith("Yes, I got")).click(); await until(() => doc.getElementById("ynGo")); doc.getElementById("ynGo").click(); await settle(4);
    ok(posts[3].path === "/all/maker/orders/" + id + "/received" && posts[3].body.amount === 40 && posts[3].body.claim === claimAt
      && isRid(posts[3].body.rid) && posts[3].body.rid !== posts[2].body.rid,
      "Receive claimed sends the claim's amount and moment under its own request id: " + JSON.stringify(posts[3]));
    await until(() => payBtn());
    failNext = 1;
    payBy("bank", "25").click(); await settle(5);
    await until(() => payBtn() && !payBtn().disabled);
    payBy("bank", "25").click(); await settle(6);
    ok(posts[4].path === "/all/maker/orders/" + id + "/received" && posts[4].body.amount === 25 && posts[4].body.claim === undefined
      && isRid(posts[4].body.rid) && posts[5].body.rid === posts[4].body.rid && posts[4].body.rid !== posts[3].body.rid,
      "Confirm received sends the amount under a request id that a retry keeps: " + JSON.stringify(posts.slice(4, 6)));

    /* a purchase lot's own amendments, and a sale row's */
    const editor = () => [...doc.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3").textContent === "Correct a row");
    await until(() => editor());
    const rowSel = fieldIn(editor(), "Which row");
    const kinds = () => tileValues(editor(), "What to do").join(",");
    rowSel.value = "row-sell-0001"; rowSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    const sellKinds = kinds();
    rowSel.value = "lot-buy-0001"; rowSel.dispatchEvent(new window.Event("change", { bubbles: true }));
    const buyKinds = kinds();
    ok(sellKinds === "Correction,Fulfilment,Cancellation" && buyKinds === "Correction,Fulfilment,Cancellation,Payment,Receipt,Default",
      "A purchase lot offers Payment, Receipt and Default; a sale row never does: " + sellKinds + " / " + buyKinds);
    const sendLot = async (kind, cash, units, n) => {
      const ed = editor(), rs = fieldIn(ed, "Which row");
      if (rs.value !== "lot-buy-0001") { rs.value = "lot-buy-0001"; rs.dispatchEvent(new window.Event("change", { bubbles: true })); }
      tile(ed, "What to do", kind);
      fieldIn(ed, "RM").value = cash; fieldIn(ed, "Units").value = units;
      [...ed.querySelectorAll("button")].find((b) => b.textContent === "Send the correction").click();
      await settle(n);
      return posts[n - 1] || { path: null, body: {} };
    };
    const pay = await sendLot("Payment", "120", "7", 7);
    ok(pay.path === "/all/maker/inputs/ledger-amend" && pay.body.rid === "lot-buy-0001" && pay.body.kind === "Payment"
      && pay.body.cash === 120 && !Object.hasOwn(pay.body, "movedUnits") && !Object.hasOwn(pay.body, "fields"),
      "Payment on a lot sends the cash alone, never units or field changes: " + JSON.stringify(pay));
    const receipt = await sendLot("Receipt", "120", "7", 8);
    ok(receipt.body.kind === "Receipt" && receipt.body.rid === "lot-buy-0001" && receipt.body.movedUnits === 7
      && !Object.hasOwn(receipt.body, "cash") && !Object.hasOwn(receipt.body, "fields"),
      "Receipt on a lot sends the units alone, never cash: " + JSON.stringify(receipt));
    const def = await sendLot("Default", "120", "7", 9);
    ok(def.body.kind === "Default" && def.body.rid === "lot-buy-0001" && !Object.hasOwn(def.body, "cash")
      && !Object.hasOwn(def.body, "movedUnits") && !Object.hasOwn(def.body, "fields"),
      "Default on a lot sends neither cash nor units: " + JSON.stringify(def));
  } finally { browser.window.close(); }
}
