/* test/order-stream-v7.mjs: plan version 5, JOIN BY LINK (his answers E, E1, E2 of 02 Nov 2026; stmt/join.js). An associate asks for a link for one
 * person; he approves it; the referee's page seals a name and a place to his slip key and sends it once with the hash of a nonce it keeps; he adds
 * the ID; the hand-over his page mints is filed for the page holding the nonce, handed over once, and the record forgets it. Every id that cannot
 * be used answers the one shut page. The real Counter Worker, Access signed by a fixture key; every username, code and key is invented. */
import { webcrypto } from "node:crypto";
import counter from "../stmt/worker.js";
import * as O from "../stmt/orders.js";
import { Store } from "./maker-order-controls.mjs";
import { nonceHashOf, JOIN_LABEL } from "../stmt/join.js";
import { joinPage } from "../stmt/page.js";
import { EN } from "../stmt/words.js";
import { JSDOM } from "jsdom";

/* the join page's own script, in a browser of its own: `ua` the browser, `store` whether localStorage works, `answers` the site's replies by path */
async function joinBrowser(ua, store, answers) {
  const calls = [];
  const dom = new JSDOM(joinPage("n0nce", "abcd-efgh"), { url: "https://counter.test/j/abcd-efgh", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w.navigator, "userAgent", { value: ua });
      Object.defineProperty(w, "crypto", { value: webcrypto });
      w.Uint8Array = Uint8Array; w.ArrayBuffer = ArrayBuffer;   /* Node's WebCrypto takes its own realm's typed arrays */
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
      if (!store) Object.defineProperty(w, "localStorage", { get() { throw new Error("blocked"); } });
      w.setTimeout = (f) => { Promise.resolve().then(f); return 1; };
      w.fetch = async (path, init) => { const body = init && init.body ? JSON.parse(init.body) : null; calls.push([String(path), body]);
        const a = answers(String(path), body, calls), st = a.status || 200; return { ok: st < 300, status: st, json: async () => a.body || {} }; };
    } });
  const settle = () => new Promise((r) => setTimeout(r, 30));
  await settle();
  return { dom, d: dom.window.document, calls, settle };
}

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
    const kept = J(await store.get("j:" + id, "json"));
    ok(ho.status === 200 && hoj.ok && hoj.join.state === "keyed" && !("ks" in hoj.join) && !kept.includes(token),
      "O5 the hand-over is minted and filed sealed, never in the clear in the store and never answered to his page here: " + J([ho.status, hoj.join && hoj.join.state, hoj.error]));
    const hoCount = () => [...store.values.keys()].filter((k) => k.startsWith("ho:")).length, before2 = hoCount();
    const twice = await owner("/all/joins/" + id + "/handover", { u: NEWU, token: Buffer.from(webcrypto.getRandomValues(new Uint8Array(24))).toString("base64url"), wrap });
    ok(twice.status === 409 && /sign-in already/.test((await twice.json()).error) && hoCount() === before2,
      "O7 a second hand-over tap is refused before anything is minted, so no stray key is left: " + J([twice.status, hoCount(), before2]));
    const w2 = await (await go("/j/" + id + "/wait", { nonce })).json(), w3 = await go("/j/" + id + "/wait", { nonce }), w3j = await w3.json();
    const page2 = await go("/j/" + id);
    ok(w2.ok && w2.key === token && w2.state === "spent" && w3j.ok && !w3j.key && page2.status === 404 && !("ks" in (await store.get("j:" + id, "json"))),
      "W1 the page holding the nonce takes the key once; asked again it is gone, the record forgets it, and the link is shut: " + J([w2.state, !!w2.key, w3j, page2.status]));

    /* R1: a link he withdraws while its key waits hands over nothing, and the key is burnt unspent */
    const r1 = (await (await assoc("/my/joins", {})).json()).join.id;
    await owner("/all/joins/" + r1 + "/approve", {});
    const nonce2 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    await go("/j/" + r1, { seal, nonceHash: await nonceHashOf(nonce2) });
    await owner("/all/joins/" + r1 + "/added", { code: "CJ7-NEW" });
    const tok2 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(24))).toString("base64url");
    await owner("/all/joins/" + r1 + "/handover", { u: NEWU, token: tok2, wrap });
    const hoBefore = hoCount();
    await owner("/all/joins/" + r1 + "/revoke", {});
    const wr = await go("/j/" + r1 + "/wait", { nonce: nonce2 });
    ok(wr.status === 404 && hoCount() === hoBefore - 2 && !("ks" in (await store.get("j:" + r1, "json"))),
      "R1 a link withdrawn while its key waits hands over nothing, and the key is burnt unspent (Fable's review): " + J([wr.status, hoBefore, hoCount()]));
    const big = await counter.fetch(new Request("https://counter.fixture.test/j/" + r1 + "/wait", { method: "POST", headers: { "content-type": "application/json", "content-length": "20000" }, body: "{}" }), env);
    ok(big.status === 413, "R2 a public post past the bound is refused unread (Fable's review): " + big.status);

    /* O6: Decline is its own state and shuts the door; withdraw too */
    const d = (await (await assoc("/my/joins", {})).json()).join.id;
    await owner("/all/joins/" + d + "/decline", {});
    const mineList = (await (await assoc("/my/joins")).json()).joins;
    ok((await go("/j/" + d)).status === 404 && mineList.find((x) => x.id === d).state === "declined" && mineList.find((x) => x.id === id).state === "used"
      && !J(mineList).includes("CJ7-NEW") && !J(mineList).includes("seal"),
      "O6 a declined link is shut and the associate reads Declined; a used one Used; their list carries no code and no seal: " + J(mineList));
  } finally { globalThis.fetch = real; }

  /* J1 to J3, Fable's review of the page's script */
  const IOS_WA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.23";
  const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const j1 = await joinBrowser(IOS_WA, true, () => ({}));
  ok(j1.d.getElementById("jf").hidden && j1.d.getElementById("jm").textContent === EN["join.inappIos"] && j1.calls.length === 0,
    "J1 opened in WhatsApp's own browser, the page sends nothing and says to open it in Safari, before anything is sealed: " + J([j1.d.getElementById("jm").textContent, j1.calls.length]));
  j1.dom.window.close();
  const pubJ = await webcrypto.subtle.exportKey("jwk", (await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])).publicKey);
  let waits = 0;
  const j2 = await joinBrowser(SAFARI, false, (path, body) => {
    if (path.endsWith("/key")) return { body: { ok: true, key: pubJ } };
    if (path.endsWith("/wait")) { waits++; return waits <= 2 ? { status: 404 } : { body: { ok: true, state: "spent", key: "the-key-0000000000000000" } }; }
    return { body: { ok: true } };
  });
  j2.d.getElementById("jn").value = "Jonah"; j2.d.getElementById("jp").value = "Taman Rekaan";
  j2.d.getElementById("jf").dispatchEvent(new j2.dom.window.Event("submit", { cancelable: true }));
  for (let i = 0; i < 20 && j2.d.getElementById("jm").textContent !== EN["join.ready"]; i++) await j2.settle();
  const sent = j2.calls.find((c) => c[0] === "/j/abcd-efgh"), waited = j2.calls.filter((c) => c[0] === "/j/abcd-efgh/wait");
  ok(!!sent && waited.length >= 3 && !!waited[0][1].nonce && (await nonceHashOf(waited[0][1].nonce)) === sent[1].nonceHash,
    "J2 with the phone's store blocked, the page still keeps its nonce and waits on it: " + J([!!sent, waited.length]));
  ok(j2.d.getElementById("jm").textContent === EN["join.ready"] && waited.length === 3,
    "J3 two passing not-founds do not end the wait: the key that follows is taken and the account opens: " + J([j2.d.getElementById("jm").textContent, waited.length]));
  j2.dom.window.close();
}
