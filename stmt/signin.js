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
  const key = "ot:" + (await idOf(token)), at = new Date().toISOString();
  /* S9 9.4: its pointer first, so Sign out everywhere reaches a link not yet opened */
  await pointAt(env, u, key, { how: "link", at }, SIGNIN_TTL);
  await env.STMT.put(key, JSON.stringify({ u, wrap, at }), { expirationTtl: SIGNIN_TTL });
  return true;
}

/* ---- WHERE AN ACCOUNT IS SIGNED IN (S3 3.2, 24 Sep 2026) ------------------------------------------
 * Every credential an open hands out, a remembered phone's wrap or a session, leaves a POINTER under the
 * account: `dev:<username>:<sha256 of the key it names>`, holding that key, how it came, when it came and
 * when it was last used. The credentials are filed under their tokens or their hashes, so without this an
 * account's phones could be found only by reading every record in the store; listed by the prefix, they
 * can be shown and signed out (stage 9) without a scan. A pointer opens nothing: it names a record, and
 * the record still needs what only the phone holds. It lives as long as what it names. */
export const devPrefix = (u) => "dev:" + u + ":";
/* S3 FIX, 24 SEP 2026: A SESSION IS FILED UNDER ITS TOKEN'S HASH TOO, as a remembered phone is (3.1), so its pointer,
 * and a copy of the store, name a key no browser can present: the pointer to a session held the live token itself. */
export const sessKey = async (token) => "sess:" + (await idOf(token));
export async function pointAt(env, u, key, fields, ttl) {
  await env.STMT.put(devPrefix(u) + (await idOf(key)), JSON.stringify(Object.assign({ key }, fields)), { expirationTtl: ttl });
}
export const unpoint = async (env, u, key) => env.STMT.delete(devPrefix(u) + (await idOf(key)));

/* S9 9.3: WHAT A DEVICE IS CALLED, read off its browser's own description at the moment it opened, in the site's own
 * words: a kind of device and a browser, "iPhone, Safari", "Android phone, Chrome", "Windows computer, Edge". Nothing
 * is copied from the description, so no version, address or anything typed is ever kept, and a description this does
 * not know is "A phone" or "A computer". `kind` is phone, tablet or computer, for the mark drawn beside it. */
export function deviceOf(ua) {
  const s = String(ua || "");
  let dev, kind = "computer";
  if (/iPhone|iPod/.test(s)) { dev = "iPhone"; kind = "phone"; }
  else if (/iPad/.test(s) || (/Macintosh/.test(s) && /Mobile[/]/.test(s))) { dev = "iPad"; kind = "tablet"; }
  else if (/Android/.test(s)) { kind = /Mobile/.test(s) ? "phone" : "tablet"; dev = "Android " + kind; }
  else if (/CrOS/.test(s)) dev = "Chromebook";
  else if (/Windows/.test(s)) dev = "Windows computer";
  else if (/Macintosh|Mac OS X/.test(s)) dev = "Mac";
  else if (/Linux/.test(s)) dev = "Linux computer";
  else if (/Mobi/.test(s)) { dev = "A phone"; kind = "phone"; }
  else dev = "A computer";
  const app = /SamsungBrowser/.test(s) ? "Samsung Internet" : /Edg(e|A|iOS)?[/]/.test(s) ? "Edge"
    : /Firefox[/]|FxiOS/.test(s) ? "Firefox" : /Chrome[/]|CriOS/.test(s) ? "Chrome" : /Safari[/]/.test(s) ? "Safari" : "";
  return { label: dev + (app ? ", " + app : ""), kind };
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

/** Which account a live link opens, spending nothing. A spent link is null, as an invented one is, except to the
 *  page that spent it, by its nonce, inside the two minutes (S3 fix: a reload there asked without it and was told the
 *  link was used, although Continue would still have opened it). */
export async function peekSignin(env, token, nonce) {
  const r = await readSignin(env, token);
  if (!r) return null;
  if (!r.rec.spent) return { u: r.rec.u };
  const mine = NONCE_RE.test(String(nonce || "")) ? String(nonce) : null;
  return mine && r.rec.nonce === mine ? { u: r.rec.u } : null;
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
    await unpoint(env, r.rec.u, r.key);   /* S9 9.4: a spent link is no longer one to sign out */
  } catch (e) { /* it expires on its own; the open still stands */ }
  return r.rec;
}

/* ---- THE HAND-OVER: A KEY AND AN EIGHT-SYMBOL CODE (S3 3.9, his decision D2 of 24 Sep 2026) ---------------
 * "A signed-in page (or Salt Admin) mints a one-use key plus an eight-symbol code, alive 15 minutes. It is
 * stored under a keyed hash with its wrap sealed by a Worker secret, and braked site-wide and per address."
 *
 * WHAT IT IS FOR. An iPhone's Home Screen app keeps its own storage, so what Safari remembers never reaches
 * it; and a second phone has nothing at all. A page already signed in, or his own at the counter, hands the
 * sign-in across: the KEY by Paste or in the address (/app#<key>), the CODE typed where a paste will not go.
 *
 * HOW. The page mints the key, a token of the link's own shape, wraps the content key under it exactly as a
 * sign-in link is wrapped, and posts the two. This Worker mints the code and files ONE record twice, under a
 * KEYED hash of each (HMAC under STMT_HANDOVER_KEY, never a plain hash), its body (the username, the key and
 * the wrap) SEALED under a key derived from the same secret. Opened by either, both are burnt, and the answer
 * carries the key, so the page unwraps under the key whichever it typed: a code is a short name for a key,
 * never a key itself.
 *
 * WHY KEYED AND SEALED. Eight symbols of thirty are about 39 bits, few enough to try every one offline against
 * a plain hash in a copy of the store. With the secret on the Worker and not in the store, a copy holds names
 * nobody can compute and bodies nobody can open; online, fifteen minutes is too short to walk thirty to the eighth at
 * any rate the site answers, and the brakes in stmt/worker.js slow it further (their real bound, which is time and not
 * guesses: docs/STATEMENTS.md).
 *
 * THE SAME TWO LIMITS AS THE LINK: inside its fifteen minutes it is a bearer credential, and single use is best
 * effort on KV. With the secret unset every hand-over route answers 503 and nothing else changes.
 */
export const HANDOVER_TTL = 15 * 60;
const CODE_ALPHA = "23456789abcdefghjkmnpqrstvwxyz";

/** Eight symbols of the username alphabet as xxxx-xxxx. Rejection sampling: 240 is 8 x 30, so no symbol is likelier. */
export function newCode() {
  let s = "";
  while (s.length < 8) for (const b of crypto.getRandomValues(new Uint8Array(16))) if (b < 240 && s.length < 8) s += CODE_ALPHA[b % 30];
  return s.slice(0, 4) + "-" + s.slice(4);
}
/** Case, spaces and hyphens are forgiven; anything that is not eight symbols of the alphabet is "". */
export function normCode(x) {
  const t = String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^[23456789abcdefghjkmnpqrstvwxyz]{8}$/.test(t) ? t.slice(0, 4) + "-" + t.slice(4) : "";
}

const enc = (s) => new TextEncoder().encode(String(s));
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const macKey = (secret) => crypto.subtle.importKey("raw", enc(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const mac = async (secret, msg) => hex(await crypto.subtle.sign("HMAC", await macKey(secret), enc(msg)));
const sealKey = async (secret) => crypto.subtle.importKey("raw",
  await crypto.subtle.sign("HMAC", await macKey(secret), enc("salt-handover-seal")), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

/** File the hand-over for `u`; returns { code, token, exp }, or null when the secret is unset or the key or wrap is not one.
 *  `admin` marks one his /all/handover minted: the only kind a browser tab spends from its address (S3 fix, below). */
export async function mintHandover(env, u, token, wrap, admin) {
  const secret = String(env.STMT_HANDOVER_KEY || "");
  if (!secret || !u || !SIGNIN_RE.test(String(token || ""))) return null;
  if (!wrap || typeof wrap !== "object" || !wrap.salt || !wrap.iv || !wrap.ct) return null;
  const code = newCode();
  const byCode = "ho:" + (await mac(secret, "code:" + code)), byKey = "ho:" + (await mac(secret, "key:" + token));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealKey(secret), enc(JSON.stringify({ u, token, wrap })));
  const exp = new Date(Date.now() + HANDOVER_TTL * 1000).toISOString(), s = { iv: b64(iv), ct: b64(ct) };
  const mark = admin === true ? { admin: true } : {};
  /* S9 9.4: its pointer, under the key's name with the code's beside it, so Sign out everywhere reaches it unopened */
  await pointAt(env, u, byKey, { how: "code", at: new Date().toISOString(), pair: byCode }, HANDOVER_TTL);
  await env.STMT.put(byCode, JSON.stringify(Object.assign({ pair: byKey, exp, s }, mark)), { expirationTtl: HANDOVER_TTL });
  await env.STMT.put(byKey, JSON.stringify(Object.assign({ pair: byCode, exp, s }, mark)), { expirationTtl: HANDOVER_TTL });
  return { code, token, exp };
}

/** S3 FIX, 24 SEP 2026: LOG OUT BURNS WHAT THE PAGE MINTED, so a key left on the clipboard or in the address of a phone
 *  handed on opens nothing. Burnt by the key alone, unopened: whoever holds it could spend it anyway. */
export async function dropHandover(env, token) {
  const secret = String(env.STMT_HANDOVER_KEY || "");
  if (!secret || !SIGNIN_RE.test(String(token || ""))) return false;
  const id = "ho:" + (await mac(secret, "key:" + token));
  let rec = null;
  try { rec = await env.STMT.get(id, "json"); } catch (e) { rec = null; }
  if (!rec) return false;
  await env.STMT.delete(id);
  if (rec.pair) await env.STMT.delete(rec.pair);
  return true;
}

/** Open by { token } or { code }: both records burnt, then { u, token, wrap, by }, or null for anything at all wrong.
 *  `by` is the road (S9 fix): qr, the key of one his counter minted, which only its QR carries; copy, a customer's own
 *  key, pasted or carried in the saved app's address; code, the eight symbols typed.
 *  S3 FIX, 24 SEP 2026: A KEY A BROWSER TAB FOUND IN ITS ADDRESS ({ token, tab: true }) OPENS ONLY ONE HE MINTED, the QR
 *  at his counter, and anything else is refused unspent. Any customer can mint a key for their own account, and
 *  /app#<key> sent to somebody else signed that browser into the sender's account with no tap, and kept it. */
export async function burnHandover(env, b) {
  const secret = String(env.STMT_HANDOVER_KEY || "");
  const token = b && typeof b.token === "string" && SIGNIN_RE.test(b.token) ? b.token : "";
  const code = token ? "" : normCode(b && b.code);
  if (!secret || (!token && !code)) return null;
  const id = "ho:" + (await mac(secret, token ? "key:" + token : "code:" + code));
  let rec = null;
  try { rec = await env.STMT.get(id, "json"); } catch (e) { rec = null; }
  if (!rec || !rec.s || (b.tab === true && rec.admin !== true)) return null;
  try { await env.STMT.delete(id); if (rec.pair) await env.STMT.delete(rec.pair); } catch (e) { /* each expires on its own */ }
  if (!(Date.parse(rec.exp) > Date.now())) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(rec.s.iv) },
      await sealKey(secret), unb64(rec.s.ct))));
    if (!(body && body.u && body.token && body.wrap)) return null;
    try { await unpoint(env, body.u, token ? id : rec.pair); } catch (e) { /* the pointer lapses with it */ }
    return Object.assign(body, { by: token ? (rec.admin === true ? "qr" : "copy") : "code" });
  } catch (e) { return null; }
}
