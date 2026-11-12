/* test/counter-c-pin-seal.mjs: THE SEAL CARRIES THE SPOT'S NAME AND ADDRESS (Counter Batch C, P6, item 18; his answers of 20 Oct 2026; re-aimed 11 Nov 2026, his word:
 * a spot is a name and an address or a point, there is no floor or unit any more).
 *
 * What a delivery seals to his slip key is the exact point (Use my location or a pasted link) with the spot's name beside it, or, with no point, the address
 * as typed (src 'addr') with the name. The name and the address never travel in the clear (the name alone is the order's place), each is cut on the phone
 * (24 and 200), the seal stays the slip's shape under PIN_MAX, and an amendment still names no spot of its own.
 * Every username, point and key is invented. Each check was proved red by its own mutation (test/counter-c-pin-seal.mutations.json).
 *   1  a point and a name seal together, opened only by his key, with nothing of either in the clear but the name as the place
 *   2  an address with no point seals as src 'addr' with the name, and the check says Address
 *   4  an address over 200 is cut before sealing
 *   3, 5  retired 11 Nov 2026: a spot with neither unit nor point (every spot has an address or a point now), and the key arriving after the step opened
 *   6  at the longest name and address the seal is under PIN_MAX and both shapes are taken by the Worker
 *   7  an amendment carrying a spot is refused; one without keeps the order's
 *   8  an order whose spot is sealed says Spot or unit, Sealed under Details
 *   9  a saved spot picked from the list, the step never opened, is sealed (the key asked for with the list), and one read back
 *      from an older store ({place, unit}) or holding more than the step allows is read as an address and cut first */
import { webcrypto } from "node:crypto";
import { startAt } from "./counter-b-kit.mjs";
const U = "pnab-cdeh", PASS = "fixture-pass-seal-03";
const S = webcrypto.subtle, enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");
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
const J = (o) => JSON.stringify(o);

export async function run({ ok }) {
  const P = await import("../stmt/pin.js"), O = await import("../stmt/orders.js"), M = await import("../stmt/maker.js"), W = await import("../stmt/words.js");
  const { landingPage } = await import("../stmt/page.js"), C = await import("../tools/stmt-crypto.mjs"), { JSDOM } = await import("jsdom");
  const pair = await S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await S.exportKey("jwk", pair.publicKey), pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const ck = await C.contentKey("test-secret", U);
  const list = { at: "2026-10-20T03:59:00Z", digest: "dps", week: { label: "19 to 25 Oct 2026", monday: "2026-10-19" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "tier", tier: "Gold", sizes: [{ q: 1, price: 100 }] }] };
  const prices = Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, J(list)));
  const wait = async (f, n = 160) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 25)); return f(); };
  const drive = async ({ geo = null, keyLate = null, orders = [] } = {}) => {
    const posted = [], keyed = { n: 0 };
    const body = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-seal", prices,
      env: await C.encryptWith(ck, J({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const dom = new JSDOM(landingPage(U, "nseal", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      Object.defineProperty(win.navigator, "geolocation", { configurable: true, value: { getCurrentPosition(okf, nof) { geo ? okf({ coords: geo }) : nof({ code: 1 }); } } });
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const reply = (status, b) => ({ ok: status === 200, status, type: "basic", json: async () => b });
        if (p === "/open") return reply(200, body);
        if (p === "/slip/key") { if (keyLate) await keyLate; keyed.n++; return reply(200, { ok: true, key: pub }); }
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: JSON.parse(J(orders)) });
        if (p === "/orders" && m === "POST") { const j = JSON.parse(init.body); posted.push(j);
          return reply(200, { ok: true, order: { id: "20261020050000-ss" + posted.length, product: "salt", qty: j.qty, status: "placed", mode: j.mode, at: "2026-10-20T05:00:00Z", total: j.total, history: [], msgs: [] } }); }
        return reply(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await wait(() => !!d.getElementById("oNew"), 200);
    return { w, d, posted, keyed };
  };
  const type = (A, id, v) => { const x = A.d.getElementById(id); if (!x) return; x.value = v; x.dispatchEvent(new A.w.Event("input", { bubbles: true })); };
  /* one order through the sheet: a new spot named Shop, its address or its exact spot if asked; returns what Place sent */
  const place = async (A, { addr = "", here = false, link = "" } = {}) => {
    const { d } = A;
    await startAt(d); d.querySelector('#osheet [data-k="mode:1"]').click();
    d.getElementById("spAdd").click(); await wait(() => !!d.getElementById("spName"));
    await wait(() => !!d.getElementById("oPinHere"));
    type(A, "spName", "Shop");
    if (here && d.getElementById("oPinHere")) { d.getElementById("oPinHere").click(); await wait(() => !!d.getElementById("oPinOff")); }
    if (addr) type(A, "spAddr", addr);
    if (link) { type(A, "spAddr", link); await wait(() => !!d.getElementById("oPinOff")); }
    d.getElementById("spUse").click();
    await wait(() => !d.getElementById("spUse") && !(d.getElementById("oGo").getAttribute("aria-disabled") === "true"));
    d.getElementById("oGo").click();
    const check = d.getElementById("osheet").textContent;
    const n = A.posted.length; d.getElementById("oPlace").click();
    await wait(() => A.posted.length > n);
    const sent = A.posted[n] || {};
    return { sent, check, got: sent.pin && typeof sent.pin === "object" ? await open(pair.privateKey, sent.pin, "salt-pin v1") : null };
  };
  const closeAll = [];
  try {
    /* ---- 1 ---- */
    const A = await drive({ geo: { latitude: 3.1412, longitude: 101.6865, accuracy: 12 } }); closeAll.push(A);
    const r1 = await place(A, { here: true });
    const clear = J(Object.assign({}, r1.sent, { pin: undefined, place: undefined }));
    ok(r1.got && r1.got.lat === 3.1412 && r1.got.lng === 101.6865 && r1.got.label === "Shop" && r1.sent.place === "Shop"
      && !/Shop|101\.6865/.test(clear) && !("label" in r1.sent),
      "a point and a name seal together, opened by his key, nothing of either in the clear but the name as the place: " + J(r1.got));
    /* ---- 2, 4 ---- */
    const B = await drive(); closeAll.push(B);
    const long = "Unit 12A, Block Q, Level 3, Wisma Zarvo Tower East, ".repeat(6);
    const r2 = await place(B, { addr: "12 Jalan Zarvo, Taman Veloria" });
    ok(r2.got && r2.got.src === "addr" && r2.got.label === "Shop" && r2.got.addr === "12 Jalan Zarvo, Taman Veloria" && !("lat" in r2.got) && !/Zarvo/.test(J(Object.assign({}, r2.sent, { pin: undefined }))) && r2.check.includes(W.EN["sp.addrRow"]),
      "an address with no point seals as src addr with the name, never in the clear, and the check says Address: " + J(r2.got));
    const r4 = await place(B, { addr: long });
    ok(r4.got && r4.got.addr === long.trim().slice(0, 200).trim() && r4.got.addr.length <= 200, "an address over 200 is cut before sealing: " + J(r4.got && r4.got.addr && r4.got.addr.length));
    /* ---- 6 ---- */
    const most = await seal(pub, { v: 1, at: "2026-10-20T05:00:00.000Z", lat: -33.123456789, lng: -151.123456789, acc: 99999, src: "gps", link: "https://maps.app.goo.gl/" + "A".repeat(40),
      label: "N".repeat(24), addr: "A".repeat(200) }, "salt-pin v1");
    const unitOnly = await seal(pub, { v: 1, at: "2026-10-20T05:00:00.000Z", label: "N".repeat(24), addr: "A".repeat(200), src: "addr" }, "salt-pin v1");
    const t1 = await P.takePin({ product: "salt", pin: most }), t2 = await P.takePin({ product: "salt", pin: unitOnly });
    ok(most.ct.length <= P.PIN_MAX && P.pinShape(most) && P.pinShape(unitOnly) && t1.pin && t2.pin && !t1.code && !t2.code,
      "at the longest name and address the seal is under PIN_MAX, and the Worker takes both shapes: " + most.ct.length);
    /* ---- 7 ---- */
    const env = { ORDER_STORE: "object", ORDERBOOK: {}, COUNTER_MAKER_KEY: "k".repeat(40), DESK_MAKER: { fetch: async () => new Response(J({ ok: true }), { status: 200 }) } };
    const am = await M.customerAmend(env, U, "20261020050000-ss1", { product: "salt", qty: 2, mode: "deliver", place: "", rid: "a".repeat(32), pin: unitOnly });
    const iso = "2026-10-20T05:30:00.000Z", base = { product: "salt", qty: 1, mode: "deliver", unit: 100, total: 100, place: "Veloria", forFriend: false, rid: "b".repeat(32) };
    const placed = O.decidePlace(U, Object.assign({ pin: t2.pin.id }, base), [], iso, "", "customer", null, {});
    const rep = placed.ev && O.decideReplace(placed.ev.order, { product: "salt", qty: 2, mode: "deliver", unit: 100, total: 200, place: "Veloria", forFriend: false, rid: "c".repeat(32), week: "", digest: "" },
      [placed.ev.order], iso, "");
    ok(am && am.status === 400 && am.code === "amendShape" && rep && rep.place && rep.place.order.pin === t2.pin.id,
      "an amendment carrying a spot is refused, and one without keeps the order's: " + J([am && am.code, rep && rep.place && rep.place.order.pin]));
    /* ---- 8 ---- */
    const o = { id: "20261020040000-pq", product: "salt", qty: 1, status: "placed", mode: "deliver", place: "Veloria", pinned: true, at: "2026-10-20T04:00:00Z", total: 100, history: [], msgs: [] };
    const E = await drive({ orders: [o] }); closeAll.push(E);
    E.d.querySelector('button[data-t="order"]').click();
    const cardOf = () => E.d.querySelector('#pOrder [data-row="' + o.id + '"]');
    if (await wait(cardOf)) cardOf().click();
    const scr = () => E.d.querySelector('#pOrder .oscreen[data-order="' + o.id + '"] .odet');
    await wait(scr);
    const rows = scr() ? [...scr().querySelectorAll(".salt-ledger__row, .salt-ledger > *")].map((r) => r.textContent.replace(/s+/g, " ").trim()) : [];
    ok(rows.some((t) => t.includes(W.EN["od.sealed"]) && t.includes(W.EN["od.sealedV"])), "an order whose spot is sealed says Spot or unit, Sealed under Details: " + J(rows));
    /* ---- 9 ---- */
    const F = await drive(); closeAll.push(F);
    F.w.localStorage.setItem("salt-spots:" + U, J([{ id: "t1", label: "N".repeat(40), place: "Veloria", unit: "U".repeat(300) }]));
    await startAt(F.d); F.d.querySelector('#osheet [data-k="mode:1"]').click();
    await wait(() => !!F.d.querySelector('#osheet [data-k="spot:0"]'));
    F.d.querySelector('#osheet [data-k="spot:0"]').click();
    await wait(() => !!F.d.getElementById("oGo") && !(F.d.getElementById("oGo").getAttribute("aria-disabled") === "true"));
    await wait(() => F.keyed.n > 0); await new Promise((r) => setTimeout(r, 30));   /* the key, so Place can seal */
    F.d.getElementById("oGo").click(); F.d.getElementById("oPlace").click();
    await wait(() => F.posted.length > 0);
    const g9 = F.posted[0] && F.posted[0].pin ? await open(pair.privateKey, F.posted[0].pin, "salt-pin v1") : null;
    ok(g9 && g9.src === "addr" && g9.addr === "U".repeat(200) && g9.label === "N".repeat(24), "an older saved spot ({place, unit}) picked from the list is read as an address, sealed and cut to what the step allows: " + J(g9 && [g9.label.length, (g9.addr || "").length]));
  } finally { await new Promise((r) => setTimeout(r, 80)); for (const x of closeAll) try { x.w.close(); } catch (e) { /* closed */ } }
}
