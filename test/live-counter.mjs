/* test/live-counter.mjs: THE COUNTER'S LIVE SOCKETS (Speed Wave 2 L2, 21 Oct 2026; stmt/orderbook.js, stmt/worker.js, stmt/page.js, stmt/owner.js).
 *
 * An open page holds one WebSocket to the order book, which tells it the KIND of thing that moved and its id, and the page then reads what it
 * always read; the poll stays as the net. Proof is at the handshake (the subprotocol carries the session), a message from a socket only asks,
 * and a Log out or Sign out everywhere closes the account's sockets. Driven on the real roads: the Counter Worker, the order book over node:sqlite
 * with the hibernation API's fake (test/orderbook-harness.mjs), the Access JWT fixture, then the customer's page and Salt Admin in jsdom with a
 * socket that connects to nothing (test/live-fakes.mjs). Every code, name and password here is invented. Each check was proved red by its own
 * mutation (test/live-counter.mutations.json, run with tools/section.mjs).
 *   1  the roads: kv answers 404, no upgrade 426, a foreign Origin 403, no or a bad session 401, /all/live past Access alone
 *   2  the object: proof carried, the subprotocol echoed, hello, the caps; the ping and the strikes; the platform's auto response
 *   3  the tell: a move reaches its account and the owner, never another account; a retry and a no-op tell nothing; kinds and ids only
 *   4  revocation: unlive, and Log out, device sign out and both of Sign out everywhere call it; a socket past its session is closed
 *   5  the customer's page: the handshake, the polls at a minute and back, one re-read for a burst, backoff and stop, ping, Log out
 *   6  Salt Admin: the same, on /all/live, Needs you and Orders and Chat */
import { webcrypto } from "node:crypto";
import counter from "../stmt/worker.js";
import { OrderBook } from "../stmt/orderbook.js";
import { orderBook, liveSeam, fakeServerSocket, objectState } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { installSockets, clockOf } from "./live-fakes.mjs";
import * as O from "../stmt/orders.js";

const BASE = "https://counter.fixture.test";
const A = "abcd-efgh", B = "jkmn-pqrs", U1 = "abcd-efgh";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run({ ok, pageWork }) {
  try { await roads(ok); } catch (e) { ok(false, "the roads stopped on an error: " + (e && e.stack)); }
  try { await customerPage(ok, pageWork); } catch (e) { ok(false, "the customer's page stopped on an error: " + (e && e.stack)); }
  try { await ownerPage(ok, pageWork); } catch (e) { ok(false, "Salt Admin stopped on an error: " + (e && e.stack)); }
}

/* ---- 1 to 4: the Worker, the object and the sockets ---- */
async function roads(ok) {
  const store = new Store(), team = "live-fixture", audience = "live-audience", kid = "live-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected live fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const jwtOf = async (email) => {
      const c = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
      return header + "." + c + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", signing.privateKey, new TextEncoder().encode(header + "." + c))).toString("base64url");
    };
    const owner = await jwtOf("maakmal97@icloud.com"), stranger = await jwtOf("someone@example.test");
    const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "live-local-master", ORDER_STORE: "object" };
    const harness = orderBook(env);
    const made = liveSeam(harness.book);
    env.ORDERBOOK = harness.ns;
    const kvEnv = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "live-local-master" };   /* the kv road: no ORDER_STORE */
    const go = (path, headers, e = env, init = {}) => counter.fetch(new Request(BASE + path, { headers, ...init }), e);
    const up = (extra) => ({ Upgrade: "websocket", Origin: BASE, ...extra });
    const sessionOf = async (u) => O.mintSession(env, u);
    const connect = async (tok, extra, path = "/live") => {
      const before = made.length;
      const res = await go(path, path === "/live" ? up({ "Sec-WebSocket-Protocol": "stmt, " + tok, ...extra }) : up({ "cf-access-jwt-assertion": tok, ...extra }));
      return { res, ws: made.length > before ? made[made.length - 1] : null };
    };
    const connectOwner = (extra) => connect(owner, extra, "/all/live");
    const book = (op, body) => harness.book.fetch(new Request("https://orderbook/" + op, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).then((r) => r.json());
    const evCount = () => harness.db.prepare("SELECT count(*) n FROM ev").get().n;
    const kinds = (ws) => ws.kinds();

    /* ---- 1. the roads ---- */
    const tA = await sessionOf(A), tB = await sessionOf(B);
    const kvLive = await go("/live", up({ "Sec-WebSocket-Protocol": "stmt, " + tA }), kvEnv), kvOwner = await go("/all/live", up({ "cf-access-jwt-assertion": owner }), kvEnv);
    ok(kvLive.status === 404, "the kv road answers /live with the site's 404, so its page keeps the ten-second poll: " + kvLive.status);
    ok(kvOwner.status === 404, "and /all/live the same, past Access: " + kvOwner.status);
    const asked0 = harness.calls();
    const noUp = await go("/live", { Origin: BASE, "Sec-WebSocket-Protocol": "stmt, " + tA }), noUpOwner = await go("/all/live", { Origin: BASE, "cf-access-jwt-assertion": owner });
    ok(noUp.status === 426 && noUpOwner.status === 426 && made.length === 0 && harness.calls() === asked0, "a request that is not an upgrade is told 426 on both roads, before the book is asked, and opens nothing: " + [noUp.status, noUpOwner.status]);
    const direct = await harness.book.fetch(new Request("https://orderbook/live?as=c&u=" + A)), directNoU = await harness.book.fetch(new Request("https://orderbook/live?as=c", { headers: { Upgrade: "websocket" } }));
    ok(direct.status === 426 && directNoU.status === 400 && made.length === 0, "the book itself refuses what is not an upgrade (426) and a customer's socket that names no account (400): " + [direct.status, directNoU.status]);
    const foreign = await go("/live", up({ Origin: "https://elsewhere.example", "Sec-WebSocket-Protocol": "stmt, " + tA })), foreignNone = await go("/live", { Upgrade: "websocket", "Sec-WebSocket-Protocol": "stmt, " + tA });
    ok(foreign.status === 403 && foreignNone.status === 403 && made.length === 0 && harness.calls() === asked0, "a foreign Origin, or none, is refused 403 on the customer's road: " + [foreign.status, foreignNone.status]);
    const foreignOwner = await go("/all/live", up({ Origin: "https://elsewhere.example", "cf-access-jwt-assertion": owner }));
    ok(foreignOwner.status === 403 && made.length === 0 && harness.calls() === asked0, "and on the owner's, whose Access cookie rides on a cross-site request: " + foreignOwner.status);
    const noProto = await go("/live", up({})), badTok = await go("/live", up({ "Sec-WebSocket-Protocol": "stmt, " + "x".repeat(30) })), onlyStmt = await go("/live", up({ "Sec-WebSocket-Protocol": "stmt" }));
    const wrongFirst = await go("/live", up({ "Sec-WebSocket-Protocol": "other, " + tA }));
    ok([noProto, badTok, onlyStmt, wrongFirst].every((r) => r.status === 401) && made.length === 0 && harness.calls() === asked0, "no session, a session the store lacks, and a subprotocol list that is not stmt and a session are 401 and open nothing: "
      + [noProto, badTok, onlyStmt, wrongFirst].map((r) => r.status));
    const noAccess = await go("/all/live", up({})), wrongMail = await go("/all/live", up({ "cf-access-jwt-assertion": stranger }));
    ok(noAccess.status === 401 && wrongMail.status === 401 && made.length === 0 && harness.calls() === asked0, "/all/live without Access, or past it as somebody else, is 401: " + [noAccess.status, wrongMail.status]);

    /* ---- 2. the object: proof carried, echoed, hello, the caps ---- */
    const a1 = await connect(tA);
    ok(a1.res.status === 200 && a1.res.headers.get("x-upgraded") === "1" && a1.ws && a1.ws.att.u === A && a1.ws.att.r === "c", "a session at the handshake opens a socket carrying that account and no other: " + JSON.stringify(a1.ws && a1.ws.att));
    ok(a1.res.headers.get("Sec-WebSocket-Protocol") === "stmt", "the subprotocol is echoed, or a browser fails the handshake: " + a1.res.headers.get("Sec-WebSocket-Protocol"));
    ok(kinds(a1.ws).length === 1 && kinds(a1.ws)[0].k === "hello" && Math.abs(a1.ws.att.exp - a1.ws.att.born - O.SESSION_TTL * 1000) < 5, "it is sent hello and nothing else, and ends with its session: " + JSON.stringify([a1.ws.sent, a1.ws.att]));
    const o1 = await connectOwner();
    ok(o1.res.status === 200 && o1.ws.att.r === "owner" && o1.ws.att.u === undefined && !o1.res.headers.get("Sec-WebSocket-Protocol") && kinds(o1.ws)[0].k === "hello", "the owner's socket past Access is tagged owner, names no account and echoes no subprotocol");
    const tagged = harness.state.getWebSockets("c").length === 1 && harness.state.getWebSockets("owner").length === 1;
    ok(tagged, "customers and the owner are tagged apart when accepted, so a tell reads each by its tag");
    const b1 = await connect(tB);
    /* the caps: eight an account, the oldest closed for a ninth; four for the owner */
    const more = []; for (let i = 0; i < 7; i++) more.push((await connect(tA)).ws);
    ok(more.every((w) => !w.closed) && !a1.ws.closed, "eight sockets of one account stand together");
    const ninth = (await connect(tA)).ws;
    ok(a1.ws.closed && a1.ws.closed.code === 1008 && more.every((w) => !w.closed) && !ninth.closed && !b1.ws.closed, "a ninth closes the oldest of that account and no other: " + JSON.stringify(a1.ws.closed));
    const os = [o1.ws]; for (let i = 0; i < 3; i++) os.push((await connectOwner()).ws);
    ok(os.every((w) => !w.closed), "four owner sockets stand together");
    const fifth = (await connectOwner()).ws;
    ok(os[0].closed && !os[1].closed && !fifth.closed, "a fifth closes the oldest owner socket");
    for (const w of [...more, ninth, ...os.slice(1), fifth]) w.close(1000, "tidy");

    const mk = async (u, serial) => {
      const at = new Date().toISOString();
      const order = O.decidePlace(u, { product: "salt", qty: 3, total: 285, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest: "live-list", rid: "live-fixture-" + serial + "-pad-pad" }, [], at, "live-list").ev.order;
      order.id = "20261021" + "090" + String(serial).padStart(3, "0") + "-l" + serial;
      harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
      return order.id;
    };
    const idC = await mk(A, 10);
    /* the ping and the strikes: a socket only asks */
    const s1 = (await connect(tA)).ws;
    const before = evCount();
    for (let i = 0; i < 5; i++) harness.book.webSocketMessage(s1, "ping");
    ok(!s1.closed && s1.sent.filter((m) => m === "pong").length === 5, "the ping is answered pong, again and again, and is no strike");
    harness.book.webSocketMessage(s1, JSON.stringify({ op: "desk", u: A, id: idC, body: { status: "acknowledged", mode: "collect" } }));
    harness.book.webSocketMessage(s1, "place");
    ok(!s1.closed && evCount() === before, "a message that asks for a move moves nothing, and two strikes leave the socket open");
    harness.book.webSocketMessage(s1, "third");
    ok(s1.closed && s1.closed.code === 1008, "the third message that is not the ping closes it 1008: " + JSON.stringify(s1.closed));
    const fresh = fakeServerSocket(); harness.state.acceptWebSocket(fresh, ["c"]); fresh.serializeAttachment({ r: "c", u: A, born: Date.now(), exp: Date.now() + 1e6 });
    harness.book.webSocketClose(fresh, 1005, ""); harness.book.webSocketError(fakeServerSocket());
    ok(fresh.closed && fresh.closed.code === 1000, "a close from the page is answered with a clean one");
    const autos = []; const pairWas = globalThis.WebSocketRequestResponsePair;
    globalThis.WebSocketRequestResponsePair = class { constructor(request, response) { this.request = request; this.response = response; } };
    try { const st = objectState(); st.setWebSocketAutoResponse = (p) => autos.push([p.request, p.response]); new OrderBook(st, {}); } finally { if (pairWas === undefined) delete globalThis.WebSocketRequestResponsePair; else globalThis.WebSocketRequestResponsePair = pairWas; }
    ok(autos.length === 1 && autos[0][0] === "ping" && autos[0][1] === "pong", "where the platform offers it, ping is answered pong without waking the object: " + JSON.stringify(autos));

    {
      const h2 = orderBook({}); const m2 = liveSeam(h2.book);
      const call = (q) => h2.book.fetch(new Request("https://orderbook/live?" + q, { headers: { Upgrade: "websocket" } }));
      for (let i = 0; i < 396; i++) await call("as=c&u=u" + i);
      for (let i = 0; i < 4; i++) await call("as=owner");
      const full = await call("as=c&u=late"), fullOwner = await call("as=owner");
      ok(m2.length === 400 && m2.every((w) => !w.closed) && full.status === 503 && fullOwner.status === 503, "400 sockets in all, and the 401st is refused 503: " + [m2.length, full.status, fullOwner.status]);
      liveSeam(harness.book, made);   /* the first seam's sockets again */
    }

    /* ---- 3. the tell ---- */
    harness.state.sockets.forEach((w) => { if (!w.closed) w.close(1000, "tidy"); });
    const sa = (await connect(tA)).ws, sa2 = (await connect(tA)).ws, sb = (await connect(tB)).ws, so = (await connectOwner()).ws;
    const idA = await mk(A, 11), idB = await mk(B, 12);
    for (const w of [sa, sa2, sb, so]) w.sent.length = 0;
    const move1 = await book("desk", { u: A, id: idA, body: { status: "acknowledged", mode: "collect", rid: "live-move-0001-padded-00" } });
    ok(move1.ok && JSON.stringify(kinds(sa)) === JSON.stringify([{ k: "order", id: idA }]) && JSON.stringify(kinds(sa2)) === JSON.stringify([{ k: "order", id: idA }]),
      "a move on A's order tells every socket of A its kind and its id, and nothing else: " + JSON.stringify([sa.sent, sa2.sent]));
    ok(sb.sent.length === 0, "and never B's: " + JSON.stringify(sb.sent));
    ok(JSON.stringify(kinds(so)) === JSON.stringify([{ k: "order", u: A, id: idA }]), "the owner is told the account as well: " + JSON.stringify(so.sent));
    for (const w of [sa, sa2, sb, so]) w.sent.length = 0;
    const again = await book("desk", { u: A, id: idA, body: { status: "acknowledged", mode: "collect", rid: "live-move-0001-padded-00" } });
    ok(again.again === true && [sa, sa2, sb, so].every((w) => w.sent.length === 0), "a retry of the same move is answered again and tells nothing: " + JSON.stringify([again.again, sa.sent, so.sent]));
    const none = await book("tdesk", { u: A, body: { noReply: true } });
    ok(none.none === true && [sa, sa2, sb, so].every((w) => w.sent.length === 0), "a move that changes nothing tells nothing: " + JSON.stringify([none.none, sa.sent, so.sent]));
    const refused = await book("tsay", { u: A, rid: "live-thread-0002-padded", body: { text: "   " } });
    ok(refused.ok === false && [sa, sa2, sb, so].every((w) => w.sent.length === 0), "a refused move tells nothing");
    await book("tsay", { u: B, rid: "live-thread-0001-padded", body: { text: "Is Friday fine" } });
    ok(JSON.stringify(kinds(sb)) === JSON.stringify([{ k: "thread" }]) && sa.sent.length === 0 && JSON.stringify(kinds(so)) === JSON.stringify([{ k: "thread", u: B }]), "a line on B's thread tells B's sockets thread, no id and no words, and the owner whose it is: " + JSON.stringify([sb.sent, so.sent]));
    for (const w of [sa, sa2, sb, so]) w.sent.length = 0;
    const pool = await book("popen", { body: { product: "salt", q: 1, target: 10 } });
    ok(pool.ok && JSON.stringify(kinds(sa)) === JSON.stringify([{ k: "pool", id: pool.order.id }]) && JSON.stringify(kinds(sb)) === JSON.stringify([{ k: "pool", id: pool.order.id }])
      && JSON.stringify(kinds(so)) === JSON.stringify([{ k: "pool", u: "", id: pool.order.id }]), "a group order opened tells every customer socket and the owner pool and its id: " + JSON.stringify([sa.sent, sb.sent, so.sent]));
    for (const w of [sa, sa2, sb, so]) w.sent.length = 0;
    /* a socket past its session's life is closed at the next tell, whoever's it is, and sent nothing */
    sa2.serializeAttachment({ ...sa2.deserializeAttachment(), exp: Date.now() - 1 });
    await book("desk", { u: B, id: idB, body: { status: "acknowledged", mode: "collect", rid: "live-move-0002-padded-00" } });
    ok(sa2.closed && sa2.closed.code === 1008 && sa2.sent.length === 0 && !sa.closed && sb.sent.length === 1, "a socket past its session is closed at the next tell, sent nothing, and the others carry on: " + JSON.stringify([sa2.closed, sa2.sent]));

    /* ---- 4. revocation ---- */
    const un = await book("unlive", { u: A });
    ok(un.ok && un.closed === 1 && sa.closed && sa.closed.code === 1008 && !sb.closed && !so.closed, "unlive closes every socket of that account and no other, the owner's included in none: " + JSON.stringify(un));
    const bad = await book("unlive", {});
    ok(bad.ok === false && bad.status === 400, "and names the account or is refused");
    const reopen = async () => { const t = await sessionOf(A); return { t, ws: (await connect(t)).ws }; };
    let c = await reopen();
    const out = await go("/logout", { "content-type": "application/json", "X-Stmt-Session": c.t }, env, { method: "POST", body: "{}" });
    ok(out.status === 200 && c.ws.closed && c.ws.closed.code === 1008 && !sb.closed, "Log out closes the account's sockets: " + out.status);
    c = await reopen();
    const dev = await go("/devices/signout", { "content-type": "application/json", "X-Stmt-Session": c.t }, env, { method: "POST", body: "{}" });
    ok(dev.status === 200 && c.ws.closed, "signing the other devices out closes the account's sockets, and a live one re-proves itself in seconds: " + dev.status);
    c = await reopen();
    const all = await go("/all/signout", { "content-type": "application/json", "cf-access-jwt-assertion": owner }, env, { method: "POST", body: JSON.stringify({ u: A }) });
    ok(all.status === 200 && c.ws.closed && !sb.closed, "Sign out everywhere closes the account's sockets: " + all.status);
    c = await reopen();
    const one = await go("/all/signout", { "content-type": "application/json", "cf-access-jwt-assertion": owner }, env, { method: "POST", body: JSON.stringify({ u: A, id: "no-such-device" }) });
    ok(one.status === 200 && c.ws.closed, "and so does ending one of its devices: " + one.status);
    ok(!sb.closed && !so.closed, "B's socket and the owner's stand through all four");
  } finally { globalThis.fetch = originalFetch; if (globalThis.WebSocketPair) delete globalThis.WebSocketPair; }
}

/* ---- 5. the customer's page ---- */
async function customerPage(ok, pageWork) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const until = async (f, n = 200) => { for (let i = 0; i < n && !f(); i++) await sleep(15); return f(); };
  const u = "abcd-efgh", pass = "fixture-pass-live", ck = await C.contentKey("live-secret", u);
  const at = new Date(Date.now() - 3600e3).toISOString();
  const opened = { ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-live-0123456789abcdef", liveStatus: "none", env: await C.encryptWith(ck, JSON.stringify({ statements: [] })),
    prices: await C.encryptWith(ck, JSON.stringify({ at, week: { monday: at.slice(0, 10), label: "This week" }, products: [{ product: "salt", unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] }], soon: [] })) };
  const wins = [];
  const page = async (test) => {
    const seen = { orders: 0, threads: 0, inflight: 0, max: 0, gate: null, paths: [] }, socks = [];
    let work, clock;
    const prefix = test ? "/all/test/c" : "";
    const html = test ? P.landingPage(u, "nlt", null, null, { base: "/all/test/c", u }) : P.landingPage(u, "nlv", null);
    const dom = new JSDOM(html, { url: test ? "https://site.test/all/test/c?u=" + u : "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = function () {};
      installSockets(win, socks); clock = clockOf(win);
      win.fetch = async (path, init) => {
        const q = String(path).slice(prefix.length), m = (init && init.method) || "GET";
        seen.paths.push(m + " " + q);
        let j = null;
        if (q === "/open" || q === "/account") j = opened;
        else if (q === "/orders" && m === "GET") {
          seen.orders++; seen.inflight++; seen.max = Math.max(seen.max, seen.inflight);
          if (seen.gate) await seen.gate;
          seen.inflight--; j = { ok: true, orders: [], claims: [], thread: { at, msgs: [{ by: "desk", text: "Friday is fine", at }] } };
        } else if (q === "/thread") { seen.threads++; j = { ok: true, thread: { at, msgs: [{ by: "desk", text: "Friday is fine", at }] } }; }
        else if (q === "/pools") j = { ok: true, pools: [] };
        else if (q === "/hours") j = { ok: true, open: true, nextChange: null };
        else if (q === "/logout") j = { ok: true };
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document, w = dom.window;
    const before = socks.length;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden); await work.quiet();
    return { w, d, work, socks, seen, clock, before };
  };
  try {
    const T = await page(true);
    const R = await page(false);
    ok(R.before === 0 && R.socks.length === 1, "no socket is opened before sign-in, and one after it: " + JSON.stringify([R.before, R.socks.length]));
    ok(T.socks.length === 0, "the test surface keeps its two-second poll and opens none: " + T.socks.length);
    const s = R.socks[0];
    ok(s.url === "wss://site.test/live" && JSON.stringify(s.protocols) === JSON.stringify(["stmt", "sess-live-0123456789abcdef"]),
      "the page opens wss://<host>/live offering the subprotocols stmt and its session, so the proof is the handshake itself: " + JSON.stringify([s.url, s.protocols]));
    ok(R.clock.live(10000).length === 1 && R.clock.live(60000).length === 0, "before hello the orders poll runs every ten seconds");
    s.open().receive({ k: "hello" });
    ok(R.clock.live(10000).length === 0 && R.clock.live(60000).length === 1, "on hello the orders poll falls to a minute, and stays as the net: " + JSON.stringify(R.clock.ints.map((i) => [i.ms, i.off])));

    /* a burst of events is one re-read; one that arrives while a read is out runs after it, never beside it */
    let b = R.seen.orders;
    for (let i = 0; i < 3; i++) s.receive({ k: "order", id: "20261021090011-l11" });
    await until(() => R.seen.orders > b, 60); await sleep(400); await R.work.quiet();
    ok(R.seen.orders === b + 1, "three events in a burst are re-read once: " + (R.seen.orders - b));
    b = R.seen.orders; let release; R.seen.gate = new Promise((r) => { release = r; }); R.seen.max = 0;
    s.receive({ k: "claim", id: "a1" });
    await until(() => R.seen.inflight === 1, 60);
    s.receive({ k: "pool", id: "p1" }); await sleep(400);
    ok(R.seen.inflight === 1 && R.seen.orders === b + 1, "an event that arrives while a re-read is out waits for it: " + JSON.stringify([R.seen.inflight, R.seen.orders - b]));
    R.seen.gate = null; release(); await until(() => R.seen.orders === b + 2, 60); await sleep(100); await R.work.quiet();
    ok(R.seen.orders === b + 2 && R.seen.max === 1, "and runs once after it, never two at once: " + JSON.stringify([R.seen.orders - b, R.seen.max]));
    b = R.seen.orders; const t0 = R.seen.threads;
    s.receive({ k: "thread" }); await until(() => R.seen.orders > b, 60); await R.work.quiet();
    ok(R.seen.orders === b + 1 && R.seen.threads === t0, "a thread event with the thread closed re-reads the orders, which bring it: " + JSON.stringify([R.seen.orders - b, R.seen.threads - t0]));
    const opener = R.d.querySelector('#aGlance [data-glance="thread"]') || R.d.querySelector("#hThread .throw") || R.d.getElementById("hThread");
    if (opener) opener.click(); await until(() => !R.d.getElementById("thSheet").hidden, 40); await R.work.quiet();
    b = R.seen.orders; const t1 = R.seen.threads;
    ok(!R.d.getElementById("thSheet").hidden, "(the thread sheet is open)");
    s.receive({ k: "thread" }); await until(() => R.seen.threads > t1, 60); await sleep(350); await R.work.quiet();
    ok(R.seen.threads === t1 + 1 && R.seen.orders === b, "with the thread open it reads the thread alone: " + JSON.stringify([R.seen.threads - t1, R.seen.orders - b]));
    ok(R.clock.live(60000).length >= 1 && R.clock.ints.filter((i) => i.ms === 2000 && !i.off).length === 0, "and the thread's own poll is no faster than a minute while the socket is up: " + JSON.stringify(R.clock.ints.map((i) => [i.ms, i.off])));

    /* the ping: answered within five seconds, or the socket is let go and made again */
    R.clock.capture = true;
    const ping = R.clock.live(45000)[0];
    ok(!!ping, "a ping runs every 45 seconds while the socket is up");
    ping.f();
    ok(s.sent.filter((m) => m === "ping").length === 1 && R.clock.pending(5000).length === 1, "it sends ping and waits five seconds for the answer");
    s.receive("pong");
    ok(R.clock.pending(5000).length === 0, "pong ends the wait");
    ping.f(); R.clock.fire(R.clock.pending(5000)[0]);
    ok(s.closedByPage && R.clock.pending(1000).length === 1, "no pong in five seconds and the socket is let go, to be made again in a second: " + JSON.stringify(R.clock.touts.map((t) => [t.ms, t.off])));
    R.clock.fire(R.clock.pending(1000)[0]);
    ok(R.socks.length === 2 && R.clock.live(10000).length === 1 && R.clock.live(60000).length === 0, "the new socket is made, and until its hello the polls are back at ten seconds and two: " + R.socks.length);

    /* backoff 1, 2, 4 seconds, then three attempts without a hello stop until the page is shown again */
    R.socks[1].drop();
    ok(R.clock.pending(2000).length === 1, "an attempt that never reaches hello is tried again after two seconds");
    R.clock.fire(R.clock.pending(2000)[0]); R.socks[2].drop();
    ok(R.clock.pending(4000).length === 1, "and then after four");
    const queued = R.clock.touts.length;
    R.clock.fire(R.clock.pending(4000)[0]); R.socks[3].drop();
    ok(R.socks.length === 4 && R.clock.touts.length === queued, "three attempts without a hello stop it trying: " + R.socks.length);
    R.d.dispatchEvent(new R.w.Event("visibilitychange"));
    ok(R.socks.length === 5, "and the page shown again tries once more");
    await R.work.quiet(); await sleep(100); await R.work.quiet();   /* the page's own re-read on a return settles first */
    b = R.seen.orders;
    R.socks[4].open().receive({ k: "hello" });
    R.clock.pending(250).forEach((t) => R.clock.fire(t));   /* the debounce, held by the clock */
    await until(() => R.seen.orders > b, 60); await sleep(350); await R.work.quiet();
    ok(R.seen.orders === b + 1, "a hello after a lost socket re-reads once, for what was missed meanwhile: " + (R.seen.orders - b));
    ok(R.clock.live(10000).length === 0 && R.clock.live(60000).length >= 1, "(and a hello puts the polls at a minute again)");
    R.socks[4].drop();
    ok(R.clock.live(10000).length === 1 && R.clock.live(60000).length === 0, "a socket that closes puts the polls back at ten seconds and two: " + JSON.stringify(R.clock.ints.map((i) => [i.ms, i.off])));
    R.clock.fire(R.clock.pending(1000).pop());
    ok(R.socks.length === 6, "and it is made again after a second");

    /* Log out closes it, and nothing reconnects */
    const last = R.socks[5]; last.open().receive({ k: "hello" });
    const lock = R.d.getElementById("lock"); lock.click(); lock.click(); await R.work.quiet(); await sleep(50);
    const pend = R.clock.touts.filter((t) => !t.off && t.ms >= 1000).length;
    ok(last.closedByPage && R.socks.length === 6 && pend === 0, "Log out closes the socket and nothing makes another: " + JSON.stringify([last.closedByPage, R.socks.length, pend]));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}

/* ---- 6. Salt Admin ---- */
async function ownerPage(ok, pageWork) {
  const live = async (extra = {}) => { const p = await richOwnerPage({ pageWork, ...extra }); await p.work.quiet(); return p; };
  const hide = (p, on) => { Object.defineProperty(p.d, "hidden", { configurable: true, get: () => on }); p.d.dispatchEvent(new p.w.Event("visibilitychange")); };
  let p = await live();
  try {
    const s = p.sockets[0];
    ok(p.sockets.length === 1 && s.url === "wss://counter.fixture.test/all/live" && s.protocols.length === 0, "Salt Admin opens wss://<host>/all/live at load, offering no subprotocol (Access is its proof): " + JSON.stringify([p.sockets.length, s && s.url, s && s.protocols]));
    const five = () => p.intervals.filter((i) => i.ms === 5000 && !i.off).length, minute = () => p.intervals.filter((i) => i.ms === 60000 && !i.off).length;
    ok(five() === 1 && minute() === 0, "before hello Needs you is read every five seconds");
    s.open().receive({ k: "hello" });
    ok(five() === 0 && minute() === 1, "on hello the read falls to a minute and stays as the net: " + JSON.stringify(p.intervals.filter((i) => !i.off).map((i) => i.ms)));
    p.reads.length = 0;
    s.receive({ k: "order", u: U1, id: "20261021090011-l11" }); await p.work.quiet();
    ok(p.reads.includes("/all/maker/review") && p.reads.includes("/all/maker/claims") && p.reads.includes("/all/maker/threads"), "an event while Needs you shows reads what Needs you reads, at once: " + JSON.stringify(p.reads));
    byAct(p.d, "nav.orders").click(); await p.work.quiet(); p.reads.length = 0;
    s.receive({ k: "claim", u: U1, id: "a1" }); await p.work.quiet();
    ok(p.reads.includes("/all/maker/review") && p.reads.includes("/all/maker/claims") && !p.reads.includes("/all/maker/threads"), "and on Orders it reads the orders and the payments: " + JSON.stringify(p.reads));
    byAct(p.d, "nav.needs").click(); await p.work.quiet();
    hide(p, true);
    p.reads.length = 0;
    s.receive({ k: "order", u: U1, id: "x" }); await p.work.quiet();
    ok(p.reads.length === 0, "a hidden page reads nothing, and the event is read when the page is shown: " + JSON.stringify(p.reads));
    hide(p, false); await p.work.quiet();
    ok(p.reads.includes("/all/maker/review"), "the page shown again reads: " + JSON.stringify(p.reads));
    const k0 = p.timers.length;
    s.drop();
    ok(five() === 1 && minute() === 0, "a socket that closes puts the read back at five seconds: " + JSON.stringify(p.intervals.filter((i) => !i.off).map((i) => i.ms)));
    const retry = (k) => p.timers.slice(k).filter((t) => !t.off && t.ms >= 1000 && t.ms <= 30000);
    ok(retry(k0).length === 1 && retry(k0)[0].ms === 1000, "and it is made again after a second: " + JSON.stringify(retry(k0).map((t) => t.ms)));
    let k1 = p.timers.length; retry(k0)[0].f(); p.sockets[1].drop();
    ok(retry(k1).length === 1 && retry(k1)[0].ms === 2000, "an attempt that never reaches hello is tried again after two seconds: " + JSON.stringify(retry(k1).map((t) => t.ms)));
    k1 = p.timers.length; retry(k1 - 1).find((t) => t.ms === 2000).f(); p.sockets[2].drop();
    ok(retry(k1).length === 1 && retry(k1)[0].ms === 4000, "then after four: " + JSON.stringify(retry(k1).map((t) => t.ms)));
    k1 = p.timers.length; retry(k1 - 1).find((t) => t.ms === 4000).f(); const n = p.timers.length; p.sockets[3].drop();
    ok(p.sockets.length === 4 && p.timers.length === n, "three attempts without a hello stop it trying: " + p.sockets.length);
    p.d.dispatchEvent(new p.w.Event("visibilitychange"));
    ok(p.sockets.length === 5, "until the page is shown again");
  } finally { p.w.close(); }

  /* Chat: an event is read while the Chat is open, and its own poll is a minute while the socket is up */
  p = await live({ hash: "#customers/messages" });
  try {
    byAct(p.d, "chat.open", U1).click(); await p.work.quiet();
    const s = p.sockets[0], chat = (ms) => p.intervals.filter((i) => i.ms === ms && !i.off).length;
    ok(chat(2000) === 1, "an open Chat is read every two seconds before hello: " + JSON.stringify(p.intervals.filter((i) => !i.off).map((i) => i.ms)));
    s.open().receive({ k: "hello" });
    ok(chat(2000) === 0 && chat(60000) >= 1, "and every minute once the socket is up: " + JSON.stringify(p.intervals.filter((i) => !i.off).map((i) => i.ms)));
    p.reads.length = 0;
    s.receive({ k: "thread", u: U1 }); await p.work.quiet();
    ok(p.reads.includes("/all/maker/threads"), "a thread event re-reads the Chat that is open: " + JSON.stringify(p.reads));
    s.drop();
    ok(chat(2000) === 1, "and the two seconds return when the socket closes");
  } finally { p.w.close(); }

  /* the test surface's Salt Admin keeps its poll and opens none */
  const P = await import("../stmt/page.js"), { JSDOM } = await import("jsdom");
  const open = (test) => {
    const socks = [];
    const dom = new JSDOM(P.landingPage("", "nlo", { master: "", accounts: [] }, null, test), { url: "https://counter.fixture.test/all" + (test ? "/test/admin" : ""), runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; installSockets(win, socks);
      win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });
    } });
    return { socks, w: dom.window };
  };
  const real = open(null), prac = open({ base: "/all/test" });
  try {
    await sleep(60);
    ok(real.socks.length === 1 && prac.socks.length === 0, "Salt Admin opens its socket, and its practice view opens none: " + JSON.stringify([real.socks.length, prac.socks.length]));
  } finally { real.w.close(); prac.w.close(); }
}
