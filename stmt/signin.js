/* stmt/signin.js: THE ONE-TIME SIGN-IN LINK (v710, his instruction of 18 Sep 2026).
 *
 * "When sharing the link, QR to the user, the site pre-fills their username and password."
 *
 * WHAT THE LINK COULD NOT DO. The shared link has always carried the username and never the
 * password, on the rule that the two travel by different channels. A password in a message is a
 * password in a chat log for ever, and the suite fails the build if one ever appears in a shareable
 * message. So the password is not put in the link; the link is made to sign them in instead.
 *
 * HOW IT WORKS. His page holds the content key already, having opened the account under the master.
 * It mints a token, wraps that key UNDER THE TOKEN, and hands the Worker the token's HASH and the
 * wrap. The token itself is written nowhere: `ot:<sha256(token)>` is the key, so a dump of this
 * store opens nothing, exactly as `rem:` holds a wrap no copy of the store can unwrap.
 * Opening the link posts the token back, the Worker burns the record and returns the wrap, and the
 * page derives the content key from the token it already has in its own address bar. From there it
 * is an ordinary session and nothing downstream knows the difference.
 *
 * WHY NOT LET THEM CHOOSE A PASSWORD. One live password a month and it cannot be changed, and every
 * issue re-wraps the content key under a fresh one minted on the laptop. A password a customer chose
 * would stop working at the next publish, silently. That is a standing rule, not a preference.
 *
 * TWO LIMITS, SAID PLAINLY RATHER THAN PROMISED AWAY:
 *   - A link inside its window IS a bearer credential, exactly as a guest link's id is. What this
 *     buys over sending a password is that it expires and it burns, not that it cannot be forwarded.
 *   - SINGLE USE IS BEST EFFORT. This Worker has KV and nothing else, and KV is eventually
 *     consistent, so two opens inside the propagation window can both succeed. The copy says once;
 *     the mechanism cannot swear to it, and this comment is where that is admitted.
 *
 * NO IMPORT BUT A SIBLING; the suite holds every file under stmt/ to that rule.
 */

/** The same shape the remembered-device token has: 24 random bytes, base64url. */
export const SIGNIN_RE = /^[A-Za-z0-9_-]{20,64}$/;
/** Three days (his D1, 24 Sep 2026; seven until then): the link now keeps a phone signed in, so an unopened
 *  one forwarded is worth more, and it lives shorter for that. */
export const SIGNIN_TTL = 3 * 24 * 3600;

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function newSignin() {
  return b64u(crypto.getRandomValues(new Uint8Array(24)));
}

/** The token's hash, which is what names the record. The token is never stored. */
export async function idOf(token) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(token)));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** File the wrap under the token's hash. Returns false when the token is not one of ours. */
export async function mintSignin(env, u, token, wrap) {
  if (!SIGNIN_RE.test(String(token || ""))) return false;
  if (!u || !wrap || typeof wrap !== "object" || !wrap.salt || !wrap.iv || !wrap.ct) return false;
  await env.STMT.put("ot:" + (await idOf(token)), JSON.stringify({ u, wrap, at: new Date().toISOString() }),
    { expirationTtl: SIGNIN_TTL });
  return true;
}

/* S3 3.3, 24 SEP 2026: NOTHING IS SPENT UNTIL CONTINUE, AND A LOST ANSWER IS NOT A LOST LINK. The page
 * asks first which account a link opens (peekSignin), which spends nothing, so a preview or an in-app
 * view that runs the page cannot use it up; only the Continue tap burns it. The page carries a nonce it
 * minted for itself, and the spent record keeps the answer for TWO MINUTES for that nonce alone: a
 * connection that drops after the burn is retried from the same page, while another device holding
 * the same link is refused as before. */
export const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const RETRY_TTL = 120;

async function readSignin(env, token) {
  if (!SIGNIN_RE.test(String(token || ""))) return null;
  const key = "ot:" + (await idOf(token));
  let rec = null;
  try { rec = await env.STMT.get(key, "json"); } catch (e) { rec = null; }
  return rec && rec.u && rec.wrap ? { key, rec } : null;
}

/** Which account a live link opens, spending nothing. A spent link is null, as an invented one is. */
export async function peekSignin(env, token) {
  const r = await readSignin(env, token);
  return r && !r.rec.spent ? { u: r.rec.u } : null;
}

/** Spend it, keeping the answer two minutes for the page that spent it. Returns the record, or null
 *  for anything at all wrong, a second device included. */
export async function burnSignin(env, token, nonce) {
  const r = await readSignin(env, token);
  if (!r) return null;
  const mine = NONCE_RE.test(String(nonce || "")) ? String(nonce) : null;
  if (r.rec.spent) return mine && r.rec.nonce === mine ? r.rec : null;
  try {
    await env.STMT.put(r.key, JSON.stringify({ u: r.rec.u, wrap: r.rec.wrap, spent: new Date().toISOString(), nonce: mine }),
      { expirationTtl: RETRY_TTL });
  } catch (e) { /* it expires on its own; the open still stands */ }
  return r.rec;
}
