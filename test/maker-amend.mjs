/* test/maker-amend.mjs: his decision of 06 Oct 2026, that everything on an agreed order is amendable after Accept (the size,
   the goods' price, the delivery charge), as one Correction for approval. Counter Admin's restate road under an immutable
   request id, the Desk's own route, the Desk's refusals (collection, floor, paid, claim, size under what is out), the order
   book's restate event, an acceptance order in its fixture alone, and the owner page's control. */
import { webcrypto } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { orderBook } from "./orderbook-harness.mjs";
import * as O from "../stmt/orders.js";
import { amendEntry } from "../src/orders.js";
import { STAGE_OF, withPending } from "../src/drafter.js";
import PE from "../engine/position.mjs";
import { landingPage } from "../stmt/page.js";
import { TEST_USER, FIX_VERSION, fixKey, exampleAccount } from "../stmt/testfix.js";
import { Store, ledger } from "./maker-order-controls.mjs";

export async function run({ ok }) {
  const store = new Store(), queue = new Store(), team = "maker-amend-fixture", audience = "maker-amend-audience", kid = "maker-amend-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "amend-local-master",
    STMT_DESK_KEY: "amend-desk-test-capability-0000001", COUNTER_MAKER_KEY: "amend-maker-test-capability-000001", ORDER_STORE: "object" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const L = ledger();
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: L.db, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  env.DESK_MAKER = { fetch: (request) => desk.fetch(request, deskEnv, {}) };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected amend fixture request: " + url);
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
    const u = "abcd-efgh", at = new Date().toISOString(), digest = "amend-list";
    await queue.put("stmt-users", JSON.stringify({ [u]: "CX1-AB" }));
    const base = { product: "salt", qty: 3, total: 285, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest };
    let serial = 10;
    const make = (patch = {}, state = "ready") => {
      const order = O.decidePlace(u, { ...base, ...patch, rid: "amend-fixture-" + (++serial) + "-pad-pad-pad" }, [], at, digest).ev.order;
      order.id = "20261006080" + String(serial).padStart(3, "0") + "-a" + serial;
      harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
      harness.book.run("desk", { u, id: order.id, body: { status: "acknowledged", mode: patch.mode || "collect", delivery: patch.mode === "deliver" ? 5 : 0 } });
      if (state === "ready") harness.book.run("desk", { u, id: order.id, body: { status: "ready" } });
      harness.book.append(null, u, order.id, { kind: "mark", at, mark: { ledgerKey: "CX1-AB|" + at.slice(0, 10) + "|salt|" + order.id } }, harness.book.order(u, order.id));
      return order.id;
    };
    const book = (id) => harness.book.order(u, id);
    const rid = (n) => "amend-request-" + n + "-padded-id";
    const tap = (id, body) => owner("/all/maker/orders/" + id + "/restate", body);
    const idReady = make();

    /* a request id and a figure are required, at the Counter and on the Desk's own route */
    const shapes = [{ total: 290 }, { total: 290, rid: "short" }, { rid: rid(1) }, { total: 290, rid: rid(1), unit: 3 },
      { total: 0, rid: rid(1) }, { qty: -1, total: 90, rid: rid(1) }, { delivery: -2, rid: rid(1) }];
    const viaCounter = await Promise.all(shapes.map((body) => tap(idReady, body)));
    const viaDesk = await Promise.all(shapes.map((body) => deskDirect(idReady, "restate", body)));
    ok(viaCounter.every((r) => r.status === 400) && viaDesk.every((r) => r.status === 400)
      && book(idReady).total === 285 && L.requests.size === 0,
      "An amendment without its request id or a figure, or with a figure that is not a figure, is refused with 400 on the Counter and on the Desk's route: "
      + viaCounter.map((r) => r.status).join(",") + "/" + viaDesk.map((r) => r.status).join(","));

    /* the Desk's own refusals reach the owner, and none is kept under its id */
    const refusals = [
      ["a collection takes no delivery charge", { delivery: 5, rid: rid(2) }, /collection carries no delivery/],
      ["the size cannot go under what is handed over", null, null],
      ["nothing changes", { total: 285, rid: rid(3) }, /already says/],
      ["a size with no known mirror is not priced", { qty: 4, total: 380, rid: rid(4) }, /being seeded/]];
    for (const [what, body, pattern] of refusals) {
      if (!body) continue;
      const r = await tap(idReady, body), text = (await r.json()).error || "";
      ok(!r.ok && pattern.test(text) && !L.requests.has("order:" + body.rid), "Amending " + what + " reaches the Desk's restate and is refused, kept under no id: " + r.status + " " + text);
    }
    const idPlaced = make({}, "ack");
    harness.book.run("desk", { u, id: idPlaced, body: { status: "cancelled" } });
    const gone = await tap(idPlaced, { total: 290, rid: rid(5) });
    ok(gone.status === 409 && book(idPlaced).total === 285, "A cancelled order's figures are not amended: " + gone.status);

    /* a waiting claim and a payment past the new figure refuse; the site's own decide holds the same */
    const idPaid = make();
    harness.book.append(null, u, idPaid, { kind: "claim", at, amount: 100, method: "transfer", account: null }, harness.book.order(u, idPaid));
    const events = (id) => harness.db.prepare("SELECT COUNT(*) AS n FROM ev WHERE oid=?").get(id).n;
    const claimed = await tap(idPaid, { total: 300, rid: rid(6) });
    const claimText = (await claimed.json()).error || "";
    ok(claimed.status === 409 && /waits on this order|waits on/.test(claimText), "[" + claimed.status + " " + claimText + "] An order with a payment waiting on his answer is not amended until he answers it.");

    /* what is handed over is read on the Desk's road too, ahead of the mirror; under what is paid is no refusal since 06 Oct 2026
       (the fold raises the refund), so that figure goes on to the mirror, unseeded here */
    const idSettled = make();
    harness.book.append(null, u, idSettled, { kind: "ledger", at, paid: 280, moved: 2 }, harness.book.order(u, idSettled));
    const underPaid = await tap(idSettled, { total: 270, rid: rid(9) });
    const underPaidText = (await underPaid.json()).error || "";
    const underMoved = await tap(idSettled, { qty: 1, total: 95, rid: rid(10) });
    ok(underPaid.status === 503 && /being seeded/.test(underPaidText) && !/paid/.test(underPaidText) && underMoved.status === 400 && /already handed over/.test((await underMoved.json()).error),
      "The Desk refuses a size under what is handed over, and a figure under what is paid is no refusal of its own: " + underPaid.status + " " + underPaidText + " / " + underMoved.status);
    const o = book(idReady), t0 = Date.now();
    const none = O.decideDesk({ ...o, status: "acknowledged" }, { restate: { qty: 3, total: 285, delivery: 0 } }, at);
    ok(none.none === true, "The order book takes an amendment that changes nothing as no event.");
    const up = O.decideDesk({ ...o, status: "ready" }, { restate: { qty: 3, total: 300, delivery: 0 } }, at);
    ok(up.ev && up.ev.kind === "restate" && up.ev.total === 300 && up.ev.qty === 3, "An amendment of the goods' price becomes a restate event: " + JSON.stringify(up));
    const refused = [
      O.decideDesk({ ...o, status: "done" }, { restate: { qty: 3, total: 300, delivery: 0 } }, at),
      O.decideDesk({ ...o, moved: 2 }, { restate: { qty: 1, total: 95, delivery: 0 } }, at),
      O.decideDesk(o, { restate: { qty: 3, total: 0, delivery: 0 } }, at),
      O.decideDesk(o, { restate: { qty: 3, total: 285, delivery: 5 } }, at),
      O.decideDesk({ ...o, payments: [{ claim: "waiting", amount: 10, at }] }, { restate: { qty: 3, total: 300, delivery: 0 } }, at)];
    ok(refused.every((r) => r.error), "The order book refuses an amendment of a done order, a size under what is handed over, no goods price, a charge on a collection, or one with a claim waiting: "
      + refused.map((r) => r.error || "accepted").join(" | "));
    /* 06 Oct 2026: under what they paid is taken, as a close under it is; the ledger raises the refund for the difference */
    const underPaidEv = O.decideDesk({ ...o, status: "ready", paid: 280, delivery: 0 }, { restate: { qty: 3, total: 270, delivery: 0 } }, at);
    ok(underPaidEv.ev && underPaidEv.ev.kind === "restate" && underPaidEv.ev.total === 270,
      "The order book takes an amendment under what they paid as a restate event: " + JSON.stringify(underPaidEv));

    /* the restate event moves the figures, never `closed`, and says so in the history the customer reads */
    harness.book.run("desk", { u, id: idReady, body: { restate: { qty: 3, total: 300, delivery: 0 } } });
    const after = book(idReady);
    const note = (after.history || []).filter((h) => h.by === "desk").pop().note;
    ok(after.total === 300 && after.qty === 3 && !after.closed && after.status === "ready" && /^amended to 3 unit, 300\.00 goods, 0\.00 delivery$/.test(note),
      "A restate event sets the order's figures, never closes it, and writes the history line the page reads: " + JSON.stringify([after.total, after.closed, note]));
    const idDeliver = make({ mode: "deliver", place: "Taman Rekaan" });
    harness.book.run("desk", { u, id: idDeliver, body: { restate: { qty: 3, total: 285, delivery: 12 } } });
    ok(book(idDeliver).delivery === 12, "A restate event restates the delivery charge of a delivery.");

    /* the Correction itself: a restating row on the order's key, for approval, its stage named for the retry road */
    const entry = amendEntry({ ...after, id: "20261006080999-x" }, "CX1-AB", { qty: 3, total: 310, delivery: 0 }, { qty: 3, total: 300, delivery: 0 }, at);
    ok(entry.status === "Amendment" && entry.payload.kind === "Correction" && entry.payload.fields.total === 310
      && entry.payload.fields.qty === 3 && entry.payload.fields.delivery === 0 && entry.payload.orderKey && STAGE_OF.Amendment === "amend",
      "An amendment is a Correction restating the size, the goods and the delivery, on the order's row, its stage amend: " + JSON.stringify(entry.payload));

    /* an acceptance order lands in its fixture alone, through the order book's own decide */
    const exId = "20261006080000-exbb1";
    const exOrder = { ...O.decidePlace(TEST_USER, { ...base, rid: "amend-fixture-ex-pad-pad-pad" }, [], at, digest).ev.order,
      id: exId, status: "ready", total: 285, qty: 3, delivery: 0, history: [{ at, status: "placed", by: "customer" }, { at, status: "acknowledged", by: "desk" }] };
    await store.put("u:" + TEST_USER, JSON.stringify({ test: true, wrap: { salt: "amend-wrap" } }));
    await store.put(fixKey(TEST_USER), JSON.stringify({ v: FIX_VERSION, salt: "amend-wrap", at: "2026-10-06T08:00:00.000Z",
      env: { iv: "amend-iv" }, claims: [], orders: [], makerBook: { sales: [] }, makerOrders: [exOrder] }));
    const realEvents = harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n;
    const exTap = await tap(exId, { total: 295, rid: rid(7) });
    const exAgain = await tap(exId, { total: 295, rid: rid(7) });
    const exNow = (await exampleAccount(env, TEST_USER)).orders.find((x) => x.id === exId);
    const exBad = await tap(exId, { qty: 3, total: 285, delivery: 9, rid: rid(8) });
    ok(exTap.status === 200 && exNow.total === 295 && exAgain.status === 200 && (await exAgain.json()).again === true
      && exBad.status === 400 && harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n === realEvents && L.requests.size === 0,
      "An acceptance order's amendment lands in its fixture alone, once under its id, and the same refusals hold there: " + JSON.stringify([exTap.status, exNow.total, exBad.status]));
    /* 06 Oct 2026: AND UNDER WHAT THEY PAID, through Counter Admin with the Desk's mirror seeded (the stub D1 above cannot be): the
       restate is taken and the answer names the refund the fold raises. The Desk's real-schema proof is in verify.mjs. */
    let DatabaseSync = null;
    try { ({ DatabaseSync } = await import("node:sqlite")); } catch (e) { /* older runtime */ }
    if (DatabaseSync) {
      const sq = new DatabaseSync(":memory:");
      for (const f of readdirSync(join(import.meta.dirname, "..", "migrations")).filter((x) => /^[0-9]+_.*[.]sql$/.test(x)).sort()) sq.exec(readFileSync(join(import.meta.dirname, "..", "migrations", f), "utf8"));
      const D1 = { prepare(sql) { const st = sq.prepare(sql);
        const mk = (a) => ({ async run() { const r = st.run(...a); return { meta: { changes: Number(r.changes || 0) } }; },
          async first() { const r = st.get(...a); return r === undefined ? null : r; }, async all() { return { results: st.all(...a) }; } });
        const self = mk([]); self.bind = (...a) => mk(a); return self; } };
      sq.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run("PRICING", JSON.stringify({ v: "v1", byProduct: { salt: { stockCost: 30, floors: { "3": { floor: 100 } }, inputs: null, sizes: [3] } } }));
      const seedRow = { rid: "s90", customer: "CX1-AB", product: "salt", date: at.slice(0, 10), qty: 3, total: 285, cash: 280 };
      sq.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)").run("sales", 0, "h0", JSON.stringify(seedRow));
      sq.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run("OPEN", JSON.stringify(withPending({ sales: [], state: { OPEN: { byKey: {}, position: {} } } }, seedRow).state.OPEN));
      sq.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run("roster", JSON.stringify(["CX1-AB"]));
      sq.prepare("INSERT INTO snapshot (one,v,stamped,at) VALUES (1,'v1',NULL,?)").run(new Date().toISOString());
      const seeded = { ...deskEnv, SALT_LEDGER: D1, SALT_WRITE_KEY: "k-fixture", REQUIRE_ACCESS: "0", ASSETS: { fetch: async () => new Response("", { status: 404 }) } };
      const keep = env.DESK_MAKER;
      env.DESK_MAKER = { fetch: (request) => desk.fetch(request, seeded, {}) };
      try {
        const idOver = make();
        harness.book.append(null, u, idOver, { kind: "mark", at, mark: { ledgerKey: PE.ovKey(seedRow) } }, harness.book.order(u, idOver));
        harness.book.append(null, u, idOver, { kind: "ledger", at, paid: 280, moved: 0 }, harness.book.order(u, idOver));
        const over = await tap(idOver, { total: 270, rid: rid(11) });
        const overBody = await over.json().catch(() => ({}));
        ok(over.status === 200 && overBody.ok && overBody.preapproval && overBody.preapproval.refund === 10,
          "Counter Admin amends a paid order to RM 270 under the RM 280 paid, and the answer names the RM 10 refund the fold raises: " + over.status + " " + JSON.stringify(overBody).slice(0, 240));
      } finally { env.DESK_MAKER = keep; }
    }
    void t0; void events;
  } finally { globalThis.fetch = originalFetch; }

  /* ---- the owner page's control, in the actual owner script ---- */
  const posts = [];
  let failNext = 0;
  const orderOf = (id, status, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 3, total: 285, status, mode: "collect", history: [], ...patch });
  const reviewBody = { ok: true, drafts: [], orders: [orderOf("20261006090001-ack", "acknowledged", { mode: "deliver", delivery: 5 }),
    orderOf("20261006090002-pla", "placed")] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => true;
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
    const card = (id) => [...doc.querySelectorAll("#makerReview article")].find((a) => a.querySelector("h3") && a.querySelector("h3").textContent === id);
    const button = (id, text) => card(id) && [...card(id).querySelectorAll("button")].find((b) => b.textContent === text);
    const field = (id, label) => {
      const wrap = card(id) && [...card(id).querySelectorAll("label")].find((l) => l.querySelector(".lbl") && l.querySelector(".lbl").textContent === label);
      return wrap && wrap.querySelector("input");
    };
    const settle = async (n) => { await until(() => posts.length >= n); await new Promise((resolve) => setTimeout(resolve, 40)); };
    doc.querySelector('[data-m="maker"]').click();
    await until(() => button("20261006090001-ack", "Amend order"));
    ok(!!field("20261006090001-ack", "Amend units") && !!field("20261006090001-ack", "Amend goods price (RM)") && !!field("20261006090001-ack", "Amend delivery (RM)")
      && !button("20261006090002-pla", "Amend order"),
      "An agreed order offers the size, the goods' price and the delivery to amend; an order not yet agreed does not.");
    button("20261006090001-ack", "Amend order").click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    ok(posts.length === 0, "Amend with no figure changed sends nothing.");
    failNext = 1;
    field("20261006090001-ack", "Amend delivery (RM)").value = "12";
    button("20261006090001-ack", "Amend order").click(); await settle(1);
    await until(() => button("20261006090001-ack", "Amend order"));
    field("20261006090001-ack", "Amend delivery (RM)").value = "12";
    button("20261006090001-ack", "Amend order").click(); await settle(2);
    ok(posts[0].path === "/all/maker/orders/20261006090001-ack/restate" && JSON.stringify(Object.keys(posts[0].body).sort()) === '["delivery","rid"]'
      && posts[0].body.delivery === 12 && /^[0-9a-f]{32}$/.test(posts[0].body.rid) && posts[1].body.rid === posts[0].body.rid,
      "Amend sends only the figure changed, and its retry after a failure carries the same request id: " + JSON.stringify(posts));
    await until(() => button("20261006090001-ack", "Amend order"));
    field("20261006090001-ack", "Amend units").value = "4";
    field("20261006090001-ack", "Amend goods price (RM)").value = "380";
    button("20261006090001-ack", "Amend order").click(); await settle(3);
    ok(posts[2].body.qty === 4 && posts[2].body.total === 380 && posts[2].body.delivery === undefined && posts[2].body.rid !== posts[0].body.rid,
      "A new size is sent with its goods' price, under a request id of its own: " + JSON.stringify(posts[2]));
    await until(() => button("20261006090001-ack", "Amend order") && field("20261006090001-ack", "Amend units").value === "3");
    field("20261006090001-ack", "Amend units").value = "5";
    button("20261006090001-ack", "Amend order").click(); await settle(4);
    ok(posts[3].body.qty === 5 && posts[3].body.total === 285, "A size changed alone is sent with the goods' price in the box, which the Desk then holds to the floor: " + JSON.stringify(posts[3]));    const tall = [...card("20261006090001-ack").querySelectorAll("[data-amend-field]")];
    ok(tall.length === 3, "The three amend fields are drawn.");
  } finally { browser.window.close(); }
}
