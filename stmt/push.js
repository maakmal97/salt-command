/* stmt/push.js: WEB PUSH TO A CUSTOMER'S PHONE, VAPID-signed, carrying at most the KIND of news.
 *
 * A COPY OF THE DESK'S SENDER (src/push.js), NOT AN IMPORT OF IT. The statements site may import
 * only a sibling file: nothing under stmt/ reaches into src/ or tools/, and the suite proves it.
 * The signing is fifty lines of standard crypto that has not changed since it was written, so
 * a second copy costs less than the first crack in that wall would. Keep the two the same.
 *
 * THE BANNER NAMES THE KIND OF NEWS (S12 12.2, his decision D4 of 24 Sep 2026). A wake carries a
 * kind code and the order's id, `{k, o}`, encrypted for that one phone (RFC 8291 aes128gcm, RFC
 * 8188 content coding) under the keys its subscription handed over, so the push service carries
 * bytes it cannot read. The words are the service worker's own (`NEWS` in stmt/sw.js), and none
 * names an amount, a product, an order or a person: a kind tells whoever holds the phone that
 * there is news, never what or how much. A subscription with no keys on file gets the wake with
 * no payload, and the service worker's old fixed words, so nothing already subscribed goes dark.
 *
 * THE KEYS ARE THE SITE'S OWN. STMT_VAPID_PRIVATE_JWK (a secret) and STMT_VAPID_PUBLIC_KEY (a var)
 * on THIS Worker, minted by tools/stmt-setup.mjs; the desk's pair is never reused here, because a
 * subscription is bound to the key it was created with and the two sites must not be able to
 * wake each other's phones.
 *
 * A subscription is push:<username>:<hash of the endpoint>, so one customer's phones are listed
 * with one prefix and the endpoint, a capability URL, is not in the key name. Gone endpoints
 * (404, 410) are deleted on the spot.
 */

import { NEWS } from "./sw.js";

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function signingKey(env) {
  const raw = env.STMT_VAPID_PRIVATE_JWK;
  if (!raw) return null;
  let jwk;
  try { jwk = JSON.parse(raw); } catch { return null; }
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidToken(env, key, origin) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.STMT_VAPID_SUBJECT || "mailto:salt@salt-command.invalid",
  })));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${header}.${body}.${b64url(sig)}`;
}

const unb64url = (s) => {
  const t = s.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
};

/* S12 12.1 (24 Sep 2026): A SUBSCRIPTION KEEPS ITS ENCRYPTION KEYS. The phone hands them over with the
   endpoint (RFC 8291): `p256dh`, its P-256 public key, and `auth`, sixteen secret bytes. Only with both can a
   wake carry words the phone alone can read. Anything else is dropped, never refused: a record with no keys
   still wakes the phone, as every record did before. */
export function pushKeys(k) {
  if (!k || typeof k.p256dh !== "string" || typeof k.auth !== "string") return null;
  if (!/^[A-Za-z0-9_-]{16,120}=*$/.test(k.p256dh) || !/^[A-Za-z0-9_-]{16,40}=*$/.test(k.auth)) return null;
  try {
    const p = unb64url(k.p256dh), a = unb64url(k.auth);
    return p.length === 65 && p[0] === 4 && a.length === 16 ? { p256dh: k.p256dh, auth: k.auth } : null;
  } catch { return null; }
}

const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, bytes * 8));
}
/* S12 12.2: RFC 8291's message for one phone, one record (RFC 8188 aes128gcm). A fresh key pair and salt for
   every wake; the shared secret is the phone's public key against that pair, mixed with the phone's auth
   secret, so only the phone that subscribed can read it. The header carries the salt, the record size and
   the fresh public key, which is all the phone needs to derive the same key. */
export async function sealFor(keys, text) {
  const te = new TextEncoder(), ua = unb64url(keys.p256dh), auth = unb64url(keys.auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, secret, cat(te.encode("WebPush: info"), Uint8Array.of(0), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, cat(te.encode("Content-Encoding: aes128gcm"), Uint8Array.of(0)), 16);
  const nonce = await hkdf(salt, ikm, cat(te.encode("Content-Encoding: nonce"), Uint8Array.of(0)), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(te.encode(text), Uint8Array.of(2))));
  const head = new Uint8Array(21);
  head.set(salt);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  return cat(head, asPub, ct);
}

/** The hash that names a subscription: the first twelve bytes of SHA-256 over the endpoint, as hex. */
export async function endpointId(endpoint) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(endpoint)));
  return [...new Uint8Array(h)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* v761: `u` is optional. With one, this customer's phones; without, EVERY phone on the site, which
   is what a notice to everybody needs. The prefix is the whole of the difference. */
export async function listSubs(env, u) {
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: u ? "push:" + u + ":" : "push:", cursor });
    for (const k of page.keys) {
      const v = await env.STMT.get(k.name);
      if (!v) continue;
      try { out.push({ key: k.name, ...JSON.parse(v) }); } catch { /* a corrupt record is skipped */ }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

/** Wake every phone one customer has subscribed. Never throws: a banner is not worth an error path.
    `news` is { k, o }: a kind the service worker has words for (NEWS in stmt/sw.js), and the order a tap opens. */
export async function wakeCustomer(env, u, news) { return wake(env, u, "salt-order", news); }
/* v761: AND EVERY PHONE ON THE SITE, for a notice that is for everybody. Same send, same clearing
   of a subscription the service has given up on, a different collapsing topic so a notice does not
   replace an order's banner on the lock screen and neither replaces the other. */
export async function wakeEveryone(env) { return wake(env, null, "salt-notice"); }
async function wake(env, u, topic, news) {
  try {
    const key = await signingKey(env);
    const pub = env.STMT_VAPID_PUBLIC_KEY;
    if (!key || !pub) return { ok: false, error: "push is not configured", sent: 0 };
    const subs = await listSubs(env, u);
    if (!subs.length) return { ok: true, sent: 0 };
    const tokens = new Map();
    const o = news && typeof news.o === "string" ? news.o : "";
    const text = news && Object.prototype.hasOwnProperty.call(NEWS, news.k) ? JSON.stringify({ k: news.k, o }) : null;
    /* a sealed wake collapses per ORDER, under the digest that names a subscription so the push service never
       reads the id: news of another order no longer replaces it while the phone is off. A bare wake's words
       are all the same, so it keeps the one topic. */
    const orderTopic = text && o ? "o-" + (await endpointId(o)) : topic;
    let sent = 0, gone = 0, failed = 0, sealed = 0;
    for (const s of subs) {
      let origin;
      try { origin = new URL(s.endpoint).origin; } catch { failed++; continue; }
      if (!tokens.has(origin)) tokens.set(origin, await vapidToken(env, key, origin));
      const keys = text && pushKeys(s.keys);
      const headers = { TTL: "3600", Urgency: "high", Topic: topic, Authorization: `vapid t=${tokens.get(origin)}, k=${pub}` };
      /* a phone whose keys are on file reads the kind; one without, or whose keys will not seal, is woken
         with nothing, as before: a key the page's check passed but WebCrypto refuses must not cost the wake */
      let body = null;
      if (keys) { try { body = await sealFor(keys, text); } catch { body = null; } }
      let r;
      try {
        if (body) { Object.assign(headers, { Topic: orderTopic, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" }); sealed++; }
        else headers["Content-Length"] = "0";
        r = await fetch(s.endpoint, body ? { method: "POST", headers, body } : { method: "POST", headers });
      } catch { failed++; continue; }
      if (r.status === 404 || r.status === 410) { await env.STMT.delete(s.key); gone++; }
      else if (r.ok || r.status === 201) sent++;
      else failed++;
    }
    return { ok: true, sent, gone, failed, sealed };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), sent: 0 };
  }
}
