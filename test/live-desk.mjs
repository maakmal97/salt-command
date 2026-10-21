/* test/live-desk.mjs: THE DESK'S LIVE OBJECT (Speed Wave 2 L1, 21 Oct 2026; src/book.js, src/worker.js, tools/build.mjs).
 *
 * An open Desk holds one WebSocket to the object named "live" in the Book class, which tells it the KIND of thing that moved (orders,
 * drafts) or that the Worker now serves another build (rev), and the page then reads what it always read; the /rev poll stays as the net,
 * at a minute while the socket is up. Driven on the real roads: the Book class over node:sqlite with the hibernation API's fake
 * (test/orderbook-harness.mjs), the Desk Worker with the Access JWT fixture and the maker suite's D1 world (test/maker-trades.mjs), then the
 * Desk's freshness block as the build ships it (read from tools/build.mjs) with a socket that connects to nothing (test/live-fakes.mjs).
 * Every code, name and id here is invented. Each check was proved red by its own mutation (test/live-desk.mutations.json, run with tools/section.mjs).
 *   1  the object: the live object refuses /load, /pitr and /window, every other name refuses /live, /tell and /rev; hello, the cap, the ping
 *      and the strikes; a tell reaches every desk socket as a kind and nothing else; rev stores the first silently and tells a change only
 *   2  the road: GET /live is the owner's alone whatever REQUIRE_ACCESS says, an upgrade from the Desk's own origin, never the CI token
 *   3  the tells: a drafter pass, an approve and a reject tell drafts; an order tap and a reconcile tell orders; the minute tells the build
 *   4  the page: the poll at a minute on hello and back on close, rev ticks, a burst of drafts or orders is one wake, backoff and stop,
 *      the ping on show, a reconnect ticks, and a new Kuala Lumpur day reloads an idle desk and offers the chip to a busy one */
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import desk from "../src/worker.js";
import { Book, LIVE_NAME, BOOK_NAME, PITR_NAME } from "../src/book.js";
import { objectState, liveSeam } from "./orderbook-harness.mjs";
import { world } from "./maker-trades.mjs";
import { installSockets, clockOf } from "./live-fakes.mjs";

const REPO = join(import.meta.dirname, "..");
const HERE = "https://desk.fixture.test";
const REV1 = "0a1b2c3d4e5f6a7b", REV2 = "f7e6d5c4b3a2f1e0";
const idOf = (name) => ({ name, equals: (o) => !!o && o.name === name });

/* the Book's namespace: one object a name, made on first ask, each with the 101 seam and its sockets recorded */
function namespace() {
  const books = new Map(), env = {};
  /* the platform's WebSocketPair is one global, so each request puts the pair of the object it goes to (its sockets recorded there) */
  const to = (name, request) => { const o = objectOf(name); liveSeam(o.book, o.made); return o.book.fetch(request); };
  let asks = 0;
  const ns = { idFromName: (n) => idOf(n), get: (id) => ({ fetch: (request) => { asks++; return to(id.name, request); } }) };
  env.BOOK = ns;
  const objectOf = (name) => {
    if (!books.has(name)) {
      const os = objectState(); os.id = idOf(name);
      const book = new Book(os, env), made = liveSeam(book);
      books.set(name, { os, book, made });
    }
    return books.get(name);
  };
  const call = (name, path, init) => to(name, new Request("https://book" + path, init));
  const post = (name, path, body) => call(name, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const open = async (name = LIVE_NAME) => { const o = objectOf(name), n = o.made.length; const res = await call(name, "/live", { headers: { Upgrade: "websocket" } }); return { res, ws: o.made.length > n ? o.made[o.made.length - 1] : null }; };
  return { ns, objectOf, call, post, open, live: () => objectOf(LIVE_NAME), asked: () => asks };
}

export async function run({ ok, pageWork }) {
  try { await theObject(ok); } catch (e) { ok(false, "the object stopped on an error: " + (e && e.stack)); }
  try { await theRoad(ok); } catch (e) { ok(false, "the road stopped on an error: " + (e && e.stack)); }
  try { await theTells(ok); } catch (e) { ok(false, "the tells stopped on an error: " + (e && e.stack)); }
  try { await thePage(ok); } catch (e) { ok(false, "the page stopped on an error: " + (e && e.stack)); }
}

/* ---- 1. the object ---- */
async function theObject(ok) {
  const N = namespace(), L = () => N.live();
  const loadBody = { rev: "r", book: { sales: [{ rid: "s1" }], purchases: [{ rid: "p1" }] }, pricing: { v: "x" } };

  /* the live object answers no load, recovery or window verb, and nothing it holds moves */
  const first = await N.open();
  await N.post(LIVE_NAME, "/rev", { id: REV1 });
  const refused = [
    (await N.post(LIVE_NAME, "/load", loadBody)).status,
    (await N.post(LIVE_NAME, "/pitr", { verb: "clear" })).status,
    (await N.post(LIVE_NAME, "/pitr", { verb: "readback" })).status,
    (await N.call(LIVE_NAME, "/window")).status];
  const loads = L().os.db.prepare("SELECT COUNT(*) AS c FROM loads").get().c, rows = L().os.db.prepare("SELECT COUNT(*) AS c FROM rows").get().c;
  const kept = L().os.db.prepare("SELECT id FROM live_rev").all();
  ok(refused.join() === "404,404,404,404" && loads === 0 && rows === 0 && kept.length === 1, "the live object answers /load, /pitr and /window with 404 and books nothing, and a clear verb leaves what it holds: " + refused.join() + " " + [loads, rows, kept.length]);

  /* every other name refuses the three live routes */
  const before = N.objectOf(BOOK_NAME).made.length;
  const other = [];
  for (const name of [BOOK_NAME, PITR_NAME, "elsewhere"]) {
    other.push((await N.call(name, "/live", { headers: { Upgrade: "websocket" } })).status, (await N.post(name, "/tell", { k: "orders" })).status, (await N.post(name, "/rev", { id: REV1 })).status);
  }
  const noTable = N.objectOf(BOOK_NAME).os.db.prepare("SELECT name FROM sqlite_master WHERE name = 'live_rev'").all().length;
  ok(other.every((s) => s === 404) && N.objectOf(BOOK_NAME).made.length === before && noTable === 0, "the Book and the recovery test object answer /live, /tell and /rev with 404 and open and store nothing: " + other.join());
  const bookLoad = await N.post(BOOK_NAME, "/load", loadBody);
  ok(bookLoad.status === 200 && (await bookLoad.json()).ok, "and the Book's own load is as it was");

  /* hello on accept, the tag, the attachment, the platform's auto response */
  ok(first.res.status === 200 && first.res.headers.get("x-upgraded") === "1" && first.ws && first.ws.tags.join() === "desk" && first.ws.kinds().length === 1 && first.ws.kinds()[0].k === "hello" && first.ws.sent[0] === '{"k":"hello"}',
    "an upgrade opens a socket tagged desk and sends it hello and nothing else: " + JSON.stringify(first.ws && [first.ws.tags, first.ws.sent]));
  const noUp = await N.call(LIVE_NAME, "/live");
  ok(noUp.status === 426 && L().made.length === 1, "a request that is not an upgrade is told 426 and opens nothing: " + noUp.status);
  const hadPair = globalThis.WebSocketRequestResponsePair;
  globalThis.WebSocketRequestResponsePair = class { constructor(request, response) { this.request = request; this.response = response; } };
  try {
    const N2 = namespace(); N2.live(); N2.objectOf(BOOK_NAME);
    const pair = N2.live().os.autoResponse(), none = N2.objectOf(BOOK_NAME).os.autoResponse();
    ok(pair && pair.request === "ping" && pair.response === "pong" && none === null, "the live object asks the platform to answer the ping, so it never wakes for one, and the Book does not");
  } finally { if (hadPair === undefined) delete globalThis.WebSocketRequestResponsePair; else globalThis.WebSocketRequestResponsePair = hadPair; }

  /* the cap: sixteen, the oldest closed for a seventeenth */
  const sockets = [first.ws];
  for (let i = 1; i < 16; i++) { sockets.push((await N.open()).ws); L().os.getWebSockets("desk")[i].att = { born: 1000 + i }; }
  first.ws.att = { born: 1 };
  ok(sockets.every((w) => !w.closed), "sixteen desk sockets stand together");
  const seventeenth = (await N.open()).ws;
  ok(first.ws.closed && first.ws.closed.code === 1008 && sockets.slice(1).every((w) => !w.closed) && !seventeenth.closed, "a seventeenth closes the oldest and no other: " + JSON.stringify(first.ws.closed));
  for (const w of [...sockets.slice(1), seventeenth]) w.close(1000, "tidy");

  /* the ping and the strikes: a socket only asks */
  const s = (await N.open()).ws;
  L().book.webSocketMessage(s, "ping");
  ok(s.sent.length === 2 && s.sent[1] === "pong" && !s.closed, "a ping is answered pong");
  L().book.webSocketMessage(s, '{"verb":"load"}'); L().book.webSocketMessage(s, "x");
  ok(!s.closed && L().os.db.prepare("SELECT COUNT(*) AS c FROM loads").get().c === 0, "two other messages are only counted, and book no load");
  L().book.webSocketMessage(s, '{"verb":"clear"}');
  ok(s.closed && s.closed.code === 1008, "the third other message closes the socket 1008: " + JSON.stringify(s.closed));
  const t = (await N.open()).ws;
  for (let i = 0; i < 4; i++) L().book.webSocketMessage(t, "ping");
  ok(!t.closed, "pings are never strikes");

  /* a tell reaches every desk socket, a kind and nothing else */
  const a = t, b = (await N.open()).ws, c = (await N.open()).ws;
  const told = await N.post(LIVE_NAME, "/tell", { k: "orders", id: "20261021-secret", u: "abcd-efgh", total: 99 });
  ok((await told.json()).sent === 3 && [a, b, c].every((w) => w.sent.at(-1) === '{"k":"orders"}'), "a tell sends every desk socket the kind alone, whatever else the body carried: " + JSON.stringify([a, b, c].map((w) => w.sent.at(-1))));
  await N.post(LIVE_NAME, "/tell", { k: "drafts" });
  ok([a, b, c].every((w) => w.sent.at(-1) === '{"k":"drafts"}'), "drafts is a kind too");
  const sent0 = a.sent.length;
  const bad = [(await N.post(LIVE_NAME, "/tell", { k: "rev" })).status, (await N.post(LIVE_NAME, "/tell", { k: "hello" })).status, (await N.post(LIVE_NAME, "/tell", {})).status, (await N.call(LIVE_NAME, "/tell", { method: "POST", body: "not json" })).status, (await N.call(LIVE_NAME, "/tell")).status];
  ok(bad.join() === "400,400,400,400,404" && a.sent.length === sent0, "a kind that is not orders or drafts, no kind, no JSON and a GET tell nobody: " + bad.join());
  b.send = () => { throw new Error("gone"); };
  const after = await N.post(LIVE_NAME, "/tell", { k: "orders" });
  ok((await after.json()).sent === 2 && a.sent.at(-1) === '{"k":"orders"}' && c.sent.at(-1) === '{"k":"orders"}', "a socket that cannot be sent to stops neither the next nor the answer");

  /* rev: the first is kept and tells nobody, the same tells nobody, a change tells every socket once */
  const N3 = namespace(), x = (await N3.open()).ws, y = (await N3.open()).ws;
  const r1 = await (await N3.post(LIVE_NAME, "/rev", { id: REV1 })).json();
  ok(r1.ok && !r1.changed && x.sent.length === 1 && y.sent.length === 1 && N3.live().os.db.prepare("SELECT id FROM live_rev").all()[0].id === REV1, "the first build id ever given is kept and tells nobody: " + JSON.stringify(r1));
  const r2 = await (await N3.post(LIVE_NAME, "/rev", { id: REV1 })).json();
  ok(r2.ok && !r2.changed && x.sent.length === 1 && y.sent.length === 1, "the same id again tells nobody");
  const r3 = await (await N3.post(LIVE_NAME, "/rev", { id: REV2 })).json();
  ok(r3.changed && x.sent.at(-1) === '{"k":"rev"}' && y.sent.at(-1) === '{"k":"rev"}' && x.sent.length === 2 && N3.live().os.db.prepare("SELECT id FROM live_rev").all()[0].id === REV2, "another id is kept and tells every desk socket rev, with no id in it: " + JSON.stringify(r3));
  const r4 = await (await N3.post(LIVE_NAME, "/rev", { id: REV2 })).json();
  ok(!r4.changed && x.sent.length === 2, "and tells once, not every minute");
  const badId = [(await N3.post(LIVE_NAME, "/rev", { id: "ABCDEF0123456789" })).status, (await N3.post(LIVE_NAME, "/rev", { id: "0123" })).status, (await N3.post(LIVE_NAME, "/rev", {})).status, (await N3.post(LIVE_NAME, "/rev", { id: 5 })).status];
  ok(badId.every((st) => st === 400) && x.sent.length === 2 && N3.live().os.db.prepare("SELECT COUNT(*) AS c FROM live_rev").get().c === 1 && N3.live().os.db.prepare("SELECT id FROM live_rev").get().id === REV2, "an id that is not sixteen lower-case hex characters is refused and kept nowhere: " + badId.join());
}

/* ---- 2. the road: GET /live ---- */
async function theRoad(ok) {
  const team = "livedesk-fixture", audience = "livedesk-audience", kid = "livedesk-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected live fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const jwtOf = async (claims) => {
      const c = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], exp: Math.floor(Date.now() / 1000) + 600, ...claims })).toString("base64url");
      return header + "." + c + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", signing.privateKey, new TextEncoder().encode(header + "." + c))).toString("base64url");
    };
    const owner = await jwtOf({ email: "maakmal97@icloud.com" }), stranger = await jwtOf({ email: "someone@example.test" });
    const service = await jwtOf({ common_name: "ci-live-client", sub: "" });
    for (const gate of ["0", "1"]) {
      const N = namespace();
      const env = { ACCESS_TEAM: team, ACCESS_AUD: audience, ACCESS_CI_CLIENT_ID: "ci-live-client", REQUIRE_ACCESS: gate, BOOK: N.ns };
      const go = (headers, e = env, init = {}) => desk.fetch(new Request(HERE + "/live", { headers, ...init }), e, {});
      const up = (extra) => ({ Upgrade: "websocket", Origin: HERE, ...extra });
      const tag = " (REQUIRE_ACCESS " + gate + ")";
      const none = await go(up({})), wrong = await go(up({ "cf-access-jwt-assertion": stranger })), viaService = await go(up({ "cf-access-jwt-assertion": service }));
      ok(none.status === 401 && /json/.test(none.headers.get("content-type")) && wrong.status === 401 && N.asked() === 0, "no Access, or Access as somebody else, is 401 and opens nothing, whatever REQUIRE_ACCESS says" + tag + ": " + [none.status, wrong.status]);
      ok(viaService.status === 401 && N.asked() === 0, "the CI service token never reaches the live socket" + tag + ": " + viaService.status);
      const plain = await go({ Origin: HERE, "cf-access-jwt-assertion": owner });
      ok(plain.status === 426 && N.asked() === 0, "the owner without an upgrade is told 426" + tag + ": " + plain.status);
      const foreign = await go(up({ Origin: "https://elsewhere.example", "cf-access-jwt-assertion": owner })), noOrigin = await go({ Upgrade: "websocket", "cf-access-jwt-assertion": owner });
      ok(foreign.status === 403 && noOrigin.status === 403 && N.asked() === 0, "a foreign Origin, or none, is refused 403 even for the owner (a cross-site page rides his Access cookie)" + tag + ": " + [foreign.status, noOrigin.status]);
      const unbound = await go(up({ "cf-access-jwt-assertion": owner }), { ...env, BOOK: undefined });
      ok(unbound.status === 503, "with no Book bound it is 503" + tag + ": " + unbound.status);
      const good = await go(up({ "cf-access-jwt-assertion": owner }));
      const sock = N.live().made[0];
      ok(good.status === 200 && good.headers.get("x-upgraded") === "1" && sock && sock.kinds()[0].k === "hello" && N.live().made.length === 1 && N.objectOf(BOOK_NAME).made.length === 0, "the owner's upgrade from the Desk's own origin reaches the live object, and only it" + tag + ": " + good.status);
    }
    const N = namespace(), env = { ACCESS_TEAM: team, ACCESS_AUD: audience, ACCESS_CI_CLIENT_ID: "ci-live-client", REQUIRE_ACCESS: "1", BOOK: N.ns };
    const post = await desk.fetch(new Request(HERE + "/live", { method: "POST", headers: { Upgrade: "websocket", Origin: HERE, "cf-access-jwt-assertion": owner } }), env, {});
    ok(post.status !== 200 && N.asked() === 0, "only a GET opens it: " + post.status);
  } finally { globalThis.fetch = originalFetch; }
}

/* ---- 3. the tells ---- */
async function theTells(ok) {
  const AT = "2099-10-05T01:00:00.000Z", AT2 = "2099-10-05T01:05:00.000Z";
  const sale = (at, party = "CX1-ZED") => ({ at, product: "salt", party, date: "2099-10-05", qty: 1, total: 130, cash: 170, movedUnits: 1, handover: "delivered", delivery: 40 });
  const setup = async () => {
    const wd = world(), N = namespace(), a = (await N.open()).ws, b = (await N.open()).ws;
    wd.desk.BOOK = N.ns;
    const sent = (k) => [a, b].every((w) => w.sent.filter((m) => m === JSON.stringify({ k })).length) ? a.sent.filter((m) => m === JSON.stringify({ k })).length : 0;
    return { wd, N, a, b, count: (w, k) => w.sent.filter((m) => m === JSON.stringify({ k })).length, sent };
  };
  const via = (wd, path, init, ctx) => desk.fetch(new Request(HERE + path, init), wd.desk, ctx || {});
  const post = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  /* a drafter pass that drafted a row, an approve and a reject tell drafts */
  {
    const { wd, a, b, count } = await setup();
    try {
      const res = await wd.call("/all/maker/inputs/sale", sale(AT)), answer = await res.json(), rows = wd.drafts();
      ok(res.status === 200 && rows.length === 1 && count(a, "drafts") === 1 && count(b, "drafts") === 1 && count(a, "orders") === 0, "a drafter pass that drafted a row tells every open desk drafts, and not orders: " + JSON.stringify([res.status, answer.error, a.sent]));
      const approve = await via(wd, "/drafts/" + encodeURIComponent(rows[0].id) + "/approve", post({}));
      ok(approve.status === 200 && count(a, "drafts") === 2 && count(b, "drafts") === 2, "an approve tells drafts: " + JSON.stringify([approve.status, a.sent]));
      const again = await via(wd, "/drafts/" + encodeURIComponent(rows[0].id) + "/approve", post({}));
      ok(again.status === 409 && count(a, "drafts") === 2, "an approve that decided nothing (409) tells nobody");
      const res2 = await wd.call("/all/maker/inputs/sale", sale(AT2, "AX1-ZED")); await res2.json();
      const next = wd.drafts().filter((r) => r.status === "pending");
      const reject = next.length ? await via(wd, "/drafts/" + encodeURIComponent(next[0].id) + "/reject", post({})) : { status: 0 };
      ok(next.length === 1 && reject.status === 200 && count(a, "drafts") === 4, "a reject tells drafts too (the second row's own pass, then its reject): " + JSON.stringify([next.length, reject.status, a.sent.length]));
    } finally { wd.sqlite.close(); }
  }
  /* the other roads to the drafter: the manual run, the quarter-hour net and the queue's arrival each tell drafts when they draft */
  {
    const { wd, a, count } = await setup();
    try {
      const made = await wd.call("/all/maker/inputs/sale", sale(AT)); await made.json();
      const qkey = [...wd.map.keys()].find((k) => k.startsWith("q:")), queue = JSON.parse(wd.map.get(qkey)).queue;
      const redo = () => wd.sqlite.exec("DELETE FROM draft");
      const quiet = async (f) => { const l = console.log; console.log = () => {}; try { return await f(); } finally { console.log = l; } };
      let n = count(a, "drafts");
      redo();
      const manual = await via(wd, "/draft-now", { method: "POST" }), mj = await manual.json();
      ok(manual.status === 200 && mj.drafted >= 1 && count(a, "drafts") === n + 1, "a manual run of the drafter that drafted a row tells drafts: " + JSON.stringify([manual.status, mj.drafted, count(a, "drafts") - n]));
      n = count(a, "drafts"); redo();
      await quiet(async () => { const waits = []; await desk.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-10-21T02:15:00Z") }, wd.desk, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); });
      ok(count(a, "drafts") === n + 1, "so does the quarter-hour net: " + (count(a, "drafts") - n));
      n = count(a, "drafts");
      await quiet(async () => { const waits = []; await desk.scheduled({ cron: "* * * * *", scheduledTime: Date.parse("2026-10-21T02:30:00Z") }, wd.desk, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); });
      ok(count(a, "drafts") === n, "a pass that finds nothing new to draft tells nobody: " + (count(a, "drafts") - n));
      n = count(a, "drafts"); redo();
      const waits = [], arrival = await via(wd, "/queue", post({ device: "d-live", updated: "2026-10-21T02:00:00Z", queue }), { waitUntil: (p) => waits.push(p) });
      await quiet(() => Promise.all(waits));
      ok(arrival.status === 200 && count(a, "drafts") === n + 1, "an entry that arrives on the queue and is drafted on arrival tells drafts: " + JSON.stringify([arrival.status, count(a, "drafts") - n]));
    } finally { wd.sqlite.close(); }
  }
  /* the maker's Add ID files a name and a place, and its pass through the drafter tells drafts too */
  {
    const { wd, a, count } = await setup();
    try {
      const seal = (text) => ({ v: 1, salt: Buffer.alloc(16, 1).toString("base64"), iv: Buffer.alloc(12, 2).toString("base64"), ct: Buffer.from(text.padEnd(16, ".")).toString("base64") });
      const res = await wd.call("/all/maker/inputs/add-id", { at: AT, code: "CX7-QED", kind: "customer", parent: null, tiers: null, vault: seal("encrypted-live-desk") });
      const answer = await res.json();
      ok(res.status === 200 && wd.drafts().length === 1 && count(a, "drafts") === 1, "an Add ID the maker files and the drafter drafts tells drafts: " + JSON.stringify([res.status, answer.error, a.sent]));
    } finally { wd.sqlite.close(); }
  }
  /* a Book that fails, or none, never fails the tap: a tell is a nudge */
  {
    const { wd } = await setup();
    try {
      wd.desk.BOOK = { idFromName: () => { throw new Error("no Book"); }, get: () => { throw new Error("no Book"); } };
      const res = await wd.call("/all/maker/inputs/sale", sale(AT)); const id = wd.drafts()[0] && wd.drafts()[0].id;
      const approve = id ? await via(wd, "/drafts/" + encodeURIComponent(id) + "/approve", post({})) : { status: 0 };
      delete wd.desk.BOOK;
      const res2 = await wd.call("/all/maker/inputs/sale", sale(AT2, "AX1-ZED"));
      ok(res.status === 200 && approve.status === 200 && res2.status === 200, "a Book that throws, or none bound, leaves the drafter, the approve and the maker input as they were: " + [res.status, approve.status, res2.status]);
    } finally { wd.sqlite.close(); }
  }
  /* an order tap the Desk relays tells orders; a line on the thread moves nothing and tells nothing; the reconcile its tap sets going tells too */
  {
    const { wd, a, b, count } = await setup();
    try {
      const posts = [];
      let owing = [];
      wd.desk.STMT_DESK_KEY = "live-desk-key";
      wd.map.set("stmt-users", JSON.stringify({ "abcd-efgh": "CX1-ZED" }));
      wd.desk.STMT_SITE = { fetch: async (url, init) => {
        const u = new URL(url), method = (init && init.method) || "GET";
        if (method === "POST") { posts.push(u.pathname); return Response.json({ ok: true, order: { id: "o1", u: "abcd-efgh", status: "acknowledged" } }); }
        return Response.json({ ok: true, orders: owing, last: null });
      } };
      const waits = [], ctx = { waitUntil: (p) => waits.push(p) }, quiet = async (f) => { const l = console.log; console.log = () => {}; try { return await f(); } finally { console.log = l; } };
      const line = await via(wd, "/orders/abcd-efgh/o1", post({ message: "Friday is fine" }), ctx); await Promise.all(waits);
      ok(line.status === 200 && posts.length === 1 && count(a, "orders") === 0, "a line on an order's thread moves no goods and tells no desk: " + [line.status, a.sent.length]);
      const move = await via(wd, "/orders/abcd-efgh/o1", post({ status: "acknowledged" }), ctx); await Promise.all(waits);
      ok(move.status === 200 && count(a, "orders") === 1 && count(b, "orders") === 1 && count(a, "drafts") === 0, "a status the Desk relays tells every open desk orders, once: " + [move.status, a.sent]);
      owing = [{ id: "20261021000000-aaaa", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0, mode: "collect", paid: 0, claimed: 0, moved: 0, status: "acknowledged",
        at: "2026-10-21T01:00:00.000Z", history: [{ at: "2026-10-21T01:00:00.000Z", status: "acknowledged", by: "desk" }], payments: [], work: ["ack"], queued: {} }];
      const o0 = count(a, "orders");
      const move2 = await quiet(async () => { const r = await via(wd, "/orders/abcd-efgh/o1", post({ status: "acknowledged" }), ctx); await Promise.all(waits); return r; });
      ok(move2.status === 200 && count(a, "orders") === o0 + 2 && count(a, "drafts") === 1, "and the reconcile that tap sets going, when it queues a stage, tells orders again and the drafter pass it runs tells drafts: " + JSON.stringify(a.sent));
    } finally { wd.sqlite.close(); }
  }
  /* the minute: a reconcile that queued something tells orders, a drafter pass tells drafts, and the build is told */
  {
    const { wd, N, a, b, count } = await setup();
    try {
      let rev = REV1;
      wd.desk.ASSETS = { fetch: async () => Response.json({ id: rev, v: "v1" }) };
      wd.desk.STMT_DESK_KEY = "live-desk-key";
      wd.map.set("stmt-users", JSON.stringify({ "abcd-efgh": "CX1-ZED" }));
      const order = { id: "20261021000000-aaaa", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0, mode: "collect", paid: 0, claimed: 0, moved: 0, status: "acknowledged",
        at: "2026-10-21T01:00:00.000Z", history: [{ at: "2026-10-21T01:00:00.000Z", status: "acknowledged", by: "desk" }], payments: [],
        work: ["ack"], queued: {} };
      let owing = [];
      wd.desk.STMT_SITE = { fetch: async (url, init) => {
        const u = new URL(url), method = (init && init.method) || "GET";
        if (method === "GET" && u.pathname === "/desk/orders/last") return Response.json({ ok: true, last: null, orders: owing });
        if (method === "GET") return Response.json({ ok: true, orders: owing });
        return Response.json({ ok: true, order, push: null });
      } };
      const tick = async (iso) => {
        const waits = [], realLog = console.log; console.log = () => {};
        try { await desk.scheduled({ cron: "* * * * *", scheduledTime: Date.parse(iso) }, wd.desk, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); } finally { console.log = realLog; }
      };
      {
        await tick("2026-10-21T02:01:00Z");
        ok(count(a, "orders") === 0 && count(a, "drafts") === 0 && a.sent.length === 1 && b.sent.length === 1, "a quiet minute tells nobody, and the first build id it hands the live object is kept in silence: " + JSON.stringify(a.sent));
        await tick("2026-10-21T02:02:00Z");
        ok(a.sent.length === 1, "the same build the next minute tells nobody");
        rev = REV2; await tick("2026-10-21T02:03:00Z");
        ok(count(a, "rev") === 1 && count(b, "rev") === 1, "the minute that finds the Worker serving another build tells every open desk rev: " + JSON.stringify(a.sent));
        await tick("2026-10-21T02:04:00Z");
        ok(count(a, "rev") === 1, "and only that minute");
        owing = [order];
        await tick("2026-10-21T02:05:00Z");
        ok(count(a, "orders") === 1 && count(b, "orders") === 1, "a minute whose reconcile queued a stage tells every open desk orders: " + JSON.stringify(a.sent));
        ok(count(a, "drafts") === 1 && count(b, "drafts") === 1, "and the drafter pass that drafted its row tells them drafts: " + JSON.stringify(a.sent));
        const dayBefore = a.sent.length; owing = [];
        await tick("2026-10-21T02:06:00Z");
        ok(a.sent.length === dayBefore, "a minute with nothing owing tells nobody");
        wd.desk.ASSETS = {}; N.live().os.getWebSockets("desk");
        await tick("2026-10-21T02:07:00Z");
        ok(a.sent.length === dayBefore, "a Worker that cannot read its build manifest tells nothing and the minute carries on");
      }
    } finally { wd.sqlite.close(); }
  }
}

/* ---- 4. the page: the freshness block as the build ships it ---- */
async function thePage(ok) {
  const src = readFileSync(join(REPO, "tools", "build.mjs"), "utf8");
  const arr = /const PWA_BLOCK = (\[[\s\S]*?\n\])\.join\(EOL\);/.exec(src);
  const block = arr ? new Function("IDTOKEN", "EOL", "return " + arr[1] + ".join(EOL);")("__ID__", "\n") : "";
  const tickSrc = (block.match(/\(function\(\)\{\s*var chip=null,timer=null;[\s\S]*?\n\}\)\(\);/) || [])[0];
  ok(!!tickSrc && tickSrc.includes("function connect()"), "the shipped freshness block carries the live socket");
  if (!tickSrc) return;
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  const rig = (opts = {}) => {
    const t = { now: Date.parse("2026-10-21T04:00:00Z"), fresh: 0, chips: 0, reads: [], ap: 0, ord: 0, vis: "visible", active: null, listeners: {}, wlisteners: {}, socks: [], dead: false, posts: 0 };
    const win = { SALT_CLOUD: true, getComputedStyle: (e) => e.style, setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
      addEventListener: (type, fn) => { (t.wlisteners[type] = t.wlisteners[type] || []).push(fn); } };
    if (!opts.noSocket) installSockets(win, t.socks);
    t.clock = clockOf(win); t.clock.capture = true;
    const doc = { get visibilityState() { return t.vis; }, get activeElement() { return t.active; }, querySelectorAll: () => [],
      addEventListener: (type, fn) => { (t.listeners[type] = t.listeners[type] || []).push(fn); },
      getElementById: () => null, createElement: () => { t.chips++; return { setAttribute() {}, set onclick(f) {} }; }, body: { appendChild() {}, classList: { contains: () => false } } };
    const fetchStub = (path) => { t.reads.push(String(path)); return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "OLDID", v: "v1" }) }); };
    class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(t.now); } static now() { return t.now; } }
    new Function("window", "document", "fetch", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "location", "navigator", "Date", "SALT_REV_MS", "SALT_BUILD_ID", "saltFresh",
      "queue", "qSyncState", "qPost", "qNewestAt", "qSentThrough", "qDirty", "saltWriteKey", "apLoad", "apBusy", "ordLoad", "ordBusy", tickSrc)(
      win, doc, fetchStub, win.setInterval, win.clearInterval, win.setTimeout, win.clearTimeout, { protocol: opts.proto || "https:", host: "desk.fixture.test" }, {}, FakeDate, 10000, "OLDID", () => { t.fresh++; },
      opts.queue || [], "server", () => { t.posts++; }, () => "", "", !!opts.dirty, () => "k-fixture", () => { t.ap++; }, undefined, () => { t.ord++; }, undefined);
    t.start = async () => { (t.wlisteners.load || []).forEach((f) => f({})); await flush(); };
    t.revReads = () => t.reads.filter((p) => p === "rev").length;
    t.fire = (type) => (t.listeners[type] || []).forEach((f) => f({}));
    t.show = () => (t.wlisteners.pageshow || []).forEach((f) => f({}));
    t.up = (i = t.socks.length - 1) => { const s = t.socks[i]; s.open(); s.receive({ k: "hello" }); return s; };
    t.pending = (ms) => t.clock.pending(ms);
    t.every = (ms) => t.clock.live(ms)[0].f();
    t.fireOne = (ms) => { const p = t.pending(ms); if (p.length) t.clock.fire(p[0]); return p.length; };
    return t;
  };

  /* the socket, and the poll that follows it */
  {
    const t = rig(); await t.start();
    ok(t.socks.length === 1 && t.socks[0].url === "wss://desk.fixture.test/live" && t.socks[0].protocols.length === 0, "with SALT_CLOUD the block opens wss://<host>/live: " + JSON.stringify(t.socks.map((s) => s.url)));
    ok(t.clock.live(10000).length === 1 && t.clock.live(60000).length === 0 && t.clock.live(45000).length === 0, "before hello the /rev poll runs every ten seconds and nothing pings");
    const reads = t.revReads();
    t.up();
    ok(t.clock.live(10000).length === 0 && t.clock.live(60000).length === 1 && t.clock.live(45000).length === 1 && t.revReads() === reads, "on hello the poll falls to a minute, a ping every 45 seconds starts, and the first hello reads nothing: " + JSON.stringify(t.clock.ints.map((i) => [i.ms, i.off])));
    t.socks[0].drop();
    ok(t.clock.live(60000).length === 0 && t.clock.live(10000).length === 1 && t.clock.live(45000).length === 0, "when the socket closes the poll is ten seconds again and the ping stops: " + JSON.stringify(t.clock.ints.map((i) => [i.ms, i.off])));
    const http = rig({ proto: "http:" }); await http.start();
    ok(http.socks[0].url === "ws://desk.fixture.test/live", "a page served over http opens ws://, not wss://: " + http.socks[0].url);
    const bare = rig({ noSocket: true }); await bare.start();
    ok(bare.revReads() === 1 && bare.clock.live(10000).length === 1, "a browser with no WebSocket keeps the ten-second poll and the load read, and nothing throws");
  }
  /* rev runs tick; other kinds and noise do nothing */
  {
    const t = rig(); await t.start(); const s = t.up(); const r0 = t.revReads();
    s.receive({ k: "rev" }); await flush();
    ok(t.revReads() === r0 + 1, "rev reads /rev now: " + (t.revReads() - r0));
    s.receive({ k: "other" }); s.receive("not json"); s.receive(null); s.receive("pong"); s.receive({ k: "hello" }); await flush();
    ok(t.revReads() === r0 + 1 && t.ap === 0 && t.ord === 0 && t.pending(300).length === 0, "an unknown kind, noise and a second hello read nothing");
    const stray = t.socks[0]; t.socks[0].drop(); const next = t.socks.length;
    stray.receive({ k: "rev" }); await flush();
    ok(t.revReads() === r0 + 1 && t.socks.length === next, "a message from a socket the page has let go reads nothing");
  }
  /* drafts and orders run the wake once a burst, 300 ms later */
  {
    const t = rig(); await t.start(); const s = t.up(); await flush();
    const r0 = t.revReads();
    s.receive({ k: "drafts" }); s.receive({ k: "orders" }); s.receive({ k: "drafts" });
    ok(t.pending(300).length === 1 && t.ap === 0 && t.ord === 0, "three events in a burst wait one 300 ms timer, and read nothing yet: " + t.pending(300).length);
    t.fireOne(300); await flush();
    ok(t.ap === 1 && t.ord === 1 && t.revReads() === r0 + 1, "the timer runs the wake once: the drafts, the orders and the build, each read once: " + JSON.stringify([t.ap, t.ord, t.revReads() - r0]));
    s.receive({ k: "orders" });
    ok(t.pending(300).length === 1, "the next burst waits a timer of its own");
    t.fireOne(300); await flush();
    ok(t.ap === 2 && t.ord === 2, "and runs the wake again");
    t.vis = "hidden"; s.receive({ k: "drafts" }); t.fireOne(300); await flush();
    ok(t.ap === 2 && t.ord === 2, "the wake keeps its own guards: a hidden desk reads nothing");
  }
  /* backoff: 1, 2 and 4 seconds, three tries without hello, then it waits for the page to be shown */
  {
    const t = rig(); await t.start();
    t.socks[0].drop();
    ok(t.pending(1000).length === 1 && t.socks.length === 1, "a socket that closes without hello is tried again after 1 second");
    t.fireOne(1000); ok(t.socks.length === 2, "(the retry opens one socket)");
    t.socks[1].drop();
    ok(t.pending(2000).length === 1 && t.pending(1000).length === 0, "and then after 2 seconds");
    t.fireOne(2000); t.socks[2].drop();
    ok(t.pending(4000).length === 1, "and then after 4 seconds");
    t.fireOne(4000); t.socks[3].drop();
    ok(t.socks.length === 4 && t.pending(1000).length + t.pending(2000).length + t.pending(4000).length + t.pending(8000).length === 0, "after three retries without a hello it stops: " + t.socks.length + " sockets");
    t.vis = "visible"; t.fire("visibilitychange");
    ok(t.socks.length === 5, "the page being shown again reconnects: " + t.socks.length);
    t.socks[4].drop();
    ok(t.pending(1000).length === 1, "and gets its three tries again, from 1 second");
    t.fireOne(1000); t.socks[5].drop(); t.fireOne(2000); t.socks[6].drop(); t.fireOne(4000); t.socks[7].drop();
    const n = t.socks.length; t.show();
    ok(t.socks.length === n + 1, "pageshow reconnects too: " + t.socks.length);
    t.vis = "hidden"; const m = t.socks.length; t.socks[t.socks.length - 1].drop(); t.fireOne(1000);
    ok(t.socks.length === m + 1, "(a timer already waiting still fires)");
  }
  {
    const t = rig(); await t.start(); t.up(); t.socks[0].drop();
    ok(t.pending(1000).length === 1, "a socket that had said hello and closes is tried after 1 second");
    t.fireOne(1000); t.socks[1].drop(); t.fireOne(2000); t.socks[2].drop(); t.fireOne(4000);
    t.up(3); t.socks[3].drop();
    ok(t.pending(1000).length === 1 && t.pending(2000).length === 0, "and a hello puts the count back to nought");
  }
  /* a reconnect that reaches hello reads once */
  {
    const t = rig(); await t.start(); t.up(); const r0 = t.revReads();
    t.socks[0].drop(); t.fireOne(1000); const s = t.up(1); await flush();
    ok(t.revReads() === r0 + 1, "a reconnect that reaches hello reads /rev once, a deploy that closed the socket being the signal: " + (t.revReads() - r0));
    s.receive({ k: "hello" }); await flush();
    ok(t.revReads() === r0 + 1, "and only once");
  }
  /* the ping on show, with its five-second deadline, and the ping every 45 seconds */
  {
    const t = rig(); await t.start(); const s0 = t.socks[0]; s0.open();
    t.fire("visibilitychange");
    ok(s0.sent.length === 0 && t.pending(5000).length === 0, "a socket that has not said hello is not pinged on show");
    s0.receive({ k: "hello" });
    t.fire("visibilitychange");
    ok(s0.sent.join() === "ping" && t.pending(5000).length === 1, "a page shown with the socket up pings at once and waits 5 seconds for the pong: " + JSON.stringify(s0.sent));
    s0.receive("pong");
    ok(t.pending(5000).length === 0 && t.clock.live(60000).length === 1, "the pong stands the deadline down");
    t.show();
    ok(s0.sent.join() === "ping,ping" && t.pending(5000).length === 1, "pageshow pings too");
    s0.close = function () { this.closedByPage = true; };   /* a dead network answers no close either: the page must let it go itself */
    t.fireOne(5000);
    ok(s0.closedByPage && t.clock.live(60000).length === 0 && t.clock.live(10000).length === 1 && t.pending(1000).length === 1 && t.clock.live(45000).length === 0, "no pong in 5 seconds drops the socket, the poll is ten seconds again and a reconnect is waiting: " + JSON.stringify(t.clock.ints.map((i) => [i.ms, i.off])));
    t.fireOne(1000); const s1 = t.up(1);
    t.every(45000);
    ok(s1.sent.join() === "ping" && t.pending(5000).length === 1, "the 45 second timer pings with the same deadline: " + JSON.stringify(s1.sent));
    t.fireOne(5000);
    ok(s1.closedByPage, "(and the deadline closes it)");
  }
  /* TODAY is a live read */
  {
    const t = rig(); await t.start();
    t.now = Date.parse("2026-10-21T15:30:00Z");
    t.every(10000);
    ok(t.fresh === 0 && t.chips === 0, "the same Kuala Lumpur day reloads nothing: " + JSON.stringify([t.fresh, t.chips]));
    t.now = Date.parse("2026-10-21T16:01:00Z");
    const r0 = t.revReads(); t.every(10000);
    ok(t.fresh === 1 && t.chips === 0 && t.revReads() === r0, "once it is a new day there (UTC+8, 00:01 on the 22nd) an idle desk loads fresh: " + JSON.stringify([t.fresh, t.chips]));
    const busy = rig(); await busy.start(); busy.active = { tagName: "INPUT" };
    busy.now = Date.parse("2026-10-21T16:01:00Z"); busy.every(10000);
    ok(busy.fresh === 0 && busy.chips === 1, "a busy desk is offered the chip, not reloaded over: " + JSON.stringify([busy.fresh, busy.chips]));
    const owed = rig({ queue: [{ at: "2026-10-21T15:00:00Z" }], dirty: true }); await owed.start(); owed.active = { tagName: "INPUT" };
    owed.now = Date.parse("2026-10-21T16:01:00Z"); const p0 = owed.posts; owed.every(10000);
    ok(owed.posts === p0 + 1 && owed.chips === 1, "and a busy desk left past midnight still sends its unsent queue on the tick (Fable, L1): " + JSON.stringify([owed.posts - p0, owed.chips]));
    const hidden = rig(); await hidden.start(); hidden.vis = "hidden"; hidden.now = Date.parse("2026-10-21T16:01:00Z"); hidden.every(10000);
    ok(hidden.fresh === 0 && hidden.chips === 0, "and a desk that is not on screen waits until it is: " + JSON.stringify([hidden.fresh, hidden.chips]));
    const late = rig(); await late.start(); late.now = Date.parse("2026-10-21T15:59:00Z");
    late.every(10000);
    ok(late.fresh === 0, "23:59 in Kuala Lumpur is still the same day");
  }
}
