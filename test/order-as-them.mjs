/* test/order-as-them.mjs: v1377, ORDER AS THEM (his answers A and D of 02 Nov 2026, docs/plan-one-order-stream.html part 1a). His Place,
 * made on their own page opened by the master, reaches the same placeOrder as theirs through /all/maker/customers/<u>/orders and carries
 * what their Place carries: a sheet's line, a delivery window, a sealed spot, Order again, a day. It refuses a note, an ask and a group
 * order. The spot is taken off for its id and filed once the order names it; a test account's is dropped. /all/maker/slip/key answers
 * the public half of his slip key. The practice surface takes his Place for a test account only. Every username and key is invented. */
import { webcrypto } from "node:crypto";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";

const U = "oath-emab", OWNER = { email: "maakmal97@icloud.com" };
const S = webcrypto.subtle, enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");
async function seal(pub, obj, info) {
  const E = { name: "ECDH", namedCurve: "P-256" }, iv = webcrypto.getRandomValues(new Uint8Array(12));
  const eph = await S.generateKey(E, false, ["deriveBits"]), pk = await S.importKey("jwk", pub, E, false, []);
  const hk = await S.importKey("raw", await S.deriveBits({ name: "ECDH", public: pk }, eph.privateKey, 256), "HKDF", false, ["deriveKey"]);
  const key = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  return { v: 1, epk: b64(new Uint8Array(await S.exportKey("raw", eph.publicKey))), iv: b64(iv), ct: b64(new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))))) };
}

export async function run({ ok }) {
  const { handleMaker } = await import("../stmt/maker.js");
  const kv = new Store(), env = { STMT: kv, ORDER_STORE: "object" };
  const ob = orderBook(env); env.ORDERBOOK = ob.ns;
  const pair = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = await S.exportKey("jwk", pair.publicKey);
  await kv.put("slipkey", JSON.stringify({ pub }));
  await kv.put("u:" + U, JSON.stringify({ prices: { digest: "as-them-list" } }));
  const call = (path, body, method = "POST", who = OWNER, opts = {}) => handleMaker(new Request("https://counter.test" + path,
    method === "GET" ? { method } : { method, body: JSON.stringify(body) }), env, path.replace(/^\/all\/test\//, "/all/"), who, opts);
  let n = 0;
  const line = (extra = {}) => ({ product: "salt", qty: 1, total: 100, unit: 100, mode: "collect", place: "", forFriend: false, week: "",
    digest: "as-them-list", rid: "as-them-rid-" + String(++n).padStart(4, "0"), ...extra });
  const place = (body, who) => call("/all/maker/customers/" + U + "/orders", body, "POST", who);

  /* A1. the fields a customer's Place carries are taken, and the order is his */
  const sheet = "s" + "1".repeat(15);
  const r1 = await place(line({ sheet, wantBy: "", againOf: "" }));
  const j1 = await r1.json();
  const row1 = j1.order && j1.order.id ? ob.db.prepare("SELECT doc FROM ord WHERE oid=?").get(j1.order.id) : null;
  const doc1 = row1 ? JSON.parse(row1.doc) : { history: [{}] };
  ok(r1.status === 200 && doc1.sheet === sheet && doc1.history[0].by === "desk",
    "A1 his Place takes a sheet's line as theirs does, and is stamped his: " + JSON.stringify([r1.status, j1.error, doc1.sheet]));

  /* A2. a note, an ask, a figure and a group order are refused before anything is written */
  const evs0 = ob.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n;
  const refusedAll = [];
  for (const extra of [{ note: "hello" }, { ask: true }, { propose: 90 }, { pool: "p123" }]) refusedAll.push((await place(line(extra))).status);
  ok(refusedAll.every((s) => s === 400) && ob.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n === evs0,
    "A2 a note, an ask, a figure of his own and a group order are refused, nothing written: " + refusedAll.join(","));

  /* A3. a sealed spot is taken off for its id, the order names it, the ciphertext is filed and never in the book */
  const sealed = await seal(pub, { lat: 3.1, lng: 101.7 }, "salt-pin v1");
  const r3 = await place(line({ mode: "deliver", place: "", pin: sealed }));
  const j3 = await r3.json();
  const pinKeys = [...kv.values.keys()].filter((k) => k.startsWith("pin:" + U + ":"));
  const book = JSON.stringify(ob.db.prepare("SELECT * FROM ev").all()) + JSON.stringify(ob.db.prepare("SELECT * FROM ord").all());
  ok(r3.status === 200 && j3.order.pinned === true && pinKeys.length === 1 && JSON.parse(await kv.get(pinKeys[0])).ct === sealed.ct
    && !book.includes(sealed.ct.slice(0, 40)),
    "A3 his Place carries a sealed spot: the order names its id, the ciphertext is filed beside it and never in the book: " + JSON.stringify([r3.status, j3.error, pinKeys.length]));

  /* A4. a malformed spot is refused and files nothing */
  const before4 = [...kv.values.keys()].filter((k) => k.startsWith("pin:")).length;
  const r4 = await place(line({ mode: "deliver", place: "Taman", pin: { v: 1, epk: "x", iv: "y", ct: 7 } }));
  ok(r4.status === 400 && [...kv.values.keys()].filter((k) => k.startsWith("pin:")).length === before4,
    "A4 a spot that is not a sealed one is refused and nothing is filed: " + r4.status);

  /* A5. the slip key's public half is his to read, and nobody else's */
  const k5 = await call("/all/maker/slip/key", null, "GET");
  const k5j = await k5.json();
  const k5x = await call("/all/maker/slip/key", null, "GET", { email: "someone@example.test" });
  ok(k5.status === 200 && k5j.key && k5j.key.x === pub.x && k5j.key.y === pub.y && k5x.status === 403,
    "A5 /all/maker/slip/key answers the public half to him alone: " + JSON.stringify([k5.status, k5x.status]));

  /* A6. the practice surface takes his Place for a test account only; a real username there is not found */
  const t6 = await call("/all/test/maker/customers/" + U + "/orders", line(), "POST", OWNER, { test: true });
  const k6 = await call("/all/test/maker/slip/key", null, "GET", OWNER, { test: true });
  const v6 = await call("/all/test/maker/vault/key", null, "GET", OWNER, { test: true });
  ok(t6.status === 404 && k6.status === 200 && v6.status === 404,
    "A6 on the practice surface his Place for a real account is not found, the public slip key reads, the sealed vault key does not: " + JSON.stringify([t6.status, k6.status, v6.status]));

  /* A7. 1d, his answer C: their phone is told, sealed to it, in the fixed kind "placed", naming the order; the words are the table's */
  const W = await import("../stmt/words.js"), SW = await import("../stmt/sw.js");
  const vp = await S.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  Object.assign(env, { STMT_VAPID_PUBLIC_KEY: "pub", STMT_VAPID_SUBJECT: "mailto:a@b.test", STMT_VAPID_PRIVATE_JWK: JSON.stringify(await S.exportKey("jwk", vp.privateKey)) });
  const ph = await phone();
  await kv.put("push:" + U + ":k", JSON.stringify({ endpoint: "https://push.example/" + U, at: "2026-10-01T00:00:00Z", keys: ph.keys }));
  const realF = globalThis.fetch, hit = [];
  globalThis.fetch = async (url, init) => { hit.push(init.body); return new Response("", { status: 201 }); };
  let j7, j7b;
  const once = line();
  try { j7 = await (await place(once)).json(); j7b = await (await place(once)).json(); } finally { globalThis.fetch = realF; }
  const news7 = hit[0] ? await ph.read(hit[0]) : null;
  ok(hit.length === 1 && j7b.order.id === j7.order.id && news7 && news7.k === "placed" && news7.o === j7.order.id && SW.NEWS.placed === W.WORDS.en["news.placed"] && !!W.WORDS.en["news.placed.b"],
    "A7 his Place tells their phone once, sealed, as Order placed for you, naming the order, and a replay of the same request tells nobody: " + JSON.stringify([hit.length, news7]));

  /* v2, his answer B: HIS PLACE IS HIS ACCEPT. A second account, so the five open orders of the first never stand in the way; the Desk is a fake
     that answers the preview with a digest and the Accept by a scripted verdict, and every call, the Desk's and the phone's, lands on one timeline */
  let U2 = "oatb-twoo";
  await kv.put("u:" + U2, JSON.stringify({ prices: { digest: "as-them-list" } }));
  await kv.put("push:" + U2 + ":k", JSON.stringify({ endpoint: "https://push.example/" + U2, at: "2026-10-01T00:00:00Z", keys: ph.keys }));
  const timeline = [];
  let verdict = { ok: true, approved: true }, pvExtra = {}, onAccept = null;
  Object.assign(env, { COUNTER_MAKER_KEY: "k".repeat(32), DESK_MAKER: { fetch: async (req) => {
    const path = new URL(req.url).pathname, body = req.method === "POST" ? await req.json() : null;
    timeline.push(["desk", path.split("/").pop(), body]);
    if (/\/accept$/.test(path) && onAccept) return onAccept(path.split("/")[path.split("/").length - 2]);
    const out = /\/preview$/.test(path) ? Object.assign({ ok: true, hash: "h".repeat(64), flags: [] }, pvExtra) : /\/accept$/.test(path) ? verdict : { ok: false, error: "not this fake's" };
    return new Response(JSON.stringify(out), { status: out.ok ? 200 : 409 });
  } } });
  const place2 = async (body) => {
    timeline.length = 0;
    globalThis.fetch = async () => { timeline.push(["push"]); return new Response("", { status: 201 }); };
    try { const r = await call("/all/maker/customers/" + U2 + "/orders", body); return await r.json(); } finally { globalThis.fetch = realF; }
  };
  const a8body = line();
  const j8 = await place2(a8body), t8 = timeline.slice();
  ok(j8.agreed && j8.agreed.accepted === true && t8.length === 3 && t8[0][0] === "push" && t8[1][1] === "preview" && JSON.stringify(t8[1][2]) === "{}"
    && t8[2][1] === "accept" && JSON.stringify(t8[2][2]) === JSON.stringify({ hash: "h".repeat(64) }),
    "A8 his collected Place is agreed at once: their banner, then the Desk's preview, then its Accept on that digest and no price of his, so the Accept's own banner is the one they keep: " + JSON.stringify([j8.agreed, t8]));
  const j8b = await place2(a8body);
  ok(j8b.order.id === j8.order.id && !j8b.agreed && timeline.length === 0, "A9 a replay of the same request agrees nothing again and wakes nobody: " + JSON.stringify(timeline));
  const j10 = await place2(line({ mode: "deliver", place: "Taman Rekaan" }));
  ok(j10.agreed && j10.agreed.accepted === false && /delivery charge/.test(j10.agreed.why) && !timeline.some((x) => x[0] === "desk"),
    "A10 a delivery is not agreed here, since its charge is his to choose: it stays Placed and says so: " + JSON.stringify([j10.agreed, timeline]));
  verdict = { ok: true, approved: false, differs: true };
  const j11 = await place2(line());
  ok(j11.agreed && j11.agreed.accepted === false && /waits under Approve/.test(j11.agreed.why),
    "A11 a row that differs from the preview is not agreed, and says it waits under Approve: " + JSON.stringify(j11.agreed));
  verdict = { ok: false, error: "the mirror is being seeded: try again in a minute" };
  const j12 = await place2(line());
  ok(j12.ok === true && j12.agreed && j12.agreed.accepted === false && /mirror is being seeded/.test(j12.agreed.why) && !!j12.order,
    "A12 an Accept the Desk refuses leaves the order Placed and says the Desk's reason: " + JSON.stringify(j12));
  verdict = { ok: true, approved: true };

  /* Fable's review of version 2, on a third account, as the second holds five open orders by now */
  U2 = "oatc-thre";
  await kv.put("u:" + U2, JSON.stringify({ prices: { digest: "as-them-list" } }));
  pvExtra = { flags: ["RM 90 for the goods is RM 5 under the Floor of RM 95 at 1 unit: the Floor is the goods at COGS, rounded up to the next RM 5."] };
  const j13 = await place2(line());
  ok(j13.agreed && j13.agreed.accepted === false && /under today's Floor/.test(j13.agreed.why) && !timeline.some((x) => x[1] === "accept"),
    "A13 a row the preview flags under the Floor is never agreed blind: no Accept is sent and it waits for him: " + JSON.stringify([j13.agreed, timeline]));
  pvExtra = { prepay: true };
  const j14 = await place2(line());
  ok(j14.agreed && j14.agreed.accepted === true && j14.agreed.prepay === true, "A14 a verdict of paid in advance rides back with the agreement: " + JSON.stringify(j14.agreed));
  pvExtra = {};
  /* an Accept that lands but whose answer is lost: the fake moves the order on, then fails; the order as it stands answers */
  const ack = (id) => { const row = ob.db.prepare("SELECT doc FROM ord WHERE oid=?").get(id); const d = JSON.parse(row.doc); d.status = "acknowledged";
    ob.db.prepare("UPDATE ord SET doc=? WHERE oid=?").run(JSON.stringify(d), id); };
  onAccept = (id) => { ack(id); return new Response("not json", { status: 502 }); };
  const a15 = line(), j15 = await place2(a15);
  onAccept = null;
  ok(j15.agreed && j15.agreed.accepted === true, "A15 an Accept that landed but whose answer was lost is settled by the order as it stands: " + JSON.stringify(j15.agreed));
  const j16 = await place2(a15);
  ok(j16.agreed && j16.agreed.accepted === true && !timeline.some((x) => x[0] === "desk"), "A16 a replay of an order already agreed says so, and asks the Desk nothing: " + JSON.stringify([j16.agreed, timeline]));
  onAccept = () => new Response(JSON.stringify({ ok: false, error: "The first sentence says it. The second goes too far." }), { status: 409 });
  const j17 = await place2(line());
  onAccept = null;
  ok(j17.agreed && j17.agreed.why === "The first sentence says it.", "A17 the Desk's reason reaches Sent as one sentence: " + JSON.stringify(j17.agreed));

  /* plan version 3 (3a): HANDED OVER AND PAID NOW, on a fourth account; the fake Desk answers the cash and the handover too, each recorded with its body */
  U2 = "oatd-four"; pvExtra = {}; verdict = { ok: true, approved: true };
  await kv.put("u:" + U2, JSON.stringify({ prices: { digest: "as-them-list" } }));
  await kv.put("push:" + U2 + ":k", JSON.stringify({ endpoint: "https://push.example/" + U2, at: "2026-10-01T00:00:00Z", keys: ph.keys }));
  const setDoc = (id, f) => { const row = ob.db.prepare("SELECT doc FROM ord WHERE oid=?").get(id); const d = JSON.parse(row.doc); f(d); ob.db.prepare("UPDATE ord SET doc=? WHERE oid=?").run(JSON.stringify(d), id); };
  const okStep = () => new Response(JSON.stringify({ ok: true }), { status: 200 });
  const realDesk = env.DESK_MAKER.fetch;
  let stepAnswer = okStep;
  env.DESK_MAKER.fetch = async (req) => {
    const path = new URL(req.url).pathname;
    if (/\/(cash|handed)$/.test(path)) { timeline.push(["desk", path.split("/").pop(), await req.json()]); return stepAnswer(path); }
    return realDesk(req);
  };
  const b18 = line({ now: true });
  const j18 = await place2(b18), t18 = timeline.slice();
  const base = b18.rid.slice(0, 58), steps18 = t18.map((x) => x[0] === "push" ? "push" : x[1]);
  ok(j18.agreed && j18.agreed.accepted === true && j18.agreed.handed === true && j18.agreed.paid === true
    && JSON.stringify(steps18) === JSON.stringify(["push", "preview", "accept", "cash", "handed"])
    && JSON.stringify(t18[3][2]) === JSON.stringify({ amount: 100, rid: base + "-cash" }) && JSON.stringify(t18[4][2]) === JSON.stringify({ qty: 1, rid: base + "-hand" }),
    "A18 Handed over and paid now: agreed, then paid what it owes, then handed over whole, each under a request id fixed by the Place's: " + JSON.stringify([j18.agreed, t18]));
  const j19 = await call("/all/maker/customers/" + U2 + "/orders", line({ now: true, mode: "deliver", place: "Taman Rekaan" }));
  const j19b = await call("/all/maker/customers/" + U2 + "/orders", line({ now: "yes" }));
  ok(j19.status === 400 && j19b.status === 400, "A19 handed and paid now is refused on a delivery, and when it is not a plain yes or no: " + JSON.stringify([j19.status, j19b.status]));
  onAccept = (id) => { setDoc(id, (d) => { d.credit = 100; }); return new Response(JSON.stringify({ ok: true, approved: true }), { status: 200 }); };
  const j20 = await place2(line({ now: true })), t20 = timeline.slice();
  onAccept = null;
  ok(j20.agreed && j20.agreed.handed === true && !t20.some((x) => x[1] === "cash") && t20.some((x) => x[1] === "handed"),
    "A20 an order their credit paid at the Accept takes no cash: what it owes is read off the order as it stands: " + JSON.stringify(t20));
  stepAnswer = (path) => /cash$/.test(path) ? new Response(JSON.stringify({ ok: false, error: "a payment they say they sent waits on this order. Answer it first." }), { status: 409 }) : okStep();
  const j21 = await place2(line({ now: true })), t21 = timeline.slice();
  stepAnswer = okStep;
  ok(j21.agreed && j21.agreed.accepted === true && j21.agreed.handed === false && j21.agreed.why === "a payment they say they sent waits on this order." && !t21.some((x) => x[1] === "handed"),
    "A21 a cash step the Desk refuses stops before the handover, and says the Desk's reason in one sentence: " + JSON.stringify([j21.agreed, t21]));
  verdict = { ok: true, approved: false, differs: true };
  const j23 = await place2(line({ now: true })), t23 = timeline.slice();
  verdict = { ok: true, approved: true };
  ok(j23.agreed && j23.agreed.accepted === false && !("handed" in j23.agreed) && !t23.some((x) => x[1] === "cash" || x[1] === "handed"),
    "A23 a Place not agreed is never paid or handed over: " + JSON.stringify([j23.agreed, t23]));
  setDoc(j18.order.id, (d) => { d.status = "done"; });
  const j22 = await place2(b18);
  ok(j22.agreed && j22.agreed.handed === true && j22.agreed.paid === true && !timeline.some((x) => x[0] === "desk"),
    "A22 a replay of a sale handed over and paid says so, and asks the Desk nothing: " + JSON.stringify([j22.agreed, timeline]));
}

/* a phone: its keys as the page files them, and RFC 8291's receiving side to read what is sealed to it (as test/pool-wake.mjs) */
const b64u = (a) => Buffer.from(a).toString("base64url");
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const hk = async (salt, ikm, info, n) => new Uint8Array(await S.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info },
  await S.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
async function phone() {
  const kp = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await S.exportKey("raw", kp.publicKey)), auth = webcrypto.getRandomValues(new Uint8Array(16));
  const read = async (msg) => {
    const salt = msg.slice(0, 16), idlen = msg[20], asPub = msg.slice(21, 21 + idlen), ct = msg.slice(21 + idlen);
    const asKey = await S.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await S.deriveBits({ name: "ECDH", public: asKey }, kp.privateKey, 256));
    const ikm = await hk(auth, secret, cat(enc.encode("WebPush: info"), [0], pub, asPub), 32);
    const cek = await hk(salt, ikm, cat(enc.encode("Content-Encoding: aes128gcm"), [0]), 16), nonce = await hk(salt, ikm, cat(enc.encode("Content-Encoding: nonce"), [0]), 12);
    const pt = new Uint8Array(await S.decrypt({ name: "AES-GCM", iv: nonce }, await S.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
    let end = pt.length - 1; while (end > 0 && pt[end] === 0) end--;
    return JSON.parse(new TextDecoder().decode(pt.slice(0, end)));
  };
  return { keys: { p256dh: b64u(pub), auth: b64u(auth) }, read };
}
