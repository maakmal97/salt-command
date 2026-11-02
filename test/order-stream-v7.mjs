/* test/order-stream-v7.mjs: plan version 5, JOIN BY LINK (his answers E, E1, E2 of 02 Nov 2026; stmt/join.js). An associate asks for a link for one
 * person; he approves it; the referee's page seals a name and a place to his slip key and sends it once with the hash of a nonce it keeps; he adds
 * the ID; the hand-over his page mints is filed for the page holding the nonce, handed over once, and the record forgets it. Every id that cannot
 * be used answers the one shut page. The real Counter Worker, Access signed by a fixture key; every username, code and key is invented. */
import { webcrypto } from "node:crypto";
import counter from "../stmt/worker.js";
import * as O from "../stmt/orders.js";
import { Store } from "./maker-order-controls.mjs";
import { nonceHashOf, JOIN_LABEL } from "../stmt/join.js";

const J = JSON.stringify;

export async function run({ ok }) {
  const store = new Store(), team = "join-fixture", audience = "join-audience", kid = "join-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "join-local-master", STMT_HANDOVER_KEY: "join-handover-test-capability-0001" };
  const ASSOC = "jqab-cdef", PLAIN = "jrab-cdef", NEWU = "jsab-cdef";
  /* KV's bulk read, get(keys[]) answering a Map, which the store's lists use (stmt/refs.js getMany) */
  const one1 = store.get.bind(store);
  store.get = async (k, type) => Array.isArray(k) ? new Map(await Promise.all(k.map(async (x) => [x, await one1(x, "json")]))) : one1(k, type);
  await store.put("u:" + ASSOC, J({ assoc: true }));
  await store.put("u:" + PLAIN, J({}));
  await store.put("roster", J([{ code: "CJ7-NEW", username: NEWU }, { code: "CJ6-ASC", username: ASSOC }]));
  const pair = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  await store.put("slipkey", J({ pub: await webcrypto.subtle.exportKey("jwk", pair.publicKey) }));
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("unexpected request: " + url);
  };
  try {
    const header = Buffer.from(J({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(J({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email: "maakmal97@icloud.com", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwt = header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
    const go = (path, body, method, headers) => counter.fetch(new Request("https://counter.fixture.test" + path, { method: method || (body === undefined ? "GET" : "POST"),
      headers: Object.assign({ "content-type": "application/json" }, headers || {}), ...(body === undefined ? {} : { body: J(body) }) }), env);
    const owner = (path, body) => go(path, body, undefined, { "cf-access-jwt-assertion": jwt });
    const as = async (u) => { const tok = await O.mintSession(env, u); return (path, body) => go(path, body, undefined, { "X-Stmt-Session": tok }); };

    /* M1: an associate asks for one; anyone else cannot */
    const assoc = await as(ASSOC), plain = await as(PLAIN);
    const m1 = await (await assoc("/my/joins", {})).json(), m1b = await plain("/my/joins", {});
    const id = m1.join && m1.join.id;
    ok(m1.ok && !!id && m1.join.state === "waiting" && /\/j\//.test(m1.join.url) && m1b.status === 404,
      "M1 an associate asks for a join link, shut and waiting on his word; someone who is not an associate cannot: " + J([m1, m1b.status]));

    /* P1: every id that cannot be used answers the one shut page, the same bytes */
    const shut1 = await go("/j/" + id), shutBody = await shut1.text(), unknown = await go("/j/zzzz-zzzz"), longer = await go("/j/" + id + "/more");
    const bare = (h) => h.replace(/nonce="[^"]*"/g, "");   /* each answer carries its own style nonce */
    ok(shut1.status === 404 && unknown.status === 404 && longer.status === 404 && bare(await unknown.text()) === bare(shutBody) && bare(await longer.text()) === bare(shutBody),
      "P1 a link waiting on his word, an unknown one and a longer path answer the one shut page: " + J([shut1.status, unknown.status, longer.status]));
    const keyShut = await go("/j/" + id + "/key");
    ok(keyShut.status === 404, "P2 the slip key's public half is not handed out while the link is shut: " + keyShut.status);

    /* O1: he approves it; the page is served, its script under its nonce, reaching this site alone */
    const ap = await (await owner("/all/joins/" + id + "/approve", {})).json();
    const page = await go("/j/" + id), html = await page.text(), csp = page.headers.get("content-security-policy") || "";
    const n = (/script-src 'nonce-([^']+)'/.exec(csp) || [])[1];
    ok(ap.ok && page.status === 200 && !!n && html.includes('nonce="' + n + '"') && /connect-src 'self'/.test(csp) && html.includes('data-id="' + id + '"')
      && html.includes("Name or nickname") && html.includes("Where you are"),
      "O1 approved, the page asks a name or nickname and where they are, its script under the page's own nonce, talking to this site alone: " + J([ap.ok, page.status, csp]));
    const pub = (await (await go("/j/" + id + "/key")).json()).key;
    ok(!!pub && pub.kty === "EC" && !pub.d, "P3 open, it hands the slip key's public half and nothing private: " + J(pub && Object.keys(pub)));

    /* S1: the form, sealed as the page seals it, and the hash of a nonce; once */
    const C = webcrypto.subtle, E = { name: "ECDH", namedCurve: "P-256" }, iv = webcrypto.getRandomValues(new Uint8Array(12));
    const eph = await C.generateKey(E, true, ["deriveBits"]), pk = await C.importKey("jwk", pub, E, false, []);
    const hk = await C.importKey("raw", await C.deriveBits({ name: "ECDH", public: pk }, eph.privateKey, 256), "HKDF", false, ["deriveKey"]);
    const kk = await C.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode(JOIN_LABEL) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const b64 = (u) => Buffer.from(u).toString("base64");
    const seal = { v: 1, epk: b64(new Uint8Array(await C.exportKey("raw", eph.publicKey))), iv: b64(iv), ct: b64(new Uint8Array(await C.encrypt({ name: "AES-GCM", iv }, kk, new TextEncoder().encode(J({ v: 1, name: "Jonah", place: "Taman Rekaan" }))))) };
    const nonce = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    const s1 = await go("/j/" + id, { seal, nonceHash: await nonceHashOf(nonce) });
    const again = await go("/j/" + id, { seal, nonceHash: await nonceHashOf(nonce) });
    const stored = J(await store.get("j:" + id, "json"));
    ok(s1.status === 200 && again.status === 404 && !/Jonah|Taman/.test(stored) && !stored.includes(nonce),
      "S1 the form is taken once, sealed: no name, no place and no nonce in the store; a second send is shut: " + J([s1.status, again.status]));
    const bad = await go("/j/" + id + "/wait", { nonce: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64url") });
    const w1 = await (await go("/j/" + id + "/wait", { nonce })).json();
    ok(bad.status === 404 && w1.ok && w1.state === "sent" && !w1.key, "S2 waiting, only the page holding the nonce is answered, and no key yet: " + J([bad.status, w1]));
    const reload = await go("/j/" + id);
    ok(reload.status === 200, "S3 the page reloaded after Send is still served, so it goes on waiting: " + reload.status);

    /* O2: his list carries the seal while sent and never the nonce's hash; his Add ID's code; the hand-over filed for that page alone */
    const list = await (await owner("/all/joins")).json(), mine = list.joins.find((x) => x.id === id);
    ok(!!mine && mine.state === "sent" && !!mine.seal && !("nonceHash" in mine) && !("key" in mine), "O2 his list carries the seal to open behind his unlock, never the nonce's hash: " + J(mine && Object.keys(mine)));
    const early = await owner("/all/joins/" + id + "/handover", { u: NEWU, token: "x", wrap: {} });
    const added = await (await owner("/all/joins/" + id + "/added", { code: "CJ7-NEW" })).json();
    const after = await store.get("j:" + id, "json");
    ok(early.status === 409 && added.ok && added.join.state === "added" && added.join.code === "CJ7-NEW" && !after.seal,
      "O3 no hand-over before his Add ID; the code is noted and the seal is let go once it is filed in his vault: " + J([early.status, added.join && added.join.state]));
    const wrongU = await owner("/all/joins/" + id + "/handover", { u: ASSOC, token: "y", wrap: {} });
    ok(wrongU.status === 409, "O4 a hand-over for an account that is not the one he added is refused: " + wrongU.status);
    const token = Buffer.from(webcrypto.getRandomValues(new Uint8Array(24))).toString("base64url"), wrap = { salt: "c2FsdA", iv: "aXY", ct: "Y3Q" };
    const ho = await owner("/all/joins/" + id + "/handover", { u: NEWU, token, wrap }), hoj = await ho.json();
    ok(ho.status === 200 && hoj.ok && hoj.join.state === "keyed" && !("key" in hoj.join), "O5 the hand-over is minted and filed, never answered to his page here: " + J([ho.status, hoj.join && hoj.join.state, hoj.error]));
    const w2 = await (await go("/j/" + id + "/wait", { nonce })).json(), w3 = await go("/j/" + id + "/wait", { nonce }), w3j = await w3.json();
    const page2 = await go("/j/" + id);
    ok(w2.ok && w2.key === token && w2.state === "spent" && w3j.ok && !w3j.key && page2.status === 404 && !("key" in (await store.get("j:" + id, "json"))),
      "W1 the page holding the nonce takes the key once; asked again it is gone, the record forgets it, and the link is shut: " + J([w2.state, !!w2.key, w3j, page2.status]));

    /* O6: Decline is its own state and shuts the door; withdraw too */
    const d = (await (await assoc("/my/joins", {})).json()).join.id;
    await owner("/all/joins/" + d + "/decline", {});
    const mineList = (await (await assoc("/my/joins")).json()).joins;
    ok((await go("/j/" + d)).status === 404 && mineList.find((x) => x.id === d).state === "declined" && mineList.find((x) => x.id === id).state === "used"
      && !J(mineList).includes("CJ7-NEW") && !J(mineList).includes("seal"),
      "O6 a declined link is shut and the associate reads Declined; a used one Used; their list carries no code and no seal: " + J(mineList));
  } finally { globalThis.fetch = real; }
}
