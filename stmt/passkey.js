/* stmt/passkey.js: A CUSTOMER'S PASSKEY (Step 6, his decisions of 29 Sep 2026).
 *
 * WHAT IT IS. Signed in, a customer saves a passkey in whatever keeps theirs (NordPass, Apple, Google), and from then on
 * Open with a passkey signs them in with the face or the finger that store asks for. Any passkey works: this Worker
 * checks the passkey's own signature over a challenge it minted, so the store needs to give nothing but the signature.
 *
 * WHAT OPENS THE ACCOUNT, AND WHAT DOES NOT. The statement is sealed under the account's content key, and this Worker
 * holds no key that opens it (stmt/worker.js, the first of its four locks); a passkey does not change that. The content
 * key is wrapped under a key made of TWO halves: a random share this Worker keeps on the passkey's record, handed back
 * only after a signature checks, and either 32 bytes the device keeps (its own wrap, `pkd:`) or the secret the passkey
 * itself returns where its store gives one (the PRF extension: Apple Passwords, Google Password Manager), which is the
 * same on every device the passkey syncs to (the passkey's roaming wrap, on its record). Neither half opens anything
 * alone: the Worker has the share and never the other half, and a device's bytes are nothing without the share, which
 * needs the face. So a passkey whose store gives no secret opens the account on each device once that device has been
 * signed into by password (his decision: the password once a new device), and one that gives it opens it everywhere.
 *
 * THE RECORDS. `pk:<sha256 of the credential id>` the passkey: its account, public key and algorithm, the share, the
 * roaming wrap once a device has made one, and where and when it was saved; a pointer under the account names it, so it
 * is listed with the account's phones and computers and ends with Sign out everywhere. `pkd:<cred hash>:<sha256 of the
 * device token>` a device's own wrap. Both run a year from their last use (his decision), and Log out keeps them (his
 * decision): the passkey still asks for the face. `pkc:<sha256 of the challenge>` a challenge, five minutes, spent once.
 *
 * WHAT IS CHECKED, and nothing is trusted that is not: the client data's type, challenge and origin; the authenticator
 * data's relying party (this address) and its user-present and user-verified flags; at saving, that the credential the
 * authenticator names is the one sent; at opening, the signature over the authenticator data and the client data's
 * hash with the public key filed at saving (ES256, EdDSA or RS256). The public key is the browser's own reading of the
 * new credential (getPublicKey), taken at saving on a live session, so it is the account holder's to give.
 *
 * Nothing here imports anything but siblings, and nothing here holds a word a customer reads.
 */
import { idOf } from "./signin.js";

export const PK_TTL = 365 * 86400;
export const CH_TTL = 300;
export const PK_ALGS = [-7, -8, -257];
export const PK_ID_RE = /^[A-Za-z0-9_-]{16,1400}$/;
export const PKT_RE = /^[A-Za-z0-9_-]{20,64}$/;

export const pkKey = async (id) => "pk:" + (await idOf(id));
export const pkdPrefix = (credKey) => "pkd:" + credKey.slice(3) + ":";
export const pkdKey = async (credKey, t) => pkdPrefix(credKey) + (await idOf(t));
const chKey = async (ch) => "pkc:" + (await idOf(ch));

export const b64u = (buf) => {
  const a = new Uint8Array(buf); let s = "";
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
/** base64 or base64url to bytes; null when it is neither */
export function unb64(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9+/_-]*={0,2}$/.test(s)) return null;
  try {
    const t = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i);
    return u;
  } catch (e) { return null; }
}
const sha256 = async (bytes) => new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** A challenge, filed for five minutes with what it is for (`open`, before any session, or `session`, a signed-in
 *  customer's save or link, naming the account and the share a new passkey will keep). */
export async function mintChallenge(env, fields) {
  const ch = b64u(crypto.getRandomValues(new Uint8Array(32)));
  await env.STMT.put(await chKey(ch), JSON.stringify(Object.assign({ at: new Date().toISOString() }, fields)), { expirationTtl: CH_TTL });
  return ch;
}
/** The challenge's record, spent: read and deleted, so it answers once (best effort, as KV is). */
export async function spendChallenge(env, ch) {
  if (typeof ch !== "string" || !PKT_RE.test(ch)) return null;
  const k = await chKey(ch), rec = await env.STMT.get(k, "json");
  if (rec) await env.STMT.delete(k);
  return rec;
}

/** The client data, read and held to this ceremony: its type, the challenge minted for it, and this address. */
export function clientOk(cdBytes, type, challenge, origin) {
  if (!cdBytes) return false;
  let c; try { c = JSON.parse(new TextDecoder().decode(cdBytes)); } catch (e) { return false; }
  return !!c && c.type === type && c.challenge === challenge && c.origin === origin && c.crossOrigin !== true;
}

/** The authenticator data: for this relying party, the user present and verified; at saving, the credential it names. */
export async function authOk(ad, rpId, wantId) {
  if (!ad || ad.length < 37) return false;
  if (!same(ad.slice(0, 32), await sha256(new TextEncoder().encode(rpId)))) return false;
  const flags = ad[32];
  if (!(flags & 0x01) || !(flags & 0x04)) return false;
  if (!wantId) return true;
  if (!(flags & 0x40) || ad.length < 55) return false;
  const n = (ad[53] << 8) | ad[54];
  return ad.length >= 55 + n && same(ad.slice(55, 55 + n), wantId);
}

/* an ECDSA signature arrives DER-encoded; WebCrypto takes r and s side by side, 32 bytes each */
export function derToRaw(der) {
  if (!der || der[0] !== 0x30) return null;
  let i = 2; if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const part = () => {
    if (der[i] !== 0x02) return null;
    const n = der[i + 1]; let v = der.slice(i + 2, i + 2 + n); i += 2 + n;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    if (v.length > 32) return null;
    const o = new Uint8Array(32); o.set(v, 32 - v.length); return o;
  };
  const r = part(), s = part();
  if (!r || !s) return null;
  const out = new Uint8Array(64); out.set(r, 0); out.set(s, 32); return out;
}

/** Whether `sig` is the passkey's signature over the authenticator data and the client data's hash. */
export async function sigOk(spki, alg, ad, cdBytes, sig) {
  try {
    const key = unb64(spki);
    if (!key || !ad || !cdBytes || !sig) return false;
    const data = new Uint8Array(ad.length + 32);
    data.set(ad, 0); data.set(await sha256(cdBytes), ad.length);
    if (alg === -7) {
      const raw = derToRaw(sig); if (!raw) return false;
      const k = await crypto.subtle.importKey("spki", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, raw, data);
    }
    if (alg === -8) {
      const k = await crypto.subtle.importKey("spki", key, { name: "Ed25519" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "Ed25519" }, k, sig, data);
    }
    if (alg === -257) {
      const k = await crypto.subtle.importKey("spki", key, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, k, sig, data);
    }
    return false;
  } catch (e) { return false; }
}

/** A wrap as the page seals it under the two halves: {v: 3, iv, ct}, base64. Measured only; nothing here opens one. */
export const wrapShape = (w) => !!w && typeof w === "object" && !Array.isArray(w) && w.v === 3
  && typeof w.iv === "string" && w.iv.length === 16 && typeof w.ct === "string" && w.ct.length >= 24 && w.ct.length <= 200
  && !!unb64(w.iv) && !!unb64(w.ct);

/** The account's passkey handle: the same for every passkey of one account, so a store saving a second passkey for it
 *  replaces the first rather than keeping two; it names nothing (the first 16 bytes of a hash of the username). */
export async function handleOf(u) {
  return b64u((await sha256(new TextEncoder().encode("salt-passkey-user:" + u))).slice(0, 16));
}
