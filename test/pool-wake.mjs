/* test/pool-wake.mjs: THE POOL, B5. Opening one wakes no phone; Close tells each joiner once, with their own order, under a banner
 * of its own beside the order's acknowledgement. Phones are real keys: the wake is sealed to them and read back here.
 * Every assertion was proved red by its own mutation. */
import vm from "node:vm";
import { rig, U1, U2, rid, sqlite } from "./pool.mjs";

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
  return { keys: { p256dh: b64u(pub), auth: b64u(auth) }, read };
}

export async function wake({ ok, KV, skipOff }) {
  if (!(await sqlite())) { skipOff("node:sqlite is unavailable here, so the pool's wakes were not driven"); return; }
  const { O, env, bk, kv } = await rig(KV), S = await import("../stmt/sw.js"), W = await import("../stmt/words.js");
  const vp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  Object.assign(env, { STMT_VAPID_PUBLIC_KEY: "pub", STMT_VAPID_SUBJECT: "mailto:a@b.test", STMT_VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", vp.privateKey)) });
  const U3 = "wxyz-2345", phones = {};
  for (const u of [U1, U2, U3]) { phones[u] = await phone(); await kv.put("u:" + u, JSON.stringify({ prices: { digest: "d1" } }));
    await kv.put("push:" + u + ":k", JSON.stringify({ endpoint: "https://push.example/" + u, at: "2026-10-01T00:00:00Z", keys: phones[u].keys })); }
  const realF = globalThis.fetch;
  const caught = async (fn) => {
    const hit = [];
    globalThis.fetch = async (url, init) => { hit.push({ u: String(url).split("/").pop(), h: init.headers, body: init.body }); return new Response("", { status: 201 }); };
    let r; try { r = await fn(); } finally { globalThis.fetch = realF; }
    const news = {};
    for (const x of hit) news[x.u] = x.body ? await phones[x.u].read(x.body) : null;
    return { r, hit, news };
  };
  const join = (u, id, tag) => O.poolJoin(env, u, id, { q: 2, total: 90, unit: 45, digest: "d1", rid: rid(tag) });

  /* OPENING WAKES NO PHONE, and nor does a join */
  let pid;
  const opened = await caught(async () => { pid = (await O.poolOpen(env, { product: "salt", q: 2, target: 6 })).pool.id; });
  const j1 = await caught(() => join(U1, pid, "a")), j2 = await caught(() => join(U2, pid, "b")), j3 = await caught(() => join(U3, pid, "c"));
  ok(opened.hit.length === 0 && j1.hit.length === 0 && j2.hit.length === 0 && j3.hit.length === 0,
    "opening a group order wakes no phone, and a join wakes none: it is a card on Home and nothing more: " + JSON.stringify([opened.hit.length, j1.hit.length]));
  /* one of the three withdraws before the close */
  await O.customerMove(env, U3, j3.r.order.id, "cancel", {});

  /* CLOSE TELLS EACH JOINER ONCE, with their own order, and a retry that only records what was left tells nobody */
  const closed = await caught(() => O.poolClose(env, pid, {}));
  const n1 = closed.news[U1], n2 = closed.news[U2];
  ok(closed.hit.length === 2 && !(U3 in closed.news) && JSON.stringify(n1) === JSON.stringify({ k: "pool-closed", o: j1.r.order.id })
    && JSON.stringify(n2) === JSON.stringify({ k: "pool-closed", o: j2.r.order.id }),
    "Close wakes each joiner who is still in, once, naming their own order, and not the one who withdrew: " + JSON.stringify(closed.news));
  ok(closed.hit.every((x) => /^p-[0-9a-f]{24}$/.test(x.h.Topic)) && closed.hit[0].h.Topic !== closed.hit[1].h.Topic,
    "each banner has a topic of its own, so the order's acknowledgement after it does not replace it at the push service: " + JSON.stringify(closed.hit.map((x) => x.h.Topic)));
  const again = await caught(() => O.poolClose(env, pid, {})), left = await caught(() => O.poolClose(env, pid, { left: [{ id: j1.r.order.id, why: "x" }] }));
  ok(again.hit.length === 0 && left.hit.length === 0 && again.r.closed === false, "a second Close, and one that only records what was left, wake nobody");
  const wk = O.wakes({ kind: "pclose", at: "2026-10-05T02:00:00Z" }, {}, false), wa = O.wakes({ kind: "pclose", at: "x", again: true }, {}, false), wo = O.wakes({ kind: "popen", at: "x" }, {}, false);
  ok(wk && wk.k === "pool-closed" && wa === null && wo === null, "the book's own wake for a close is pool-closed, and none for an open or a retry: " + JSON.stringify([wk, wa, wo]));

  /* THE BANNER: its words are the table's, and it is a banner of its own beside the order's */
  ok(Object.prototype.hasOwnProperty.call(S.NEWS, "pool-closed") && S.NEWS["pool-closed"] === "Group order closed" && W.EN["news.pool-closed.b"] === "Your order is in. We confirm it next.",
    "the service worker has words for the kind: " + JSON.stringify(S.NEWS["pool-closed"]));
  const shown = [];
  const handlers = {}, ctx = { URL, Promise, fetch: async () => ({ ok: false }), setTimeout, clients: {},
    self: { location: { href: "https://x.test/sw.js?u=" + U1 }, registration: { scope: "https://x.test/", showNotification: (t, o) => { shown.push([t, o]); return Promise.resolve(); } },
      addEventListener: (e, f) => { handlers[e] = f; }, skipWaiting() {}, clients: { claim() {} } } };
  vm.runInNewContext(S.swScript(), ctx);
  const push = async (n) => { let p; handlers.push({ data: { json: () => n }, waitUntil: (x) => { p = x; } }); await p; };
  await push({ k: "pool-closed", o: j1.r.order.id }); await push({ k: "confirmed-credit", o: j1.r.order.id });
  const [b1, b2] = shown;
  ok(b1[0] === "Group order closed" && b1[1].body === "Your order is in. We confirm it next." && b1[1].tag === "pool-" + j1.r.order.id && b2[1].tag === "order-" + j1.r.order.id
    && b1[1].data.order === j1.r.order.id && /#o=/.test(b1[1].data.url),
    "the banner reads Group order closed, Your order is in, under a tag of its own and opens the order, while the acknowledgement keeps the order's: " + JSON.stringify([b1[0], b1[1].tag, b2[1].tag]));
}
