import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { siteWords } from "../src/orders.js";
import { orderBook } from "./orderbook-harness.mjs";
import * as C from "../tools/stmt-crypto.mjs";
import { TEST_USER, TEST_PASS, FIX_VERSION, fixKey, exampleThread } from "../stmt/testfix.js";
import { build, sealFixture } from "../tools/testfix.mjs";
import { allThreads, applyEvent, fixtureThreadMove } from "../stmt/orders.js";
import { answerSheets } from "./maker-act.mjs";

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
  const store = new Store(), pushes = [], bridge = [], posts = [];
  const team = "maker-communications-fixture", audience = "maker-communications-audience", kid = "maker-communications-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const pushSigning = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const env = {
    STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "communications-local-master",
    STMT_DESK_KEY: "communications-desk-test-capability", COUNTER_MAKER_KEY: "communications-maker-test-capability",
    STMT_VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey("jwk", pushSigning.privateKey)),
    STMT_VAPID_PUBLIC_KEY: "communications-public-push-key", ORDER_STORE: "object"
  };
  const harness = orderBook(env); env.ORDERBOOK = harness.ns;
  const deskEnv = { SALT_QUEUE: new Store(), COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY,
    STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  env.DESK_MAKER = { fetch: (request) => {
    bridge.push({ path: new URL(request.url).pathname, method: request.method,
      capability: request.headers.get("X-Counter-Maker-Key") });
    return desk.fetch(request, deskEnv, { waitUntil() {} });
  } };
  const user = "abcd-efgh", password = C.newPassword(), contentKey = await C.contentKey("communications-fixture", user);
  await store.put("u:" + user, JSON.stringify({ u: user, verifier: await C.makeVerifier(password),
    wrap: await C.wrapKey(password, contentKey), env: await C.encryptWith(contentKey, JSON.stringify({ statements: [] })) }));
  await store.put("push:" + user + ":fixture", JSON.stringify({ endpoint: "https://push.fixture.test/send" }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs")
      return Response.json({ keys: [{ ...publicKey, kid }] });
    if (String(url) === "https://push.fixture.test/send") { pushes.push(init); return new Response(null, { status: 201 }); }
    throw new Error("Unexpected communications fixture request.");
  };
  const token = async (email) => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com",
      aud: [audience], email, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    return header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
  };
  const jwt = await token("maakmal97@icloud.com");
  const owner = (path, method = "GET", body, auth = jwt) => {
    if (method === "POST") posts.push({ path, body: structuredClone(body) });
    return counter.fetch(new Request("https://counter.fixture.test" + path, {
      method, headers: { "cf-access-jwt-assertion": auth, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }), env);
  };
  let page;
  try {
    const session = (await (await counter.fetch(new Request("https://counter.fixture.test/open", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u: user, password })
    }), env)).json()).session;
    const customer = (method = "GET", body) => counter.fetch(new Request("https://counter.fixture.test/thread", {
      method, headers: { "X-Stmt-Session": session, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }), env);
    await customer("POST", { text: "When can I collect?", rid: "customer-thread-fixture-01" });
    const list = await owner("/all/maker/threads"), listed = await list.json();
    ok(list.status === 200 && listed.threads[0]?.u === user
      && listed.threads[0].msgs[0].text === "When can I collect?"
      && bridge.at(-1).path === "/_internal/maker/threads" && bridge.at(-1).capability === env.COUNTER_MAKER_KEY,
      "Chat reads a customer's actual thread through the verified owner Worker and exact capability bridge.");
    if (list.status !== 200 || !listed.threads?.length) return;
    const denied = await owner("/all/maker/threads", "GET", undefined, "");
    const other = await owner("/all/maker/threads", "GET", undefined, await token("other@example.test"));
    ok(denied.status === 401 && other.status === 401, "New Chat routes remain behind actual JWT and exact-owner authorization.");
    const privateDenied = await desk.fetch(new Request("https://desk.fixture.test/_internal/maker/threads"), deskEnv, {});
    const method = await owner("/all/maker/threads", "POST", {});
    const unknown = await owner("/all/maker/threads/not-an-account", "POST", {});
    ok(privateDenied.status === 404 && method.status === 405 && unknown.status === 404,
      "Chat refuses missing bridge capability, wrong methods and non-account paths.");
    const reply = { message: "Ready tomorrow.", rid: "owner-thread-fixture-01" };
    const first = await owner("/all/maker/threads/" + user, "POST", reply);
    const repeated = await owner("/all/maker/threads/" + user, "POST", reply);
    const changed = await owner("/all/maker/threads/" + user, "POST", { ...reply, message: "Different reply." });
    const visible = (await (await customer()).json()).thread;
    ok(first.status === 200 && repeated.status === 200 && changed.status === 409
      && visible.msgs.filter((line) => line.text === reply.message).length === 1 && pushes.length === 1,
      "An owner reply reaches the customer once, wakes once, and refuses changed content under the same id.");
    const noop = { noReply: true, rid: "owner-noop-reply-fixture-01" };
    await new Promise((resolve) => setTimeout(resolve, 2));
    await owner("/all/maker/threads/" + user, "POST", noop);
    const noopEvent = harness.db.prepare("SELECT body FROM ev WHERE eid=?").get("d:" + user + ":thread:" + noop.rid);
    const unchanged = structuredClone(harness.book.order(user, "thread"));
    const preserved = noopEvent && applyEvent(structuredClone(unchanged), JSON.parse(noopEvent.body)).order;
    ok(noopEvent && JSON.stringify(preserved) === JSON.stringify(unchanged),
      "No reply needed on an already answered thread records an immutable no-op without changing its history.");
    const forbiddenWords = ["ambassador", "titanium", "platinum", "gold", "silver", "bronze",
      "Salt Command", "CX1-ZED"];
    for (const [index, word] of forbiddenWords.entries()) {
      const response = await owner("/all/maker/threads/" + user, "POST",
        { message: word, rid: "forbidden-owner-word-" + String(index).padStart(2, "0") });
      ok(!!siteWords(word) && response.status === 400, "Chat uses authoritative siteWords for " + word + ".");
    }
    const extra = await owner("/all/maker/threads/" + user, "POST", { ...reply, rid: "extra-reply-fields-01", name: "Invented Person" });
    ok(extra.status === 400, "Chat rejects unsupported private fields rather than stripping and accepting them.");
    await customer("POST", { text: "Thank you.", rid: "customer-thread-fixture-02" });
    await owner("/all/maker/threads/" + user, "POST", noop);
    const stillAsked = (await (await owner("/all/maker/threads")).json()).threads[0];
    ok(stillAsked.quiet !== stillAsked.msgs.at(-1).at, "Retrying an earlier no-op cannot quiet a new customer question.");
    const quiet = { noReply: true, rid: "owner-no-reply-fixture-01" };
    const beforeQuiet = pushes.length;
    const quietResult = await owner("/all/maker/threads/" + user, "POST", quiet);
    const quietThread = (await quietResult.json()).thread;
    ok(quietResult.status === 200 && quietThread.quiet === quietThread.msgs.at(-1).at && pushes.length === beforeQuiet,
      "No reply needed marks the customer's last line without adding a message or wake.");
    await customer("POST", { text: "One more question.", rid: "customer-thread-fixture-03" });
    await owner("/all/maker/threads/" + user, "POST", quiet);
    const afterReplay = (await (await owner("/all/maker/threads")).json()).threads[0];
    ok(afterReplay.quiet !== afterReplay.msgs.at(-1).at, "Retrying No reply needed never quiets a later customer line.");
    const racePushes = pushes.length;
    const concurrentReply = { message: "One concurrent real answer.", rid: "owner-concurrent-identical-01" };
    await Promise.all([owner("/all/maker/threads/" + user, "POST", concurrentReply),
      owner("/all/maker/threads/" + user, "POST", concurrentReply)]);
    ok((await (await customer()).json()).thread.msgs.filter((line) => line.text === concurrentReply.message).length === 1
      && pushes.length === racePushes + 1, "Concurrent native identical owner requests commit and wake once.");
    await Promise.all([customer("POST", { text: "Concurrent native customer.", rid: "customer-concurrent-native-01" }),
      owner("/all/maker/threads/" + user, "POST", { message: "Concurrent native owner.", rid: "owner-concurrent-native-01" })]);
    const nativeRace = (await (await customer()).json()).thread;
    ok(nativeRace.msgs.some((line) => line.text === "Concurrent native customer.")
      && nativeRace.msgs.some((line) => line.text === "Concurrent native owner."),
      "Native customer and owner concurrency retains both messages.");
    await Promise.all([owner("/all/maker/threads/" + user, "POST", { noReply: true, rid: "owner-native-quiet-race-01" }),
      owner("/all/maker/threads/" + user, "POST", { message: "Native answer survives quiet.", rid: "owner-native-answer-race-01" })]);
    ok((await (await customer()).json()).thread.msgs.some((line) => line.text === "Native answer survives quiet."),
      "Native reply and No reply needed concurrency cannot erase the reply.");
    await customer("POST", { text: "A native question waiting.", rid: "customer-native-final-question-01" });
    const fixtureKey = await C.contentKey("communications-test-account", TEST_USER);
    const fixtureWrap = await C.wrapKey(TEST_PASS, fixtureKey);
    await store.put("u:" + TEST_USER, JSON.stringify({ u: TEST_USER, test: true, wrap: fixtureWrap,
      verifier: await C.makeVerifier(TEST_PASS), env: await C.encryptWith(fixtureKey, JSON.stringify({ statements: [] })) }));
    const published = await sealFixture(build(new Date("2026-10-01T01:00:00.000Z")), { wrap: fixtureWrap }, TEST_PASS);
    await store.put(fixKey(TEST_USER), JSON.stringify(published));
    const publishedThread = await exampleThread(env, TEST_USER);
    ok(publishedThread?.msgs.some((line) => line.text === "Do you deliver on Sundays?"),
      "A built and sealed fixture hands its account thread to the actual Worker reader.");
    const fixtureSession = (await (await counter.fetch(new Request("https://counter.fixture.test/open", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ u: TEST_USER, password: TEST_PASS })
    }), env)).json()).session;
    const exampleCustomer = (body) => counter.fetch(new Request("https://counter.fixture.test/thread", {
      method: "POST", headers: { "X-Stmt-Session": fixtureSession, "content-type": "application/json" }, body: JSON.stringify(body)
    }), env);
    const publishedRead = await counter.fetch(new Request("https://counter.fixture.test/thread", {
      headers: { "X-Stmt-Session": fixtureSession }
    }), env);
    ok((await publishedRead.json()).thread?.msgs.some((line) => line.text === "Do you deliver on Sundays?"),
      "The customer Worker hands over the account-thread case from the real sealed fixture.");
    const examples = (await (await owner("/all/maker/threads")).json()).threads;
    const realMarks = harness.book.run("last", {});
    ok(examples.some((thread) => thread.u === TEST_USER && thread.test) && (await allThreads(env)).length === 1,
      "Maker can open an acceptance-account Chat without adding it to incumbent counts.");
    if (!examples.some((thread) => thread.u === TEST_USER)) return;
    const fixtureReply = { message: "An example answer.", rid: "example-owner-reply-01" };
    const exampleAnswer = await owner("/all/maker/threads/" + TEST_USER, "POST", fixtureReply);
    await owner("/all/maker/threads/" + TEST_USER, "POST", fixtureReply);
    const exampleConflict = await owner("/all/maker/threads/" + TEST_USER, "POST", { ...fixtureReply, message: "Changed example." });
    const savedExample = { thread: await exampleThread(env, TEST_USER) };
    ok(exampleAnswer.status === 200 && exampleConflict.status === 409
      && savedExample.thread.msgs.filter((line) => line.text === fixtureReply.message).length === 1
      && harness.db.prepare("SELECT COUNT(*) AS n FROM thr WHERE u=?").get(TEST_USER).n === 0,
      "Acceptance-account owner replies/retries live only in its fixture and refuse changed request content.");
    const noFixture = await owner("/all/maker/threads/0000-0001", "POST", { message: "Example.", rid: "missing-fixture-reply-01" });
    ok(noFixture.status === 409, "An acceptance account without its fixture cannot make a real Chat.");
    await exampleCustomer({ text: "An example follow-up.", rid: "example-customer-followup-01" });
    const exampleQuiet = await owner("/all/maker/threads/" + TEST_USER, "POST", { noReply: true, rid: "example-owner-quiet-01" });
    const quietExample = { thread: await exampleThread(env, TEST_USER) };
    ok(exampleQuiet.status === 200 && quietExample.thread.quiet === quietExample.thread.msgs.at(-1).at,
      "Acceptance-account No reply needed uses the shared decision rules inside its fixture.");
    await exampleCustomer({ text: "Another example follow-up.", rid: "example-customer-followup-02" });
    const normalPut = store.put.bind(store);
    let releaseWrites, heldWrites = 0;
    const writeBarrier = new Promise((resolve) => { releaseWrites = resolve; });
    store.put = async (key, value) => {
      if (key === fixKey(TEST_USER)) {
        heldWrites++;
        if (heldWrites === 2) releaseWrites();
        await writeBarrier;
      }
      return normalPut(key, value);
    };
    try {
      await Promise.all([
        owner("/all/maker/threads/" + TEST_USER, "POST", { message: "Concurrent example answer.", rid: "example-owner-race-reply-01" }),
        owner("/all/maker/threads/" + TEST_USER, "POST", { noReply: true, rid: "example-owner-race-quiet-01" })
      ]);
      const exampleAfterRace = (await (await owner("/all/maker/threads")).json()).threads.find((thread) => thread.u === TEST_USER);
      ok(exampleAfterRace.msgs.some((line) => line.text === "Concurrent example answer."),
        "Concurrent acceptance-account reply and No reply needed cannot erase the reply.");
      await Promise.all([
        exampleCustomer({ text: "Concurrent customer line.", rid: "example-customer-race-01" }),
        owner("/all/maker/threads/" + TEST_USER, "POST", { message: "Concurrent owner line.", rid: "example-owner-race-02" })
      ]);
      const both = await exampleThread(env, TEST_USER);
      ok(both.msgs.some((line) => line.text === "Concurrent customer line.")
        && both.msgs.some((line) => line.text === "Concurrent owner line."),
        "Concurrent acceptance-account customer and owner writers share one serialized thread authority.");
    } finally { store.put = normalPut; }
    harness.restart();
    ok((await exampleThread(env, TEST_USER)).msgs.some((line) => line.text === "Concurrent owner line."),
      "Restarting the fixture thread object preserves its committed replies.");
    const beforeKv = await exampleThread(env, TEST_USER);
    env.ORDER_STORE = "kv";
    await exampleCustomer({ text: "Fixture on the KV road.", rid: "example-customer-kv-01" });
    ok((await exampleThread(env, TEST_USER)).msgs.length === beforeKv.msgs.length + 1
      && ![...store.values.keys()].some((key) => key === "thr:" + TEST_USER)
      && harness.db.prepare("SELECT COUNT(*) AS n FROM ev WHERE u=?").get(TEST_USER).n === 0
      && harness.db.prepare("SELECT COUNT(*) AS n FROM behind WHERE u=?").get(TEST_USER).n === 0,
      "Fixture threads keep the same isolated authority on the KV road, without real events or write-behind marks.");
    env.ORDER_STORE = "object";
    const republished = await sealFixture(build(new Date("2026-10-02T01:00:00.000Z")), { wrap: fixtureWrap }, TEST_PASS);
    await store.put(fixKey(TEST_USER), JSON.stringify(republished));
    ok(!(await exampleThread(env, TEST_USER)).msgs.some((line) => line.text === "Concurrent owner line."),
      "A newly sealed publication resets only its acceptance thread generation.");
    const staleGeneration = await fixtureThreadMove(env, { u: TEST_USER, actor: "desk",
      generation: JSON.stringify([published.salt, published.at, published.env.iv]), seed: published.thread,
      rid: "owner-stale-publication-01", body: { message: "Stale fixture message." } });
    ok(staleGeneration.status === 409 && !(await exampleThread(env, TEST_USER)).msgs.some((line) => line.text === "Stale fixture message."),
      "A delayed old-publication writer cannot reset or overwrite the new acceptance thread.");
    if (staleGeneration.status !== 409) return;
    const savedReceipts = harness.db.prepare("SELECT receipts FROM fixture_thread WHERE u=?").get(TEST_USER).receipts;
    const fullReceipts = Object.fromEntries(Array.from({ length: 400 }, (_, index) => ["desk:fixture-cap-" + index, "{}"]));
    harness.db.prepare("UPDATE fixture_thread SET receipts=? WHERE u=?").run(JSON.stringify(fullReceipts), TEST_USER);
    const capped = await owner("/all/maker/threads/" + TEST_USER, "POST",
      { message: "Over the receipt limit.", rid: "owner-fixture-capped-01" });
    ok(capped.status === 409 && !(await exampleThread(env, TEST_USER)).msgs.some((line) => line.text === "Over the receipt limit."),
      "Full fixture receipts refuse explicitly without silently pruning retry identity or recording a line.");
    harness.db.prepare("UPDATE fixture_thread SET receipts=? WHERE u=?").run(savedReceipts, TEST_USER);
    const fixtureNoop = { noReply: true, rid: "owner-fixture-noop-01" };
    await owner("/all/maker/threads/" + TEST_USER, "POST", fixtureNoop);
    await exampleCustomer({ text: "An example still waiting.", rid: "example-customer-waiting-01" });
    await owner("/all/maker/threads/" + TEST_USER, "POST", fixtureNoop);
    const fixtureAfterNoop = await exampleThread(env, TEST_USER);
    ok(fixtureAfterNoop.quiet !== fixtureAfterNoop.msgs.at(-1).at,
      "Fixture no-op receipts prevent an old retry from quieting a new acceptance question.");
    ok(JSON.stringify(harness.book.run("last", {})) === JSON.stringify(realMarks) && (await allThreads(env)).length === 1,
      "Fixture reads and moves do not enter real thread scans or activity/chase marks.");
    const newFixtureWrap = await C.wrapKey(TEST_PASS, await C.contentKey("communications-recreated-fixture", TEST_USER));
    const existingFixtureAccount = await store.get("u:" + TEST_USER, "json");
    const newKeyFixture = await sealFixture(build(new Date("2026-10-03T01:00:00.000Z")), { wrap: newFixtureWrap }, TEST_PASS);
    await store.put("u:" + TEST_USER, JSON.stringify({ ...existingFixtureAccount, wrap: newFixtureWrap }));
    await store.put(fixKey(TEST_USER), JSON.stringify(newKeyFixture));
    const newKeyThread = await exampleThread(env, TEST_USER);
    const oldKeyWriter = await fixtureThreadMove(env, { u: TEST_USER, actor: "desk",
      generation: JSON.stringify([republished.salt, republished.at, republished.env.iv]), seed: republished.thread,
      rid: "owner-old-key-fixture-01", body: { message: "Old account key reply." } });
    ok(oldKeyWriter.status === 409 && !newKeyThread.msgs.some((line) => line.text === "An example still waiting.")
      && !(await exampleThread(env, TEST_USER)).msgs.some((line) => line.text === "Old account key reply."),
      "A recreated fixture identity excludes old-key history and delayed old-key writers.");
    await exampleCustomer({ text: "Example after key renewal.", rid: "customer-new-fixture-key-01" });
    const stableRead = await exampleThread(env, TEST_USER);
    ok((await exampleThread(env, TEST_USER)).msgs.length === stableRead.msgs.length
      && stableRead.msgs.some((line) => line.text === "Example after key renewal."),
      "Repeated reads of one stable fixture identity never reset newer replies.");
    delete env.ORDERBOOK;
    const bindingAbsent = await owner("/all/maker/threads/" + TEST_USER, "POST",
      { message: "Must not use KV fallback.", rid: "owner-fixture-unbound-01" });
    env.ORDERBOOK = harness.ns;
    ok(bindingAbsent.status === 503 && !(await exampleThread(env, TEST_USER)).msgs.some((line) => line.text === "Must not use KV fallback."),
      "New owner fixture writes fail closed without the serialization binding.");
    const beforeNotice = pushes.length;
    const unconfirmed = await owner("/all/maker/bulletin", "POST", { lines: ["Collection tomorrow."] });
    const notice = await owner("/all/maker/bulletin", "POST", { lines: ["Collection tomorrow."], confirmed: true });
    const publicNotice = await counter.fetch(new Request("https://counter.fixture.test/bulletin"), env);
    ok(unconfirmed.status === 400 && notice.status === 200 && (await publicNotice.json()).lines[0] === "Collection tomorrow."
      && pushes.length === beforeNotice + 1, "Confirmed Notice Set uses the incumbent authenticated handler, reaches customers and wakes every phone.");
    /* 11 Oct 2026, the stress test: the notice already up, set again, stores nothing and wakes nobody, and the answer says so */
    const beforeSame = pushes.length, storedNotice = await store.get("bulletin");
    const sameNotice = await owner("/all/maker/bulletin", "POST", { lines: ["Collection tomorrow."], confirmed: true });
    const sameBody = await sameNotice.json();
    ok(sameNotice.status === 200 && sameBody.unchanged === true && pushes.length === beforeSame && (await store.get("bulletin")) === storedNotice,
      "The same notice set again stores nothing, wakes nobody and answers that it is unchanged.");
    const changedNotice = await owner("/all/maker/bulletin", "POST", { lines: ["Collection tomorrow, 10:00."], confirmed: true });
    ok(changedNotice.status === 200 && !(await changedNotice.json()).unchanged && pushes.length === beforeSame + 1,
      "A different notice is still a notice and wakes every phone.");
    const beforeForbidden = pushes.length;
    const forbiddenNotice = await owner("/all/maker/bulletin", "POST", { lines: ["Gold"], confirmed: true });
    ok(forbiddenNotice.status === 400 && pushes.length === beforeForbidden, "Notice uses authoritative siteWords before any write or wake.");
    const beforeClear = pushes.length;
    const cleared = await owner("/all/maker/bulletin", "POST", { lines: [] });
    ok(cleared.status === 200 && !(await (await counter.fetch(new Request("https://counter.fixture.test/bulletin"), env)).json()).lines.length
      && pushes.length === beforeClear, "Notice Clear removes the customer notice and wakes nobody.");
    const fakePolls = new Map(); let nextPoll = 100000, visiblePage = true, failRead = false, loseReply = false,
      loseNotice = false, confirmations = false, hoursHold = null, hoursHeld = 0;
    const html = await (await owner("/all")).text();
    let reloadData = null, chatStorageKey = null;
    const pageOptions = { url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(window) {
        if (reloadData) {
          window.localStorage.setItem(chatStorageKey, reloadData);
          const moved = JSON.parse(reloadData); moved.u = TEST_USER;
          window.localStorage.setItem("saltMakerChat:" + TEST_USER + ":" + moved.rid, JSON.stringify(moved));
        }
        Object.defineProperty(window, "crypto", { value: webcrypto });
        window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
        const interval = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
        window.setInterval = (fn, ms, ...args) => {
          if (ms !== 2000) return interval(fn, ms, ...args);
          const id = nextPoll++; fakePolls.set(id, () => fn(...args)); return id;
        };
        window.clearInterval = (id) => { if (!fakePolls.delete(id)) clear(id); };
        Object.defineProperty(window.document, "hidden", { get: () => !visiblePage, configurable: true });
        window.fetch = async (path, init = {}) => {
          const body = init.body === undefined ? undefined : JSON.parse(init.body);
          if (path === "/all/maker/threads" && failRead) throw new Error("fixture offline");
          if (path === "/all/maker/hours" && init.method === "POST" && hoursHold) { hoursHeld++; await hoursHold; }
          const response = await owner(path, init.method || "GET", body);
          if (String(path).startsWith("/all/maker/threads/") && loseReply) { loseReply = false; throw new Error("fixture lost confirmation"); }
          if (path === "/all/maker/bulletin" && init.method === "POST" && loseNotice) { loseNotice = false; throw new Error("fixture lost notice confirmation"); }
          return response;
        };
      }
    };
    page = new JSDOM(html, pageOptions).window; let doc = page.document;
    answerSheets(page, [], () => confirmations);   /* a notice asks on the page's Sheet (Phase 2c), answered as it comes up by `confirmations` */
    const until = async (condition) => {
      for (let i = 0; i < 100 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      return !!condition();
    };
    const tap = (root, label) => [...doc.querySelectorAll(root + " button")].find((button) => button.textContent === label)?.click();
    /* 11 Oct 2026: the conversations are Customers, Messages */
    doc.querySelector('[data-act="nav.customers"]').click(); doc.querySelector('[data-act="part.customers.messages"]').click();
    await until(() => doc.querySelector('[data-thread="' + user + '"]'));
    doc.querySelector('[data-thread="' + user + '"]').click();
    ok(/^1 waiting/.test(doc.getElementById("makerChatStatus").textContent),
      "The owner waiting count excludes an acceptance-account question.");
    let textarea = doc.querySelector('[data-thread-reply="' + user + '"]');
    textarea.value = "Kept typed reply."; textarea.dispatchEvent(new page.Event("input", { bubbles: true }));
    failRead = true; [...fakePolls.values()][0]();
    await until(() => /Check the connection/.test(doc.getElementById("makerChatStatus").textContent));
    ok(textarea.value === "Kept typed reply.", "Chat refresh errors retain the reply being typed.");
    textarea.value = "Kept typed reply."; textarea.dispatchEvent(new page.Event("input", { bubbles: true }));
    failRead = false; visiblePage = false; doc.dispatchEvent(new page.Event("visibilitychange"));
    ok(fakePolls.size === 0, "Chat does not poll while the owner page is hidden.");
    visiblePage = true; doc.dispatchEvent(new page.Event("visibilitychange"));
    ok(fakePolls.size === 1, "An open Chat resumes exactly one poll when the owner returns.");
    if (fakePolls.size !== 1) return;
    await customer("POST", { text: '<img src=x onerror="window.makerLeak=1">', rid: "customer-thread-markup-01" });
    [...fakePolls.values()][0]();
    const markupRead = await until(() => doc.getElementById("makerChatLines").textContent.includes("<img"));
    ok(markupRead && !doc.querySelector("#makerChatLines img") && page.makerLeak === undefined,
      "Owner Chat draws customer markup as text, never executable elements.");
    loseReply = true; tap("#makerChatOpen", "Send");
    tap("#makerChatOpen", "Close");
    doc.querySelector('[data-thread="' + user + '"]').click();
    textarea = doc.querySelector('[data-thread-reply="' + user + '"]');
    ok([...doc.querySelectorAll("#makerChatOpen button")].find((button) => button.textContent === "Send again").disabled,
      "Closing and reopening an in-flight Chat cannot re-enable duplicate submits.");
    await until(() => /Your reply is kept/.test(doc.getElementById("makerChatOpen").textContent));
    const pendingReply = posts.filter((item) => item.path === "/all/maker/threads/" + user).at(-1).body;
    chatStorageKey = "saltMakerChat:" + user + ":" + pendingReply.rid;
    ok(textarea.value === "Kept typed reply." && textarea.disabled
      && /may have gone through/.test(doc.getElementById("makerChatOpen").textContent)
      && !/Not sent[.]/.test(doc.getElementById("makerChatOpen").textContent),
      "A lost reply confirmation keeps the original text and prevents a changed resubmission.");
    reloadData = page.localStorage.getItem(chatStorageKey);
    const encryptedRetry = reloadData && JSON.parse(reloadData);
    ok(encryptedRetry?.envelope.ct && encryptedRetry.rid === pendingReply.rid
      && !reloadData.includes("Kept typed reply.") && !reloadData.includes(env.STMT_MASTER)
      && Object.keys(encryptedRetry).sort().join(",") === "at,envelope,rid,u,v",
      "Pending Chat persists only ciphertext and fixed safe metadata, never the reply or master key.");
    tap("#makerChatOpen", "Close"); page.close();
    page = new JSDOM(html, pageOptions).window; doc = page.document;
    answerSheets(page, [], () => confirmations);
    /* 11 Oct 2026: the conversations are Customers, Messages */
    doc.querySelector('[data-act="nav.customers"]').click(); doc.querySelector('[data-act="part.customers.messages"]').click();
    await until(() => doc.querySelector('[data-thread="' + user + '"]'));
    doc.querySelector('[data-thread="' + TEST_USER + '"]').click();
    const beforeSwitchedRetry = posts.length;
    tap("#makerChatOpen", "Open unsent reply");
    const refusedSwitch = await until(() => /belongs to another account/.test(doc.getElementById("makerChatOpen").textContent));
    tap("#makerChatOpen", "Send");
    ok(refusedSwitch && posts.length === beforeSwitchedRetry && page.localStorage.getItem(chatStorageKey) === reloadData,
      "An encrypted retained request is bound to its original account even when moved into another account slot.");
    doc.querySelector('[data-thread="' + user + '"]').click();
    textarea = doc.querySelector('[data-thread-reply="' + user + '"]');
    ok(textarea.value === "" && textarea.disabled && page.localStorage.getItem(chatStorageKey) === reloadData,
      "Reload retains the original ciphertext without opening or resubmitting it automatically.");
    tap("#makerChatOpen", "Open unsent reply");
    await until(() => /Original reply opened/.test(doc.getElementById("makerChatOpen").textContent));
    ok(textarea.value === "Kept typed reply." && page.localStorage.getItem(chatStorageKey) === reloadData,
      "Explicit owner-context opening restores the unchanged encrypted request for review.");
    const beforeRetry = posts.filter((item) => item.path === "/all/maker/threads/" + user).length;
    const otherPendingKey = "saltMakerChat:" + user + ":zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
    page.localStorage.setItem(otherPendingKey, reloadData);
    tap("#makerChatOpen", "Send again");
    const retryCompleted = await until(() => /Reply sent/.test(doc.getElementById("makerChatOpen").textContent));
    const lastReply = posts.filter((item) => item.path === "/all/maker/threads/" + user).at(-1).body;
    ok(retryCompleted && posts.filter((item) => item.path === "/all/maker/threads/" + user).length === beforeRetry + 1
      && JSON.stringify(lastReply) === JSON.stringify(pendingReply)
      && page.localStorage.getItem(chatStorageKey) === null
      && page.localStorage.getItem(otherPendingKey) === reloadData
      && (await (await customer()).json()).thread.msgs.filter((line) => line.text === "Kept typed reply.").length === 1,
      "The actual owner retry button reuses the fixed immutable request and never adds a second customer line.");
    tap("#makerChatOpen", "Close");
    ok(fakePolls.size === 0, "Closing Chat stops its poll.");
    /* the notice is Shop, Notice */
    doc.querySelector('[data-act="nav.shop"]').click(); doc.querySelector('[data-act="part.shop.notice"]').click();
    await until(() => doc.querySelector("#makerBulletin textarea"));
    const noticeText = doc.querySelector("#makerBulletin textarea"); noticeText.value = "A still notice.";
    const beforeSet = posts.filter((item) => item.path === "/all/maker/bulletin").length;
    tap("#makerBulletin", "Set the notice");
    await new Promise((resolve) => setTimeout(resolve, 20));
    ok(posts.filter((item) => item.path === "/all/maker/bulletin").length === beforeSet,
      "Notice Set refuses to submit when its notification confirmation is cancelled.");
    const beforeConfirmedSet = posts.filter((item) => item.path === "/all/maker/bulletin").length;
    confirmations = true; tap("#makerBulletin", "Set the notice");
    await until(() => /Notice set/.test(doc.getElementById("makerBulletinStatus").textContent));
    ok(posts.filter((item) => item.path === "/all/maker/bulletin").length === beforeConfirmedSet + 1
      && (await (await counter.fetch(new Request("https://counter.fixture.test/bulletin"), env)).json()).lines[0] === "A still notice.",
      "The actual owner Notice Set button changes the customer's public notice.");
    /* 11 Oct 2026: the box is empty once the notice is set, and the same notice set again says so and wakes nobody */
    ok(noticeText.value === "", "Notice set empties its text box, so a second tap has nothing to send.");
    const beforeAgain = pushes.length, storedAgain = await store.get("bulletin");
    noticeText.value = "A still notice."; tap("#makerBulletin", "Set the notice");
    await until(() => /already up/.test(doc.getElementById("makerBulletinStatus").textContent));
    ok(doc.getElementById("makerBulletinStatus").textContent === "That notice is already up. Nobody was notified."
      && pushes.length === beforeAgain && (await store.get("bulletin")) === storedAgain,
      "The same notice set again says it is already up, stores nothing and wakes nobody.");
    noticeText.value = "";
    const noticeStyle = page.getComputedStyle(doc.getElementById("makerBulletinCurrent"));
    ok(noticeStyle.getPropertyValue("overflow-wrap") === "anywhere", "A long word in the current notice wraps instead of widening the page: " + noticeStyle.getPropertyValue("overflow-wrap"));
    noticeText.value = "Kept notice draft."; loseNotice = true; tap("#makerBulletin", "Set the notice");
    await until(() => /it may already be set/.test(doc.getElementById("makerBulletinStatus").textContent));
    const afterLostNotice = posts.filter((item) => item.path === "/all/maker/bulletin").length;
    tap("#makerBulletin", "Set the notice");
    ok(noticeText.value === "Kept notice draft."
      && [...doc.querySelectorAll("#makerBulletin button")].find((button) => button.textContent === "Set the notice").disabled
      && posts.filter((item) => item.path === "/all/maker/bulletin").length === afterLostNotice,
      "An ambiguous Notice result retains its draft and blocks another write until readback.");
    const beforeReadback = pushes.length;
    tap("#makerBulletin", "Read it again");
    const reread = await until(() => ![...doc.querySelectorAll("#makerBulletin button")]
      .find((button) => button.textContent === "Set the notice").disabled);
    ok(reread && noticeText.value === "Kept notice draft." && pushes.length === beforeReadback
      && doc.getElementById("makerBulletinCurrent").textContent === "Kept notice draft."
      && /matches what you sent/.test(doc.getElementById("makerBulletinStatus").textContent)
      && /whether the first one went out is not known/.test(doc.getElementById("makerBulletinStatus").textContent),
      "Notice readback unlocks controls without changing the typed draft or sending another wake.");
    await owner("/all/maker/bulletin", "POST", { lines: ["Another operator's notice."], confirmed: true });
    noticeText.value = "Another operator's notice.";
    const beforeDifferentRead = pushes.length;
    tap("#makerBulletin", "Read it again");
    const differing = await until(() => /differs from what you sent/.test(doc.getElementById("makerBulletinStatus").textContent));
    ok(differing && noticeText.value === "Another operator's notice." && pushes.length === beforeDifferentRead
      && doc.getElementById("makerBulletin").textContent.includes("Kept notice draft.")
      && /whether the first one went out is not known/.test(doc.getElementById("makerBulletinStatus").textContent),
      "Notice readback distinguishes another concurrent notice while preserving the original intended body and notification uncertainty.");
    /* 11 Oct 2026: each of the three hours buttons stays off until its answer lands, where its callback let go at once (Shop, Hours). 13 Oct 2026: Save answers on the line right under it (#makerHoursSaved), the other two on the one below them */
    doc.querySelector('[data-act="part.shop.hours"]').click();
    const hoursBtn = (label) => [...doc.querySelectorAll("#makerSchedule button")].find((button) => button.textContent === label);
    const holdHours = async (label, ready, saved) => {
      /* 20 Oct 2026 (canvas V63): Done stands in an opened day */
      if (label === "Done") { await until(() => doc.querySelector('#makerSchedule [data-act="hours.day"]')); doc.querySelector('#makerSchedule [data-act="hours.day"]').click(); }
      await until(() => hoursBtn(label));
      doc.getElementById("makerHoursMessage").textContent = ""; if (doc.getElementById("makerHoursSaved")) doc.getElementById("makerHoursSaved").textContent = "";
      if (ready) ready();
      let release; hoursHold = new Promise((resolve) => { release = resolve; }); hoursHeld = 0;
      const button = hoursBtn(label); button.click();
      const out = await until(() => hoursHeld === 1), off = button.disabled;
      release(); hoursHold = null;
      const back = await until(() => saved.test(doc.getElementById(label === "Done" ? "makerHoursSaved" : "makerHoursMessage").textContent) && (label === "Done" ? !hoursBtn(label) : hoursBtn(label) && !hoursBtn(label).disabled));
      return { out, off, back };
    };
    for (const [label, ready, saved] of [
      ["Done", null, /Weekly hours saved/],
      ["Set it", () => { doc.querySelector('#makerSchedule input[type="datetime-local"]').value = new Date(Date.now() + 3 * 86400000 + 8 * 3600000).toISOString().slice(0, 16); }, /Saved for now/],
      ["Back to the weekly hours", null, /Back on the weekly hours/]]) {
      const held = await holdHours(label, ready, saved);
      ok(held.out && held.off && held.back, label + " keeps its button off until the answer, then frees it: " + JSON.stringify(held));
    }
    doc.querySelector('[data-act="nav.customers"]').click(); doc.querySelector('[data-act="part.customers.messages"]').click();
    await until(() => doc.querySelector('[data-thread="' + user + '"]'));
    doc.querySelector('[data-thread="' + user + '"]').click();
    doc.querySelector('[data-act="part.customers.accounts"]').click();
    ok(fakePolls.size === 0, "Leaving Messages stops an open Chat poll.");
    harness.book.run("drop", { u: TEST_USER });
    ok(harness.db.prepare("SELECT COUNT(*) AS n FROM fixture_thread WHERE u=?").get(TEST_USER).n === 0,
      "Unmaking a test account drops its isolated thread state and receipts.");
  } finally {
    if (page) page.close();
    globalThis.fetch = originalFetch;
    harness.db.close();
  }
}
