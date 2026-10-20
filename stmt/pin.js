/* stmt/pin.js: A DELIVERY'S EXACT SPOT, SEALED ON THEIR PHONE (his decisions of 10 Oct 2026).
 *
 * Asking for a delivery, a customer may share the exact spot: Use my location (read once on their phone) or a Google Maps or
 * Waze link they paste. An exact point is held as a name is held (rule 2), so it is sealed on their own phone before it leaves,
 * to the same public key a slip is sealed to (KV `slipkey`, F13), and this site keeps only ciphertext. The protocol is the
 * slip's, an ephemeral P-256 pair, ECDH, HKDF-SHA-256 and AES-GCM-256, but with the info "salt-pin v1", so a pin never opens
 * as a slip nor a slip as a pin. Here it is only measured.
 *
 * ONE PIN AN ORDER. Place carries it; it is swapped for its id BEFORE the order book is asked, so the book's events hold the
 * id alone and never the ciphertext, and ONLY ONCE THE ORDER IS RECORDED AND NAMES IT is the ciphertext filed at
 * pin:<username>:<id> for PIN_TTL (30 days): a refused Place stores nothing. The desk reads it through its keyed relay, GET
 * /desk/pins/<username>/<id>, and each Desk read files it for another 30 days, so an order still open keeps its spot; Salt
 * Admin reads it too (GET /all/maker/pins/<username>/<id>, behind /all's two locks, his answer of 20 Oct 2026) and its read
 * keeps nothing, so looking never holds a finished delivery's point past its 30 days. Both open it only after the one unlock. An
 * amendment before Accept keeps the order's pin (decideReplace); a test account's is never filed. Nothing here imports
 * anything but the words and the slip's shape. */
import { refusal } from "./words.js";
import { slipShape, slipId, SLIP_ID_RE } from "./slip.js";

export const PIN_TTL = 30 * 86400;
/* the ciphertext's base64, at most: a point and its accuracy, or a link, sealed, is a few hundred characters */
export const PIN_MAX = 4096;
export const pinKey = (u, id) => "pin:" + u + ":" + id;
export const PIN_ID_RE = SLIP_ID_RE;

/** Whether `s` is a sealed pin's shape: the slip's shape, its ciphertext no longer than PIN_MAX. */
export const pinShape = (s) => slipShape(s) && s.ct.length <= PIN_MAX;

/** A placement's body with its pin taken off: the sealed pin is replaced by its id and handed back as `pin`, to be filed by
 *  keepPin once the order is recorded; ANY OTHER `pin`, a bare id included, is refused, so an order can name only a pin this
 *  Worker files for this account. Returns { body, pin? } or { error, status }. */
export async function takePin(body) {
  if (!body || typeof body !== "object" || !("pin" in body)) return { body };
  const b = Object.assign({}, body), s = b.pin;
  delete b.pin;
  if (s == null || s === "") return { body: b };
  if (!pinShape(s)) return Object.assign(refusal("pinBad"), { status: 400 });
  const id = await slipId(s.ct);
  b.pin = id;
  return { body: b, pin: { id, value: JSON.stringify({ v: 1, epk: s.epk, iv: s.iv, ct: s.ct }) } };
}
/** The pin filed, once the recorded order names it (`named`, the order's own pin id). Best effort: the order stands, and a
 *  pin that did not keep reads on the desk as not kept, its area words the fallback. */
export async function keepPin(env, u, pin, named) {
  if (!pin || named !== pin.id) return false;
  try { await env.STMT.put(pinKey(u, pin.id), pin.value, { expirationTtl: PIN_TTL }); return true; } catch (e) { return false; }
}
/** The sealed pin as filed, for the desk's relay and Salt Admin's read; the desk's (keep) files it for another PIN_TTL as it
 *  is read, Admin's (keep false) does not; null once lapsed. */
export async function readPin(env, u, id, keep = true) {
  if (!PIN_ID_RE.test(String(id || ""))) return null;
  let v = null;
  try { v = await env.STMT.get(pinKey(u, id), "json"); } catch (e) { v = null; }
  if (v && keep) try { await env.STMT.put(pinKey(u, id), JSON.stringify(v), { expirationTtl: PIN_TTL }); } catch (e) { /* read once more next time */ }
  return v;
}
