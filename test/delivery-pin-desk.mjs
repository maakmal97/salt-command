/* test/delivery-pin-desk.mjs: THE DESK OPENS A DELIVERY'S EXACT SPOT (his decisions of 10 Oct 2026). The desk Worker relays the
 * sealed spot keyed, as it relays a slip, and his service worker never keeps it; the Site orders card opens it with the slip key
 * the one unlock holds, under the pin's own info, measures the fee to it ahead of the places vault and the locality, offers to
 * file it as their place through the vault's own road (never for a friend's order or a -R bucket), and the lock drops it.
 * Every code, name and point is invented. Every assertion was proved red by its own mutation. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { Store } from "./maker-order-controls.mjs";

const REPO = join(import.meta.dirname, "..");
const S = webcrypto.subtle, enc = new TextEncoder(), b64 = (u8) => Buffer.from(u8).toString("base64");
async function seal(pub, obj, info) {
  const E = { name: "ECDH", namedCurve: "P-256" }, iv = webcrypto.getRandomValues(new Uint8Array(12));
  const eph = await S.generateKey(E, false, ["deriveBits"]), pk = await S.importKey("jwk", pub, E, false, []);
  const hk = await S.importKey("raw", await S.deriveBits({ name: "ECDH", public: pk }, eph.privateKey, 256), "HKDF", false, ["deriveKey"]);
  const key = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  return { v: 1, epk: b64(new Uint8Array(await S.exportKey("raw", eph.publicKey))), iv: b64(iv), ct: b64(new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))))) };
}

export async function run({ ok }) {
  /* 1. THE RELAY: keyed, to the site's desk road, 404 when not kept; the service worker passes it by */
  const deskW = (await import("../src/worker.js")).default;
  const KEY = "k-pin-fixture", U = "pnab-cdef", PID = "5e".repeat(16), PIN = { v: 1, epk: "e", iv: "i", ct: "c" };
  const seen = [];
  const STMT_SITE = { fetch: async (u, init) => { seen.push({ u: String(u), h: (init && init.headers) || {} });
    return String(u).endsWith("/" + PID) ? new Response(JSON.stringify({ ok: true, pin: PIN }), { status: 200 })
      : new Response(JSON.stringify({ ok: false, error: "that location is not kept" }), { status: 404 }); } };
  const assets = { fetch: async () => new Response(JSON.stringify({ id: "rev-fixture" }), { headers: { "content-type": "application/json" } }) };
  const env = { SALT_QUEUE: new Store(), ASSETS: assets, REQUIRE_ACCESS: "0", SALT_WRITE_KEY: KEY, STMT_SITE, STMT_DESK_KEY: "dk" };
  const call = async (path, opts = {}) => { const r = await deskW.fetch(new Request("https://salt-command.example" + path, opts), env); let j = null; try { j = await r.json(); } catch (e) { j = null; } return { status: r.status, j }; };
  const K = { headers: { "X-Salt-Key": KEY } };
  const unkeyed = await call("/pins/" + U + "/" + PID), got = await call("/pins/" + U + "/" + PID, K), miss = await call("/pins/" + U + "/" + "cd".repeat(16), K);
  const posted = await call("/pins/" + U + "/" + PID, { method: "POST", headers: { "X-Salt-Key": KEY } });
  ok(unkeyed.status === 401 && got.status === 200 && got.j && JSON.stringify(got.j.pin) === JSON.stringify(PIN)
    && seen[0] && seen[0].u === "https://stmt/desk/pins/" + U + "/" + PID && seen[0].h["X-Stmt-Desk"] === "dk" && miss.status === 404 && posted.status === 405,
    "the desk fetches a spot with its key alone, relayed to the site's desk road, 404 when not kept: " + JSON.stringify([unkeyed.status, got.status, miss.status, posted.status, seen.map((s) => s.u)]));
  const vm = await import("node:vm");
  const sw = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  const answered = (path) => {
    const L = {}, told = [];
    const ctx = { URL, console, caches: { match: async () => undefined, open: async () => ({ put() {} }) },
      self: { addEventListener: (t, f) => { L[t] = f; }, location: { origin: "https://salt-command.example" } },
      fetch: async () => ({ status: 200, type: "basic", redirected: false, clone() { return this; } }) };
    vm.createContext(ctx); vm.runInContext(sw, ctx);
    L.fetch({ request: { method: "GET", url: "https://salt-command.example" + path, mode: "cors" }, respondWith: (p) => told.push(p) });
    return told.length;
  };
  ok(answered("/pins/" + U + "/" + PID) === 0 && answered("/icon-192.png") === 1, "a GET of a spot passes the service worker by to the network and is never cached");

  /* 2. THE CARD: opened with the one unlock, the fee measured to it, filed as their place, dropped by the lock */
  const { openMaster } = await import("../tools/payload.mjs");
  const V = await import("../tools/seed-vault.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true }); } catch (e) { w.crypto = webcrypto; } }
  const rd = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const CODE = "CZ9-PNQ";
  const names = JSON.stringify(await V.vaultEncrypt("pw", { [CODE]: "Zed Pnq (Qelvor)", "CZ8-PNR": "Zed Pnr (Qelvor)" }));
  const places = JSON.stringify(await V.vaultEncrypt("pw", { [CODE]: { addr: "Kedai Zqor", lat: 3.2, lng: 101.5, src: "waze", at: null }, _base: { addr: null, lat: 3.0, lng: 101.4, src: null, at: null } }));
  const key = await V.slipKeyMint("pw");
  const spot = { v: 1, lat: 3.1, lng: 101.7, acc: 9, src: "gps", at: "2026-10-10T05:30:00.000Z" };
  const sealedPin = JSON.stringify(await seal(key.pub, spot, "salt-pin v1")), sealedSlip = JSON.stringify(await seal(key.pub, spot, "salt-slip v1"));
  const sealedLink = JSON.stringify(await seal(key.pub, { v: 1, link: "https://maps.app.goo.gl/AbCdEf123", src: "link", at: spot.at }, "salt-pin v1"));
  const P1 = "11".repeat(16), P2 = "22".repeat(16), P3 = "33".repeat(16);
  w.eval("try{cloudMode=function(){return true;};}catch(e){};(function(){NAME_VAULT=" + names + ";qSyncState='server';window.prompt=function(){return 'pw';};"
    + "window.__gets=[];window.__draws=0;ordDraw=function(){window.__draws++;};navigator.__defineGetter__&&0;"
    + "var A=function(st,j){return Promise.resolve({ok:st===200,status:st,json:function(){return Promise.resolve(j);}});};"
    + "window.fetch=function(u,o){var s=String(u);window.__gets.push(s);"
    + "if(s==='vault/addr')return A(200,{ok:true,vault:" + places + "});if(s==='vault/key')return A(200,{ok:true,vault:" + JSON.stringify(key.vault) + "});"
    + "if(s==='pins/" + U + "/" + P1 + "')return A(200,{ok:true,pin:" + sealedPin + "});if(s==='pins/" + U + "/" + P2 + "')return A(200,{ok:true,pin:" + sealedSlip + "});"
    + "if(s==='pins/" + U + "/" + P3 + "')return A(200,{ok:true,pin:" + sealedLink + "});"
    + "if(s==='geo/expand')return A(200,{ok:true,location:'https://www.google.com/maps/place/X/@3.05,101.6,17z/data=!3d3.15!4d101.75'});"
    + "if(s.indexOf('pins/')===0)return A(404,{ok:false,error:'that location is not kept'});return A(200,{ok:true});};})();");
  /* no geolocation in jsdom: the fee is worked from his base point, as the desk does when his location is not read */
  try { Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: undefined }); } catch (e) { /* none there */ }
  const order = (id, pin, extra) => Object.assign({ id, u: U, code: CODE, status: "placed", mode: "deliver", product: "salt", qty: 1, total: 100, pin, at: spot.at, history: [], msgs: [] }, extra || {});
  const O1 = order("20261010050000-aaaa", P1), O2 = order("20261010050000-bbbb", P2), O3 = order("20261010050000-cccc", P3),
    O4 = order("20261010050000-dddd", P1, { forFriend: true }), O5 = order("20261010050000-eeee", "44".repeat(16));
  w.eval("ORD_OPEN=" + JSON.stringify([O1, O2, O3, O4, O5]) + ";");
  const locked = rd("{line:ordPinLine(" + JSON.stringify(O1) + ")}");
  await w.eval("ordPinPoint(" + JSON.stringify(O1) + ")");
  ok(/show names to open it/.test(locked.line) && !rd("window.__gets").some((g) => g.indexOf("pins/") === 0),
    "locked, the card says a spot was shared, sealed, and fetches nothing: " + JSON.stringify(locked));
  await w.eval("vaultReveal('pw')");
  await w.eval("ordPinPoint(" + JSON.stringify(O1) + ").then(function(p){window.__p1=p;})");
  const one = rd("{p:window.__p1,st:ORD_PIN['" + O1.id + "'],line:ordPinLine(" + JSON.stringify(O1) + ")}");
  ok(one.p && one.p.lat === 3.1 && one.p.lng === 101.7 && one.st.st === "ok" && /open on this device/.test(one.line) && /data-pinfile="20261010050000-aaaa"/.test(one.line)
    && !/3\.1|101\.7/.test(one.line),
    "unlocked, the spot opens with the slip key under the pin's own info, and the card names it and offers to file it, never its figures: " + JSON.stringify(one));
  await w.eval("ordPinPoint(" + JSON.stringify(O2) + ")");
  const two = rd("ORD_PIN['" + O2.id + "']");
  ok(two.st === "err" && !two.pt && /would not open/.test(two.msg), "a slip's seal never opens as a spot: " + JSON.stringify(two));
  await w.eval("ordPinPoint(" + JSON.stringify(O3) + ")");
  const three = rd("{st:ORD_PIN['" + O3.id + "'],gets:window.__gets.filter(function(g){return g==='geo/expand';}).length}");
  ok(three.st.st === "ok" && three.st.pt.lat === 3.15 && three.st.pt.lng === 101.75 && three.gets === 1,
    "a short Google link they shared is opened as Add ID opens one, the place's own point taken: " + JSON.stringify(three));
  await w.eval("ordPinPoint(" + JSON.stringify(O5) + ")");
  ok(/no longer kept/.test(rd("ORD_PIN['" + O5.id + "'].msg")), "a spot no longer kept says so, and the fee falls back to their filed place");

  /* the fee: measured to the shared spot, ahead of the places vault */
  await w.eval("deliveryOffer('" + CODE + "',ORD_PIN['" + O1.id + "'].pt).then(function(o){window.__off=o;});deliveryOffer('" + CODE + "',null).then(function(o){window.__off0=o;})");
  await new Promise((r) => setTimeout(r, 30));
  const fee = rd("{a:window.__off,b:window.__off0,line:feeLine(window.__off)}");
  ok(fee.a && fee.a.to === "pin" && fee.b && fee.b.to === "exact" && fee.a.km !== fee.b.km && /the spot .* shared on this order/.test(fee.line),
    "the fee is measured to the spot they shared ahead of their filed point, and the line says so: " + JSON.stringify(fee));
  await w.eval("ORD_FEE={};ordFeeRead(ORD_OPEN[0]).then(function(){window.__fr=ORD_FEE[ordFeeKey(ORD_OPEN[0])];})");
  await new Promise((r) => setTimeout(r, 30));
  ok(rd("window.__fr && window.__fr.off && window.__fr.off.to") === "pin", "the card's own fee read measures to the spot");

  /* filing it as their place: through the vault's own road, never for a friend's order */
  w.eval("window.__filed=null;wbVaultFile=function(edit,editPlaces){var m={'" + CODE + "':{addr:'Kedai Zqor',lat:3.2,lng:101.5,src:'waze',at:null}};editPlaces(m);window.__filed=m;return Promise.resolve(null);};");
  w.eval("ORD_PIN['" + O4.id + "']=ORD_PIN['" + O1.id + "'];");
  await w.eval("ordPinFile('" + O4.id + "')");
  ok(rd("window.__filed") === null && !/data-pinfile/.test(rd("ordPinLine(" + JSON.stringify(O4) + ")")) && /open on this device/.test(rd("ordPinLine(" + JSON.stringify(O4) + ")")), "a friend's order shows the spot but never files it as the associate's place");
  w.eval("window.__filed=null;");
  await w.eval("ordPinFile('" + O1.id + "')");
  const filed = rd("{m:window.__filed,st:ORD_PIN['" + O1.id + "'],line:ordPinLine(" + JSON.stringify(O1) + ")}");
  ok(filed.m && filed.m[CODE].lat === 3.1 && filed.m[CODE].lng === 101.7 && filed.m[CODE].src === "pin" && filed.m[CODE].addr === "Kedai Zqor"
    && filed.st.filed === true && /Filed as their place/.test(filed.line),
    "File as their place writes the spot into the places vault on this device, keeping the address filed: " + JSON.stringify(filed.m));

  /* the lock drops every spot */
  w.eval("lockVault();");
  ok(JSON.stringify(rd("ORD_PIN")) === "{}" && /show names to open it/.test(rd("ordPinLine(" + JSON.stringify(O1) + ")")), "the lock drops every spot opened");
}
