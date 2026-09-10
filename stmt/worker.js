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
import { SW_JS } from "./sw.js";
import { identity } from "./access.js";
import { endpointId } from "./push.js";
import { mintSession, sessionUser, ordersOf, allOrders, placeOrder, customerMove, deskMove } from "./orders.js";

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

/* THE PASSWORD IS FORGIVEN THE SAME WAY (06 Sep 2026): a statement password is sixteen symbols of
   one alphabet in four groups, and one typed without its hyphens, with the wrong ones, or in
   capitals is the same password. Only a value that is exactly sixteen such symbols is reshaped;
   anything else, the owner's master passphrase included, is compared as typed. The page groups
   the field as it is typed too; this is the same rule at the door, so a pasted password works
   whatever the page did. */
const PASS_RE = /^[23456789abcdefghjkmnpqrstvwxyz]{16}$/;
export function normPass(s) {
  const t = typeof s === "string" ? s.trim() : "";
  const raw = t.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!PASS_RE.test(raw)) return t;
  return raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12) + "-" + raw.slice(12);
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
/* a verifier no password matches, run when the username does not exist so the refusal costs the
   same either way (08 Sep 2026); the salt and hash are fixed bytes, not secrets */
const DUMMY_VERIFIER = { salt: "c2FsdC1jb21tYW5kLW51bGw=", hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", rounds: 10000 };

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
  const pass = normPass(body.password);
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

  /* THE SAME WORK FOR A NAME THAT EXISTS AND ONE THAT DOES NOT (08 Sep 2026). The verifier ran only
     when the record existed, so an unknown username answered in a fraction of a millisecond and a
     known one with a wrong password in two: the one answer for every refusal, timed. A fixed
     verifier is run against the typed password when there is no record, and its result discarded. */
  const known = !!(rec && rec.env);
  const passOk = (!byMaster && !!pass) ? await verifierOk(pass, known ? rec.verifier : DUMMY_VERIFIER) : false;
  const byPass = known && passOk;

  if (!byMaster && !byPass) {
    /* KV counts are eventually consistent, so someone racing many requests can land a few
       more than ten before the count catches up. That is a brake, not a lock. */
    await bump(uKey, uFails);
    await bump(ipKey, ipFails);
    /* THE OVERRIDE'S BRAKE COUNTS OVERRIDE ATTEMPTS ONLY (08 Sep 2026). The page sends every typed
       value as both password and master, so ten wrong customer passwords from one address locked the
       owner's override from that address for fifteen minutes: on his own phone, helping that
       customer, exactly when it is for. A value shaped like a statement password was never a
       master attempt. */
    if (master && masterKey && !PASS_RE.test(String(master))) await bump(mKey, mFails);
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
  /* THE SESSION (06 Sep 2026): a token the order routes take in place of the password, minted here
     because this is the one place the password has just been proved. Fifteen minutes in the store;
     the page forgets it the moment it locks. The override gets none: the owner does not order. */
  const session = byMaster ? null : await mintSession(env, u);
  return new Response(JSON.stringify({
    ok: true, byMaster, issued: rec.issued || null, issues: rec.issues || null,
    wrap: byMaster ? null : (rec.wrap || null),
    wrapMaster: byMaster ? (rec.wrapMaster || null) : null,
    env: rec.env, live: rec.live || null, prices: rec.prices || null, session
  }), {
    status: 200,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store, private" }, HEADERS)
  });
}

/* ---- THE ORDER ROUTES (06 Sep 2026) ---------------------------------------------------
 * Customer side, on a session: his own orders, a placement, a rail once the order is ready, a
 * withdrawal before it is, and a push subscription. Nothing a session cannot reach answers with
 * anything but the one refusal, so a token that has expired reads exactly as no token at all.
 * JSON only, as /open: the content type is the gate, so a cross-site form cannot place an order
 * with a browser that happens to hold nothing anyway. */
async function readJson(request) {
  if (!/^application\/json\b/i.test(String(request.headers.get("content-type") || ""))) return null;
  try { return await request.json(); } catch (e) { return null; }
}
const OID_RE = /^[0-9]{14}-[a-z0-9]{1,8}$/;

async function handleCustomer(request, env, p, m) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  const u = await sessionUser(request, env);
  if (!u) return json({ ok: false, error: "Sign in again to see your orders.", session: false }, 401);
  if (p === "/orders") {
    if (m === "GET") return json({ ok: true, orders: await ordersOf(env, u) });
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const r = await placeOrder(env, u, await readJson(request));
    return r.error ? json({ ok: false, error: r.error }, 400) : json({ ok: true, order: r.order });
  }
  if (p === "/push/subscribe") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = await readJson(request);
    const ep = b && b.endpoint;
    if (typeof ep !== "string" || !/^https:\/\//.test(ep)) return json({ ok: false, error: "a subscription needs an https endpoint" }, 400);
    const id = await endpointId(ep);
    await env.STMT.put("push:" + u + ":" + id, JSON.stringify({ endpoint: ep, at: new Date().toISOString() }));
    return json({ ok: true, id });
  }
  const mm = /^\/orders\/([^/]+)\/(method|cancel)$/.exec(p);
  if (!mm || !OID_RE.test(mm[1])) return notFound();
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const r = await customerMove(env, u, mm[1], mm[2], await readJson(request));
  return r.error ? json({ ok: false, error: r.error }, r.status || 400) : json({ ok: true, order: r.order });
}

/* Desk side, on the shared key STMT_DESK_KEY, which the ledger's Worker holds as a secret and sends
 * as X-Stmt-Desk over a service binding. It is a key, not a session: it names no customer and opens
 * no statement, and this Worker still cannot read a single sealed document with it. Unset, the
 * routes refuse everything, so an undeployed setup fails closed. */
function deskOk(request, env) {
  const want = String(env.STMT_DESK_KEY || "");
  return !!want && ctEq(String(request.headers.get("X-Stmt-Desk") || ""), want);
}
async function handleDesk(request, env, p, m) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  if (!deskOk(request, env)) return json({ ok: false, error: "desk key required" }, 401);
  if (p === "/desk/orders") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const all = new URL(request.url).searchParams.get("all") === "1";
    return json({ ok: true, orders: await allOrders(env, all) });
  }
  const mm = /^\/desk\/orders\/([^/]+)\/([^/]+)$/.exec(p);
  if (!mm) return notFound();
  const u = normUser(mm[1]);
  if (!u || !OID_RE.test(mm[2])) return notFound();
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const r = await deskMove(env, u, mm[2], await readJson(request));
  return r.error ? json({ ok: false, error: r.error }, r.status || 400) : json({ ok: true, order: r.order, push: r.push });
}

/* ---- THE OWNER'S LIST (10 Sep 2026) ---------------------------------------------------------
 * His instruction: open any statement from a list, with Zero Trust proving who is asking. /all is
 * covered by a Cloudflare Access application on this hostname AND verified again in stmt/access.js,
 * because a deleted or misconfigured application is exactly the case where a stranger arrives
 * carrying a header of his own. Behind it the page is handed the roster and STMT_MASTER, which is
 * his decision of today: the list opens an account with no passphrase typed. The trade is stated
 * where it is made -- an Access session on this hostname is then enough to read every account -- and
 * it is why the route verifies the token rather than trusting the header.
 *
 * THE ROSTER IS THE PUBLISH'S, not this Worker's: `roster` is written by tools/stmt-publish.mjs and
 * carries the desk code beside each username, which is what he knows an account by. A site that has
 * not been published since this shipped has no such key, so the usernames are listed from the store
 * itself and the codes are simply absent. Neither path reads a single sealed document. */
async function roster(env) {
  const named = await env.STMT.get("roster", "json");
  if (Array.isArray(named) && named.length) return named;
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "u:", cursor });
    for (const k of page.keys) out.push({ code: null, username: k.name.slice(2) });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.username.localeCompare(b.username));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = (url.pathname.replace(/\/+$/, "") || "/");
    const m = request.method;

    /* Generated per request so the inline style and script carry a nonce rather than needing
       'unsafe-inline'. One builder for the customer's door and the owner's. */
    const pageResponse = (user, owner) => {
      const nonce = b64e(crypto.getRandomValues(new Uint8Array(16))).replace(/[^A-Za-z0-9]/g, "");
      return new Response(landingPage(user, nonce, owner), {
        headers: Object.assign({
          "content-type": "text/html; charset=utf-8",
          "content-security-policy":
            "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
            + "img-src 'self' data:; connect-src 'self'; worker-src 'self'; "
            + "style-src 'nonce-" + nonce + "'; script-src 'nonce-" + nonce + "'"
        }, HEADERS)
      });
    };

    if (p === "/all") {
      if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
      if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
      /* Said plainly rather than answered with a 404: reaching this unauthenticated means the
         Access application is gone or misconfigured, and that is the one thing he must be told
         rather than left to guess at. Nothing is handed over either way. */
      const who = await identity(request, env);
      if (!who) return new Response("This page is behind Cloudflare Access, and this request did not pass it.", {
        status: 401, headers: Object.assign({ "content-type": "text/plain; charset=utf-8" }, HEADERS)
      });
      return pageResponse("", { master: String(env.STMT_MASTER || ""), accounts: await roster(env) });
    }

    if (p === "/open") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      return handleOpen(request, env);
    }
    /* THE SERVICE WORKER, served as text: the site has no assets. It caches nothing and reads
       nothing; see stmt/sw.js. worker-src 'self' in the page's CSP is what lets it register. */
    if (p === "/sw.js") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return new Response(SW_JS, { headers: Object.assign({ "content-type": "application/javascript; charset=utf-8" }, HEADERS) });
    }
    if (p === "/push/key") return json({ ok: true, key: env.STMT_VAPID_PUBLIC_KEY || null, configured: !!(env.STMT_VAPID_PUBLIC_KEY && env.STMT_VAPID_PRIVATE_JWK) });
    if (p === "/orders" || p.startsWith("/orders/") || p === "/push/subscribe") return handleCustomer(request, env, p, m);
    if (p === "/desk/orders" || p.startsWith("/desk/orders/")) return handleDesk(request, env, p, m);
    if (p !== "/") return notFound();
    if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);

    /* The QR carries ?u=<username>; anything else in the query is ignored, and a username that
       does not parse is simply not filled in. */
    return pageResponse(normUser(url.searchParams.get("u")), null);
  }
};
