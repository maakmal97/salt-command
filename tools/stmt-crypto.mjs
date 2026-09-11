/* tools/stmt-crypto.mjs: THE PASSWORD, THE VERIFIER AND THE ENVELOPE.
 *
 * THE POINT OF ENCRYPTING AT ALL, since the Worker already gates the fetch.
 * The Worker's ten-minute window controls who may FETCH a statement. It cannot control what
 * happens to the bytes afterwards, and it is one deploy away from being wrong. Encrypting
 * under the customer's own password means the blob is useless to anyone who gets hold of it
 * by any route: a misconfigured route, a cached response, a copy taken off the wire. Two
 * layers, and neither is sufficient alone. This is the same reasoning, and deliberately the
 * same crypto, as the name vault: PBKDF2-SHA256 at 150,000 rounds into AES-GCM-256, envelope
 * {v,salt,iv,ct}, base64 throughout, matching the desk's vaultEncrypt byte for byte.
 *
 * THE PASSWORD IS NEVER STORED, HERE OR ANYWHERE THE WORKER CAN REACH. What the Worker holds
 * is a verifier: PBKDF2 over the password with its OWN salt, separate from the encryption
 * salt, so possessing the verifier tells an attacker nothing that helps them decrypt. A wrong
 * password therefore fails twice, once at the Worker and again at the decryption, and the
 * second failure is the one that cannot be bypassed by anything short of the password itself.
 */
import { webcrypto as wc } from "node:crypto";

const b64e = (buf) => Buffer.from(buf).toString("base64");
const b64d = (s) => new Uint8Array(Buffer.from(s, "base64"));

/* TWO ROUND COUNTS, AND THE ASYMMETRY IS DELIBERATE.
 *
 * The ENCRYPTION key keeps the vault's 150,000. It runs once, in the customer's browser, where
 * a fifth of a second is invisible, and it is the layer that must hold even if the ciphertext
 * is copied and attacked offline for ever.
 *
 * The VERIFIER runs on the Worker, on every attempt, inside a CPU budget measured in
 * milliseconds. 150,000 rounds there would be a denial of service against ourselves. It is set
 * low because it is doing a different job: key stretching exists to rescue passwords that
 * humans chose, and these are sixteen random symbols, about 78 bits. Stretching a 78-bit
 * secret buys nothing an attacker was ever going to defeat by guessing, and the ten-attempt
 * lockout in front of it makes online guessing hopeless regardless. If passwords ever become
 * human-chosen, this number has to go up and the lockout stops being sufficient.
 *
 * The count is STORED IN EACH RECORD rather than assumed, so it can be raised later without
 * stranding the statements already issued. */
export const PBKDF2_ROUNDS = 150000;
export const VERIFIER_ROUNDS = 10000;

/* NO I, L, O, U, 0 OR 1. These get read down a phone line and typed on a phone keyboard, and
   every one of those six is the character somebody mistakes for another. Thirty symbols over
   sixteen places is about 78 bits, which against the Worker's ten-attempt lockout is not a
   number anybody is getting through; the constraint that actually decided the format is that
   it has to be dictatable over WhatsApp without a second message correcting it. */
const ALPHABET = "23456789abcdefghjkmnpqrstvwxyz";

/** A fresh password, as four readable groups of four. */
export function newPassword() {
  const bytes = wc.getRandomValues(new Uint8Array(16));
  let out = "";
  for (let i = 0; i < 16; i++) {
    /* rejection-free because 256 is not a multiple of 30, so the low symbols would be very
       slightly favoured; over sixteen characters that is worth about a hundredth of a bit
       and is not worth the branch. Stated so nobody has to rediscover it. */
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i % 4 === 3 && i !== 15) out += "-";
  }
  return out;
}

/* THE USERNAME (03 Sep 2026, his instruction): NOT THE DESK CODE, AND NOT DERIVED FROM IT.
   The first cut used the code as the username, so the address of a statement was the address
   of an account on the desk, and a code is guessable from a roster. A username is two groups of
   four from the same alphabet, minted at random the first time a customer is issued a statement
   and kept for life in statements/_users.json. Random rather than a hash of the code, because a
   hash needs a key the generator must hold, and the routine that runs it holds no secrets.
   Lower case, so it can never be mistaken for a code on the page it sits beside. */
export function newUsername() {
  const bytes = wc.getRandomValues(new Uint8Array(8));
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}
export const USERNAME_RE = /^[23456789abcdefghjkmnpqrstvwxyz]{4}-[23456789abcdefghjkmnpqrstvwxyz]{4}$/;
/* v588: ONE MINT AND ONE FILE FORMAT for statements/_users.json. Two writers use them: the statements run,
   the month a customer is first issued a statement, and the fold, the day a customer is registered. A
   username that exists is returned and never replaced. */
export function userFor(users, code) {
  if (users[code]) return users[code];
  const taken = new Set(Object.values(users));
  let u;
  do { u = newUsername(); } while (taken.has(u));
  users[code] = u;
  return u;
}
/* sorted by code, one line each, so a new customer is one added line in the diff */
export function usersJson(users) {
  const sorted = {};
  for (const k of Object.keys(users).sort()) sorted[k] = users[k];
  return JSON.stringify(sorted, null, 2) + "\n";
}

async function deriveBits(pass, salt, bits, rounds) {
  const base = await wc.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await wc.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" }, base, bits));
}

async function deriveKey(pass, salt) {
  const base = await wc.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

/** What the Worker stores to check a password without being able to read the statement. */
export async function makeVerifier(pass) {
  const salt = wc.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(pass, salt, 256, VERIFIER_ROUNDS);
  return { salt: b64e(salt), hash: b64e(hash), rounds: VERIFIER_ROUNDS };
}

/** Recompute a verifier for a candidate password. */
export async function checkVerifier(pass, verifier) {
  const hash = await deriveBits(pass, b64d(verifier.salt), 256, verifier.rounds || VERIFIER_ROUNDS);
  return b64e(hash) === verifier.hash;
}

/** The vault envelope, over a string rather than an object. */
export async function encryptText(pass, text) {
  const salt = wc.getRandomValues(new Uint8Array(16));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(String(text)));
  return { v: 1, salt: b64e(salt), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}

export async function decryptText(pass, blob) {
  const key = await deriveKey(pass, b64d(blob.salt));
  const pt = await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return new TextDecoder().decode(pt);
}

/* ---- THE CONTENT KEY, AND WHY THERE IS ONE (03 Sep 2026, his instruction: live statements) ----
 *
 * A statement that updates with every approved entry is written by the deploy job, in the
 * cloud, minutes after a fold. That job has no customer password and must never have one: the
 * passwords live in one gitignored file on the laptop. So the content is not encrypted under
 * the password at all. Each customer has a CONTENT KEY, derived from one secret (STMT_KEY,
 * held as a GitHub Actions secret and in statements/_secrets.json on the laptop) and the
 * username, and everything the customer reads is AES-GCM under that key: the monthly bundle
 * and the live document alike. The password's only job is to unwrap the content key, and the
 * wrap is made once a month on the laptop, where the password is. Rotating the password
 * re-wraps the same key; the content never has to be re-encrypted for a new password.
 *
 * WHAT THIS CHANGES ABOUT THE ARGUMENT ABOVE: nothing for the Worker, which still holds no key
 * and still serves ciphertext after a verifier check. What it adds is one secret in two places,
 * and a rule: STMT_KEY lost means every account re-issued, because no wrap can be remade
 * without it. It is derived per username with HMAC rather than stored per customer, so a new
 * customer needs no new secret anywhere.
 *
 * THE MASTER WRAP is how the owner's override actually opens a page. The first cut returned the
 * envelope on the master password and left the browser to decrypt it with a password it did not
 * have, so the override could never have shown a statement. Now the content key is wrapped a
 * second time under the master passphrase when the issue is made, and the page unwraps with
 * whichever was typed. The Worker still never sees the master as a key; it compares it. */
export async function contentKey(secret, username) {
  const k = await wc.subtle.importKey("raw", new TextEncoder().encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await wc.subtle.sign("HMAC", k, new TextEncoder().encode("salt-statement-key:" + username)));
}

/** The content key wrapped under a password: PBKDF2 at the encryption count, then AES-GCM over the raw key. */
export async function wrapKey(pass, ck) {
  const salt = wc.getRandomValues(new Uint8Array(16));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const kek = await deriveKey(pass, salt);
  const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, kek, ck);
  return { v: 2, salt: b64e(salt), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}

export async function unwrapKey(pass, wrap) {
  const kek = await deriveKey(pass, b64d(wrap.salt));
  return new Uint8Array(await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(wrap.iv) }, kek, b64d(wrap.ct)));
}

/** AES-GCM under a raw content key. No salt: the key is not derived from anything here. */
export async function encryptWith(ck, text) {
  const iv = wc.getRandomValues(new Uint8Array(12));
  const key = await wc.subtle.importKey("raw", ck, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = await wc.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(String(text)));
  return { v: 2, iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
}

export async function decryptWith(ck, blob) {
  const key = await wc.subtle.importKey("raw", ck, { name: "AES-GCM" }, false, ["decrypt"]);
  const pt = await wc.subtle.decrypt({ name: "AES-GCM", iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return new TextDecoder().decode(pt);
}

/** A fresh STMT_KEY, for the one-time setup: 32 random bytes as hex. */
export function newSecret() {
  return Buffer.from(wc.getRandomValues(new Uint8Array(32))).toString("hex");
}

/** The shape the Worker will accept, so a malformed record is refused before it is stored. */
export function isEnvelope(x) {
  return !!x && x.v === 1 && typeof x.salt === "string" && typeof x.iv === "string"
    && typeof x.ct === "string" && x.salt.length > 0 && x.iv.length > 0 && x.ct.length > 0;
}
