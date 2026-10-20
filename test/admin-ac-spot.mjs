/* test/admin-ac-spot.mjs: SALT ADMIN A TO C, P4 (20 Oct 2026; docs/plan-counter-admin-ac.html). Their saved spot, opened on Salt Admin too (his answer).
 * What is proved here, each check red under its own mutation (test/admin-ac-spot.mutations.json):
 *   1  the Counter answers his read of a spot from its own store, and that read keeps nothing (the Desk's read still files it for another 30 days); a
 *      spot not kept is a 404
 *   2  on a delivery that carries one, the card says Their spot, Sealed, with Unlock, and reads nothing until the one unlock
 *   3  unlocked, it opens the seal under 'salt-pin v1' with the slip key and draws the spot's name, its floor or unit, and Maps at the point
 *   4  the lock takes the opened spot off the page and seals the card again
 *   5  a unit sealed alone draws no Maps; a practice order's spot, never filed, offers no Unlock
 * The real ECDH, HKDF and AES-GCM run in the page (the harness's webcrypto). Drawn by the maker harness (test/maker-act.mjs). */
import { webcrypto } from "node:crypto";
import { richOwnerPage, byAct, slipFixture } from "./maker-act.mjs";
import { handleMaker } from "../stmt/maker.js";
import { readPin } from "../stmt/pin.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const b64 = (v) => Buffer.from(v).toString("base64");
const U = "abcd-efgh", IDP = "a".repeat(32), IDU = "b".repeat(32), IDX = "c".repeat(32);
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
    [IDU]: await pinSeal(fix.pub, { unit: "Unit 7", src: "unit" }) };
  const base = { u: U, product: "salt", delivery: 10, msgs: [], history: [], payments: [], paid: 0, mode: "deliver", place: "Lirau", qty: 1, total: 50, status: "acknowledged", at: "2026-10-10T02:00:00.000Z" };
  const orders = [{ ...base, id: "ord-sp", pin: IDP }, { ...base, id: "ord-su", pin: IDU }, { ...base, id: "ord-sx", pin: IDX, test: true }];
  const p = await richOwnerPage({ pageWork, slip: true, review: (j) => ({ ...j, orders: (j.orders || []).concat(orders) }),
    extra: (route) => { const m = /^\/all\/maker\/pins\/[^/]+\/([0-9a-f]{32})$/.exec(route); return m ? (sealed[m[1]] ? { ok: true, pin: sealed[m[1]] } : undefined) : undefined; } });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const gateOf = (id) => { const c = p.card(id); return c && c.querySelector("[data-pin-gate]"); };
    const unlock = async (g) => { await click(g && byAct(g, "vault.unlock")); const f = byAct(d, "vault.passphrase"); if (f) f.value = p.slipPass; await click(byAct(d, "vault.open")); };
    const pinReads = () => p.wire.filter((x) => /\/all\/maker\/pins\//.test(typeof x === "string" ? x : x.route || x.url || "")).length;
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.confirmed"));
    const open = async (id) => { await click(byAct(d, "order.open", id)); return p.card(id); };
    /* 2 */
    let C = await open("ord-sp"), gate = C && C.querySelector("[data-pin-gate]");
    ok(!!gate && /^Their spot/.test(t(gate)) && /Sealed/.test(t(gate)) && !!byAct(gate, "vault.unlock") && !gate.querySelector("[data-maker-pin]") && pinReads() === 0,
      "a delivery with a spot says Their spot, Sealed, with Unlock, and reads nothing yet: " + t(gate));
    /* 3 */
    await unlock(gate);
    gate = gateOf("ord-sp");
    const opened = gate && gate.querySelector("[data-maker-pin]"), maps = opened && opened.querySelector("a[data-spot-maps]");
    ok(!!opened && /Spot\s*Back door/.test(t(opened)) && /Floor or unit\s*Unit 12, floor 3/.test(t(opened)) && !!maps && /3\.15,101\.71/.test(maps.getAttribute("href")) && pinReads() === 1,
      "unlocked, the card opens their spot: its name, its floor or unit and Maps at the point: " + t(opened) + " " + (maps && maps.getAttribute("href")));
    /* 4 */
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
  } finally { p.w.close(); }
}
