/* test/admin-push.mjs: SALT ADMIN'S OWN NOTIFICATIONS (19 Oct 2026, docs/plan-notifications.html section 3, P2 and P3).
 * The Desk wakes Salt Admin over the service binding (POST /desk/owner-wake { k, o? }); the Counter seals { k, o } to each subscription filed
 * under opush: and answers { ok, devices, sent, failed }; Admin's own worker (GET /all/sw.js, scope /all) shows the banner and a tap opens the
 * place that answers it; the bell on Shop > This device turns it on and off from a tap. Phones are real keys: the wake is sealed to them and read
 * back here. Every code, name and endpoint is invented. Every assertion was proved red by its own mutation (test/admin-push.mutations.json).
 *   A  the wake: refused without the Desk's key, for a kind it does not know and for a bad order id; devices 0 with none subscribed; sealed {k, o}
 *      and nothing else, one topic a kind, reported as devices and sent; a gone endpoint (410) pruned; a failing one counted and kept
 *   B  the store: subscribe and unsubscribe sit inside the gate, refuse what is not https or has no keys, file at opush: and never push:;
 *      a customer's listings and its alerts count read push: alone; no fixture road wakes Admin
 *   C  the worker: /all/sw.js behind both locks with Service-Worker-Allowed: /all; each kind its title, a tag and renotify; an unknown or missing
 *      payload the fixed banner; no name rides; a tap focuses an open Admin and tells it where, else opens it there
 *   D  the bell: asked from a tap alone, registers /all/sw.js at /all, files the subscription, says On, turns off, never touches a registration
 *      that is not Admin's, says On on opening when already subscribed, opens the place a banner names; not drawn on the test surface or the door */
import vm from "node:vm";
import { surface } from "./test-surface-harness.mjs";
import { ADMIN_SW_JS, ADMIN_NEWS, ADMIN_FALLBACK } from "../stmt/admin-sw.js";
import { listSubs, endpointId, wakeEveryone } from "../stmt/push.js";
import * as O from "../stmt/orders.js";
import { richOwnerPage } from "./maker-act.mjs";

const b64u = (a) => Buffer.from(a).toString("base64url");
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const te = new TextEncoder();
const hk = async (salt, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info },
  await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
/* a phone: its keys as the page files them, and RFC 8291's receiving side to read what is sealed to it */
async function phone() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  const read = async (msg) => {
    const salt = msg.slice(0, 16), idlen = msg[20], asPub = msg.slice(21, 21 + idlen), ct = msg.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, kp.privateKey, 256));
    const ikm = await hk(auth, secret, cat(te.encode("WebPush: info"), [0], pub, asPub), 32);
    const cek = await hk(salt, ikm, cat(te.encode("Content-Encoding: aes128gcm"), [0]), 16), nonce = await hk(salt, ikm, cat(te.encode("Content-Encoding: nonce"), [0]), 12);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
    let end = pt.length - 1; while (end > 0 && pt[end] === 0) end--;
    return JSON.parse(new TextDecoder().decode(pt.slice(0, end)));
  };
  return { keys: { p256dh: b64u(pub), auth: b64u(auth) }, read, pub };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ORDER = "20261019010000-ab1";

export async function run({ ok, pageWork }) {
  const s = await surface();
  try {
    const vp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    Object.assign(s.env, { STMT_VAPID_PUBLIC_KEY: "admin-push-public", STMT_VAPID_SUBJECT: "mailto:a@b.test",
      STMT_VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", vp.privateKey)) });
    /* push endpoints answer as told; everything else is the harness's own */
    const base = globalThis.fetch, hits = [], status = {};
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (u.startsWith("https://push.example/")) { hits.push({ u, h: init.headers, body: init.body }); return new Response("", { status: status[u] || 201 }); }
      return base(url, init);
    };
    /* KV's bulk read, which the sheet uses, answers a Map; the harness's store reads one key */
    const one = s.store.get.bind(s.store);
    s.store.get = async (k, t) => (Array.isArray(k) ? new Map(await Promise.all(k.map(async (x) => [x, await one(x, t)]))) : one(k, t));
    const KEY = s.env.STMT_DESK_KEY;
    const wake = async (body, key = KEY, method = "POST") => {
      const r = await s.counter.fetch(new Request("https://counter.fixture.test/desk/owner-wake", {
        method, headers: { ...(key ? { "X-Stmt-Desk": key } : {}), "content-type": "application/json" }, ...(method === "POST" ? { body: JSON.stringify(body) } : {}) }), s.env);
      return { status: r.status, j: await r.json().catch(() => null) };
    };
    const sub = async (body, auth = s.jwt, path = "/all/push/subscribe") => {
      const r = await s.owner(path, body, auth); return { status: r.status, j: await r.json().catch(() => null) };
    };
    const A = await phone(), B = await phone(), C = await phone();
    const EA = "https://push.example/admin-a", EB = "https://push.example/admin-b", EC = "https://push.example/admin-c";
    const keysOf = (store) => [...store.values.keys()];

    /* ---- A. THE WAKE ---- */
    const noKey = await wake({ k: "order" }, ""), badKey = await wake({ k: "order" }, "not-the-desk-key");
    ok(noKey.status === 401 && badKey.status === 401 && hits.length === 0,
      "POST /desk/owner-wake is refused without the Desk's key and with another, and nothing is sent: " + JSON.stringify([noKey.status, badKey.status, hits.length]));
    const get = await wake(null, KEY, "GET");
    ok(get.status === 405, "the wake answers only POST: " + get.status);
    const badKind = await wake({ k: "hello" }), noKind = await wake({}), badOrder = await wake({ k: "pay", o: "a b/../c" }), longOrder = await wake({ k: "pay", o: "x".repeat(41) });
    ok(badKind.status === 400 && noKind.status === 400, "a kind outside order, pay, cancel, said, rate, take, pass and approve is refused: " + JSON.stringify([badKind.status, noKind.status]));
    ok(badOrder.status === 400 && longOrder.status === 400, "an order id that is not a short id is refused: " + JSON.stringify([badOrder.status, longOrder.status]));
    const empty = await wake({ k: "order" });
    ok(empty.status === 200 && same(empty.j, { ok: true, devices: 0, sent: 0, failed: 0 }) && hits.length === 0,
      "with no subscription the answer is devices 0 and nothing is sent: " + JSON.stringify(empty));

    /* ---- B (first half). SUBSCRIPTIONS ---- */
    const none = await sub({ endpoint: EA, keys: A.keys }, ""), other = await sub({ endpoint: EA, keys: A.keys }, await s.token("someone@example.test"));
    ok(none.status === 401 && other.status === 401 && keysOf(s.store).filter((k) => k.startsWith("opush:")).length === 0,
      "subscribe is inside the gate: refused without the Access JWT and for another email, and nothing is filed: " + JSON.stringify([none.status, other.status]));
    const httpEp = await sub({ endpoint: "http://push.example/x", keys: A.keys }), httpOff = await sub({ endpoint: "http://push.example/x" }, s.jwt, "/all/push/unsubscribe"),
      longEp = await sub({ endpoint: "https://push.example/" + "x".repeat(1000), keys: A.keys }), noEp = await sub({ keys: A.keys });
    ok(httpEp.status === 400 && httpOff.status === 400 && noEp.status === 400, "an endpoint that is not https, or missing, is refused by subscribe and unsubscribe: " + JSON.stringify([httpEp.status, httpOff.status, noEp.status]));
    ok(longEp.status === 400, "an endpoint over 1000 characters is refused: " + longEp.status);
    const noKeys = await sub({ endpoint: EA }), badKeys = await sub({ endpoint: EA, keys: { p256dh: "short", auth: "short" } });
    ok(noKeys.status === 400 && badKeys.status === 400 && keysOf(s.store).filter((k) => k.startsWith("opush:")).length === 0,
      "a subscription without its two keys, or with keys that are not a P-256 key and sixteen secret bytes, is refused and nothing is filed: " + JSON.stringify([noKeys.status, badKeys.status]));
    const getSub = await s.owner("/all/push/subscribe", undefined, s.jwt, "GET");
    ok(getSub.status === 405, "subscribe answers only POST: " + getSub.status);
    const okA = await sub({ endpoint: EA, keys: A.keys }), okB = await sub({ endpoint: EB, keys: B.keys });
    const idA = await endpointId(EA), recA = JSON.parse(s.store.values.get("opush:" + idA) || "null");
    ok(okA.status === 200 && okA.j.ok === true && recA && recA.endpoint === EA && same(recA.keys, A.keys) && typeof recA.at === "string" && okB.status === 200,
      "a valid subscription is filed at opush:<hash of the endpoint> with its endpoint, its keys and its time: " + JSON.stringify([okA.status, recA]));
    ok(keysOf(s.store).filter((k) => k.startsWith("opush:")).length === 2 && keysOf(s.store).every((k) => !k.startsWith("push:")),
      "Admin's subscriptions are filed under opush: and never under push:: " + JSON.stringify(keysOf(s.store).filter((k) => /push/.test(k))));

    /* ---- A (second half). SEND ---- */
    const sent = await wake({ k: "pay", o: ORDER });
    const reads = await Promise.all(hits.map((x) => (x.u === EA ? A : B).read(x.body)));
    ok(sent.status === 200 && same(sent.j, { ok: true, devices: 2, sent: 2, failed: 0 }) && hits.length === 2,
      "a wake is sent to each subscription under opush: and reports devices and sent: " + JSON.stringify([sent, hits.length]));
    ok(reads.length === 2 && reads.every((r) => same(r, { k: "pay", o: ORDER })),
      "what is sealed to each phone is { k, o } and nothing else, read back with the phone's own keys: " + JSON.stringify(reads));
    ok(hits.every((x) => /^a-pay-[0-9a-f]{16}$/.test(x.h.Topic) && x.h.Topic.length <= 32 && x.h["Content-Encoding"] === "aes128gcm"),
      "each wake takes a topic of its kind and order within the push service's 32 characters: " + JSON.stringify(hits.map((x) => x.h.Topic)));
    ok(hits.every((x) => /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=admin-push-public$/.test(x.h.Authorization)),
      "each wake is signed with the site's own VAPID pair: " + JSON.stringify(hits.map((x) => x.h.Authorization)));
    hits.length = 0;
    const bare = await wake({ k: "approve" });
    const bareRead = await A.read(hits.find((x) => x.u === EA).body);
    ok(bare.j && bare.j.sent === 2 && same(bareRead, { k: "approve" }) && hits.every((x) => x.h.Topic === "a-approve"),
      "a kind with no order id is sealed as { k } alone under the topic of the kind: " + JSON.stringify([bareRead, hits.map((x) => x.h.Topic)]));
    /* a third phone that fails, a second that is gone */
    hits.length = 0;
    await sub({ endpoint: EC, keys: C.keys });
    status[EB] = 410; status[EC] = 500;
    const mixed = await wake({ k: "said" });
    ok(mixed.j && mixed.j.devices === 2 && mixed.j.sent === 1 && mixed.j.failed === 1 && !s.store.values.has("opush:" + await endpointId(EB)),
      "an endpoint the push service says is gone (410) is deleted and no longer counted among the devices: " + JSON.stringify([mixed.j, keysOf(s.store).filter((k) => k.startsWith("opush:")).length]));
    ok(s.store.values.has("opush:" + await endpointId(EC)), "an endpoint that merely failed (500) is counted as failed and kept");
    status[EC] = 201;

    /* ---- B (second half). THE CUSTOMER'S SIDE NEVER READS opush: ---- */
    const CU = "abcd-efgh", EU = "https://push.example/customer-u";
    await s.store.put("u:" + CU, JSON.stringify({ u: CU }));
    await s.store.put("push:" + CU + ":k1", JSON.stringify({ endpoint: EU, at: "2026-10-01T00:00:00Z", keys: (await phone()).keys }));
    const listed = await listSubs(s.env), listedU = await listSubs(s.env, CU);
    ok(listed.length === 1 && listed[0].endpoint === EU && listedU.length === 1,
      "a listing of the customers' subscriptions holds push: records alone: " + JSON.stringify(listed.map((x) => x.endpoint)));
    hits.length = 0;
    await wakeEveryone(s.env);
    ok(hits.length === 1 && hits[0].u === EU, "a notice to everybody reaches the customer's phone and none of Admin's: " + JSON.stringify(hits.map((x) => x.u)));
    const sheet = await (await s.owner("/all/sheet", undefined, s.jwt, "GET")).json();
    const row = (sheet.accounts || []).find((a) => a.username === CU);
    ok(row && row.alerts === 1, "the per-account alerts count reads push: records alone, so Admin's phones are no account's alerts: " + JSON.stringify(row && row.alerts));
    const off = await sub({ endpoint: EA }, s.jwt, "/all/push/unsubscribe");
    ok(off.status === 200 && !s.store.values.has("opush:" + idA) && s.store.values.has("opush:" + await endpointId(EC)),
      "unsubscribe deletes that endpoint's record and no other: " + JSON.stringify([off.status, keysOf(s.store).filter((k) => k.startsWith("opush:")).length]));

    /* a fixture move wakes Admin never */
    const tok = await O.mintSession(s.env, "0000-0002"), at = new Date(Date.now() - 3600e3).toISOString();
    await s.putFixture("0000-0002", { orders: [], makerOrders: [], prices: { digest: "admin-push" }, thread: { u: "0000-0002", msgs: [{ at, by: "maker", text: "Hello there" }] } });
    hits.length = 0; const bridged = s.bridge.length;
    const said = await s.owner("/all/test/c/thread", { text: "Hello back", rid: "admin-push-fixture-0001-padded" }, s.jwt, "POST", { "X-Stmt-Session": tok });
    ok(said.status === 200 && hits.filter((x) => x.u.includes("admin-")).length === 0 && s.bridge.length === bridged,
      "a test account's move under /all/test wakes Salt Admin never: " + JSON.stringify([said.status, hits.map((x) => x.u), s.bridge.length - bridged]));

    /* ---- C. THE WORKER ---- */
    const swAt = (auth) => s.counter.fetch(new Request("https://counter.fixture.test/all/sw.js", { headers: auth ? { "cf-access-jwt-assertion": auth } : {} }), s.env);
    const swNone = await swAt(""), swOther = await swAt(await s.token("someone@example.test")), swOwner = await swAt(s.jwt);
    const swBody = await swOwner.text();
    ok(swNone.status === 401 && swOther.status === 401 && !(await swNone.text()).includes("showNotification"),
      "/all/sw.js is refused without the Access JWT and for another email, and hands over nothing: " + JSON.stringify([swNone.status, swOther.status]));
    ok(swOwner.status === 200 && swOwner.headers.get("Service-Worker-Allowed") === "/all",
      "/all/sw.js inside the gate carries Service-Worker-Allowed: /all, so it may be registered at scope /all: " + JSON.stringify([swOwner.status, swOwner.headers.get("Service-Worker-Allowed")]));
    ok(/^text\/javascript/.test(swOwner.headers.get("content-type")) && swBody === ADMIN_SW_JS, "it is served as text/javascript and is the worker's own script: " + swOwner.headers.get("content-type"));
    ok(swOwner.headers.get("cache-control") === "no-store", "it is never cached: " + swOwner.headers.get("cache-control"));
    const swPost = await s.owner("/all/sw.js", {}, s.jwt, "POST");
    ok(swPost.status === 405, "it answers GET alone: " + swPost.status);

    const shown = [], opened = [], handlers = {};
    let clients = [];
    const ctx = { URL, Promise, JSON, Object, setTimeout,
      self: { registration: { showNotification: (t, o) => { shown.push([t, o]); return Promise.resolve(); } },
        addEventListener: (e, f) => { handlers[e] = f; }, skipWaiting() {}, clients: { claim() {},
          matchAll: async () => clients, openWindow: async (u) => { opened.push(u); } } } };
    vm.runInNewContext(ADMIN_SW_JS, ctx);
    const push = async (data, throws) => {
      let p;
      try { handlers.push({ data: data === null ? null : { json: () => { if (throws) throw new Error("not json"); return data; } }, waitUntil: (x) => { p = x; } }); await p; }
      catch (e) { shown.push(["THREW", String(e.message)]); }
      return shown[shown.length - 1];
    };
    const got = {};
    for (const k of Object.keys(ADMIN_NEWS)) got[k] = await push({ k });
    const titles = { order: "New order", pay: "A customer says they paid", cancel: "A customer cancelled", said: "A customer wrote", rate: "A customer rated an order",
      take: "A customer took your price", pass: "A customer said no to your price", approve: "Rows to approve" };
    ok(Object.keys(titles).every((k) => got[k] && got[k][0] === titles[k] && got[k][1].body === ADMIN_NEWS[k][1] && got[k][1].body.length > 10 && got[k][1].icon === "/icon-key.png"),
      "each kind shows its own title, a body that says where to act, and the key icon: " + JSON.stringify(Object.keys(got).map((k) => [k, got[k] && got[k][0]])));
    ok(Object.keys(titles).every((k) => got[k][1].tag === "admin-" + k) && new Set(Object.keys(titles).map((k) => got[k][1].tag)).size === 8 && Object.values(got).every((g) => g[1].renotify === true),
      "each kind takes a tag of its own so it replaces itself, and every banner renotifies: " + JSON.stringify(Object.values(got).map((g) => g[1].tag)));
    const withOrder = await push({ k: "order", o: ORDER }), otherOrder = await push({ k: "order", o: "20261019010000-ab2" });
    ok(withOrder[1].tag === "admin-order-" + ORDER && otherOrder[1].tag !== withOrder[1].tag && withOrder[1].data.hash === "#orders",
      "a new order takes a tag of its own order, so two orders are two banners: " + JSON.stringify([withOrder[1].tag, otherOrder[1].tag]));
    const unknown = await push({ k: "zzz" }), missing = await push(null), garbled = await push(undefined, true);
    ok([unknown, missing, garbled].every((x) => x[0] === ADMIN_FALLBACK[0] && x[1].body === ADMIN_FALLBACK[1] && x[1].tag === "admin-update") && ADMIN_FALLBACK[0] === "Something needs you",
      "an unknown kind, no payload and a payload that will not parse are the fixed Something needs you: " + JSON.stringify([unknown[0], missing[0], garbled[0]]));
    const lean = await push({ k: "pay", o: ORDER, name: "Zed Tester", code: "CX1-ZED", amount: 987654, product: "salt" });
    ok(!JSON.stringify(lean).match(/Zed|CX1|987654|salt/) && lean[0] === titles.pay,
      "a payload that carries a name, a code, an amount or a product shows none of them: " + JSON.stringify(lean));
    const place = { order: "#orders", pay: "#orders/payments", cancel: "#orders", said: "#customers/messages", rate: "#orders", take: "#orders", pass: "#orders", approve: "#needs" };
    ok(Object.keys(place).every((k) => got[k][1].data.hash === place[k]),
      "each kind's tap is addressed to the place that answers it: " + JSON.stringify(Object.keys(got).map((k) => [k, got[k][1].data.hash])));

    const click = async (data) => {
      let p, closed = false;
      handlers.notificationclick({ notification: { close() { closed = true; }, data }, waitUntil: (x) => { p = x; } }); await p; return closed;
    };
    const told = [], focused = [];
    const win = (url) => ({ url, postMessage: (m) => told.push([url, m]), focus: async () => { focused.push(url); } });
    clients = [win("https://counter.fixture.test/all/test"), win("https://counter.fixture.test/all#needs")];
    const closed = await click({ hash: "#orders/payments", order: "" });
    ok(closed && focused.length === 1 && focused[0] === "https://counter.fixture.test/all#needs" && opened.length === 0,
      "a tap closes the banner and focuses the open Salt Admin window, not the test surface: " + JSON.stringify([closed, focused, opened]));
    ok(told.length === 1 && same(told[0][1], { salt: "admin", hash: "#orders/payments" }),
      "and tells that window where to go: " + JSON.stringify(told));
    clients = [win("https://counter.fixture.test/all/test")]; focused.length = 0;
    await click({ hash: "#customers/messages", order: "" });
    ok(opened.length === 1 && opened[0] === "/all#customers/messages" && focused.length === 0,
      "with no Salt Admin window open, a tap opens /all at the place that answers it: " + JSON.stringify([opened, focused]));

    /* ---- D. THE BELL ---- */
    const KEYB = b64u(A.pub);
    const bell = async (opts = {}) => {
      const st = { asked: 0, regs: [], subscribed: [], unsub: 0, sub: opts.sub || null, reg: null, listeners: [], perm: opts.perm || "default", answer: opts.answer || "granted" };
      const SUB = { endpoint: "https://push.example/admin-bell", toJSON: () => ({ keys: { p256dh: A.keys.p256dh, auth: A.keys.auth } }),
        unsubscribe: async () => { st.unsub++; st.sub = null; return true; } };
      if (opts.sub) st.sub = SUB;
      const REG = (scope) => ({ scope, installing: null, waiting: null, active: { state: "activated" },
        pushManager: { getSubscription: async () => st.sub, subscribe: async (o) => { st.subscribed.push(o); st.sub = SUB; return SUB; } } });
      const p = await richOwnerPage({ pageWork,
        before(w) {
          w.PushManager = function PushManager() {};
          w.Notification = { get permission() { return st.perm; }, requestPermission: async () => { st.asked++; st.perm = st.answer; return st.answer; } };
          Object.defineProperty(w.navigator, "serviceWorker", { configurable: true, value: {
            addEventListener: (t, f) => st.listeners.push([t, f]),
            register: async (url, o) => { st.regs.push([url, o]); st.reg = REG("https://counter.fixture.test/all"); return st.reg; },
            getRegistration: async () => (opts.rootReg ? REG("https://counter.fixture.test/") : st.reg || (opts.sub ? REG("https://counter.fixture.test/all") : undefined)) } });
        },
        extra: (route) => (route === "/push/key" ? { ok: true, key: KEYB, configured: true } : route.startsWith("/all/push/") ? { ok: true } : undefined) });
      await p.work.quiet();
      st.p = p; st.state = () => p.d.getElementById("alertState").textContent;
      st.on = p.d.getElementById("alertOn"); st.off = p.d.getElementById("alertOff");
      st.posts = () => p.posts.filter((x) => x.route.startsWith("/all/push/"));
      return st;
    };
    const b1 = await bell();
    ok(b1.state() === "Off" && !b1.on.hidden && b1.off.hidden && b1.on.getAttribute("data-act") === "alerts.on" && b1.off.getAttribute("data-act") === "alerts.off"
      && b1.asked === 0 && b1.regs.length === 0 && b1.posts().length === 0,
      "Shop > This device draws Notifications Off with Turn on, and opening the page asks nothing, registers nothing and files nothing: " + JSON.stringify([b1.state(), b1.asked, b1.regs, b1.posts()]));
    b1.on.click(); await b1.p.work.quiet();
    ok(b1.asked === 1 && same(b1.regs, [["/all/sw.js", { scope: "/all" }]]),
      "the tap asks the browser once and registers Admin's own worker at scope /all: " + JSON.stringify([b1.asked, b1.regs]));
    const subOpts = b1.subscribed[0], filed = b1.posts();
    ok(b1.subscribed.length === 1 && subOpts.userVisibleOnly === true && Buffer.from(subOpts.applicationServerKey).toString("base64url") === KEYB,
      "it subscribes with the Counter's VAPID key from /push/key: " + JSON.stringify(b1.subscribed.length));
    ok(filed.length === 1 && filed[0].route === "/all/push/subscribe" && same(filed[0].body, { endpoint: "https://push.example/admin-bell", keys: A.keys }),
      "it files the endpoint and both keys at /all/push/subscribe: " + JSON.stringify(filed));
    ok(b1.state() === "On" && b1.on.hidden && !b1.off.hidden, "and says On with Turn off in its place: " + b1.state());
    b1.off.click(); await b1.p.work.quiet();
    ok(same(b1.posts().map((x) => x.route), ["/all/push/subscribe", "/all/push/unsubscribe"]) && same(b1.posts()[1].body, { endpoint: "https://push.example/admin-bell" }) && b1.unsub === 1 && b1.state() === "Off" && !b1.on.hidden,
      "Turn off tells the site to forget the endpoint, drops the phone's own subscription and says Off: " + JSON.stringify([b1.posts().map((x) => x.route), b1.unsub, b1.state()]));
    const b2 = await bell({ answer: "denied" });
    b2.on.click(); await b2.p.work.quiet();
    ok(b2.asked === 1 && b2.regs.length === 0 && b2.posts().length === 0 && b2.state() === "Off" && /did not allow/.test(b2.p.d.getElementById("alertNote").textContent),
      "a refusal at the browser's question registers nothing, files nothing and says why: " + JSON.stringify([b2.regs, b2.posts(), b2.p.d.getElementById("alertNote").textContent]));
    const b3 = await bell({ perm: "granted", sub: true });
    ok(b3.asked === 0 && b3.state() === "On" && b3.regs.length === 0 && same(b3.posts().map((x) => x.route), ["/all/push/subscribe"]),
      "a phone already subscribed says On on opening, asks nothing and files its subscription again: " + JSON.stringify([b3.state(), b3.asked, b3.posts().map((x) => x.route)]));
    const b4 = await bell({ perm: "granted", sub: true, rootReg: true });
    ok(b4.state() === "Off" && b4.posts().length === 0, "a registration at the root, the customer's, is never taken for Admin's: " + JSON.stringify([b4.state(), b4.posts().length]));
    const msg = b3.listeners.find((l) => l[0] === "message");
    msg[1]({ data: { salt: "admin", hash: "#orders/payments" } }); await b3.p.work.quiet();
    ok(b3.p.w.location.hash === "#orders/payments", "a banner's tap is told to the open page, which opens the place it names: " + b3.p.w.location.hash);
    msg[1]({ data: { salt: "admin", hash: "#nowhere" } }); msg[1]({ data: { salt: "news", order: "x" } }); await b3.p.work.quiet();
    ok(b3.p.w.location.hash === "#orders/payments", "an address the page does not know, and a message that is not Admin's, move nothing: " + b3.p.w.location.hash);

    const pageOf = async (path, auth) => (await s.counter.fetch(new Request("https://counter.fixture.test" + path, { headers: auth ? { "cf-access-jwt-assertion": auth } : {} }), s.env)).text();
    const admin = await pageOf("/all", s.jwt), tester = await pageOf("/all/test/admin", s.jwt), door = await pageOf("/");
    ok(admin.includes('id="alertOn"') && !tester.includes('id="alertOn"') && !door.includes('id="alertOn"') && !door.includes("/all/sw.js") && !door.includes("opush"),
      "the bell is drawn on Salt Admin and on neither the test surface nor the customer's door, which carries none of its script: " + JSON.stringify([admin.includes('id="alertOn"'), tester.includes('id="alertOn"'), door.includes('id="alertOn"')]));
  } finally { s.close(); }
}
