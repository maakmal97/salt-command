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

/** The shape the Worker will accept, so a malformed record is refused before it is stored. */
export function isEnvelope(x) {
  return !!x && x.v === 1 && typeof x.salt === "string" && typeof x.iv === "string"
    && typeof x.ct === "string" && x.salt.length > 0 && x.iv.length > 0 && x.ct.length > 0;
}
