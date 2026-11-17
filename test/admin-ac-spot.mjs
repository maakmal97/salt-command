/* test/admin-ac-spot.mjs: SALT ADMIN A TO C, P4 (20 Oct 2026; docs/plan-counter-admin-ac.html). Their saved spot, opened on Salt Admin too (his answer).
 * What is proved here, each check red under its own mutation (test/admin-ac-spot.mutations.json):
 *   1  the Counter answers his read of a spot from its own store, and that read keeps nothing (the Desk's read still files it for another 30 days); a
 *      spot not kept is a 404
 *   2  on a delivery that carries one, the card says Their spot, Sealed, with Unlock, and reads nothing until the one unlock
 *   3  unlocked, it opens the seal under 'salt-pin v1' with the slip key and draws the spot's name, its floor or unit, and Maps at the point
 *   4  the lock takes the opened spot off the page and seals the card again; a tap that closes a claim's slip leaves it, and a redraw of the
 *      card neither fetches it nor opens it again (Fable's review)
 *   5  a unit sealed alone draws no Maps; a practice order's spot, never filed, offers no Unlock
 *   8  (11 Nov 2026) an address they typed is drawn as its Name and Address, with Maps searching those words
 *   9  (17 Nov 2026, the one place field plan) an address with no point is placed on the card, which then draws Maps at it and File as their place
 *   10 File as their place sends the locality worked out from the point, the point and their words sealed, and says it waits for Approve
 *   11 a link the reader does not know opens as their own link, with Place it beside it
 * The real ECDH, HKDF and AES-GCM run in the page (the harness's webcrypto). Drawn by the maker harness (test/maker-act.mjs). */
import { webcrypto } from "node:crypto";
import { richOwnerPage, byAct, slipFixture } from "./maker-act.mjs";
import { handleMaker } from "../stmt/maker.js";
import { readPin } from "../stmt/pin.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const b64 = (v) => Buffer.from(v).toString("base64");
const U = "abcd-efgh", IDP = "a".repeat(32), IDU = "b".repeat(32), IDX = "c".repeat(32), IDL = "d".repeat(32), IDM = "e".repeat(32), IDA = "f".repeat(32), IDW = "9".repeat(32);
/* a spot sealed as their phone seals it (stmt/page.js pinSeal): an ephemeral pair, ECDH with his public half, HKDF under 'salt-pin v1', AES-GCM */
async function pinSeal(pubJwk, value) {
  const S = webcrypto.subtle, E = { name: "ECDH", namedCurve: "P-256" };
  const eph = await S.generateKey(E, true, ["deriveBits"]), pub = await S.importKey("jwk", { kty: pubJwk.kty, crv: pubJwk.crv, x: pubJwk.x, y: pubJwk.y }, E, false, []);
  const bits = await S.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256), hk = await S.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const aes = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("salt-pin v1") }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12)), ct = await S.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(value)));
  return { v: 1, epk: b64(await S.exportKey("raw", eph.publicKey)), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

export async function run({ ok, pageWork }) {
  /* 1 */
  const kv = new Map([["pin:" + U + ":" + IDP, JSON.stringify({ v: 1, epk: "QQ==", iv: "QQ==", ct: "QQ==" })]]), puts = [];
  const env = { STMT: { get: async (k, type) => { const v = kv.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { puts.push(k); kv.set(k, v); } } };
  const call = async (path, method = "GET") => handleMaker(new Request("https://counter.test" + path, { method }), env, path, { email: "maakmal97@icloud.com" });
  const got = await call("/all/maker/pins/" + U + "/" + IDP), gotBody = await got.json(), none = await call("/all/maker/pins/" + U + "/" + IDU);
  ok(got.status === 200 && gotBody.pin && gotBody.pin.ct === "QQ==" && none.status === 404 && puts.length === 0,
    "his read of a spot answers its ciphertext from the Counter's store and keeps nothing; a spot not kept is a 404: " + JSON.stringify([got.status, none.status, puts]));
  await readPin(env, U, IDP);
  ok(puts.length === 1, "the Desk's read still files the spot for another 30 days");

  const fix = await slipFixture();
  const sealed = { [IDP]: await pinSeal(fix.pub, { lat: 3.15, lng: 101.71, label: "Back door", unit: "Unit 12, floor 3" }),
    [IDU]: await pinSeal(fix.pub, { unit: "Unit 7", src: "unit" }),
    [IDL]: await pinSeal(fix.pub, { link: "https://maps.app.goo.gl/AbCdEf123", src: "link", label: "Gate" }),
    [IDM]: await pinSeal(fix.pub, { link: "https://maps.apple/p/ZzYy99", src: "link" }),
    [IDA]: await pinSeal(fix.pub, { addr: "12 Jalan Lirau, Block B", src: "addr", label: "Home" }),
    [IDW]: await pinSeal(fix.pub, { addr: "Gate https://share.invented.test/p/QwErTy", src: "addr", label: "Gate" }) };
  const base = { u: U, product: "salt", delivery: 10, msgs: [], history: [], payments: [], paid: 0, mode: "deliver", place: "Lirau", qty: 1, total: 50, status: "acknowledged", at: "2026-10-10T02:00:00.000Z" };
  const orders = [{ ...base, id: "ord-sp", pin: IDP }, { ...base, id: "ord-su", pin: IDU }, { ...base, id: "ord-sx", pin: IDX, test: true }, { ...base, id: "ord-sl", pin: IDL },
    { ...base, id: "ord-sm", pin: IDM }, { ...base, id: "ord-sa", pin: IDA }, { ...base, id: "ord-sw", pin: IDW }];
  let geoFail = false;
  const p = await richOwnerPage({ pageWork, slip: true, review: (j) => ({ ...j, orders: (j.orders || []).concat(orders) }),
    extra: (route) => { if (route === "/all/maker/geo/open") return geoFail ? { ok: false, error: "The link did not lead to a point." } : { ok: true, location: "https://www.google.com/maps/place/Gate/@3.0738,101.7255,17z" };
      const m = /^\/all\/maker\/pins\/[^/]+\/([0-9a-f]{32})$/.exec(route); return m ? (sealed[m[1]] ? { ok: true, pin: sealed[m[1]] } : undefined) : undefined; } });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const gateOf = (id) => { const c = p.card(id); return c && c.querySelector("[data-pin-gate]"); };
    const unlock = async (g) => { await click(g && byAct(g, "vault.unlock")); const f = byAct(d, "vault.passphrase"); if (f) f.value = p.slipPass; await click(byAct(d, "vault.open")); };
    const pinReads = () => p.wire.filter((x) => /\/all\/maker\/pins\//.test(typeof x === "string" ? x : x.route || x.url || "")).length;
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.open"));
    const open = async (id) => { await click(byAct(d, "order.open", id)); return p.card(id); };
    /* 2 */
    let C = await open("ord-sp"), gate = C && C.querySelector("[data-pin-gate]");
    ok(!!gate && /^Delivery address/.test(t(gate)) && /Sealed/.test(t(gate)) && !!byAct(gate, "vault.unlock") && !gate.querySelector("[data-maker-pin]") && pinReads() === 0,
      "a delivery with a spot says Their spot, Sealed, with Unlock, and reads nothing yet: " + t(gate));
    /* 3 */
    await unlock(gate);
    gate = gateOf("ord-sp");
    const opened = gate && gate.querySelector("[data-maker-pin]"), maps = opened && opened.querySelector("a[data-spot-maps]");
    ok(!!opened && /Name\s*Back door/.test(t(opened)) && /Floor or unit\s*Unit 12, floor 3/.test(t(opened)) && !!maps && /3\.15,101\.71/.test(maps.getAttribute("href")) && pinReads() === 1,
      "unlocked, the card opens their spot: its name, its floor or unit and Maps at the point: " + t(opened) + " " + (maps && maps.getAttribute("href")));
    /* 4 */
    await click(byAct(d, "nav.orders"));
    const kept = gateOf("ord-sp") && gateOf("ord-sp").querySelector("[data-maker-pin]");
    ok(!!kept && /Back door/.test(t(kept)), "a tap on the place he is in leaves the opened address standing");
    await click(byAct(d, "order.open", "ord-sp")); await click(byAct(d, "order.open", "ord-sp"));
    ok(pinReads() === 1 && !!(gateOf("ord-sp") && gateOf("ord-sp").querySelector("[data-maker-pin]")), "and a redraw of the card neither fetches nor opens it again: " + pinReads());
    gate = gateOf("ord-sp");
    await click(gate && byAct(gate, "vault.lock"));
    gate = gateOf("ord-sp");
    ok(!!gate && !d.querySelector("[data-maker-pin]") && /Sealed/.test(t(gate)) && !/Back door/.test(d.body.textContent),
      "the lock takes the opened spot off the page and seals the card again");
    /* 5 */
    await unlock(gate);
    C = await open("ord-su");
    const U7 = C && C.querySelector("[data-pin-gate] [data-maker-pin]");
    ok(!!U7 && /Floor or unit\s*Unit 7/.test(t(U7)) && !U7.querySelector("a[data-spot-maps]"), "a unit sealed alone is read with no Maps: " + t(U7));
    C = await open("ord-sx");
    ok(!!C && !C.querySelector("[data-pin-gate]") && /A practice spot is never filed/.test(t(C)), "a practice order's spot offers no Unlock");
    /* 6 (4 Nov 2026, his report that the exact location did not work): a short link they shared is opened on Salt Admin for its point */
    C = await open("ord-sl");
    const SL = C && C.querySelector("[data-pin-gate] [data-maker-pin]"), slMaps = SL && SL.querySelector("a[data-spot-maps]");
    const geo = p.wire.filter((x) => /\/all\/maker\/geo\/open/.test(typeof x === "string" ? x : x.route || x.url || "")).length;
    ok(!!slMaps && /3\.0738,101\.7255/.test(slMaps.getAttribute("href")) && geo === 1 && !/could not be opened/.test(t(SL)),
      "6 a short link they shared opens through Salt Admin's map road to Maps at its point: " + t(SL) + " " + (slMaps && slMaps.getAttribute("href")) + " geo " + geo);
    /* 7 (Fable's re-check): a link that will not open says so, and a redraw of the card holds that answer rather than opening it again */
    geoFail = true;
    const geoN = () => p.wire.filter((x) => /\/all\/maker\/geo\/open/.test(typeof x === "string" ? x : x.route || x.url || "")).length;
    C = await open("ord-sm");
    const SM = C && C.querySelector("[data-pin-gate]:has([data-maker-pin])"), firstGeo = geoN();
    await click(byAct(d, "order.open", "ord-sm")); await click(byAct(d, "order.open", "ord-sm"));
    ok(!!SM && /could not be opened to a point just now/.test(t(SM)) && !SM.querySelector("a[data-spot-maps]") && firstGeo === 2 && geoN() === 2,
      "7 a link that will not open says so with no Maps, and a redraw does not open it again: " + t(SM) + " geo " + firstGeo + "/" + geoN());
    /* 8 (11 Nov 2026, his word: a name and an address or a point) */
    C = await open("ord-sa");
    const SA = C && C.querySelector("[data-pin-gate] [data-maker-pin]"), saMaps = SA && SA.querySelector("a[data-spot-maps]");
    ok(!!SA && /Name\s*Home/.test(t(SA)) && /Address\s*12 Jalan Lirau, Block B/.test(t(SA)) && !!saMaps
      && saMaps.getAttribute("href") === "https://www.google.com/maps/search/?api=1&query=12%20Jalan%20Lirau%2C%20Block%20B" && !/could not be opened/.test(t(SA)),
      "8 an address they typed is drawn as its Name and Address, with Maps searching it: " + t(SA) + " " + (saMaps && saMaps.getAttribute("href")));
    /* 9 (17 Nov 2026, his yes to the one place field plan, D3): an address with no point is placed here once, and the point measures the order */
    let gA = gateOf("ord-sa");
    const pin = gA && byAct(gA, "spot.place", "ord-sa"), use = gA && byAct(gA, "spot.place.use", "ord-sa");
    const before9 = [!!pin, !!use, !gA || !byAct(gA, "spot.file", "ord-sa"), /No point yet: place it to measure the distance\./.test(t(gA))];
    if (pin) { pin.value = "3.0738, 101.7255"; pin.dispatchEvent(new p.w.Event("input", { bubbles: true })); }
    await click(use);
    gA = gateOf("ord-sa");
    const placedMaps = gA && gA.querySelector("[data-maker-pin] a[data-spot-maps]");
    ok(before9.every(Boolean) && !!placedMaps && /3\.0738,101\.7255/.test(placedMaps.getAttribute("href")) && /Address\s*12 Jalan Lirau, Block B/.test(t(gA))
      && !byAct(gA, "spot.place", "ord-sa") && !!byAct(gA, "spot.file", "ord-sa"),
      "9 an address with no point is placed here, and the card draws Maps at that point and File as their place: " + JSON.stringify(before9) + " " + t(gA));
    /* 10 (D4): File as their place sends the placement as Place on the map does: the locality worked out from the point in the clear, the point and their words sealed */
    await click(byAct(gA, "spot.file", "ord-sa"));
    const filedPost = p.posts.filter((x) => x.route === "/all/maker/inputs/place").at(-1);
    const plain = filedPost && filedPost.body && filedPost.body.places && filedPost.body.places["CX1-ZED"];
    let sealedPlace = null;
    try {
      const env = filedPost.body.addrVault, base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(p.slipPass), "PBKDF2", false, ["deriveKey"]);
      const key = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt: Buffer.from(env.salt, "base64"), iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      sealedPlace = JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(env.iv, "base64") }, key, Buffer.from(env.ct, "base64"))))["CX1-ZED"];
    } catch (e) { sealedPlace = null; }
    ok(Array.isArray(plain) && plain.length === 3 && typeof plain[2] === "string" && plain[2].length > 1 && Math.abs(plain[0] - 3.07) < 0.2 && Math.abs(plain[1] - 101.73) < 0.2
      && !JSON.stringify(filedPost.body).includes("Lirau") && !JSON.stringify(filedPost.body).includes("3.0738")
      && sealedPlace && sealedPlace.lat === 3.0738 && sealedPlace.lng === 101.7255 && sealedPlace.addr === "12 Jalan Lirau, Block B"
      && /Sent\. It is their place once you approve it\./.test(t(gateOf("ord-sa"))) && !byAct(gateOf("ord-sa"), "spot.file", "ord-sa"),
      "10 File as their place sends their locality in the clear and the point and words sealed, and says it waits for Approve: " + JSON.stringify([plain, sealedPlace]));
    /* 11 (D1): a link of a maker the reader does not know reaches him whole, as a link he opens */
    C = await open("ord-sw");
    const SW = C && C.querySelector("[data-pin-gate] [data-maker-pin]"), swMaps = SW && SW.querySelector("a[data-spot-maps]");
    ok(!!swMaps && swMaps.getAttribute("href") === "https://share.invented.test/p/QwErTy" && /Open their link/.test(t(swMaps)) && !!byAct(gateOf("ord-sw"), "spot.place", "ord-sw"),
      "11 a link the reader does not know opens as their own link, with Place it beside it: " + t(SW));
  } finally { p.w.close(); }
}
