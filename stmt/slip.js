/* stmt/slip.js: A PAYMENT SLIP, SEALED ON THEIR PHONE (F13, 29 Sep 2026; the combined plan's Step 5, his word "Start slips").
 *
 * A slip is a picture of a payment, and a picture of a bank's screen carries names, so rule 2 holds it as it holds a name:
 * it is sealed on the customer's own phone before it leaves, to the public half of his slip key (KV `slipkey`, put here by
 * `node tools/seed-vault.mjs --slip-key`), and the site keeps only what it is given, which is ciphertext. The private half
 * lives only in his vault, so nothing on this site can open a slip, and neither can their page once it is sent.
 *
 * The protocol is the laptop's slipSeal (tools/seed-vault.mjs) and the page's: an ephemeral P-256 pair, ECDH with the key,
 * HKDF-SHA-256 (no salt, info "salt-slip v1") to an AES-GCM-256 key, a fresh 12-byte iv, {v: 1, epk, iv, ct}, each in
 * base64. Here it is only measured: a shape that is not that one is refused, never stored.
 *
 * ONE SLIP A CLAIM. It rides on the claim itself ("I have sent it"), on an order or against the account: the claim carries
 * the id alone, so the book holds the reference and KV the bytes, and ONLY ONCE THE CLAIM IS RECORDED, and names it, is the
 * ciphertext filed at slip:<username>:<id> for SLIP_TTL (30 days, his Q14): a refused claim stores nothing, so refusals
 * cannot be looped to fill the store, and nothing is ever deleted that a recorded claim may name. The id is the first 16
 * bytes of the ciphertext's SHA-256 in hex, so a retry files the same key once. The
 * desk reads it through its keyed relay, GET /desk/slips/<username>/<id>. Nothing here imports anything but the words.
 */
import { refusal } from "./words.js";

export const SLIP_PUB = "slipkey";
export const SLIP_TTL = 30 * 86400;
export const SLIP_ID_RE = /^[0-9a-f]{32}$/;
/* the ciphertext's base64, at most: about 2.1 MB of picture. The page re-encodes to 1,600 px JPEG under 1.5 MB first. */
export const SLIP_MAX = 2800000;
/* a claim's whole body, at most, read off its content-length before it is parsed */
export const SLIP_BODY_MAX = SLIP_MAX + 16384;
const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
export const slipKey = (u, id) => "slip:" + u + ":" + id;

/** Whether `s` is a sealed slip's shape: a P-256 point uncompressed (65 bytes, 88 characters), a 12-byte iv (16) and a
 *  ciphertext no longer than SLIP_MAX, each base64. Measured only: nothing here can open it. */
export function slipShape(s) {
  if (!s || typeof s !== "object" || Array.isArray(s) || s.v !== 1) return false;
  const { epk, iv, ct } = s;
  return typeof epk === "string" && epk.length === 88 && B64_RE.test(epk)
    && typeof iv === "string" && iv.length === 16 && B64_RE.test(iv)
    && typeof ct === "string" && ct.length >= 24 && ct.length <= SLIP_MAX && ct.length % 4 === 0 && B64_RE.test(ct);
}

export async function slipId(ct) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ct)));
  let s = "";
  for (let i = 0; i < 16; i++) s += (h[i] < 16 ? "0" : "") + h[i].toString(16);
  return s;
}

/** A claim's body with its slip taken off: the sealed slip is replaced by its id and handed back as `slip`, to be filed
 *  by keepSlip once the claim is recorded; ANY OTHER `slip`, a bare id included, is refused, so a claim can name only a
 *  slip this Worker files for this account. Returns { body, slip? } or { error, status }. */
export async function takeSlip(body) {
  if (!body || typeof body !== "object" || !("slip" in body)) return { body };
  const b = Object.assign({}, body), s = b.slip;
  delete b.slip;
  if (s == null) return { body: b };
  if (typeof s === "object" && s && typeof s.ct === "string" && s.ct.length > SLIP_MAX) return Object.assign(refusal("slipBig"), { status: 413 });
  if (!slipShape(s)) return Object.assign(refusal("slipBad"), { status: 400 });
  const id = await slipId(s.ct);
  b.slip = id;
  return { body: b, slip: { id, value: JSON.stringify({ v: 1, epk: s.epk, iv: s.iv, ct: s.ct }) } };
}
/** The slip filed, once the claim `named` (the recorded claim's own slip id) is this one: a retry answered with an earlier
 *  claim naming another files nothing. Best effort: the claim is their word and stands; a slip that did not keep reads on
 *  the desk as not found. */
export async function keepSlip(env, u, slip, named) {
  if (!slip || named !== slip.id) return false;
  try { await env.STMT.put(slipKey(u, slip.id), slip.value, { expirationTtl: SLIP_TTL }); return true; } catch (e) { return false; }
}
/** A claim's body over SLIP_BODY_MAX by its content-length, refused before it is read. */
export const slipTooBig = (request) => +(request.headers.get("content-length") || 0) > SLIP_BODY_MAX
  ? Object.assign(refusal("slipBig"), { status: 413 }) : null;

/** The public half their page seals to, or null while none is filed. */
export async function slipPub(env) {
  let r = null;
  try { r = await env.STMT.get(SLIP_PUB, "json"); } catch (e) { r = null; }
  const k = r && r.pub;
  return k && k.kty === "EC" && k.crv === "P-256" && typeof k.x === "string" && typeof k.y === "string"
    ? { kty: k.kty, crv: k.crv, x: k.x, y: k.y } : null;
}

/** The sealed slip as filed, for the desk's relay alone; null once its 30 days are over, or never filed. */
export async function readSlip(env, u, id) {
  if (!SLIP_ID_RE.test(String(id || ""))) return null;
  try { return await env.STMT.get(slipKey(u, id), "json"); } catch (e) { return null; }
}
