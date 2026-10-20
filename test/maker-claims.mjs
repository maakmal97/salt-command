import { webcrypto } from "node:crypto";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { exampleAccount, exampleClaim, withExamples, TEST_USER, FIX_VERSION, fixKey } from "../stmt/testfix.js";
import { orderBook } from "./orderbook-harness.mjs";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { slipSeal } from "../tools/seed-vault.mjs";

class Store {
  values = new Map();
  async get(key, type) {
    const value = this.values.get(key) ?? null;
    return value === null || type !== "json" ? value : JSON.parse(value);
  }
  async put(key, value) { this.values.set(key, value); }
  async list() { return { keys: [], list_complete: true }; }
}

export async function run({ ok }) {
  const store = new Store(), queue = new Store(), calls = [], u = TEST_USER;
  const env = { STMT: store, ORDER_STORE: "object", COUNTER_MAKER_KEY: "maker-claims-local-capability-0001" };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const deskEnv = { SALT_QUEUE: queue, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY,
    SALT_LEDGER: { prepare() { throw new Error("Acceptance touched real D1."); } } };
  env.DESK_MAKER = { fetch(request) {
    calls.push(new URL(request.url).pathname);
    return desk.fetch(request, deskEnv, { waitUntil() { throw new Error("Acceptance queued real work."); } });
  } };
  const claim = { id: "a20261003070000-ex1", u, kind: "account", at: "2026-10-03T07:00:00.000Z",
    amount: 30, method: "transfer", account: "maybiz", state: "waiting", history: [] };
  const sale = { rid: "x1", customer: "TX0-FIX", date: "2026-10-01", qty: 1,
    total: 40, cash: 0, deliveredQty: 1, product: "salt" };
  const initial = { v: FIX_VERSION, salt: "invented-wrap", at: "2026-10-03T07:00:00.000Z",
    env: { iv: "invented-iv" }, claims: [claim], orders: [], makerOrders: [], makerBook: { sales: [sale] } };
  await store.put("u:" + u, JSON.stringify({ test: true, wrap: { salt: initial.salt } }));
  await store.put(fixKey(u), JSON.stringify(initial));
  const owner = async (path, body, identity = { email: "maakmal97@icloud.com" }) =>
    handleMaker(new Request("https://counter.fixture.test" + path, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    }), env, path, identity);
  const route = "/all/maker/claims/" + u + "/" + claim.id;
  const read = async () => (await (await owner(route + "/preview", {})).json());
  const preview = await read();
  ok(preview.ok && preview.rows.length === 1 && preview.rows[0].rm === 30 && preview.rows[0].owed === 40
    && preview.left === 0 && typeof preview.hash === "string",
    "Actual Maker/Desk bridge previews an invented delivered row with shared allocation and no real D1: " + JSON.stringify(preview));
  const denied = await owner(route + "/preview", {}, null);
  ok(denied.status === 403, "Claim controls reject an unverified owner identity.");
  const privateDenied = await desk.fetch(new Request("https://desk/_internal/maker/vault/key"), deskEnv, {});
  ok(privateDenied.status === 404, "The sealed slip-key bridge requires its exact private capability.");
  const received = { hash: preview.hash, rid: "acceptance-claim-received-01" };
  const first = await owner(route + "/received", received);
  const again = await owner(route + "/received", received);
  const changed = await owner(route + "/received", { ...received, covered: true });
  const state = await exampleAccount(env, u), customer = await withExamples(env, u, [], []);
  ok(first.status === 200 && again.status === 200 && changed.status === 409
    && state.account.sales[0].cash === 30 && customer.claims[0].state === "received",
    "Lost-response retry consumes one immutable fixture claim receipt; changed same-id content refuses.");
  ok(String(customer.claims[0].answered || "") > initial.at,
    "The customer's example claim carries its Received moment after the sealed live document, so To pay now nets it once: "
    + JSON.stringify(customer.claims[0].answered));
  harness.restart();
  const restarted = await exampleAccount(env, u);
  ok(restarted.account.sales[0].cash === 30 && restarted.account.claims[0].state === "received",
    "Example claim money and verdict survive actual SQLite authority restart.");
  const born = await exampleClaim(env, u, { amount: 8, method: "transfer", account: "maybank", rid: "customer-example-claim-01" });
  const duplicate = await exampleClaim(env, u, { amount: 8, method: "transfer", account: "maybank", rid: "customer-example-claim-01" });
  ok(born.claim?.id === duplicate.claim?.id
    && born.claim && (await withExamples(env, u, [], [])).claims.some((c) => c.id === born.claim.id),
    "The incumbent customer claim writer and reader share isolated serialized account state.");
  const next = { ...initial, at: "2026-10-03T07:01:00.000Z",
    claims: [claim, { ...claim, id: "a20261003070000-ex2" }, { ...claim, id: "a20261003070000-ex3", amount: 5 }] };
  await store.put(fixKey(u), JSON.stringify(next));
  const a = await read();
  const bRoute = "/all/maker/claims/" + u + "/a20261003070000-ex2";
  const cRoute = "/all/maker/claims/" + u + "/a20261003070000-ex3";
  const b = await (await owner(bRoute + "/preview", {})).json();
  const c = await (await owner(cRoute + "/preview", {})).json();
  const competing = await Promise.all([
    owner(route + "/received", { hash: a.hash, rid: "competing-claim-received-01" }),
    owner(bRoute + "/received", { hash: b.hash, rid: "competing-claim-received-02" })
  ]);
  ok(competing.map((r) => r.status).sort().join(",") === "200,409"
    && (await exampleAccount(env, u)).account.sales[0].cash === 30,
    "Two example claims competing for one invented balance atomically refuse the stale preview.");
  const stale = await owner(cRoute + "/received", { hash: c.hash, rid: "stale-claim-received-01" });
  ok(c.ok && c.left === 0 && stale.status === 409 && (await stale.json()).differs === true
    && (await exampleAccount(env, u)).account.sales[0].cash === 30,
    "A preview taken before another payment landed is refused as changed and books nothing.");
  const loser = competing[0].status === 409 ? route : bRoute;
  const refreshed = await (await owner(loser + "/preview", {})).json();
  const over = await owner(loser + "/received", { hash: refreshed.hash, rid: "over-claim-received-01" });
  ok(refreshed.left === 20 && over.status === 409, "An example overclaim cannot book more than its rows still owe: "
    + JSON.stringify({ left: refreshed.left, rows: refreshed.rows, status: over.status, error: refreshed.error }));
  const covered = await owner(loser + "/received", { hash: refreshed.hash, covered: true, rid: "covered-claim-received-01" });
  ok(covered.status === 200 && (await exampleAccount(env, u)).account.sales[0].cash === 30,
    "Received on the book already marks only the example claim and books no second money.");
  const real = await desk.fetch(new Request("https://desk/_internal/maker/claims/" + u + "/" + claim.id + "/received", {
    method: "POST", headers: { "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" },
    body: JSON.stringify(received)
  }), deskEnv, {});
  ok(real.status === 409, "The actual real-ledger bridge explicitly refuses test-account claim decisions.");
  const count = (table) => harness.db.prepare("SELECT count(*) AS n FROM " + table).get().n;
  ok(["ord", "acl", "ev", "behind", "thr"].every((table) => count(table) === 0)
    && queue.values.size === 0 && harness.state.alarmAt() === null,
    "Acceptance decisions create no real claims/events/order projections/queue/alarm effects.");
  const old = await exampleAccount(env, u);
  await store.put(fixKey(u), JSON.stringify({ ...next, at: "2026-10-03T07:02:00.000Z" }));
  await exampleAccount(env, u);
  const delayed = await env.ORDERBOOK.get(env.ORDERBOOK.idFromName("orders")).fetch("https://book/fixture-account", {
    method: "POST", body: JSON.stringify({ u, generation: old.generation, actor: "read", seed: old.account })
  });
  ok(!(await delayed.json()).ok && (await exampleAccount(env, u)).account.sales[0].cash === 0,
    "A new fixture publication resets isolated examples and refuses delayed older-generation state.");
  const keys = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const sealed = { v: 1, salt: "invented-salt", iv: "invented-iv", ct: "invented-ciphertext" };
  await queue.put("vault-key", JSON.stringify({ vault: sealed, pub: await webcrypto.subtle.exportKey("jwk", keys.publicKey) }));
  const request = new Request("https://counter/all/maker/vault/key");
  const keyRead = await handleMaker(request, env, "/all/maker/vault/key", { email: "maakmal97@icloud.com" });
  const keyWrite = await owner("/all/maker/vault/key", {});
  ok(keyRead.status === 200 && JSON.stringify((await keyRead.json()).vault) === JSON.stringify(sealed)
    && keyWrite.status === 405 && calls.at(-1) === "/_internal/maker/vault/key",
    "Owner slip-key read returns only the existing envelope through exact capability; no write route exists.");
  const pass = "invented-local-pass", privateJwk = await webcrypto.subtle.exportKey("jwk", keys.privateKey);
  const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const aes = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ciphertext = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(privateJwk)));
  const b64 = (value) => Buffer.from(value).toString("base64");
  const envelope = { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ciphertext) };
  const picture = await slipSeal(await webcrypto.subtle.exportKey("jwk", keys.publicKey), new Uint8Array([255, 216, 255, 217]));
  let visible = true, releaseKey, keyWait = false, created = 0, revoked = 0;
  let slipWait = false, releaseSlip = null, decryptWait = false, releaseDecrypt = null, slipMode = "ok";
  const imports = [], posts = [], fetched = { key: 0, slip: 0 }, asked = [];
  let derives = 0;
  const subtle = new Proxy(webcrypto.subtle, { get(target, name) {
    if (name === "deriveBits") return async (...args) => { derives++; return target.deriveBits(...args); };
    if (name === "decrypt") return async (...args) => {
      if (decryptWait) { decryptWait = false; await new Promise((resolve) => { releaseDecrypt = resolve; }); }
      return target.decrypt(...args);
    };
    if (name === "importKey") return async (...args) => {
      if (args[0] === "jwk" && args[1]?.d) imports.push({ extractable: args[3], usages: args[4] });
      return target.importKey(...args);
    };
    const value = target[name];
    return typeof value === "function" ? value.bind(target) : value;
  } });
  const browserCrypto = { subtle, getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID() };
  const ids = [claim.id, "a20261003070000-ex2"];
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: browserCrypto });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => { asked.push("confirm"); return true; };
      Object.defineProperty(window.document, "hidden", { get: () => !visible });
      window.URL.createObjectURL = () => { created++; return "blob:fixture-" + created; };
      window.URL.revokeObjectURL = () => { revoked++; };
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/claims/")) {
          posts.push({ route: String(path), body: JSON.parse(init.body) });
          if (/[/]preview$/.test(String(path))) return Response.json({ ok: true, hash: "h".repeat(64), rows: [{ date: "2026-10-01", rm: 30, owed: 40, rid: "x1" }], left: 0 });
          return Response.json({ ok: true });
        }
        if (path === "/all/maker/claims") return Response.json({ ok: true, claims: [{ ...claim, slip: "0".repeat(32), test: true },
          { ...claim, id: ids[1], slip: "1".repeat(32), test: true }] });
        if (path === "/all/maker/vault/key") {
          fetched.key++;
          if (keyWait) await new Promise((resolve) => { releaseKey = resolve; });
          return Response.json({ ok: true, vault: envelope });
        }
        if (String(path).startsWith("/all/maker/slips/")) {
          fetched.slip++;
          if (slipWait) { slipWait = false; await new Promise((resolve) => { releaseSlip = resolve; }); }
          if (slipMode === "missing") return Response.json({ ok: false, error: "no such slip" }, { status: 404 });
          if (slipMode === "version") return Response.json({ ok: true, slip: { ...picture, v: 2 } });
          if (slipMode === "tampered") return Response.json({ ok: true, slip: { ...picture, ct: Buffer.from("not a sealed picture").toString("base64") } });
          return Response.json({ ok: true, slip: picture });
        }
        if (path === "/all/maker/review") return Response.json({ ok: true, orders: [], drafts: [] });
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
      for (let i = 0; i < 150 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      return !!predicate();
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
    /* a claim is a row, and its card stands under it once the row is tapped (Phase 2b); only one is open at a time */
    const rowOf = (n) => doc.querySelector('#makerClaims [data-act="claim.open"][data-key="' + u + ":" + ids[n] + '"]');
    const card = (n) => doc.querySelector('#makerClaims [data-maker-card="claim:' + u + ":" + ids[n] + '"]');
    const inCard = (act) => doc.querySelector('#makerClaims [data-act="' + act + '"]');
    /* the slip is sealed while the page is locked (Phase 4b): the card says Locked and offers the one Unlock, which opens the Sheet; a password typed there and sent opens it */
    const unlockBtn = () => inCard("vault.unlock");
    const unlockWith = (word) => { unlockBtn().click(); doc.getElementById("vaultPass").value = word; doc.getElementById("vaultGo").click(); };
    const thumb = () => inCard("claim.slip");
    const said = () => doc.querySelector("#makerClaims p.msg")?.textContent || "";
    const lock = () => { visible = false; doc.dispatchEvent(new window.Event("visibilitychange")); visible = true; };
    doc.querySelector('[data-act="nav.orders"]').click();
    doc.querySelector('[data-act="part.orders.payments"]').click();
    await until(() => rowOf(0) && rowOf(1));
    ok(!!rowOf(0) && !!rowOf(1) && [...doc.querySelectorAll("#makerClaims [data-act]")].every((e) => e.getAttribute("data-act") === "claim.open")
      && posts.length === 0 && fetched.key === 0 && fetched.slip === 0,
      "Waiting claims are a row each, with no control and no read behind it: nothing is previewed and no slip is asked for until a claim is opened");
    rowOf(0).click();
    await until(() => inCard("claim.received") && !inCard("claim.received").disabled);
    ok(!!card(0) && !card(1) && !!inCard("claim.received-booked") && !!inCard("claim.not-found") && !inCard("claim.preview")
      && !!unlockBtn() && !doc.querySelector("#makerClaims input[type=password]") && /Locked/.test(card(0).textContent) && fetched.key === 0 && fetched.slip === 0
      && posts.filter((p) => /[/]preview$/.test(p.route)).length === 1,
      "Opening a claim reads its rows once and offers Received and Not found with no Preview rows button; its slip says Locked, offers the one Unlock and fetches nothing it cannot open");
    keyWait = true; unlockWith(pass);
    await until(() => releaseKey);
    lock();
    releaseKey();
    await settle();
    ok(created === 0 && imports.length === 0 && !doc.querySelector("[data-maker-slip]") && doc.getElementById("vaultPass").value === "" && doc.getElementById("vaultSheet").hidden
      && !!unlockBtn() && /Locked/.test(card(0).textContent),
      "Held key-fetch completion after visibility lock cannot import/paint an old slip unlock.");
    keyWait = false; unlockWith(pass);
    await until(() => thumb());
    ok(created === 1 && !!doc.querySelector("[data-maker-slip]") && thumb().tagName === "BUTTON" && /^blob:/.test(thumb().querySelector("img").src),
      "Actual owner device opens the unchanged ECDH/HKDF sealed JPEG locally and draws it as a thumbnail that is a control.");
    ok(imports.length === 1 && imports[0].extractable === false && JSON.stringify(imports[0].usages) === '["deriveBits"]',
      "The unlocked slip key is imported non-extractable for deriveBits only: " + JSON.stringify(imports));
    const small = thumb().getAttribute("aria-expanded") === "false" && !card(0).querySelector(".maker-slipbox").classList.contains("open");
    thumb().click();
    const large = thumb().getAttribute("aria-expanded") === "true" && card(0).querySelector(".maker-slipbox").classList.contains("open");
    thumb().click();
    ok(small && large && thumb().getAttribute("aria-expanded") === "false" && created === 1,
      "Tapping the thumbnail opens the full slip in place and the next tap shrinks it, with no second picture made: " + JSON.stringify([small, large]));
    inCard("vault.lock").click();
    ok(revoked === 1 && !doc.querySelector("[data-maker-slip]") && !!unlockBtn() && /Locked/.test(card(0).textContent),
      "Lock revokes the actual picture URL, removes its rendered image, and the card says Locked again.");
    slipWait = true; unlockWith(pass);
    await until(() => releaseSlip);
    lock();
    await settle();
    unlockWith(pass);
    await until(() => doc.querySelectorAll("[data-maker-slip]").length === 1);
    const derivedBefore = derives;
    releaseSlip(); await settle();
    ok(created === 2 && doc.querySelectorAll("[data-maker-slip]").length === 1 && derives === derivedBefore,
      "A slip read held across lock and a new unlock cannot use the key or paint under the newer session: "
      + created + "/" + (derives - derivedBefore));
    const drawn = created, shut = revoked;
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => created === drawn + 1 && !!thumb());
    ok(revoked === shut + 1 && doc.querySelectorAll("[data-maker-slip]").length === 1 && thumb().querySelector("img").src === "blob:fixture-" + created,
      "Redrawing the claims revokes the picture rendered, and the card still open draws its slip again from the key the page holds: " + revoked);
    const closedAt = revoked;
    rowOf(0).click();
    ok(revoked === closedAt + 1 && !card(0) && !doc.querySelector("[data-maker-slip]"),
      "Closing the card lets its picture go: its URL is revoked and no image is left on the page");
    decryptWait = true; rowOf(0).click();
    await until(() => releaseDecrypt);
    const heldAt = created;
    lock();
    releaseDecrypt(); await settle();
    ok(created === heldAt && !doc.querySelector("[data-maker-slip]") && !!unlockBtn(),
      "A slip decryption held across lock cannot create or paint a picture URL: " + created);
    unlockWith(pass);
    await until(() => thumb());
    const refusal = async (mode) => {
      slipMode = mode; const before = created;
      rowOf(0).click(); rowOf(0).click();
      await until(() => /could not be opened/.test(said()));
      const text = said();
      return created === before && !doc.querySelector("[data-maker-slip]") && !!inCard("claim.view-slip") ? text : "painted";
    };
    const missing = await refusal("missing"), version = await refusal("version"), tampered = await refusal("tampered");
    ok(/no longer held/.test(missing) && /cannot be read/.test(version) && /could not be opened/.test(tampered),
      "Missing or expired, wrong-version and tampered slips are refused on the device without a picture: "
      + JSON.stringify([missing, version, tampered]));
    /* 11 Oct 2026, the five places: the unlocked slip key stays while he moves between the parts of Orders, the picture is let go when Payments is left
       (12 Oct 2026: the claim opened is shut with it, and opened again it draws its slip from the key with no passphrase). Since Phase 4b the unlock is the
       page's, not Orders': it stays when Orders is left too, and goes only with the lock (a page hidden, the sign-in ended, a lapse, Lock) */
    slipMode = "ok";
    const keysAtUnlock = fetched.key;
    rowOf(0).click(); rowOf(0).click();
    await until(() => thumb());
    const unlocked = !!thumb();
    doc.querySelector('[data-act="part.orders.confirmed"]').click();
    const letGo = !doc.querySelector("[data-maker-slip]");
    doc.querySelector('[data-act="part.orders.payments"]').click();
    const shutOnReturn = !card(0) && !!rowOf(0);
    rowOf(0).click();
    const keptKey = await until(() => thumb()) && !unlockBtn();
    ok(unlocked && letGo && shutOnReturn && keptKey,
      "An unlocked slip key survives a move between the parts of Orders, the picture is let go and the card shut on leaving Payments, and the next claim opened draws its slip with no passphrase: "
      + JSON.stringify([unlocked, letGo, shutOnReturn, keptKey]));
    doc.querySelector('[data-act="nav.customers"]').click();
    doc.querySelector('[data-act="nav.orders"]').click();
    doc.querySelector('[data-act="part.orders.payments"]').click();
    await until(() => rowOf(0));
    const slips = fetched.slip;
    rowOf(0).click();
    await until(() => !!card(0));
    await settle();
    const keptAcrossPlaces = await until(() => thumb()) && !unlockBtn() && !/Locked/.test(card(0).textContent) && fetched.slip === slips + 1;
    ok(keptAcrossPlaces && fetched.key === keysAtUnlock,
      "and it is kept when Orders is left: the next claim opened draws its slip with no unlock asked and the key not fetched again: " + JSON.stringify([keptAcrossPlaces, fetched.key, keysAtUnlock]));
    ok(asked.length === 0, "and no native confirm was asked on the way: " + JSON.stringify(asked));
  } catch (e) { ok(false, "the page test stopped on an error: " + (e && e.message)); } finally { browser.window.close(); }
  harness.db.close();
  await concurrentFixture(ok);
  await deskFailures(ok);
  await realBridge(ok);
}

/* Every Desk call the claim and slip routes make: a Desk refusal keeps its status, an outage answers 503, and a Desk
   answer that says ok but lacks what the route reads is refused 502. None ever comes back as 200. */
async function deskFailures(ok) {
  const store = new Store(), u = TEST_USER, real = "abcd-efgh", claimId = "a20261003070000-ex1";
  const env = { STMT: store, ORDER_STORE: "object", COUNTER_MAKER_KEY: "maker-claims-local-capability-0001" };
  const book = orderBook(env); env.ORDERBOOK = book.ns;
  const claim = { id: claimId, u, kind: "account", at: "2026-10-03T07:00:00.000Z",
    amount: 30, method: "transfer", account: "maybiz", state: "waiting", history: [] };
  await store.put("u:" + u, JSON.stringify({ test: true, wrap: { salt: "failure-wrap" } }));
  await store.put(fixKey(u), JSON.stringify({ v: FIX_VERSION, salt: "failure-wrap", at: claim.at, env: { iv: "iv" },
    claims: [claim], orders: [], makerOrders: [], makerBook: { sales: [] } }));
  let answer = null;
  env.DESK_MAKER = { async fetch() {
    if (answer === "outage") throw new Error("Desk unreachable");
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
  } };
  const call = (path, method, body) => handleMaker(new Request("https://counter.fixture.test" + path, {
    method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})
  }), env, path, { email: "maakmal97@icloud.com" });
  const routes = [
    ["/all/maker/claims", "GET"],
    ["/all/maker/vault/key", "GET"],
    ["/all/maker/slips/" + real + "/" + "1".repeat(32), "GET"],
    ["/all/maker/claims/" + real + "/" + claimId + "/preview", "POST", {}],
    ["/all/maker/claims/" + u + "/" + claimId + "/preview", "POST", {}],
    ["/all/maker/claims/" + u + "/" + claimId + "/received", "POST", { hash: "h", rid: "failure-received-0001" }],
    ["/all/maker/claims/" + u + "/" + claimId + "/notfound", "POST", { amount: 30, rid: "failure-notfound-0001" }]
  ];
  const seen = [];
  for (const [kind, expected] of [[{ status: 409, body: { ok: false, error: "that claim is answered already" } }, 409],
    [{ status: 200, body: { ok: false, error: "refused in a 200" } }, 502], ["outage", 503]]) {
    answer = kind;
    for (const [path, method, body] of routes) {
      const response = await call(path, method, body), read = await response.json();
      seen.push(response.status === expected && read.ok === false ? "ok" : path + ":" + response.status);
    }
  }
  ok(seen.every((s) => s === "ok"),
    "Every claim and slip route answers a Desk refusal with its status and an outage with 503, never 200: "
    + JSON.stringify(seen.filter((s) => s !== "ok")));
  answer = { status: 200, body: { ok: true } };
  const malformed = [];
  for (const [path, method, body] of [routes[0], routes[4], routes[5], routes[6]]) {
    const response = await call(path, method, body);
    malformed.push(response.status);
  }
  const fixture = await exampleAccount(env, u);
  ok(malformed.every((s) => s === 502) && fixture.account.claims[0].state === "waiting" && fixture.account.revision === 0,
    "A Desk answer that says ok but lacks the claim list or preview is refused 502 and decides no example claim: "
    + JSON.stringify(malformed));
  book.db.close();
}

/* Every bound example writer goes through the one serialized fixture authority: concurrent order, replacement and
   claim writes on one test account all survive, and each retry is answered once. */
async function concurrentFixture(ok) {
  const { build } = await import("../tools/testfix.mjs");
  const { exampleMove, exampleReplace } = await import("../stmt/testfix.js");
  const store = new Store(), u = TEST_USER, fix = build(new Date(), "open", u);
  /* the group orders' two pooled orders are left out: this check drives the plain orders, with room for one more */
  fix.orders = fix.orders.filter((o) => !o.pool);
  /* and the negotiation cases (05 Oct 2026), another feature's, which would use up the open-order limit this replacement needs */
  fix.orders = fix.orders.filter((o) => !o.price);
  /* and the delivery window cases (10 Oct 2026), for the same room */
  fix.orders = fix.orders.filter((o) => !o.slot);
  /* and the order paid before anything moved (11 Oct 2026, Phase 7d part 1), the case Cancel's Sheet names a refund on, for the same room */
  fix.orders = fix.orders.filter((o) => !/-ex47$/.test(o.id));
  /* and the order ready at one collection point then moved to another (18 Oct 2026, Counter Batch A), open too, for the same room */
  fix.orders = fix.orders.filter((o) => !/-ex26$/.test(o.id));
  const open = fix.orders.filter((o) => ["placed", "acknowledged", "ready"].includes(o.status));
  /* 20 Oct 2026: and the reward's own case (ex48, an order that takes them over, FIX_VERSION 13), so room for one more is left as before */
  fix.orders = fix.orders.filter((o) => o !== open.at(-1) && o.rwd !== "cross");
  fix.salt = "concurrent-fixture"; fix.makerOrders = fix.orders; fix.makerBook = { sales: [] };
  await store.put("u:" + u, JSON.stringify({ test: true, wrap: { salt: fix.salt }, prices: { digest: fix.prices.digest } }));
  await store.put(fixKey(u), JSON.stringify(fix));
  const env = { STMT: store, ORDER_STORE: "object" };
  const roadReads = [], get = store.get.bind(store);
  store.get = (key, ...rest) => { if (key === "orderbook:road") roadReads.push(key); return get(key, ...rest); };
  await store.put("orderbook:road", new Date(Date.now() + 60000).toISOString());
  const book = orderBook(env); env.ORDERBOOK = book.ns;
  const placed = fix.orders.filter((o) => o.status === "placed" && !(+o.moved > 0));
  const replaced = placed.find((o) => o.sheet && o.product === "salt"), cancelled = placed.find((o) => o !== replaced);
  const change = { product: "salt", qty: replaced.qty, mode: "collect", place: "", forFriend: false, week: "",
    digest: fix.prices.digest, rid: "concurrent-replace-0001" };
  const moves = () => [
    exampleMove(env, u, cancelled.id, "cancel", { rid: "concurrent-cancel-0001" }),
    exampleReplace(env, u, replaced.id, change),
    exampleClaim(env, u, { amount: 12, method: "transfer", account: "maybank", rid: "concurrent-claim-0001" })];
  const first = await Promise.all(moves()), again = await Promise.all(moves());
  const state = (await exampleAccount(env, u)).account, before = await store.get(fixKey(u));
  ok(first.every((r) => !r.error) && again.every((r, i) => (r.order || r.claim).id === (first[i].order || first[i].claim).id)
    && state.orders.find((o) => o.id === cancelled.id).status === "cancelled"
    && state.orders.find((o) => o.id === replaced.id).status === "cancelled"
    && state.orders.filter((o) => o.replaces === replaced.id).length === 1
    && state.claims.filter((c) => c.amount === 12).length === 1 && before === JSON.stringify(fix),
    "Concurrent example cancel, replacement and claim writes all survive once in the serialized authority, never the whole fixture: "
    + JSON.stringify(first.map((r) => r.error || "ok")));
  ok(roadReads.length === 0, "Acceptance-account moves never consult the KV road or move the real order book in: " + roadReads.length);
  book.db.close();
}

/* A real (non-test) account claim decided from Salt Admin through the actual Desk bridge: native claimPreview,
   claimReceived with its preapprovals and afterApproval, and notFoundClaim's booked refusal, over the real D1 schema. */
async function realBridge(ok) {
  const { DatabaseSync } = await import("node:sqlite");
  const { readdirSync, readFileSync } = await import("node:fs");
  const stmtWorker = (await import("../stmt/worker.js")).default;
  const O = await import("../stmt/orders.js");
  const migrations = new URL("../migrations/", import.meta.url);
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort())
    db.exec(readFileSync(new URL(f, migrations), "utf8"));
  const D1 = { prepare(sql) {
    const st = db.prepare(sql);
    const mk = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; },
      first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
    const self = mk([]); self.bind = (...a) => mk(a); return self;
  } };
  const C = "CX1-AB", U = "abcd-efgh";
  let seq = 0;
  const putSale = (row) => db.prepare("INSERT INTO entry (collection,seq,hash,doc) VALUES (?,?,?,?)")
    .run("sales", seq++, "h" + seq, JSON.stringify(row));
  putSale({ rid: "s20", customer: C, date: "2026-09-02", qty: 1, total: 50, cash: 0, deliveredQty: 1, deliveredOn: "2026-09-02" });
  putSale({ rid: "s21", customer: C, date: "2026-09-10", qty: 1, total: 60, cash: 0, deliveredQty: 1, deliveredOn: "2026-09-10" });
  const setState = (k, doc) => db.prepare("INSERT OR REPLACE INTO state (key,doc) VALUES (?,?)").run(k, JSON.stringify(doc));
  setState("roster", [C]); setState("OPEN", { byKey: {}, position: {} });
  setState("PRICING", { v: "v900", byProduct: { salt: { stockCost: 30, floors: { "1": { floor: 40 } }, inputs: null, sizes: [1] } } });
  db.prepare("INSERT INTO snapshot (one,v,stamped) VALUES (1,'v900',NULL)").run();
  const site = orderBook({}), skv = new Store(), dkv = new Store();
  const senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDERBOOK: site.ns, ORDER_STORE: "object" };
  let failTell = false;
  await dkv.put("stmt-users", JSON.stringify({ [U]: C }));
  const denv = { SALT_QUEUE: dkv, SALT_LEDGER: D1, STMT_DESK_KEY: "desk-key", REQUIRE_ACCESS: "0",
    COUNTER_MAKER_KEY: "maker-claims-real-capability-0001",
    STMT_SITE: { fetch(url, init) {
      if (failTell && /\/desk\/claims\/[^/]+\/[^/]+$/.test(new URL(url).pathname))
        return new Response(JSON.stringify({ ok: false, error: "invented outage" }), { status: 503 });
      return stmtWorker.fetch(new Request(url, init), senv);
    } } };
  const cenv = { STMT: skv, ORDER_STORE: "object", ORDERBOOK: site.ns, COUNTER_MAKER_KEY: denv.COUNTER_MAKER_KEY,
    DESK_MAKER: { fetch: (request) => desk.fetch(request, denv, { waitUntil() {} }) } };
  const owner = async (path, body) => {
    const r = await handleMaker(new Request("https://counter.fixture.test" + path, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), cenv, path, { email: "maakmal97@icloud.com" });
    return { status: r.status, j: await r.json() };
  };
  const drafts = (id) => db.prepare("SELECT id,status,decided_by,entry FROM draft").all().filter((d) => JSON.parse(d.entry).claimId === id);
  const c1 = (await O.claimAccount(senv, U, { amount: 80, method: "transfer", account: "wise" })).claim;
  const route = "/all/maker/claims/" + U + "/" + c1.id;
  const pv = await owner(route + "/preview", {});
  ok(pv.status === 200 && JSON.stringify(pv.j.rows.map((r) => [r.rid, r.rm])) === '[["s20",50],["s21",30]]'
    && pv.j.left === 0 && !pv.j.own && drafts(c1.id).length === 0,
    "Salt Admin previews a real account claim through native Desk allocation, drafting nothing: " + JSON.stringify(pv.j.rows));
  const yes = await owner(route + "/received", { hash: pv.j.hash, rid: "real-claim-received-0001" });
  const ds = drafts(c1.id);
  ok(yes.status === 200 && ds.length === 2 && ds.every((d) => d.status === "approved" && /^preapproved/.test(d.decided_by))
    && (await O.claimsOf(senv, U)).find((x) => x.id === c1.id).state === "received",
    "Salt Admin Received on a real claim approves exactly the drawn rows through Desk preapproval and tells the site: "
    + JSON.stringify(ds.map((d) => [d.status, d.decided_by])));
  const retry = await owner(route + "/received", { hash: pv.j.hash, rid: "real-claim-received-0001" });
  ok(retry.status === 200 && retry.j.again === true && drafts(c1.id).length === 2,
    "A lost-answer retry of real Received finds the verdict given and books nothing more: " + JSON.stringify(retry.j));
  const c2 = (await O.claimAccount(senv, U, { amount: 30, method: "transfer", account: "wise" })).claim;
  const route2 = "/all/maker/claims/" + U + "/" + c2.id;
  const pv2 = await owner(route2 + "/preview", {});
  failTell = true;
  const untold = await owner(route2 + "/received", { hash: pv2.j.hash, rid: "real-claim-received-0002" });
  failTell = false;
  const refused = await owner(route2 + "/notfound", { amount: 30, rid: "real-claim-notfound-0002" });
  const told = await owner(route2 + "/received", { hash: pv2.j.hash, rid: "real-claim-received-0003" });
  ok(untold.status !== 200 && drafts(c2.id).length === 1 && refused.status === 409 && /booked/.test(refused.j.error)
    && told.status === 200 && told.j.again === true && drafts(c2.id).length === 1
    && (await O.claimsOf(senv, U)).find((x) => x.id === c2.id).state === "received",
    "Not found is refused once real rows are booked, and Received tells the site again without booking twice: "
    + JSON.stringify({ untold: untold.status, refused: refused.j.error, told: told.j }));
  site.db.close(); db.close();
}
