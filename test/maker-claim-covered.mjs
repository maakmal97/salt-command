/* Counter Admin's Received, on the book already, on an order's own claim: the Desk's native road, a request id kept, and the owner page naming it. */
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { makerOrderFault } from "../src/maker.js";
import { orderBook } from "./orderbook-harness.mjs";
import * as O from "../stmt/orders.js";
import { landingPage } from "../stmt/page.js";
import { Store, ledger } from "./maker-order-controls.mjs";

export async function run({ ok }) {
  const rid = "covered-claim-rid-0001";
  const claim = "2026-10-04T08:15:00.000Z";
  const fault = (body) => makerOrderFault("received", body);
  ok(fault({ amount: 70, claim, covered: true, rid }) === ""
    && /named claim/.test(fault({ amount: 70, covered: true, rid })) && /named claim/.test(fault({ amount: 70, claim, covered: false, rid }))
    && /boolean/.test(fault({ amount: 70, claim, covered: "yes", rid }))
    && /Unsupported/.test(makerOrderFault("cash", { amount: 70, claim, covered: true, rid })),
    "Received, on the book already, is true, names its claim and belongs to Received alone");

  /* the real roads: a claim above what the order owes, money he recorded another way carrying it */
  const store = new Store(), queue = new Store(), team = "maker-covered-fixture", audience = "maker-covered-audience", kid = "maker-covered-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "covered-local-master",
    STMT_DESK_KEY: "covered-desk-test-capability-00001", COUNTER_MAKER_KEY: "covered-maker-test-capability-001", ORDER_STORE: "object" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const L = ledger();
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: L.db, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  env.DESK_MAKER = { fetch: (request) => desk.fetch(request, deskEnv, {}) };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected covered fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email: "maakmal97@icloud.com",
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwt = header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
    const owner = (path, body) => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method: "POST", headers: { "cf-access-jwt-assertion": jwt, "content-type": "application/json" }, body: JSON.stringify(body) }), env);
    const u = "abcd-efgh", at = new Date().toISOString(), digest = "covered-list";
    await queue.put("stmt-users", JSON.stringify({ [u]: "CX1-AB" }));
    const order = O.decidePlace(u, { product: "salt", qty: 3, total: 285, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest,
      rid: "covered-fixture-1-pad-pad-pad" }, [], at, digest).ev.order;
    order.id = "20261004080001-c1";
    harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
    harness.book.run("desk", { u, id: order.id, body: { status: "acknowledged", mode: "collect" } });
    harness.book.append(null, u, order.id, { kind: "mark", at, mark: { ledgerKey: "CX1-AB|" + at.slice(0, 10) + "|salt|" + order.id } }, harness.book.order(u, order.id));
    const route = "/all/maker/orders/" + order.id + "/received";
    const owes = await owner(route, { amount: 285, claim: at, covered: true, rid });
    const body = await owes.json();
    ok(owes.status === 409 && /nothing they recorded is waiting|not waiting any more|still owes/.test(body.error) && !L.requests.has("order:" + rid),
      "Counter Admin's covered Received reaches the Desk's own native road, which refuses a claim that is not waiting, and keeps nothing under its id: " + owes.status + " " + body.error);
    const bare = await owner(route, { amount: 285, covered: true, rid });
    ok(bare.status === 400, "covered without a named claim is refused at the Counter: " + bare.status);
  } finally { globalThis.fetch = originalFetch; }

  /* the owner page */
  const posts = [];
  const claimAt = "2026-10-04T08:15:00.000Z", claim2 = "2026-10-04T09:15:00.000Z";
  const mk = (id, paid, amount, at) => ({ id, u: "abcd-efgh", product: "salt", qty: 1, total: 70, delivery: 0, paid, status: "ready", mode: "collect", history: [],
    payments: [{ at, amount, claim: "waiting" }] });
  const reviewBody = { ok: true, drafts: [], orders: [mk("20261004090001-cov", 70, 70, claimAt), mk("20261004090002-own", 0, 70, claim2)] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => true;
      window.fetch = async (path, init) => {
        const where = String(path);
        if (init && init.method === "POST" && where.startsWith("/all/maker/orders/")) { posts.push({ path: where, body: JSON.parse(init.body) }); return Response.json({ ok: true }); }
        if (where === "/all/maker/review") return Response.json(reviewBody);
        if (where === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (where === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (where === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (where === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog: { parties: [], loans: [], rewards: [], correctionFields: [], rows: [] } });
        if (where === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, accounts: [] });
      };
    }
  });
  try {
    const doc = browser.window.document;
    const until = async (p) => { for (let i = 0; i < 200 && !p(); i++) await new Promise((r) => setTimeout(r, 10)); return !!p(); };
    const card = (id) => cardOf(doc, id);
    const button = (id, test) => card(id) && [...card(id).querySelectorAll("button")].find((b) => test(b.textContent));
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => card("20261004090002-own") && button("20261004090002-own", (t) => t.startsWith("Receive claimed")));
    ok(!!button("20261004090001-cov", (t) => t.startsWith("Received, on the book already")) && !button("20261004090001-cov", (t) => t.startsWith("Receive claimed"))
      && !!button("20261004090002-own", (t) => t.startsWith("Receive claimed")) && !button("20261004090002-own", (t) => t.startsWith("Received, on the book already")),
      "A claim above what the order still owes offers Received, on the book already, in place of Receive claimed, and a claim the order owes offers Receive claimed");
    /* 12 Oct 2026 (Phase 2b, his decision 4 of 11 Oct): each asks on the page's Sheet, restating who and how much, and one action sends it */
    const sheet = () => doc.getElementById("ynSheet");
    const go = () => doc.getElementById("ynGo");
    button("20261004090001-cov", (t) => t.startsWith("Received, on the book already")).click();
    await new Promise((r) => setTimeout(r, 50));
    ok(!!sheet() && posts.length === 0 && /Received, on the book already RM 70\.00/.test(sheet().textContent) && /CX1-AB|abcd-efgh/.test(sheet().textContent) && /Nothing more is booked/.test(sheet().textContent),
      "Received, on the book already, asks on the page's Sheet, naming the amount and who, and sends nothing as it opens: " + (sheet() && sheet().textContent));
    go().click();
    await until(() => posts.length >= 1); await new Promise((r) => setTimeout(r, 150));
    await until(() => button("20261004090002-own", (t) => t.startsWith("Receive claimed")));
    button("20261004090002-own", (t) => t.startsWith("Receive claimed")).click();
    await new Promise((r) => setTimeout(r, 50));
    ok(!!sheet() && posts.length === 1 && /Received RM 70\.00 from/.test(sheet().querySelector(".salt-sheet__title").textContent),
      "Receive claimed asks on the Sheet too, and sends nothing as it opens: " + (sheet() && sheet().textContent));
    go().click();
    await until(() => posts.length >= 2);
    ok(posts[0].path.endsWith("/20261004090001-cov/received") && posts[0].body.covered === true && posts[0].body.claim === claimAt && posts[0].body.amount === 70
      && /^[0-9a-f]{32}$/.test(posts[0].body.rid) && !Object.hasOwn(posts[1].body, "covered") && posts[1].body.claim === claim2,
      "Received, on the book already, sends covered with the claim and its own request id; the plain Receive sends no covered: " + JSON.stringify(posts));
  } finally { browser.window.close(); }
}
