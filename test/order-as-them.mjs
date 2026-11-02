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
}
