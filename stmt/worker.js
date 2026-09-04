/* stmt/worker.js: THE STATEMENTS SITE. A second Worker, on its own address, with nothing else on it.
 *
 * WHY IT IS NOT A ROUTE ON THE LEDGER'S WORKER (his instruction, 03 Sep 2026). The first cut
 * served statements at /s/<CODE> on salt-command itself. That put the address a customer scans
 * one path segment away from the desk, and the desk is open: anyone who trimmed the URL read the
 * whole ledger. Everything lives there, so nothing a customer holds may point at it. This Worker
 * has a cryptic name of its own, its own KV store, no assets, no D1, no write key and no idea the
 * ledger exists. The one thing it can serve is a single customer's own ciphertext, and only after
 * a password check.
 *
 * THE ADDRESS IS THE WORKER'S NAME in wrangler.stmt.jsonc. It shares the account's workers.dev
 * subdomain with the desk, which is one thing a curious customer could still notice; a custom
 * domain on this Worker is the fix for that, and it is one line in the same file.
 *
 * FOUR THINGS STAND BETWEEN AN ACCOUNT AND THE PUBLIC, and none is trusted alone:
 *   1. The statements are AES-GCM ciphertext at rest, encrypted under the customer's own
 *      password with the vault's crypto. This Worker holds no key and could not read one if
 *      the route were wrong. A mistake here leaks noise.
 *   2. A PBKDF2 verifier decides whether the envelope is handed over at all.
 *   3. Ten failed attempts lock a username for fifteen minutes. A username is random rather
 *      than a desk code, so it is not guessable from a roster, and an unknown username answers
 *      exactly as a wrong password does, so the list cannot be walked either.
 *   4. STMT_MASTER is the owner's override. The customer's password cannot be changed: a
 *      customer who has lost his asks for it again, and the owner reads it back from
 *      _passwords.json.
 *
 * WHAT A RECORD HOLDS (03 Sep 2026, live statements): a verifier; the content key wrapped under
 * the password and, when the issue was made with it, under the master; the monthly bundle
 * sealed under that content key; and, once the deploy has run, the live document sealed under
 * the same key with the moment it was written. The deploy rewrites the live document after every
 * fold. This Worker reads none of it: it hands the record over or it does not.
 *
 * WHAT IS DELIBERATELY NOT HERE: any check that the reader is the right person. A password
 * shared is a password shared, and an open page can be photographed. This route makes an
 * account hard to reach by accident or by grinding. It cannot make a document un-forwardable,
 * and nothing in the copy implies otherwise.
 *
 * NO IMPORT FROM src/ OR tools/. The suite proves it: this Worker must bundle on its own, and
 * must never be able to reach the ledger's code even by accident.
 */
import { landingPage } from "./page.js";

const UKEY = (u) => "u:" + u;
const FKEY = (k) => "fail:" + k;          // keyed on address AND username; see handleOpen
const IPKEY = (ip) => "ipfail:" + ip;     // one caller sweeping many accounts
const MKEY = (ip) => "mfail:" + ip;       // the override's own brake, so a locked account cannot shut it
const SKEY = (u) => "seen:" + u;
const MAX_FAILS = 10;
const MAX_IP_FAILS = 30;
const FAIL_TTL = 900;                                   // fifteen minutes; the KV minimum is 60
const USER_RE = /^[23456789abcdefghjkmnpqrstvwxyz]{4}-[23456789abcdefghjkmnpqrstvwxyz]{4}$/;

const HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, HEADERS)
});
const notFound = () => new Response("Not found", {
  status: 404, headers: Object.assign({ "content-type": "text/plain; charset=utf-8" }, HEADERS)
});

/** Case and punctuation are forgiven; anything that is not eight symbols of the alphabet is "". */
export function normUser(s) {
  s = String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.length !== 8) return "";
  s = s.slice(0, 4) + "-" + s.slice(4);
  return USER_RE.test(s) ? s : "";
}

const b64d = (s) => {
  const raw = atob(s), a = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
  return a;
};
const b64e = (buf) => {
  let s = ""; const a = new Uint8Array(buf);
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
};
function ctEq(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* The round count travels WITH each record, so raising it later does not strand statements
   already issued. It is far below the 150,000 the encryption key uses, deliberately: this one
   runs on every attempt inside a Worker's CPU budget, and the passwords it guards are sixteen
   random symbols rather than anything a person chose. tools/stmt-crypto.mjs states the whole
   argument, including when it would stop being true. */
async function verifierOk(pass, verifier) {
  if (!verifier || !verifier.salt || !verifier.hash) return false;
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: b64d(verifier.salt), iterations: verifier.rounds || 10000, hash: "SHA-256" }, base, 256);
  return ctEq(b64e(bits), verifier.hash);
}

/* ONE ANSWER FOR EVERY REFUSAL. An unknown username, a wrong password and a malformed
   username all say the same thing, with the same status, after the same counter tick, so
   nothing about which usernames exist can be read off the responses. */
const REFUSED = "That username and password were not accepted.";

async function handleOpen(request, env) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);

  /* JSON ONLY, AND THE CONTENT TYPE IS THE GATE (04 Sep 2026 audit). request.json() ignores the
     header, so a POST sent as text/plain was a CORS-safelisted SIMPLE request: any page a customer
     happened to visit could spend his attempts from his own browser, with no preflight and without
     the attacker ever reading the reply. Demanding application/json forces a preflight, which this
     Worker answers for nobody. */
  const ctype = String(request.headers.get("content-type") || "");
  if (!/^application\/json\b/i.test(ctype)) return json({ ok: false, error: REFUSED }, 401);

  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const u = normUser(body.u);
  const pass = typeof body.password === "string" ? body.password.trim() : "";
  const master = typeof body.master === "string" ? body.master.trim() : "";

  /* THE COUNTER IS KEYED ON THE CALLER AS WELL AS THE ACCOUNT, and that is the whole point.
     Keyed on the username alone, ten unauthenticated POSTs locked ANY customer out for fifteen
     minutes, and locked the owner's override out with him: about forty requests an hour held one
     account shut for ever, and thirty-seven usernames off one review sheet took the site down for
     the price of a shell loop. Found by audit on 04 Sep. An attacker can now only ever spend his
     OWN allowance: fail:<address>:<username> brakes grinding one account from one place,
     ipfail:<address> brakes sweeping many accounts from one place, and neither key is one a
     stranger can reach on the customer's behalf.
     WHAT THIS DOES NOT DO, stated rather than implied: someone with many addresses can still make
     attempts, and nothing here stops that. What makes it pointless is the password itself, sixteen
     random symbols, about 78 bits. The lockout is a brake on a person with the address, never the
     thing the secrecy rests on. */
  const who = String(request.headers.get("CF-Connecting-IP") || "local");
  const readN = async (k) => parseInt(await env.STMT.get(k) || "0", 10) || 0;
  const bump = async (k, n) => env.STMT.put(k, String(n + 1), { expirationTtl: FAIL_TTL });
  const uKey = FKEY(who + ":" + u), ipKey = IPKEY(who), mKey = MKEY(who);
  const tooMany = () => json({ ok: false, error: "Too many attempts. Try again in fifteen minutes." }, 429);

  const ipFails = await readN(ipKey);
  if (ipFails >= MAX_IP_FAILS) return tooMany();
  if (!u) { await bump(ipKey, ipFails); return json({ ok: false, error: REFUSED }, 401); }

  const rec = await env.STMT.get(UKEY(u), "json");
  const masterKey = String(env.STMT_MASTER || "");

  /* THE OVERRIDE IS WEIGHED BEFORE THE CUSTOMER'S LOCKOUT, on its own counter. It is the
     break-glass: the one moment it is needed is the moment a customer cannot get in, which under
     a shared counter was exactly when it had also stopped working. */
  const mFails = await readN(mKey);
  const byMaster = !!(rec && rec.env && master && masterKey && mFails < MAX_FAILS && ctEq(master, masterKey));

  const uFails = await readN(uKey);
  if (!byMaster && uFails >= MAX_FAILS) return tooMany();

  const byPass = !byMaster && !!(rec && rec.env) && !!pass && await verifierOk(pass, rec.verifier);

  if (!byMaster && !byPass) {
    /* KV counts are eventually consistent, so someone racing many requests can land a few
       more than ten before the count catches up. That is a brake, not a lock. */
    await bump(uKey, uFails);
    await bump(ipKey, ipFails);
    if (master && masterKey) await bump(mKey, mFails);
    return json({ ok: false, error: REFUSED }, 401);
  }

  if (uFails) await env.STMT.delete(uKey);
  if (mFails && byMaster) await env.STMT.delete(mKey);

  /* Recorded so he can tell whether a statement was ever opened, which is the question he
     actually asks after sending thirty-seven of them. It gates nothing. */
  if (!byMaster) {
    const seen = await env.STMT.get(SKEY(u), "json");
    await env.STMT.put(SKEY(u), JSON.stringify({
      first: (seen && seen.first) || new Date().toISOString(),
      last: new Date().toISOString(),
      opens: ((seen && seen.opens) || 0) + 1,
      issued: rec.issued || null
    }));
  }

  /* ONLY THE WRAP THAT MATCHED TRAVELS BACK, and the reason is the sharpest finding of the 04 Sep
     audit. This returned BOTH wraps to everyone. wrapMaster is the customer's content key sealed
     under STMT_MASTER, so every customer signing in with his own password was handed, once a
     month, a self-verifying offline crack target against the one passphrase that opens EVERY
     account: PBKDF2 then AES-GCM over 32 bytes, where the tag says immediately when a guess is
     right, with no rate limit, no lockout and no trace. An auditor recovered a five-word master
     from a returned wrap in a single pass. Recovering it would defeat the site outright, because
     the master branch above needs only a username, and usernames are printed in the clear on every
     paper statement.
     Nothing else in the record is a secret to the holder of a correct password: the envelope and
     the live document are his own account, and both are ciphertext he now has the key for. */
  return new Response(JSON.stringify({
    ok: true, byMaster, issued: rec.issued || null, issues: rec.issues || null,
    wrap: byMaster ? null : (rec.wrap || null),
    wrapMaster: byMaster ? (rec.wrapMaster || null) : null,
    env: rec.env, live: rec.live || null
  }), {
    status: 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private" }, HEADERS)
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = (url.pathname.replace(/\/+$/, "") || "/");
    const m = request.method;

    if (p === "/open") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      return handleOpen(request, env);
    }
    if (p !== "/") return notFound();
    if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);

    /* Generated per request so the inline style and script can carry a nonce rather than
       needing 'unsafe-inline'. The QR carries ?u=<username>; anything else in the query is
       ignored, and a username that does not parse is simply not filled in. */
    const nonce = b64e(crypto.getRandomValues(new Uint8Array(16))).replace(/[^A-Za-z0-9]/g, "");
    return new Response(landingPage(normUser(url.searchParams.get("u")), nonce), {
      headers: Object.assign({
        "content-type": "text/html; charset=utf-8",
        "content-security-policy":
          "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
          + "img-src 'self' data:; connect-src 'self'; "
          + "style-src 'nonce-" + nonce + "'; script-src 'nonce-" + nonce + "'"
      }, HEADERS)
    });
  }
};
