/* test/counter-c-desk-spot.mjs: THE DESK READS THE SPOT'S NAME AND UNIT (Counter Batch C, P7, item 18; his answers of 20 Oct 2026).
 *
 * A sealed spot may carry the spot's name and a floor or unit beside its point, or a unit with no point (src 'unit'). After the one
 * unlock the card names them ("Shop · Level 2") before the point's line; a unit alone says so and is never filed, so File all leaves
 * it out and the fee falls back to the filed place; filing writes the point alone; a slip's seal still never opens as a spot, and the
 * lock drops the words with the point. Every code, name and point is invented. Each check was proved red by its own mutation
 * (test/counter-c-desk-spot.mutations.json).
 *   1  a point with a name and unit: the card names both before its line, no figure, and offers to file it
 *   2  a unit alone reads its own line, measures no fee and is not offered for filing
 *   3  File all leaves a unit alone out, and its own file tap writes nothing
 *   4  filing writes the point alone, never the name or the unit
 *   5  a slip's seal carrying a name opens as nothing and names nothing
 *   6  the lock drops the name and unit with the point */
import { webcrypto } from "node:crypto";
const S = webcrypto.subtle, enc = new TextEncoder(), b64 = (u8) => Buffer.from(u8).toString("base64");
async function seal(pub, obj, info) {
  const E = { name: "ECDH", namedCurve: "P-256" }, iv = webcrypto.getRandomValues(new Uint8Array(12));
  const eph = await S.generateKey(E, false, ["deriveBits"]), pk = await S.importKey("jwk", pub, E, false, []);
  const hk = await S.importKey("raw", await S.deriveBits({ name: "ECDH", public: pk }, eph.privateKey, 256), "HKDF", false, ["deriveKey"]);
  const key = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  return { v: 1, epk: b64(new Uint8Array(await S.exportKey("raw", eph.publicKey))), iv: b64(iv), ct: b64(new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj))))) };
}
const J = (o) => JSON.stringify(o);

export async function run({ ok }) {
  const { openMaster } = await import("../tools/payload.mjs");
  const V = await import("../tools/seed-vault.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  if (!w.crypto || !w.crypto.subtle) { try { Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true }); } catch (e) { w.crypto = webcrypto; } }
  const rd = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const U = "pnab-cdej", CODE = "CZ7-PNS", OTHER = "CZ6-PNT";
  const names = J(await V.vaultEncrypt("pw", { [CODE]: "Zed Pns (Qelvor)", [OTHER]: "Zed Pnt (Qelvor)" }));
  const places = J(await V.vaultEncrypt("pw", { _base: { addr: null, lat: 3.0, lng: 101.4, src: null, at: null } }));
  const key = await V.slipKeyMint("pw");
  const at = "2026-10-20T05:30:00.000Z";
  const both = J(await seal(key.pub, { v: 1, lat: 3.1, lng: 101.7, acc: 9, src: "gps", at, label: "Shop", unit: "Level 2" }, "salt-pin v1"));
  const unitOnly = J(await seal(key.pub, { v: 1, at, label: "Warehouse", unit: "Unit 12A", src: "unit" }, "salt-pin v1"));
  const slip = J(await seal(key.pub, { v: 1, lat: 3.1, lng: 101.7, src: "gps", at, label: "Shop", unit: "Level 2" }, "salt-slip v1"));
  const P1 = "71".repeat(16), P2 = "72".repeat(16), P3 = "73".repeat(16);
  w.eval("try{cloudMode=function(){return true;};}catch(e){};(function(){NAME_VAULT=" + names + ";qSyncState='server';window.prompt=function(){return 'pw';};"
    + "window.__gets=[];pinDraw=function(){};"
    + "var A=function(st,j){return Promise.resolve({ok:st===200,status:st,json:function(){return Promise.resolve(j);}});};"
    + "window.fetch=function(u,o){var s=String(u);window.__gets.push(s);"
    + "if(s==='vault/addr')return A(200,{ok:true,vault:" + places + "});if(s==='vault/key')return A(200,{ok:true,vault:" + J(key.vault) + "});"
    + "if(s==='pins/" + U + "/" + P1 + "')return A(200,{ok:true,pin:" + both + "});if(s==='pins/" + U + "/" + P2 + "')return A(200,{ok:true,pin:" + unitOnly + "});"
    + "if(s==='pins/" + U + "/" + P3 + "')return A(200,{ok:true,pin:" + slip + "});"
    + "if(s.indexOf('pins/')===0)return A(404,{ok:false,error:'that location is not kept'});return A(200,{ok:true});};})();");
  try { Object.defineProperty(w.navigator, "geolocation", { configurable: true, value: undefined }); } catch (e) { /* none there */ }
  const order = (id, pin, code) => ({ id, u: U, code, status: "placed", mode: "deliver", product: "salt", qty: 1, total: 100, pin, at, history: [], msgs: [] });
  const O1 = order("20261020050000-aaa1", P1, CODE), O2 = order("20261020050000-aaa2", P2, OTHER), O3 = order("20261020050000-aaa3", P3, CODE);
  w.eval("ORD_OPEN=" + J([O1, O2, O3]) + ";");
  await w.eval("vaultReveal('pw')");
  await w.eval("Promise.all([ordPinPoint(" + J(O1) + "),ordPinPoint(" + J(O2) + "),ordPinPoint(" + J(O3) + ")]).then(function(r){window.__pts=r;})");
  /* ---- 1 ---- */
  const one = rd("{st:ORD_PIN['" + O1.id + "'],line:ordPinLine(" + J(O1) + ")}");
  const nameAt = one.line.indexOf("Shop · Level 2"), openAt = one.line.indexOf("open on this device");
  ok(one.st && one.st.st === "ok" && one.st.label === "Shop" && one.st.unit === "Level 2" && nameAt >= 0 && openAt > nameAt
    && /data-pinfile="20261020050000-aaa1"/.test(one.line) && !/3\.1|101\.7/.test(one.line),
    "a point with a name and unit: the card names both before its line, no figure, and offers to file it: " + J(one.line));
  /* ---- 2 ---- */
  const two = rd("{p:window.__pts[1],st:ORD_PIN['" + O2.id + "'],line:ordPinLine(" + J(O2) + ")}");
  ok(two.p === null && two.st && two.st.st === "unit" && !two.st.pt && two.line.indexOf("Warehouse · Unit 12A") >= 0
    && /A unit, no exact spot: the fee is measured to their filed place\./.test(two.line) && !/data-pinfile/.test(two.line) && !/holds no point/.test(two.line),
    "a unit alone reads its own line, measures no fee and is not offered for filing: " + J(two.line));
  /* ---- 3 ---- */
  w.eval("vaultPlaces={};window.__calls=0;window.__filed=null;wbVaultFile=function(edit,editPlaces){window.__calls++;var m={};editPlaces(m);window.__filed=m;return Promise.resolve(null);};");
  const batch = rd("ordPinBatch().map(function(x){return x.o.code;})");
  await w.eval("ordPinFile('" + O2.id + "')");
  ok(J(batch) === J([CODE]) && rd("window.__calls") === 0, "File all leaves a unit alone out, and its own file tap writes nothing: " + J(batch));
  /* ---- 4 ---- */
  await w.eval("ordPinFile('" + O1.id + "')");
  const filed = rd("window.__filed");
  ok(filed && filed[CODE] && filed[CODE].lat === 3.1 && filed[CODE].lng === 101.7 && filed[CODE].src === "pin" && !("label" in filed[CODE]) && !("unit" in filed[CODE])
    && !/Shop|Level 2/.test(J(filed)),
    "filing writes the point alone, never the name or the unit: " + J(filed));
  /* ---- 5 ---- */
  const three = rd("{st:ORD_PIN['" + O3.id + "'],line:ordPinLine(" + J(O3) + ")}");
  ok(three.st && three.st.st === "err" && !three.st.label && !three.st.unit && /would not open/.test(three.line) && !/Shop|Level 2/.test(three.line),
    "a slip's seal carrying a name opens as nothing and names nothing: " + J(three));
  /* ---- 6 ---- */
  w.eval("lockVault();");
  ok(J(rd("ORD_PIN")) === "{}" && !/Shop|Level 2|Warehouse|Unit 12A/.test(rd("ordPinLine(" + J(O1) + ")+ordPinLine(" + J(O2) + ")")),
    "the lock drops the name and unit with the point");
}
