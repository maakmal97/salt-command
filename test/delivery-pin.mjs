/* test/delivery-pin.mjs: A DELIVERY'S EXACT SPOT, SEALED ON THEIR PHONE (his decisions of 10 Oct 2026). Use my location or a
 * pasted Google Maps or Waze link, sealed on the phone to his slip key under its own info ("salt-pin v1"), so the Counter holds
 * ciphertext alone: the envelope is taken off for its id before the order book is asked, filed only once the order names it,
 * for 30 days and 30 more at each read of the desk's relay. The area words become the fallback. Every username, point and key
 * is invented. Every assertion was proved red by its own mutation. */
import { createHash, webcrypto } from "node:crypto";
import { orderBook } from "./orderbook-harness.mjs";
import { Store } from "./maker-order-controls.mjs";

const U = "pnab-cdef", PASS = "fixture-pass-spot-02";
const S = webcrypto.subtle, enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");
/* the page's own protocol, here as the laptop's: an ephemeral pair, ECDH, HKDF-SHA-256 with the info named, AES-GCM-256 */
async function seal(pub, obj, info) {
  const E = { name: "ECDH", namedCurve: "P-256" }, iv = webcrypto.getRandomValues(new Uint8Array(12));
  const eph = await S.generateKey(E, false, ["deriveBits"]), pk = await S.importKey("jwk", pub, E, false, []);
  const hk = await S.importKey("raw", await S.deriveBits({ name: "ECDH", public: pk }, eph.privateKey, 256), "HKDF", false, ["deriveKey"]);
  const key = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  return { v: 1, epk: b64(new Uint8Array(await S.exportKey("raw", eph.publicKey))), iv: b64(iv), ct: b64(new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))))) };
}
async function open(priv, sealed, info) {
  try {
    const epk = await S.importKey("raw", Buffer.from(sealed.epk, "base64"), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const hk = await S.importKey("raw", await S.deriveBits({ name: "ECDH", public: epk }, priv, 256), "HKDF", false, ["deriveKey"]);
    const key = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, hk, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await S.decrypt({ name: "AES-GCM", iv: Buffer.from(sealed.iv, "base64") }, key, Buffer.from(sealed.ct, "base64"))));
  } catch (e) { return null; }
}

export async function run({ ok }) {
  const P = await import("../stmt/pin.js"), O = await import("../stmt/orders.js"), W = await import("../stmt/words.js");
  const pair = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await S.exportKey("jwk", pair.publicKey), pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const spot = { v: 1, lat: 3.1412, lng: 101.6865, acc: 12, src: "gps", at: "2026-10-10T05:30:00.000Z" };
  const sealed = await seal(pub, spot, "salt-pin v1");

  /* 1. THE PIN, MEASURED: swapped for its id, anything else refused, filed only when the order names it */
  const t = await P.takePin({ product: "salt", pin: sealed });
  ok(t.body && /^[0-9a-f]{32}$/.test(t.body.pin) && t.pin && t.pin.id === t.body.pin && !JSON.stringify(t.body).includes(sealed.ct),
    "Place's body carries the pin's id alone once it is taken off: " + JSON.stringify(t.body));
  const bare = await P.takePin({ pin: t.body.pin }), plain = await P.takePin({ pin: { lat: 3.1, lng: 101.6 } });
  const big = await P.takePin({ pin: Object.assign({}, sealed, { ct: "A".repeat(P.PIN_MAX + 4) }) });
  ok(bare.code === "pinBad" && plain.code === "pinBad" && big.code === "pinBad" && bare.status === 400 && plain.error === W.EN["e.pinBad"],
    "a bare id, a point in the clear and one too large are refused in the customer's words, never stored: " + JSON.stringify([bare.code, plain.code, big.code]));
  const puts = [];
  class TStore extends Store { async put(k, v, o) { puts.push([k, o && o.expirationTtl]); return super.put(k, v); } }
  const kv = new TStore();
  ok(!(await P.keepPin({ STMT: kv }, U, t.pin, "f".repeat(32))) && !(await P.keepPin({ STMT: kv }, U, t.pin, null)) && !puts.length,
    "a pin no recorded order names is filed nowhere");
  ok(await P.keepPin({ STMT: kv }, U, t.pin, t.pin.id) && puts.length === 1 && puts[0][0] === "pin:" + U + ":" + t.pin.id && puts[0][1] === 30 * 86400,
    "the order naming it files the ciphertext under the account and the id, for 30 days: " + JSON.stringify(puts));
  const read = await P.readPin({ STMT: kv }, U, t.pin.id);
  ok(read && read.ct === sealed.ct && puts.length === 2 && puts[1][1] === 30 * 86400, "a read by the desk's relay keeps it 30 days more: " + JSON.stringify(puts[1]));

  /* 2. AT PLACE: a delivery with a pin needs no area words; a pin is a delivery's; the customer reads that it is shared */
  const iso = "2026-10-10T05:30:00.000Z";
  const base = { product: "salt", qty: 1, mode: "deliver", unit: 100, total: 100, place: "", forFriend: false, rid: "a".repeat(32) };
  const withPin = O.decidePlace(U, Object.assign({ pin: t.pin.id }, base), [], iso, "", "customer", null, {});
  ok(withPin.ev && withPin.ev.order.pin === t.pin.id && withPin.ev.order.place === "", "a delivery sharing its exact spot is placed with no area words");
  ok(O.decidePlace(U, base, [], iso, "", "customer", null, {}).code === "placeWhere", "and with neither it is refused as ever");
  ok(O.decidePlace(U, Object.assign({}, base, { mode: "collect", pin: t.pin.id }), [], iso, "", "customer", null, {}).code === "pinBad"
    && O.decidePlace(U, Object.assign({}, base, { pin: "not-an-id", place: "Taman" }), [], iso, "", "customer", null, {}).code === "pinBad",
    "a pin on a collection, or one that is not an id this Worker set, is refused");
  const view = O.customerView(withPin.ev.order);
  ok(view.pinned === true && !("pin" in view) && !JSON.stringify(view).includes(t.pin.id), "the customer reads that the spot is shared, never its id");
  const rep = O.decideReplace(withPin.ev.order, { product: "salt", qty: 2, mode: "deliver", unit: 100, total: 200, place: "", forFriend: false, rid: "b".repeat(32), week: "", digest: "" },
    [withPin.ev.order], iso, "");
  const repC = O.decideReplace(withPin.ev.order, { product: "salt", qty: 2, mode: "collect", unit: 100, total: 200, place: "", forFriend: false, rid: "c".repeat(32), week: "", digest: "" },
    [withPin.ev.order], iso, "");
  ok(rep.place && rep.place.order.pin === t.pin.id && repC.place && !("pin" in repC.place.order),
    "an amendment before Accept keeps the order's spot while it is delivered, and drops it for a collection");
  ok(O.decideReplace(withPin.ev.order, { product: "salt", qty: 2, mode: "deliver", unit: 100, total: 200, place: "", forFriend: false, rid: "d".repeat(32), week: "", digest: "", pin: "e".repeat(32) },
    [withPin.ev.order], iso, "").code === "amendShape", "and an amendment cannot name a spot of its own");

  /* 3. THE WORKER: Place over its real road; the book's events hold the id, KV the ciphertext, and the desk's relay reads it */
  const stmtW = (await import("../stmt/worker.js")).default;
  const skv = new TStore(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key", ORDER_STORE: "object" };
  const ob = orderBook(senv); senv.ORDERBOOK = ob.ns;
  const tok = "p".repeat(24);
  await skv.put("sess:" + createHash("sha256").update(tok).digest("hex"), JSON.stringify({ u: U, at: new Date().toISOString() }));
  const post = (path, body) => stmtW.fetch(new Request("https://site.test" + path, { method: "POST", headers: { "content-type": "application/json", "X-Stmt-Session": tok }, body: JSON.stringify(body) }), senv);
  const placed = await post("/orders", Object.assign({}, base, { rid: "f".repeat(32), pin: sealed }));
  const pj = await placed.json();
  const kept = await skv.get("pin:" + U + ":" + t.pin.id, "json");
  ok(placed.status === 200 && pj.order.pinned === true && kept && kept.ct === sealed.ct, "a Place carrying a sealed spot is recorded and its ciphertext filed: " + placed.status);
  const evs = JSON.stringify(ob.db.prepare("SELECT * FROM ev").all()) + JSON.stringify(ob.db.prepare("SELECT * FROM ord").all());
  ok(evs.includes(t.pin.id) && !evs.includes(sealed.ct.slice(0, 40)) && !evs.includes(sealed.epk.slice(0, 40)), "the order book holds the id alone, never the ciphertext");
  const n0 = [...skv.values.keys()].filter((k) => k.startsWith("pin:")).length;
  const refused = await post("/orders", Object.assign({}, base, { rid: "g".repeat(32), mode: "collect", pin: await seal(pub, spot, "salt-pin v1") }));
  ok(refused.status === 400 && [...skv.values.keys()].filter((k) => k.startsWith("pin:")).length === n0, "a refused Place files no spot");
  /* a test account's spot is dropped before the order is asked for, and never filed */
  const ttok = "q".repeat(24);
  await skv.put("sess:" + createHash("sha256").update(ttok).digest("hex"), JSON.stringify({ u: "0000-0000", at: new Date().toISOString() }));
  /* every Place by a test account goes to its fixture (the test surface, P3), so the account has one, as the publish seals it */
  const TF = await import("../stmt/testfix.js");
  await skv.put("u:0000-0000", JSON.stringify({ test: true, wrap: { salt: "pin-wrap" } }));
  await skv.put(TF.fixKey("0000-0000"), JSON.stringify({ v: TF.FIX_VERSION, salt: "pin-wrap", at: "2026-10-18T07:00:00.000Z", env: { iv: "pin-iv" }, claims: [], orders: [], makerBook: { sales: [] } }));
  const tpost = await stmtW.fetch(new Request("https://site.test/orders", { method: "POST", headers: { "content-type": "application/json", "X-Stmt-Session": ttok },
    body: JSON.stringify(Object.assign({}, base, { place: "Taman", rid: "h".repeat(32), pin: await seal(pub, spot, "salt-pin v1") })) }), senv);
  const tj = await tpost.json();
  ok(tpost.status === 200 && !tj.order.pinned && ![...skv.values.keys()].some((k) => k.startsWith("pin:0000-0000:")), "a test account's spot is dropped and never filed: " + tpost.status);
  const dreq = (path) => stmtW.fetch(new Request("https://site.test" + path, { headers: { "X-Stmt-Desk": "desk-key" } }), senv);
  const relay = await dreq("/desk/pins/" + U + "/" + t.pin.id), rj = await relay.json().catch(() => ({}));
  ok(relay.status === 200 && !!rj.pin && rj.pin.ct === sealed.ct && (await dreq("/desk/pins/" + U + "/" + "0".repeat(32))).status === 404
    && (await stmtW.fetch(new Request("https://site.test/desk/pins/" + U + "/" + t.pin.id), senv)).status !== 200,
    "the desk's keyed relay reads the ciphertext as filed, an unknown one is not kept, and nothing reads it without the desk's key");

  /* 4. THE PAGE: Use my location reads once, Place seals it to the key and sends the envelope; links are read on the phone */
  const { landingPage } = await import("../stmt/page.js"), C = await import("../tools/stmt-crypto.mjs"), { JSDOM } = await import("jsdom");
  const html = landingPage("", "np", null, null), script = html.slice(html.lastIndexOf('<script nonce="np">') + 19, html.lastIndexOf("</script>"));
  const p0 = script.indexOf("  function pinPt("), p1 = script.indexOf("  function pinHere(");
  let pinRead = () => "missing";
  try { if (p0 >= 0 && p1 > p0) pinRead = new Function(script.slice(p0, p1) + "\nreturn pinRead;")(); } catch (e) { pinRead = () => "throws"; }
  const cases = [
    ["https://www.google.com/maps/place/X/@3.1412,101.6865,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d3.1501!4d101.7002", 3.1501, 101.7002],
    ["https://www.google.com/maps?q=3.1412,101.6865", 3.1412, 101.6865],
    ["https://www.google.com/maps/search/?api=1&query=3.1412%2C101.6865", 3.1412, 101.6865],
    ["https://maps.google.com/maps/@3.0738,101.5183,15z", 3.0738, 101.5183],
    ["https://waze.com/ul?ll=3.1412%2C101.6865&navigate=yes", 3.1412, 101.6865],
    ["https://www.waze.com/live-map/directions?to=ll.3.1412%2C101.6865", 3.1412, 101.6865]];
  const bad = cases.filter(([u, a, b]) => { const r = pinRead(u); return !r || Math.abs(r.lat - a) > 1e-6 || Math.abs(r.lng - b) > 1e-6; });
  ok(bad.length === 0, "a Google Maps or Waze link with the point in it is read on the phone, the place's own point before the map's centre: " + JSON.stringify(bad.map((c) => c[0].slice(0, 50))));
  const wz = pinRead("https://waze.com/ul/hw283f2u7q");
  ok(wz && Math.abs(wz.lat - 3.14) < 0.05 && Math.abs(wz.lng - 101.69) < 0.05, "a Waze short link's geohash is read on the phone, no redirect: " + JSON.stringify(wz));
  const short = pinRead("https://maps.app.goo.gl/AbCdEf123");
  ok(short && short.link === "https://maps.app.goo.gl/AbCdEf123" && !("lat" in short), "a short Google link, which only a redirect opens, is kept as the link for the desk");
  const none = ["https://example.com/maps/@3.1,101.6,15z", "http://www.google.com/maps/@3.1,101.6,15z", "https://www.google.com/maps/place/Somewhere", "Jalan 1", "https://waze.com/ul/h"]
    .filter((u) => pinRead(u) !== null);
  ok(none.length === 0, "a link of any other site, not https, or with no point in it reads as nothing: " + JSON.stringify(none));

  const ck = await C.contentKey("test-secret", U);
  const list = { at: "2026-10-10T03:59:00Z", digest: "dp1", week: { label: "5 to 11 Oct 2026", monday: "2026-10-05" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "tier", tier: "Gold", sizes: [{ q: 1, price: 100 }] }] };
  const prices = Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, JSON.stringify(list)));
  const drive = async (key, geo) => {
    const posted = [], asked = [];
    const body = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-pin", prices,
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const dom = new JSDOM(landingPage(U, "npin", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      Object.defineProperty(win.navigator, "geolocation", { configurable: true, value: { getCurrentPosition(okf, nof, opts) { asked.push(opts); geo ? okf({ coords: geo }) : nof({ code: 1 }); } } });
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const reply = (status, b) => ({ ok: status === 200, status, type: "basic", json: async () => b });
        if (p === "/open") return reply(200, body);
        if (p === "/slip/key") return reply(200, { ok: true, key });
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: [] });
        if (p === "/orders" && m === "POST") { const j = JSON.parse(init.body); posted.push(j);
          return reply(200, { ok: true, order: { id: "20261010050000-pppp", product: "salt", qty: j.qty, status: "placed", mode: j.mode, at: "2026-10-10T05:00:00Z", total: j.total, history: [], msgs: [] } }); }
        return reply(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    for (let i = 0; i < 200 && !d.getElementById("oNew"); i++) await new Promise((r) => setTimeout(r, 25));
    return { w, d, posted, asked };
  };
  const wait = async (f) => { for (let i = 0; i < 160 && !f(); i++) await new Promise((r) => setTimeout(r, 25)); return f(); };
  const A = await drive(pub, { latitude: 3.1412, longitude: 101.6865, accuracy: 12 });
  try {
    const { d, posted, asked } = A;
    d.getElementById("oNew").click();
    d.querySelector('#osheet [data-k="mode:1"]').click();
    ok(await wait(() => !!d.getElementById("oPinHere")) && !!d.getElementById("oPinLink"), "a delivery offers Use my location and a map link once the key is filed");
    ok(d.getElementById("oGo").disabled, "with neither the area nor the spot, Review waits");
    d.getElementById("oPinHere").click();
    ok(await wait(() => !!d.getElementById("oPinOff")) && asked.length === 1 && asked[0].maximumAge === 0 && !d.getElementById("oGo").disabled,
      "Use my location reads the phone once, fresh, and the spot stands in for the area: " + JSON.stringify(asked));
    d.getElementById("oGo").click();
    ok(d.getElementById("osheet").textContent.includes(W.EN["sh.pinShared"]), "the check says the spot is shared, sealed");
    d.getElementById("oPlace").click();
    ok(await wait(() => posted.length === 1), "Place sends the order");
    const env = posted[0] && posted[0].pin, got = env && typeof env === "object" ? await open(pair.privateKey, env, "salt-pin v1") : null;
    ok(got && got.lat === 3.1412 && got.lng === 101.6865 && got.src === "gps" && !JSON.stringify(posted[0]).includes("101.6865") && posted[0].place === "",
      "and the spot leaves sealed to his key, opened only by it, with nothing of the point in the clear: " + JSON.stringify(got));
  } finally { await new Promise((r) => setTimeout(r, 80)); A.w.close(); }
  /* no key filed, no spot offered; a phone that will not share says so and the area is asked for */
  const B = await drive(null, null);
  try {
    const { d } = B;
    d.getElementById("oNew").click(); d.querySelector('#osheet [data-k="mode:1"]').click();
    await new Promise((r) => setTimeout(r, 150));
    ok(!d.getElementById("oPinHere") && !!d.getElementById("oWhere"), "with no key filed no spot is offered, and the area is asked as ever");
  } finally { B.w.close(); }
  const D = await drive(pub, null);
  try {
    const { d } = D;
    d.getElementById("oNew").click(); d.querySelector('#osheet [data-k="mode:1"]').click();
    await wait(() => !!d.getElementById("oPinHere")); d.getElementById("oPinHere").click();
    ok(await wait(() => d.getElementById("osheet").textContent.includes(W.EN["sh.pinNo"])) && !d.getElementById("oPinOff") && d.getElementById("oGo").disabled,
      "a phone that will not share its location says so, and Review waits for the area");
  } finally { D.w.close(); }
}
