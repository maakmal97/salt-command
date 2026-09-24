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
import { landingPage, boardPage, shutPage } from "./page.js";
import { SW_JS } from "./sw.js";
import { identity } from "./access.js";
import QR from "./qr.js";
import { normRef, mintRef, readRef, listRefs, revokeRef, markOpen, ensureStanding, refsBy, setRef, linkWaiting, MAX_PER_ASSOC } from "./refs.js";
import { SIGNIN_RE, SIGNIN_TTL, mintSignin, burnSignin, peekSignin, idOf, pointAt, unpoint, devPrefix, mintHandover, burnHandover, dropHandover, sessKey, deviceOf } from "./signin.js";
import { endpointId, pushKeys, wakeCustomer, wakeEveryone } from "./push.js";
import { linkMessage, signInMessage, totalsLine, monthNameOf } from "./send.js";
import { ICON_PNG_B64, ICON_SIZE, ADMIN_ICON_PNG_B64 } from "./icons.js";
import { FONTS } from "./fonts.js";
/* S10 (D10): the site's one Durable Object is exported from the main module, which is where the binding in
   wrangler.stmt.jsonc looks for its class */
export { OrderBook } from "./orderbook.js";
import { mintSession, dropSession, sessionUser, SESSION_TTL, ordersOf, customerView, allOrders, ordersOwing, placeOrder, customerMove, deskMove, orderMarks, dropOrders, toChase, markChased, chaseSlot, readsBoth, checkStores } from "./orders.js";

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

/* ---- THE TEST ACCOUNT (v689, his instruction of 18 Sep 2026) ---------------------------------
 * One account he can open anywhere, that counts nowhere, and that he can destroy with one tap.
 * ITS NAME IS THE POINT: zeros are not in the alphabet a real username is drawn from, so this one
 * cannot collide with an account and cannot be arrived at by mistyping one. Both are the exception
 * stated here and nowhere else. It is made by the Worker, with its own random key, so no statement,
 * no price list and no laptop secret is involved in it. */
export const TEST_USER = "0000-0000";
export const TEST_PASS = "0000-0000-0000-0000";
const TEST_REC = "u:" + TEST_USER;

/** Case and punctuation are forgiven; anything that is not eight symbols of the alphabet is "". */
export function normUser(s) {
  s = String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.length !== 8) return "";
  s = s.slice(0, 4) + "-" + s.slice(4);
  if (s === TEST_USER) return s;
  return USER_RE.test(s) ? s : "";
}

/* THE PASSWORD IS FORGIVEN THE SAME WAY (06 Sep 2026): a statement password is sixteen symbols of
   one alphabet in four groups, and one typed without its hyphens, with the wrong ones, or in
   capitals is the same password. Only a value that is exactly sixteen such symbols is reshaped;
   anything else, the owner's master passphrase included, is compared as typed. The page takes it
   in four boxes of four and joins them with hyphens; this is the same rule at the door, so a
   password works whatever the page did. */
const PASS_RE = /^[23456789abcdefghjkmnpqrstvwxyz]{16}$/;
export function normPass(s) {
  const t = typeof s === "string" ? s.trim() : "";
  const raw = t.toLowerCase().replace(/[^a-z0-9]/g, "");
  /* the test account's password is sixteen zeros, forgiven the same way a real one is (v689) */
  if (/^0{16}$/.test(raw)) return TEST_PASS;
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

/* EVERY OPEN IS AN OPEN (24 Sep 2026). `seen:` was written on a password open alone, so a customer who
   signed in once from his link and then came back on a remembered phone read "Not opened" on his list,
   or one open, for ever. All three roads write it now, with the road the last one took. His own opens
   under the master are not the customer's and are never counted. BEST EFFORT: the count gates nothing,
   and KV refuses a second write to one key inside a second, so a put that throws must never fail an
   open; on the link road the token is already burnt by then. */
/* S9 9.3: AND HOW THEY GOT IN, the last ten ways in (a link, a code, a password), each with its moment and the kind of
   device it was used on, called from the browser's description at that moment (deviceOf) and never an address. A
   remembered phone coming back is not a way in: it is on the account's list of phones and computers, with its last use. */
const LOG_MAX = 10;
async function markSeen(env, u, rec, how, request) {
  try {
    const seen = await env.STMT.get(SKEY(u), "json");
    const now = new Date().toISOString();
    const log = Array.isArray(seen && seen.log) ? seen.log : [];
    const d = deviceOf(request && request.headers.get("user-agent"));
    await env.STMT.put(SKEY(u), JSON.stringify({
      first: (seen && seen.first) || now, last: now,
      opens: ((seen && seen.opens) || 0) + 1,
      how, issued: (rec && rec.issued) || null,
      log: how === "remembered" ? log : [{ how, at: now, where: d.label, kind: d.kind }].concat(log).slice(0, LOG_MAX)
    }));
  } catch (e) { /* the next open counts */ }
}

/* S3 3.2: EVERY SESSION AN OPEN MINTS LEAVES ITS POINTER under the account (stmt/signin.js), so signing an account
   out everywhere reaches a session minted a minute ago as well as a remembered phone. Best effort, as markSeen is:
   a pointer that cannot be written never fails an open, and the session lapses on its own in fifteen minutes. */
/* S9 9.4: and the pointer names the device in the site's own words (deviceOf), for the account's phones and computers */
async function openSession(env, u, how, request) {
  const session = await mintSession(env, u);
  const now = new Date().toISOString(), d = deviceOf(request && request.headers.get("user-agent"));
  try { await pointAt(env, u, await sessKey(session), { how, at: now, last: now, label: d.label, kind: d.kind }, SESSION_TTL); } catch (e) { /* it lapses on its own */ }
  return session;
}

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
  /* the count rides on the key's metadata as well, so lockedOut reads it off the listing (S9 fix) */
  const bump = async (k, n) => env.STMT.put(k, String(n + 1), { expirationTtl: FAIL_TTL, metadata: { n: n + 1 } });
  const uKey = FKEY(who + ":" + u), ipKey = IPKEY(who), mKey = MKEY(who);
  const tooMany = () => json({ ok: false, error: "Too many attempts. Try again in fifteen minutes." }, 429);

  const ipFails = await readN(ipKey);
  if (ipFails >= MAX_IP_FAILS) return tooMany();
  if (!u) { await bump(ipKey, ipFails); return json({ ok: false, error: REFUSED }, 401); }

  /* D15: A SPARE ACCOUNT IS NOBODY'S YET. The publish marks one the laptop minted ahead of need and the
     fold has not bound to a code, and the door treats it as no account at all, his override included:
     nobody has been handed its password, and an open would be counted as a customer's. */
  const got = await env.STMT.get(UKEY(u), "json");
  const rec = got && got.spare === true ? null : got;
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
    /* AND HIS CORRECT MASTER IS NEVER A MISS (24 Sep 2026). On a username with no account behind it
       the override has nothing to open, so it refuses, but that is the account's fault and not a wrong
       passphrase: counted, ten taps on such a row locked his override on every account for fifteen
       minutes. */
    /* 24 SEP 2026: THE SHAPE IS READ AS normPass READS IT. The page sends what was typed in the four
       boxes joined with hyphens, so the raw test never matched and every mistyped customer password
       still counted here; the test password's sixteen zeros are a password's shape too. */
    const shaped = String(master).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (master && masterKey && !ctEq(master, masterKey) && !PASS_RE.test(shaped) && !/^0{16}$/.test(shaped)) await bump(mKey, mFails);
    return json({ ok: false, error: REFUSED }, 401);
  }

  if (uFails) await env.STMT.delete(uKey);
  if (mFails && byMaster) await env.STMT.delete(mKey);

  /* Recorded so he can tell whether a statement was ever opened, which is the question he
     actually asks after sending thirty-seven of them. It gates nothing. */
  if (!byMaster) await markSeen(env, u, rec, "password", request);

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
  const session = byMaster ? null : await openSession(env, u, "password", request);
  return new Response(JSON.stringify({
    ok: true, byMaster, issued: rec.issued || null, issues: rec.issues || null,
    wrap: byMaster ? null : (rec.wrap || null),
    wrapMaster: byMaster ? (rec.wrapMaster || null) : null,
    /* v702: whether this account may order on behalf of a friend. It decides one tick on the
       order form and nothing else; where a row books is the desk's decision, never this. */
    assoc: !!rec.assoc,
    /* v706: an associate's own report card, sealed under the same content key as the statement */
    card: rec.card || null,
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
  /* S1 1.42: Log out is answered with or without a live session. Behind the check, a phone logging out after
     its fifteen minutes got a 401 and left its remembered wrap on the site for the rest of thirty days. */
  if (p === "/logout") return logOut(request, env, m, u);
  if (!u) return json({ ok: false, error: "Sign in again to see your orders.", session: false }, 401);
  /* S3 3.5: THE PAGE RE-READS ON EVERY RETURN, on its session: the sealed documents as an open hands them over,
     and never a wrap, because the page still holds the key it opened them with */
  if (p === "/account") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const acct = await env.STMT.get("u:" + u, "json");
    if (!acct) return json({ ok: false, error: "Sign in again to see your orders.", session: false }, 401);
    return json({ ok: true, u, issued: acct.issued || null, issues: acct.issues || null, assoc: !!acct.assoc,
      card: acct.card || null, env: acct.env, live: acct.live || null, prices: acct.prices || null });
  }
  /* S9 9.4, FOR THE CUSTOMER'S OWN THIS DEVICE CARD (9.9): their phones and computers, on their session, and signing the
     others out. The list carries no id and no address: the kind of device, when it came and was last used, whether it
     is kept signed in, and which is this one, told by this session and this phone's own remembered token. Signing the
     others out spares this one and the alerts on this phone's own subscription, and touches nothing of the account's. */
  if (p === "/devices" || p === "/devices/signout") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = (await readJson(request)) || {};
    const here = [await sessKey(String(request.headers.get("X-Stmt-Session") || ""))];
    if (typeof b.token === "string" && REM_RE.test(b.token)) here.push(await remKey(b.token));
    const isHere = (d) => here.includes(d.key) || opened(d).some((s) => here.includes(s));
    const devs = devicesIn(await pointersOf(env, u));
    if (p === "/devices") return json({ ok: true, devices: devs.map((d) => Object.assign(deviceOut(d), { here: isHere(d) })) });
    let devices = 0, phones = 0;
    for (const d of devs) if (!isHere(d)) { phones += await endDevice(env, u, d); devices++; }
    const ep = typeof b.endpoint === "string" && /^https:\/\//.test(b.endpoint) ? await endpointId(b.endpoint) : null;
    return json({ ok: true, devices, phones: phones + await dropPhones(env, u, ep) });
  }
  if (p === "/orders") {
    if (m === "GET") return json({ ok: true, orders: (await ordersOf(env, u)).map(customerView) });
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const r = await placeOrder(env, u, await readJson(request));
    return r.error ? json({ ok: false, error: r.error }, r.status || 400) : json({ ok: true, order: customerView(r.order) });
  }
  if (p === "/push/subscribe") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = await readJson(request);
    const ep = b && b.endpoint;
    if (typeof ep !== "string" || !/^https:\/\//.test(ep)) return json({ ok: false, error: "a subscription needs an https endpoint" }, 400);
    const id = await endpointId(ep), keys = pushKeys(b.keys);   /* S12 12.1: kept, so a wake can carry its kind */
    /* S9 fix: and the device it came from, the session and the remembered phone holding it, so signing that one device
       out stops its alerts too (endDevice); a phone signed out stops waking (v692) */
    const sess = await sessKey(String(request.headers.get("X-Stmt-Session") || ""));
    const ph = (await pointersOf(env, u)).find((x) => opened(x).includes(sess));
    await env.STMT.put("push:" + u + ":" + id, JSON.stringify(Object.assign({ endpoint: ep, at: new Date().toISOString(), sess },
      ph ? { dev: ph.key } : {}, keys ? { keys } : {})));
    return json({ ok: true, id, keys: !!keys });
  }
  /* S9 9.9: notifications off on this phone, from its This device card: its own push record and no other */
  if (p === "/push/unsubscribe") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = await readJson(request);
    const ep = b && b.endpoint;
    if (typeof ep !== "string" || !/^https:\/\//.test(ep)) return json({ ok: false, error: "send the subscription's endpoint" }, 400);
    await env.STMT.delete("push:" + u + ":" + await endpointId(ep));
    return json({ ok: true });
  }
  /* v692: remember this device, and log out of it */
  if (p === "/remember") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = await readJson(request);
    const wrap = b && b.wrap;
    if (!wrap || typeof wrap !== "object" || !wrap.salt || !wrap.iv || !wrap.ct) return json({ ok: false, error: "send the wrap" }, 400);
    const tok = b64e(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const key = await remKey(tok), now = new Date().toISOString();
    /* S3 3.2: the pointer first, so a phone is never remembered where it cannot be found again. S9 9.4: naming the device
       and the session it was kept on, so the phone is listed once */
    const d = deviceOf(request.headers.get("user-agent")), stok = String(request.headers.get("X-Stmt-Session") || "");
    await pointAt(env, u, key, Object.assign({ how: "remember", at: now, last: now, label: d.label, kind: d.kind },
      stok ? { sess: await sessKey(stok) } : {}), REM_TTL);
    await env.STMT.put(key, JSON.stringify({ u, wrap, at: now }), { expirationTtl: REM_TTL });
    return json({ ok: true, token: tok, days: REM_TTL / 86400 });
  }
  const mm = /^\/orders\/([^/]+)\/(method|cancel|pay|say)$/.exec(p);   /* v751: say, a line on the order */
  if (!mm || !OID_RE.test(mm[1])) return notFound();
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const r = await customerMove(env, u, mm[1], mm[2], await readJson(request));
  return r.error ? json({ ok: false, error: r.error }, r.status || 400) : json({ ok: true, order: customerView(r.order) });
}

/* v692: LOGGING OUT IS A DEPARTURE. The session goes, the remembered wrap goes, and since S1 1.42 so does this
   phone's push record, because a phone handed on is a phone signed out. A token only forgets its own account,
   so one device cannot sign another out: with a live session it must be that session's account, and with none
   the token is its own proof, since whoever holds it could open that account anyway. */
async function logOut(request, env, m, su) {
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const b = await readJson(request);
  await dropSession(env, String(request.headers.get("X-Stmt-Session") || ""));
  const tok = b && typeof b.token === "string" && REM_RE.test(b.token) ? b.token : null;
  const { key, rec, raw } = tok ? await readRem(env, tok) : {};
  if (rec && (!su || rec.u === su)) { await env.STMT.delete(key); if (raw) await env.STMT.delete(raw); await unpoint(env, rec.u, key); }
  const stok = String(request.headers.get("X-Stmt-Session") || "");
  if (su && stok) await unpoint(env, su, await sessKey(stok));
  const u = su || (rec && rec.u) || "";
  const ep = b && typeof b.endpoint === "string" && /^https:\/\//.test(b.endpoint) ? b.endpoint : null;
  if (u && ep) await env.STMT.delete("push:" + u + ":" + await endpointId(ep));
  /* S3 fix: and the hand-overs this page minted, ten at most */
  for (const k of (b && Array.isArray(b.handover) ? b.handover.slice(0, 10) : [])) await dropHandover(env, k);
  return json({ ok: true });
}

/* ---- AN ASSOCIATE'S OWN LINKS (v709, his instruction of 18 Sep 2026) --------------------------
 * "If they want to refer to a customer, they will be able to mint their own link, just like how I'd
 * choose a customer and generate the link. It will need to be approved by me."
 *
 * ON A SESSION, NEVER UNDER /all. An associate is a customer, not him: this reads the session the
 * order routes read and refuses anybody whose own record does not carry the associate mark. The
 * mark is the publish's, off the report card's own list, so nobody can make themselves one.
 *
 * THE FIELDS ARE PROJECTED, ONE BY ONE. refOut hands back the WHOLE record: his label, the
 * introducer, and who minted it. Reusing it here would show one associate another's notes, and
 * their own link's level would name a tier on a customer's page, which the page never does.
 */
/* what an associate may see of their own link: where it points, whether it is open yet, and how
   often it has been used. Not his label, not the level, not who else holds one. His read-only view
   of their page (/all/orders/<u>) hands over exactly this, so it draws what they see. */
const mineOut = (origin, r) => ({ id: r.id, url: refUrl(origin, r.id), qr: refQr(origin, r.id),
  made: r.made || null, opens: r.opens || 0, last: r.last || null,
  state: r.revoked ? "withdrawn" : (r.declined === true ? "declined" : (r.approved === false ? "waiting" : "open")) });

async function handleMyRefs(request, env, p, m, origin) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  const u = await sessionUser(request, env);
  if (!u) return json({ ok: false, error: "Sign in again to see your links.", session: false }, 401);
  let acct = null;
  try { acct = await env.STMT.get("u:" + u, "json"); } catch (e) { acct = null; }
  if (!acct || acct.assoc !== true) return notFound();

  if (p === "/my/refs") {
    if (m === "GET") return json({ ok: true, refs: (await refsBy(env, u)).map((r) => mineOut(origin, r)), max: MAX_PER_ASSOC });
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const mine = await refsBy(env, u);
    /* the same shape as the open-order cap: a count, a plain refusal, and a reason */
    if (mine.filter((r) => !r.revoked).length >= MAX_PER_ASSOC)
      return json({ ok: false, error: "you already have " + MAX_PER_ASSOC + " links; withdraw one to make another" }, 409);
    /* NO LABEL FROM A CUSTOMER: a note typed here would be the first plaintext anybody but him has
       put into this store, and a label is his note. He can write one when he approves it. */
    const rec = await mintRef(env, { introducer: u, by: u, label: "" });
    if (!rec) return json({ ok: false, error: "could not mint an unused id; try again" }, 500);
    return json({ ok: true, ref: mineOut(origin, rec) });
  }
  const mm = /^\/my\/refs\/([^/]+)\/(revoke)$/.exec(p);
  if (!mm) return notFound();
  const id = normRef(mm[1]);
  if (!id) return notFound();
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  const rec = await readRef(env, id);
  /* a link only ever forgets its own minter's, so one associate cannot withdraw another's */
  if (!rec || String(rec.by || "").toLowerCase() !== u) return notFound();
  const out = await revokeRef(env, id, true);
  return json({ ok: true, ref: mineOut(origin, out) });
}

/* The remembered opening: the token names the record and carries the wrap back, and the device key
   that opens it never left the browser. It mints a session exactly as a password does, so nothing
   downstream knows the difference; the refusal is the door's one refusal, so a stale token on an
   old phone says what a wrong password says and no more. */
async function handleRemember(request, env) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  const b = await readJson(request);
  const tok = b && typeof b.token === "string" && REM_RE.test(b.token) ? b.token : null;
  const { key, rec, raw } = tok ? await readRem(env, tok) : {};
  if (!rec || !rec.u) return json({ ok: false, error: REFUSED }, 401);
  const acct = await env.STMT.get("u:" + rec.u, "json");
  if (!acct) { await env.STMT.delete(key); if (raw) await env.STMT.delete(raw); await unpoint(env, rec.u, key); return json({ ok: false, error: REFUSED }, 401); }
  await markSeen(env, rec.u, acct, "remembered", request);
  /* S3 3.6, HIS DECISION D1 OF 24 SEP 2026: KEEP ME SIGNED IN RUNS THIRTY DAYS FROM THE LAST OPEN, not from the tick,
     so a customer who uses the page is never signed out by a calendar. Every open files the record again for thirty
     days, which is also the put that moves a record filed the old way under its hash (3.1). Best effort: a put that
     throws (KV takes one write to a key a second) never fails the open, and the record keeps the days it had.
     S3 3.2: the phone's own pointer says when it was last used, lives as long, and one filed before pointers is
     given its first. */
  const now = new Date().toISOString();
  /* S3 FIX, 24 SEP 2026: A RECORD FOUND UNDER ITS RAW TOKEN KEEPS THE END IT HAD, thirty days from its tick, and never
     slides. A copy of the store taken before 3.1 names that token, and sliding would renew it for as long as it was
     used; the phone signs in again at that end, and the record it then makes is filed under a hash and slides. */
  if (raw && !rec.end) rec.end = new Date(Date.parse(rec.at || now) + REM_TTL * 1000).toISOString();
  const left = rec.end ? Math.floor((Date.parse(rec.end) - Date.now()) / 1000) : REM_TTL;
  if (!(left > 0)) { await env.STMT.delete(key); if (raw) await env.STMT.delete(raw); await unpoint(env, rec.u, key); return json({ ok: false, error: REFUSED }, 401); }
  const ttl = Math.max(60, left);
  try {
    await env.STMT.put(key, JSON.stringify(rec), { expirationTtl: ttl });
    if (raw) await env.STMT.delete(raw);
  } catch (e) { /* it opens either way, and slides on the next */ }
  /* S9 9.4: the session first, so the phone's pointer names it (`sess`): the account's list shows the phone once, and
     signing the phone out ends the session it opened */
  const session = await openSession(env, rec.u, "remembered", request);
  const d = deviceOf(request.headers.get("user-agent"));
  try {
    /* and the sessions it opened before (`was`, four at most), which may still be live in another tab on the same phone:
       they are this phone too, so they are not listed as other devices, and signing the phone out ends them */
    const old = await env.STMT.get(devPrefix(rec.u) + (await idOf(key)), "json");
    const was = [old && old.sess].concat((old && old.was) || []).filter((x) => typeof x === "string").slice(0, 4);
    await pointAt(env, rec.u, key, { how: "remember", at: rec.at || now, last: now, label: d.label, kind: d.kind, sess: await sessKey(session), was }, ttl);
  } catch (e) { /* the next open writes it */ }
  return json({
    ok: true, u: rec.u, remembered: true, wrap: rec.wrap,
    issued: acct.issued || null, issues: acct.issues || null, assoc: !!acct.assoc, card: acct.card || null,
    env: acct.env, live: acct.live || null, prices: acct.prices || null, session
  });
}

/* ---- THE ONE-TIME LINK IS OPENED (v710, his instruction of 18 Sep 2026) ----------------------
 * The token names a record holding the content key wrapped UNDER THAT TOKEN, so this Worker holds
 * ciphertext and a username and the opener holds the only thing that unwraps it. It is burnt on
 * the way through, and from there it is an ordinary session: nothing downstream knows the
 * difference, exactly as a remembered device does not.
 *
 * A USED, AN EXPIRED AND AN INVENTED TOKEN GET THE DOOR'S ONE REFUSAL, so a link that has been
 * opened reads exactly as a link that never existed, and the space cannot be walked.
 */
async function handleSignin(request, env) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  const b = await readJson(request);
  const tok = b && typeof b.token === "string" && SIGNIN_RE.test(b.token) ? b.token : null;
  /* S3 3.3: the page asks which account first, and that spends nothing; a spent link is refused alike */
  if (b && b.peek === true) {
    const live = tok ? await peekSignin(env, tok, b.nonce) : null;
    if (!live || !(await env.STMT.get("u:" + live.u))) return json({ ok: false, error: REFUSED }, 401);
    return json({ ok: true, u: live.u });
  }
  const rec = tok ? await burnSignin(env, tok, b && b.nonce) : null;
  if (!rec) return json({ ok: false, error: REFUSED }, 401);
  const acct = await env.STMT.get("u:" + rec.u, "json");
  if (!acct) return json({ ok: false, error: REFUSED }, 401);
  await markSeen(env, rec.u, acct, "link", request);
  const session = await openSession(env, rec.u, "link", request);
  return json({
    ok: true, u: rec.u, remembered: true, wrap: rec.wrap,
    issued: acct.issued || null, issues: acct.issues || null, assoc: !!acct.assoc, card: acct.card || null,
    env: acct.env, live: acct.live || null, prices: acct.prices || null, session
  });
}

/* ---- THE HAND-OVER, MINTED AND OPENED (S3 3.9, his decision D2 of 24 Sep 2026) --------------------------------
 * POST /handover on a live session takes { token, wrap }, the key the page minted and the content key wrapped under
 * it as a link is wrapped, and answers { ok, code, token, exp }. POST /handover/open takes { token } or { code } and
 * answers what a one-time link's open answers, with `token` beside the wrap to unwrap it under. The mechanism is in
 * stmt/signin.js; what is here is the door.
 *
 * A CODE IS BRAKED PER ADDRESS AND SITE-WIDE: ten misses from one address (a v6 network's /64, which one host holds
 * whole) and a hundred across the site, each for a quarter-hour. The brakes slow a walk; they are not what stops it
 * (docs/STATEMENTS.md states the real bound: a KV count can lag). A flood shuts CODE sign-in for everyone for fifteen
 * minutes. S3 FIX, 24 SEP 2026: A KEY IS NEITHER BRAKED NOR COUNTED. It is 192 bits, as a sign-in link's token is; braked
 * with the codes, a hundred bogus codes from ten addresses shut the saved app's Paste, /app#<key> and his counter's QR
 * for every customer. A miss is any refused code; a success resets nothing, or an account could mint its own code to
 * clear its address between guesses. JSON only, as /open, so another site's page cannot spend a customer's allowance
 * from their browser. The refusal is the door's one; a brake answers the door's brake. */
const HO_FAIL = (ip) => "hofail:" + ip, HO_SITE = "hofail";
/* the address a code miss is counted against: a v4 address as it is, a v6 address's /64 */
function netOf(ip) {
  if (!ip.includes(":")) return ip;
  const [h, t = ""] = ip.split("::");
  const a = h ? h.split(":") : [], z = t ? t.split(":") : [];
  const g = a.concat(Array(Math.max(0, 8 - a.length - z.length)).fill("0"), z);
  return g.slice(0, 4).map((x) => (parseInt(x, 16) || 0).toString(16)).join(":") + "::/64";
}
const MAX_HO_FAILS = 10, MAX_HO_SITE = 100;
const noHandover = () => json({ ok: false, error: "Signing in with a code is not switched on here." }, 503);
async function handleHandover(request, env, p, m) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  if (!env.STMT_HANDOVER_KEY) return noHandover();
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  if (p === "/handover") {
    const u = await sessionUser(request, env);
    if (!u) return json({ ok: false, error: "Sign in again to make a code.", session: false }, 401);
    const b = await readJson(request);
    const made = await mintHandover(env, u, b && b.token, b && b.wrap);
    /* S9 9.9: with a QR of the site's own /app for the other device's camera, the address alone and never the key */
    return made ? json(Object.assign({ ok: true, qr: appQr(new URL(request.url).origin) }, made)) : json({ ok: false, error: "send the key and the wrap" }, 400);
  }
  const b = await readJson(request);
  if (!b) return json({ ok: false, error: REFUSED }, 401);
  const byKey = typeof b.token === "string" && SIGNIN_RE.test(b.token);
  const who = netOf(String(request.headers.get("CF-Connecting-IP") || "local"));
  const readN = async (k) => parseInt(await env.STMT.get(k) || "0", 10) || 0;
  const ipN = byKey ? 0 : await readN(HO_FAIL(who)), siteN = byKey ? 0 : await readN(HO_SITE);
  if (ipN >= MAX_HO_FAILS || siteN >= MAX_HO_SITE) return json({ ok: false, error: "Too many attempts. Try again in fifteen minutes." }, 429);
  const rec = await burnHandover(env, b);
  const acct = rec ? await env.STMT.get("u:" + rec.u, "json") : null;
  if (!acct && byKey) return json({ ok: false, error: REFUSED }, 401);
  if (!acct) {
    /* KV takes one write to a key a second, and the site-wide count is one key: a put it refuses is a brake that
       lags, never an open that fails */
    try { await env.STMT.put(HO_FAIL(who), String(ipN + 1), { expirationTtl: FAIL_TTL }); } catch (e) { /* the next miss counts */ }
    try { await env.STMT.put(HO_SITE, String(siteN + 1), { expirationTtl: FAIL_TTL }); } catch (e) { /* the next miss counts */ }
    return json({ ok: false, error: REFUSED }, 401);
  }
  await markSeen(env, rec.u, acct, rec.by, request);
  const session = await openSession(env, rec.u, rec.by, request);
  return json({
    ok: true, u: rec.u, remembered: true, wrap: rec.wrap, token: rec.token,
    issued: acct.issued || null, issues: acct.issues || null, assoc: !!acct.assoc, card: acct.card || null,
    env: acct.env, live: acct.live || null, prices: acct.prices || null, session
  });
}

/* Desk side, on the shared key STMT_DESK_KEY, which the ledger's Worker holds as a secret and sends
 * as X-Stmt-Desk over a service binding. It is a key, not a session: it names no customer and opens
 * no statement, and this Worker still cannot read a single sealed document with it. Unset, the
 * routes refuse everything, so an undeployed setup fails closed. */
function deskOk(request, env) {
  const want = String(env.STMT_DESK_KEY || "");
  return !!want && ctEq(String(request.headers.get("X-Stmt-Desk") || ""), want);
}
/* ---- THE BULLETIN (20 Sep 2026, his instruction): a notice board across the top of Salt Counter ----
 * One clear key in this store, no prefix, so no listing under u:, order:, push: or fail: ever sees it and
 * the publish, which deletes only u: and fail: keys, never touches it. It is set from Enter on the desk,
 * which reaches it over the binding on the desk key; the desk is where the words are checked, this
 * Worker holding none of the words it refuses. It cannot be sealed: the desk has no content key, and a
 * notice for everyone is not a document for one. The door carries it at first paint; an open page reads
 * it back on its poll. Running scrolls the lines as one; changing shows them one at a time. */
const BULL_KEY = "bulletin";
async function readBulletin(env) {
  try {
    const b = env.STMT ? await env.STMT.get(BULL_KEY, "json") : null;
    if (b && Array.isArray(b.lines)) return { lines: b.lines.filter((s) => typeof s === "string"), mode: b.mode === "change" ? "change" : "run", at: b.at || null };
  } catch (e) { /* an unreadable notice is no notice */ }
  return { lines: [], mode: "run", at: null };
}
function checkBulletin(body) {
  const lines = (Array.isArray(body.lines) ? body.lines : []).filter((s) => typeof s === "string")
    .map((s) => s.replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean).slice(0, 8);
  return { lines, mode: body.mode === "change" ? "change" : "run" };
}
const DESK_WAITING = "desk-waiting";
async function handleDesk(request, env, p, m) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  if (!deskOk(request, env)) return json({ ok: false, error: "desk key required" }, 401);
  if (p === "/desk/bulletin") {
    if (m === "GET") return json(Object.assign({ ok: true }, await readBulletin(env)));
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const body = await readJson(request);
    if (!body) return json({ ok: false, error: "send JSON" }, 400);
    const b = checkBulletin(body);
    if (!b.lines.length) { await env.STMT.delete(BULL_KEY); return json({ ok: true, lines: [], mode: b.mode, at: null, cleared: true }); }
    const rec = { lines: b.lines, mode: b.mode, at: new Date().toISOString() };
    await env.STMT.put(BULL_KEY, JSON.stringify(rec));
    /* v761, his instruction of 21 Sep 2026: the notice reaches them as well, and not only on the
       next time they happen to open the page. Every phone on the site, because that is who a notice
       is for. Clearing one wakes nobody: there is nothing to read. */
    const push = await wakeEveryone(env);
    return json(Object.assign({ ok: true }, rec, { push }));
  }
  if (p === "/desk/orders") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    const q = new URL(request.url).searchParams;
    /* v694: the orders with a stage the ledger has not been told about, whatever state they are
       in. A completed order still owes its last entries, so this is not the open list. */
    if (q.get("work") === "1") return json({ ok: true, orders: await ordersOwing(env) });
    /* S9 9.8: and, when the desk's page asks, how many associate links wait in Salt Admin: a count, no link, no name */
    const links = q.get("links") === "1" ? { links: (await listRefs(env)).filter(linkWaiting).length } : {};
    return json(Object.assign({ ok: true, orders: await allOrders(env, q.get("all") === "1") }, links));
  }
  /* S9 9.8: WHAT WAITS ON THE DESK, told by the desk (src/orders.js tellWaiting) as one figure, for Salt Admin's
     line. A count and its moment, nothing else: no order, no code and no way to the desk. */
  if (p === "/desk/waiting") {
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = await readJson(request);
    const n = b && b.n;
    if (!Number.isInteger(n) || n < 0 || n > 9999) return json({ ok: false, error: "send the count as a whole number" }, 400);
    await env.STMT.put(DESK_WAITING, JSON.stringify({ n, at: new Date().toISOString() }));
    return json({ ok: true, n });
  }
  /* the moment of the newest placement, one read: the desk asks this every minute (16 Sep 2026),
     and since v694 the moment of the newest change of any kind beside it, so the reconcile lists
     nothing on a quiet minute */
  if (p === "/desk/orders/last") {
    if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
    /* v752: and when a customer last wrote on one; v760: and when one last paid or took one back.
       S10: from wherever the orders live (orderMarks), the shared marks moving with them */
    return json(Object.assign({ ok: true }, await orderMarks(env)));
  }
  const mm =/^\/desk\/orders\/([^/]+)\/([^/]+)$/.exec(p);
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
  /* v689: the test account is on the list so he can open it, and marked so every count leaves it
     out. The publish never writes it into `roster`, so it is added here or not at all. */
  const test = (await env.STMT.get("u:" + TEST_USER)) ? [{ code: "TEST", username: TEST_USER, test: true }] : [];
  if (Array.isArray(named) && named.length) return named.concat(test);
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "u:", cursor });
    for (const k of page.keys) {
      const username = k.name.slice(2);
      out.push(username === TEST_USER ? { code: "TEST", username, test: true } : { code: null, username });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => a.username.localeCompare(b.username));
}

/* ---- THE GUEST REFERRAL LINKS (10 Sep 2026) --------------------------------------------------
 * He mints a link from inside the Access area, pinned to a tier and labelled so he knows who he
 * gave it to; the link's id is its own credential and opens one board and nothing else. The rules
 * are in stmt/refs.js. These are the routes.
 *
 * THE QR IS DRAWN HERE, IN THE WORKER, from the vendored copy of the one encoder (tools/qrsync.mjs
 * keeps stmt/qr.js byte-identical to engine/qr.mjs and CI fails on drift). So no encoder is inlined
 * into a page's script and nothing about QR drawing runs in a browser. RECTANGLES, never a stroked
 * path: a stroked symbol looks right and does not decode.
 */
const refUrl = (origin, id) => origin + "/g/" + id;
function refQr(origin, id) {
  const svg = QR.qrRectSvg(refUrl(origin, id), { size: 180, dark: "#05080a", light: "#f2f4f5",
    label: "Referral link " + id });
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
const refOut = (origin, r) => Object.assign({}, r, { url: refUrl(origin, r.id), qr: refQr(origin, r.id) });
/* S9 9.9: the site's own /app, for a customer's other device to open; it carries nothing but the address */
function appQr(origin) {
  return "data:image/svg+xml," + encodeURIComponent(QR.qrRectSvg(origin + "/app", { size: 180, dark: "#05080a", light: "#f2f4f5", label: "Salt Counter" }));
}

/* ---- REMEMBER ME, AND LOGGING OUT (v692, his instruction of 18 Sep 2026) ----------------------
 * The page locked itself after three minutes and asked for the password again. He asked for the
 * opposite: stay signed in on his customers' own phones, and leave by a button.
 *
 * NEITHER HALF OPENS ANYTHING ON ITS OWN, which is the whole design. When a reader ticks Remember
 * me, the page makes a random device key, wraps the content key under it, keeps the device key in
 * that browser and sends the WRAP here. This Worker holds ciphertext and a username; the browser
 * holds a key and a token. A copy of the store opens nothing, and the device alone opens nothing.
 * The password itself is never kept anywhere.
 *
 * REMEMBERING IS A CUSTOMER'S OWN: it is minted on a session, which only a correct password mints.
 * Logging out drops the session and the remembered wrap, so a phone handed on is a phone signed
 * out. Thirty days, his figure, counted from the last open since S3 3.6, and the record expires on its own after that. */
const REM_TTL = 30 * 24 * 3600;
const REM_RE = /^[A-Za-z0-9_-]{20,64}$/;

/* S3 3.1, 24 SEP 2026: A REMEMBERED DEVICE IS FILED UNDER THE HASH OF ITS TOKEN, as a one-time link has been since
   v710. The key WAS the token, so anybody holding a copy of this store could post one to /remember/open and be
   handed a session, which places orders, without the device key that opens the wrap; and a sign-in that keeps
   itself alive (3.4 to 3.6) would have made that copy worth more. A record filed the old way is re-filed under
   its hash on its next open (handleRemember). ONLY A TOKEN OF THE OLD MINTING'S OWN SHAPE is looked up raw (24
   bytes, 32 characters): a hash read off a copy is 64, so it can never name a record by itself. */
const REM_RAW_RE = /^[A-Za-z0-9_-]{32}$/;
const remKey = async (tok) => "rem:" + (await idOf(tok));
/* the record a token names, where it is filed, and the old raw key it still sits under, if it does */
async function readRem(env, tok) {
  const key = await remKey(tok);
  const rec = await env.STMT.get(key, "json");
  if (rec || !REM_RAW_RE.test(tok)) return { key, rec, raw: null };
  const raw = "rem:" + tok, old = await env.STMT.get(raw, "json");
  return { key, rec: old, raw: old ? raw : null };
}

/* ---- THE MASTER ACCOUNT (v687, his instruction of 18 Sep 2026) --------------------------------
 * /all is his account, and it opens on its own page: Review statement, and the links below it.
 * ONE CHECK AT THE DOOR OF THE WHOLE PREFIX, rather than one per route: a route added under /all
 * later cannot be reachable by forgetting a line, which is the only way this gate has ever been
 * got wrong. /all itself keeps the plain-text refusal, because reaching it unauthenticated means
 * the Access application is gone and that is the one thing he must be told; everything under it
 * answers the same JSON 401 whatever the path, so a probe learns nothing from the difference. An
 * unknown path past the check answers the site's usual 404, byte for byte.
 *
 * WHAT REVIEW READS is `sheet`, written by tools/stmt-publish.mjs from each statement's own rows,
 * merged here with `seen:<username>`, which this Worker has written on every customer open since
 * v499 and nothing has ever read. Codes, never names. */
/* S9 9.1: WHO IS LOCKED OUT, read off the brake itself. fail:<address>:<username> counts the misses from
   one address and lapses fifteen minutes after the last; at MAX_FAILS that address is refused. The address
   never leaves here: Needs you is told how many places are shut out and when the last one opens again.
   S9 fix: THE COUNT IS READ OFF THE LISTING, from the metadata bump writes: one operation a thousand keys, never
   a read a key. Anyone can mint fail: keys for any well-shaped username, and a read each took /all/sheet past the
   Workers' limit on operations in one request. A key from before this carries none and lapses within fifteen
   minutes. */
async function lockedOut(env) {
  const out = new Map();
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "fail:", cursor });
    for (const k of page.keys) {
      if (!(k.metadata && +k.metadata.n >= MAX_FAILS)) continue;
      const u = k.name.slice(k.name.lastIndexOf(":") + 1);
      const until = k.expiration ? new Date(k.expiration * 1000).toISOString() : null;
      const was = out.get(u) || { from: 0, until: null };
      out.set(u, { from: was.from + 1, until: String(until || "") > String(was.until || "") ? until : was.until });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}
/* S9 9.2: how many phones take each account's alerts, off the push records' own keys (push:<username>:<id>) */
async function alertsOn(env) {
  const out = new Map();
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "push:", cursor });
    for (const k of page.keys) { const u = k.name.split(":")[1]; out.set(u, (out.get(u) || 0) + 1); }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}
async function ownerSheet(env, origin) {
  const sheet = await env.STMT.get("sheet", "json");
  const rows = sheet && Array.isArray(sheet.accounts) ? sheet.accounts : [];
  const byUser = new Map(rows.map((a) => [a.username, a]));
  const issue = sheet ? sheet.issue || null : null;
  const month = monthNameOf(issue);
  await keepTicks(env);
  const locks = await lockedOut(env), alerts = await alertsOn(env);
  const out = [];
  for (const a of await roster(env)) {
    const s = byUser.get(a.username) || null;
    const seen = await env.STMT.get("seen:" + a.username, "json");
    const sent = issue ? await env.STMT.get(SENT_KEY(issue, a.username), "json") : null;
    /* v688: everything one card needs. The address is this request's own origin, so nothing has
       to be configured twice, and the message is built from stmt/send.js, the one copy of the
       words the laptop's send sheet uses. The QR is a matrix of 0s and 1s, drawn on the card's
       own canvas, because Share carries a PNG and a PNG needs a canvas. */
    const url = origin + "/?u=" + encodeURIComponent(a.username);
    /* 23 SEP 2026: THERE IS NO ISSUE TO BE MISSING FROM (his question of 23 Sep 2026: "I thought it is a
       continuous and live statement"). Every account carries its whole book to now, so a roster
       code the publish wrote no row for has no ACCOUNT at all: a username the fold minted with
       nothing behind it, which cannot sign in until the laptop mints one (v707). The card said
       "No statement in this issue." over exactly that, which read as a quiet month and hid the one
       fact he needed. The test account is made here and is never in the sheet, so it is not one. */
    const account = !!a.test || !!s;
    out.push({
      code: a.code, username: a.username, test: !!a.test, account,
      issued: s ? s.issued : null, t: s ? s.t : null, flag: s ? s.flag : null,
      url, msg: linkMessage({ url, user: a.username }), tot: s ? totalsLine(s.t) : "",
      qr: QR.qrMatrix(url).map((line) => line.join("")),
      pwMaster: s ? s.pwMaster || null : null,
      seen: seen ? { first: seen.first || null, last: seen.last || null, opens: +seen.opens || 0, how: seen.how || null } : null,
      sent: sent ? sent.at || null : null, locked: locks.get(a.username) || null, alerts: alerts.get(a.username) || 0
    });
  }
  /* S9 9.8: the desk's own count of what waits there, as it last told this site */
  const desk = await env.STMT.get(DESK_WAITING, "json");
  /* D15: the level a stranger is quoted, the ladder's last, so the card of an ID still waiting for its
     account can say which standing link to show. Named by the book through the publish, never here. */
  const names = await env.STMT.get("tiers", "json");
  const stranger = Array.isArray(names) && names.length ? String(names[names.length - 1]) : null;
  return { ok: true, at: sheet ? sheet.at || null : null, issue, month, accounts: out, stranger,
    desk: desk ? { n: +desk.n || 0, at: desk.at || null } : null };
}

/* A TICK IS THE SITE'S, NOT ONE BROWSER'S (v688). The laptop sheet keeps its ticks in that
   browser's storage, so sending half the issue on the phone and half on the laptop meant two
   half-finished lists. This one is a key per account per issue, so both of his devices show the
   same.
   A TICK NO LONGER EXPIRES (his instruction of 23 Sep 2026). It was written to lapse 61 days on,
   when a new issue came every month and started a clean list anyway. The account is one live
   document now and no new issue is sealed (v772), so the issue key never moves and the lapse
   would only have unticked accounts he had handed over, two months after he did. A tick is kept
   until he takes it back; a new sealed issue, which does need sending again, is still a new key,
   and the publish clears the old issue's ticks when one is sealed. */
const SENT_KEY = (issue, u) => "sent:" + issue + ":" + u;
/* The ticks written before this carry the old 61-day lapse, and only a put without one removes
   it. A listing says which do, so each is rewritten once and a listing after that finds none. */
async function keepTicks(env) {
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "sent:", cursor });
    for (const k of page.keys) {
      if (!k.expiration) continue;
      const v = await env.STMT.get(k.name);
      if (v != null) await env.STMT.put(k.name, v);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}

/* ---- MAKING AND UNMAKING THE TEST ACCOUNT (v689) ---------------------------------------------
 * The record is built here, with a key made here, so nothing real is behind it: a bundle of one
 * plain statement, a small price list, and the two wraps a page expects. It opens with the fixed
 * password like any account, orders like any account, and is deleted with everything it wrote:
 * its orders, its opens, its ticks and any phone it subscribed. It is marked `test`, which is how
 * every list leaves it out of a count. */
async function testStatement() {
  const at = new Date().toISOString();
  const body = '<div class="w"><h1>Test account</h1>'
    + '<p class="lead">This account is for trying the page out. Nothing on it is on the book, '
    + "and nothing it orders reaches the ledger.</p>"
    + '<table class="rows"><thead><tr><th class="l">Date</th><th>Quantity</th><th class="r">Amount</th></tr></thead>'
    + '<tbody><tr><td class="l dt">1 September 2026</td><td class="q">1<span class="u">unit</span></td>'
    + '<td class="r">RM 100.00</td></tr></tbody></table></div>';
  return { v: 1, issued: at.slice(0, 10), statements: [{ issued: at.slice(0, 10), label: "Test", body }] };
}
function testPrices() {
  const now = new Date(), day = now.toISOString().slice(0, 10);
  return { at: now.toISOString(), week: { monday: day, sunday: day, label: "this week" }, since: day,
    products: [{ product: "salt", name: "Salt", unit: "unit", basis: "tier", tier: "Silver", levels: 4,
      rate: null, orders: 0, sizes: [{ q: 1, price: 120 }, { q: 2.5, price: 280 }, { q: 5, price: 540 }] }],
    soon: [] };
}
async function makeTest(env) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const ck = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const sealed = async (obj) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, ck, new TextEncoder().encode(JSON.stringify(obj)));
    return { v: 2, iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
  };
  const wrapUnder = async (pass) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const kek = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, raw);
    return { v: 2, salt: b64e(salt), iv: b64e(iv), ct: b64e(new Uint8Array(ct)) };
  };
  const vsalt = crypto.getRandomValues(new Uint8Array(16));
  const vbase = await crypto.subtle.importKey("raw", new TextEncoder().encode(TEST_PASS), "PBKDF2", false, ["deriveBits"]);
  const vbits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: vsalt, iterations: 10000, hash: "SHA-256" }, vbase, 256);
  const bundle = await testStatement();
  const rec = {
    u: TEST_USER, test: true, issued: bundle.issued, issues: [bundle.issued],
    verifier: { salt: b64e(vsalt), hash: b64e(new Uint8Array(vbits)), rounds: 10000 },
    wrap: await wrapUnder(TEST_PASS), env: await sealed(bundle),
    live: Object.assign({ at: new Date().toISOString() }, await sealed({ at: new Date().toISOString(), body: bundle.statements[0].body })),
    prices: Object.assign({ at: new Date().toISOString(), week: testPrices().week.monday }, await sealed(testPrices()))
  };
  if (env.STMT_MASTER) rec.wrapMaster = await wrapUnder(String(env.STMT_MASTER));
  await env.STMT.put(TEST_REC, JSON.stringify(rec));
  return rec;
}
async function unmakeTest(env) {
  const gone = [TEST_REC, "seen:" + TEST_USER];
  for (const pre of ["order:" + TEST_USER + ":", "push:" + TEST_USER + ":", "sent:", devPrefix(TEST_USER)]) {
    let cursor;
    do {
      const page = await env.STMT.list({ prefix: pre, cursor });
      for (const k of page.keys) if (!pre.startsWith("sent:") || k.name.endsWith(":" + TEST_USER)) gone.push(k.name);
      /* S3 3.2: its remembered phones and live sessions, found through their pointers */
      if (pre.startsWith("dev:")) for (const k of page.keys) {
        const at = await env.STMT.get(k.name, "json");
        if (at && /^(rem|sess|ot|ho):/.test(String(at.key))) gone.push(at.key);
        if (at && at.pair) gone.push(at.pair);
      }
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
  }
  for (const k of gone) await env.STMT.delete(k);
  /* S10: and its orders in the order book, where they live on the object road */
  return gone.length + await dropOrders(env, TEST_USER);
}

/* S3 FIX, 24 SEP 2026: SIGN OUT EVERYWHERE, fold 9.4's server half, shipped with the sign-in that no longer ages out
   (3.4 to 3.6), which is what it answers: a forwarded link, a lost or sold phone. Every pointer under the account names
   a remembered phone or a session, and each goes with its pointer; so do the account's push records, since a phone
   signed out stops waking (v692). A phone remembered before pointers and not opened since has none, and ends thirty
   days from its tick (handleRemember). Returns how many phones and sessions it ended. */
/* S9 9.4: AN ACCOUNT'S PHONES AND COMPUTERS, and signing them out. Every pointer under dev:<username>: names what it
   points at (stmt/signin.js): a remembered phone (rem:) or a session (sess:), each a device, named in the site's own
   words when it opened; an unopened sign-in link (ot:) or hand-over (ho:, its code's record beside it as `pair`). A
   remembered phone names the session it opened (`sess`), so the phone is one device and not two. Nothing here is an
   address, and nothing reads or rewrites the account's own u: record, which the publish owns. */
async function pointersOf(env, u) {
  const out = [], pre = devPrefix(u);
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: pre, cursor });
    for (const k of page.keys) {
      const p = await env.STMT.get(k.name, "json");
      if (p && typeof p.key === "string") out.push(Object.assign({}, p, { name: k.name, id: k.name.slice(pre.length) }));
      else await env.STMT.delete(k.name);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}
/* the sessions a remembered phone opened: the newest (`sess`) and the ones before it (`was`) */
const opened = (p) => /^rem:/.test(p.key) ? [p.sess].concat(Array.isArray(p.was) ? p.was : []).filter((x) => typeof x === "string") : [];
function devicesIn(ptrs) {
  const held = new Set([].concat(...ptrs.map(opened)));
  return ptrs.filter((p) => /^(rem|sess):/.test(p.key) && !held.has(p.key))
    .sort((a, b) => String(b.last || b.at || "").localeCompare(String(a.last || a.at || "")));
}
const deviceOut = (p) => ({ label: p.label || null, kind: p.kind || null, at: p.at || null, last: p.last || p.at || null, kept: /^rem:/.test(p.key) });
/* one device ended: its credential, the sessions a remembered phone opened, and the pointers to all of them; and, since
   an S9 fix, the alerts filed from it (a push record names its session and the phone holding it), so a phone signed out
   by its own row stops waking (v692). Returns how many alerts it stopped. */
async function endDevice(env, u, p) {
  await env.STMT.delete(p.key);
  for (const s of opened(p)) { await env.STMT.delete(s); await unpoint(env, u, s); }
  await env.STMT.delete(p.name);
  const mine = [p.key].concat(opened(p));
  let n = 0, cursor;
  do {
    const page = await env.STMT.list({ prefix: "push:" + u + ":", cursor });
    for (const k of page.keys) {
      const r = await env.STMT.get(k.name, "json");
      if (r && (mine.includes(r.dev) || mine.includes(r.sess))) { await env.STMT.delete(k.name); n++; }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return n;
}
/* the account's push records, all but the one a phone keeping its sign-in names */
async function dropPhones(env, u, keepId) {
  let n = 0, cursor;
  do {
    const page = await env.STMT.list({ prefix: "push:" + u + ":", cursor });
    for (const k of page.keys) if (!keepId || k.name !== "push:" + u + ":" + keepId) { await env.STMT.delete(k.name); n++; }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return n;
}
/* S3 FIX, 24 SEP 2026, and S9 9.4: SIGN OUT EVERYWHERE, the answer to a forwarded link or a lost phone. Every device on
   the account is ended, every link and code not yet opened is burnt, and every phone stops taking its alerts, since a
   phone signed out stops waking (v692). `keep` spares the one link his own page made as the account opened and has not
   sent, named by its token's hash, so Send still works after. A phone remembered before pointers and not opened since
   has none, and ends thirty days from its tick (handleRemember). Returns how many devices, links and phones it ended. */
async function signOutEverywhere(env, u, keep) {
  const ptrs = await pointersOf(env, u), devs = devicesIn(ptrs);
  let links = 0, phones = 0;
  for (const p of ptrs) {
    /* S9 fix: a device ends as his one-device Sign out ends it, a remembered phone taking the sessions it names, whose
       own pointers may be missing (written best effort, or not yet in the list) */
    if (/^(rem|sess):/.test(p.key)) { phones += await endDevice(env, u, p); continue; }
    if (keep && p.key === "ot:" + keep && !p.out) continue;
    /* S9 fix: counted only when it has left a page (`out`, POST /all/out) or is a code, which is shown; a link made as an
       account opened and never sent is burnt uncounted, so the answer names what somebody may hold */
    const live = await env.STMT.get(p.key, "json");
    if (live && !live.spent && (p.out || /^ho:/.test(p.key))) links++;
    await env.STMT.delete(p.key);
    if (p.pair) await env.STMT.delete(p.pair);
    await env.STMT.delete(p.name);
  }
  phones += await dropPhones(env, u, null);
  return { devices: devs.length, links, phones, ended: devs.length + links + phones };
}

async function handleRefs(request, env, p, m, origin) {
  if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
  if (!(await identity(request, env))) return json({ ok: false, error: "Access required" }, 401);

  if (p === "/all/refs") {
    /* v696, his instruction of 18 Sep 2026: five links, one per tier. They are ENSURED on the
       listing rather than made on a tap, so the answer to "what are my links" is always exactly
       five and there is nothing to remember. Idempotent: a level that already has one keeps the id
       it was given, because an id handed to a stranger must never change what it opens. */
    if (m === "GET") {
      let names = null;
      try { names = await env.STMT.get("tiers", "json"); } catch (e) { names = null; }
      await ensureStanding(env, names);
      /* the five come back in the LADDER's order, not the order they happened to be minted in:
         he reads them as a ladder, so they are listed as one. Everything else keeps newest first. */
      /* a standing link whose level the book no longer names (Bronze, 23 Sep 2026) goes after the ladder */
      const rank = (r) => (r.standing && Array.isArray(names) && names.indexOf(r.level) >= 0) ? names.indexOf(r.level) : 99;
      const all = (await listRefs(env)).sort((a, b) => rank(a) - rank(b));
      /* v709: the level names ride with the list, so his picker never states what the tiers are
         called: the book decides that and this is the one road it travels. */
      return json({ ok: true, refs: all.map((r) => refOut(origin, r)), tiers: Array.isArray(names) ? names : [] });
    }
    if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    const b = await readJson(request);
    if (!b) return json({ ok: false, error: "send it as application/json" }, 400);
    /* ============ v658, HIS RULE: A LINK NAMES ITS INTRODUCER ============
       It was pinned to tier 1 or tier 2, which were the two boards the desk had. The board is the
       ladder now, and a guest's level is derived from the customer who handed the link out: two
       above them where there is room, else one, capped at the last. So what the route takes is the
       introducer's USERNAME, checked against the roster the publish writes, and the level itself is
       never typed and never stored: the publish computes it from the introducer's tier at that
       moment, so a link follows its introducer up. */
    const introducer = String(b.introducer || "").toLowerCase().trim();
    if (!introducer) return json({ ok: false, error: "a link names the customer who is introducing" }, 400);
    let known = false;
    try {
      const roster = await env.STMT.get("roster", "json");
      known = Array.isArray(roster) && roster.some((x) => String(x.username).toLowerCase() === introducer);
    } catch (e) { known = false; }
    if (!known) return json({ ok: false, error: "no customer on the roster has that username" }, 400);
    const rec = await mintRef(env, { introducer, label: b.label, by: "" });
    if (!rec) return json({ ok: false, error: "could not mint an unused id; try again" }, 500);
    return json({ ok: true, ref: refOut(origin, rec) });
  }
  const mm = /^\/all\/refs\/([^/]+)\/(revoke|restore|approve|decline|level)$/.exec(p);
  if (!mm) return notFound();
  const id = normRef(mm[1]);
  if (!id) return notFound();
  if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
  /* v709: his word on a link an associate minted, and the tier he may change on it. A level he
     does not set leaves it on the v658 rule, where the associate is the introducer: "if need be"
     means it works without him. */
  /* 24 SEP 2026, HIS DECISION D13: DECLINE IS ITS OWN STATE. It wrote approved:false, which IS the
     pending state, so a declined link read "waiting" to the associate for ever and stayed in his queue.
     It keeps approved:false, so the door and the publish, which test that alone, stay shut on it, and
     adds `declined`, which every reader of "waiting" leaves out. Approving it clears the mark. */
  if (mm[2] === "approve" || mm[2] === "decline") {
    const yes = mm[2] === "approve";
    const rec0 = await setRef(env, id, { approved: yes, declined: !yes });
    if (!rec0) return json({ ok: false, error: "no such link" }, 404);
    return json({ ok: true, ref: refOut(origin, rec0) });
  }
  if (mm[2] === "level") {
    const b = await readJson(request);
    const want = b && b.level === null ? null : String((b && b.level) || "");
    let names = null;
    try { names = await env.STMT.get("tiers", "json"); } catch (e) { names = null; }
    /* Ambassador is index 0 and is the floor, never a guest's: a level off the five is refused
       rather than quietly serving the board. */
    if (want !== null && !(Array.isArray(names) && names.indexOf(want) >= 1)) return json({ ok: false, error: "that is not a tier a guest may be quoted" }, 400);
    const rec1 = await setRef(env, id, { level: want });
    if (!rec1) return json({ ok: false, error: "no such link" }, 404);
    return json({ ok: true, ref: refOut(origin, rec1) });
  }
  const rec = await revokeRef(env, id, mm[2] === "revoke");
  if (!rec) return json({ ok: false, error: "no such link" }, 404);
  return json({ ok: true, ref: refOut(origin, rec) });
}

/* The guest's own door. An unknown id, a malformed id and a revoked one all answer with the same
   404, so the space cannot be walked and a withdrawn link cannot be told from one that never
   existed. S8 8.2: that 404 is ONE STYLED PAGE, the board's look and the same words for all, not
   the site's bare "Not found", which left a stranger holding a link with nothing to do. */
const guestHtml = (html, nonce, status) => new Response(html, {
  status,
  headers: Object.assign({
    "content-type": "text/html; charset=utf-8",
    /* script-src 'none' OUTRIGHT, not a nonce: this page is numbers and there is nothing for a
       script to do, so the strongest thing that can be said about it is free to say. */
    "content-security-policy":
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
      + "img-src 'self' data:; font-src 'self'; style-src 'nonce-" + nonce + "'; script-src 'none'"
  }, HEADERS)
});
const guestNonce = () => b64e(crypto.getRandomValues(new Uint8Array(16))).replace(/[^A-Za-z0-9]/g, "");
const shut = () => { const n = guestNonce(); return guestHtml(shutPage(n), n, 404); };
async function handleGuest(request, env, id) {
  if (!env.STMT) return shut();
  const rec = await readRef(env, id);
  /* v709: a link an associate minted is shut until he approves it, from the moment it exists,
     because the id IS the credential and they could hand it out the second they made it. The test
     is `=== false` and never `!approved`: readRef hands back the stored JSON untouched and not one
     link already in the store carries the field, so the loose test would shut every link he has
     ever handed out, and shut it silently, because a pending, a withdrawn and an unknown id all
     answer the same 404 by design. */
  if (!rec || rec.revoked || rec.approved === false) return shut();
  await markOpen(env, rec);
  /* v698: A STANDING LINK READS ITS LEVEL'S BOARD, not one written under its own id. The five are
     minted the first time he opens the Links panel, so one minted since the last publish would have
     had no board of its own and fallen back to board:2, which is the LAST level: four of the five
     would have quoted Bronze until the next deploy. A level's board does not depend on which link
     points at it, so there is nothing to publish per link and minting one can never be wrong.
     v658: a link that names an INTRODUCER still reads its own board, because that one does depend
     on who handed it out. A link minted since the last publish has none yet, and a stranger is
     never left looking at an empty page, so it falls back to the board every stranger sees, which
     is the cap a guest board can never pass. */
  const levelKey = async () => {
    /* v709: keyed on the LEVEL alone. It wanted `standing` too, and setting that on an associate's
       link to make this work would have had ensureStanding adopt it as one of the five he hands to
       strangers. A level is a level whoever minted the link. */
    if (!rec.level) return null;
    try {
      const names = await env.STMT.get("tiers", "json");
      const k = Array.isArray(names) ? names.indexOf(rec.level) : -1;
      return k >= 1 ? "tboard:" + k : null;
    } catch (e) { return null; }
  };
  let prices = null;
  const own = (await levelKey()) || ("gboard:" + rec.id);
  try { prices = await env.STMT.get(own, "json"); } catch (e) { prices = null; }
  if (!prices) { try { prices = await env.STMT.get("board:2", "json"); } catch (e) { prices = null; } }
  const nonce = guestNonce();
  return guestHtml(boardPage({ tier: rec.tier, prices }, nonce), nonce, 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = (url.pathname.replace(/\/+$/, "") || "/");
    const m = request.method;

    /* Generated per request so the inline style and script carry a nonce rather than needing
       'unsafe-inline'. One builder for the customer's door and the owner's. */
    const pageResponse = async (user, owner) => {
      const nonce = b64e(crypto.getRandomValues(new Uint8Array(16))).replace(/[^A-Za-z0-9]/g, "");
      return new Response(landingPage(user, nonce, owner, await readBulletin(env)), {
        headers: Object.assign({
          "content-type": "text/html; charset=utf-8",
          "content-security-policy":
            "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; "
            + "img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; "
            + "style-src 'nonce-" + nonce + "'; script-src 'nonce-" + nonce + "'"
        }, HEADERS)
      });
    };

    /* the guest's board; the id in the path is the whole credential. A path with more after the id is a
       mangled link, and gets the same shut page as any other (S8, 25 Sep 2026). */
    if (p.startsWith("/g/")) {
      const g = /^\/g\/([^/]+)$/.exec(p);
      return g ? handleGuest(request, env, g[1]) : shut();
    }

    /* the master account: the page, the account list, and the links, all behind one check */
    if (p === "/all" || p.startsWith("/all/")) {
      if (!env.STMT) return json({ ok: false, error: "no KV binding" }, 500);
      const who = await identity(request, env);
      if (p === "/all") {
        if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
        /* Said plainly rather than answered with a 404: reaching this unauthenticated means the
           Access application is gone or misconfigured, and that is the one thing he must be told
           rather than left to guess at. Nothing is handed over either way. */
        if (!who) return new Response("This page is behind Cloudflare Access, and this request did not pass it.", {
          status: 401, headers: Object.assign({ "content-type": "text/plain; charset=utf-8" }, HEADERS)
        });
        return pageResponse("", { master: String(env.STMT_MASTER || ""), accounts: await roster(env) });
      }
      if (!who) return json({ ok: false, error: "Access required" }, 401);
      /* the referral links, minted and revoked from inside the Access area only */
      /* 19 SEP 2026: HIS OWN APP. The same manifest the customer's gets, pointed at /all and named
         differently, so his home screen carries the admin page rather than a second copy of the
         customer door. It sits INSIDE the prefix, so it is gated like everything else here and an
         expired Access session refuses it exactly as it refuses the page itself.
         THE DESK'S NAME IS STILL NOWHERE (rule 5): this is the statements site's admin surface and
         is named for that, not for the ledger it reports on. */
      if (p === "/all/manifest.webmanifest") {
        if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
        const own = { name: "Salt Admin", short_name: "Salt Admin", start_url: "/all", scope: "/all",
          display: "standalone", orientation: "portrait", background_color: "#05080a", theme_color: "#05080a",
          icons: [{ src: "/icon-key.png", sizes: ICON_SIZE + "x" + ICON_SIZE, type: "image/png", purpose: "any maskable" }] };
        return new Response(JSON.stringify(own), { headers: Object.assign({}, HEADERS, {
          "content-type": "application/manifest+json; charset=utf-8", "cache-control": "no-store" }) });
      }
      if (p === "/all/refs" || p.startsWith("/all/refs/")) return handleRefs(request, env, p, m, url.origin);
      if (p === "/all/sheet") {
        if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
        return json(await ownerSheet(env, url.origin));
      }
      /* v710: MINT A ONE-TIME SIGN-IN LINK for one account. His page holds the content key already,
         having opened the account under the master, so it wraps that key under a token it minted
         and hands over the token and the wrap. This Worker never sees the key and never stores the
         token, only its hash; the finished words and the code are built HERE so the one copy of the
         message holds. S9 9.3: made as his page opens an account, so its share runs inside the tap; each
         opening files a record, which lapses in three days or is burnt by Sign out everywhere. */
      const sim = /^\/all\/signin\/([^/]+)$/.exec(p);
      if (sim) {
        if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
        const u = normUser(sim[1]);
        if (!u) return notFound();
        const known = (await roster(env)).some((x) => x.username === u);
        if (!known) return json({ ok: false, error: "no account on the roster has that username" }, 400);
        const b = await readJson(request);
        const tok = b && typeof b.token === "string" ? b.token : "";
        if (!(await mintSignin(env, u, tok, b && b.wrap))) return json({ ok: false, error: "send the token and the wrap" }, 400);
        const link = url.origin + "/s/" + tok;
        const issue = await env.STMT.get("issue");
        return json({ ok: true, url: link, msg: signInMessage({ url: link, user: u }),
          qr: QR.qrMatrix(link) });
      }
      /* S3 3.9 AND 3.13: A HAND-OVER FOR A CUSTOMER STANDING AT HIS COUNTER. His page opens the account under the
         master, wraps the content key under a key it mints, and posts { u, token, wrap }, as the Sign-in link does;
         what comes back is the code to read out and the address of the saved app's own page with the key after the
         #, drawn as a QR for their camera. The key never reaches a log: a fragment is never sent. */
      if (p === "/all/handover") {
        if (!env.STMT_HANDOVER_KEY) return noHandover();
        if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
        const b = await readJson(request);
        const u = normUser(b && b.u);
        if (!u || !(await roster(env)).some((x) => x.username === u)) return json({ ok: false, error: "no account on the roster has that username" }, 400);
        const made = await mintHandover(env, u, b.token, b.wrap, true);
        if (!made) return json({ ok: false, error: "send the key and the wrap" }, 400);
        /* S3 fix: the QR's own form, the one key a browser tab spends from its address (stmt/signin.js burnHandover) */
        const link = url.origin + "/app#qr." + made.token;
        return json(Object.assign({ ok: true, url: link, qr: QR.qrMatrix(link).map((line) => line.join("")) }, made));
      }
      /* 24 SEP 2026 (M22): REVIEW OPENS AN ACCOUNT AS ITS OWN PAGE, READ ONLY. An account opened under
         the master has no session, because the owner does not order, so the page read no orders and
         drew "None yet." under a live order form for every account. What their page reads on a
         session, their orders and an associate's own links, is read here instead, behind the one
         Access check at the door of the prefix. Reading only: nothing under this route moves. */
      const om = /^\/all\/orders\/([^/]+)$/.exec(p);
      if (om) {
        if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
        const u = normUser(om[1]);
        if (!u) return notFound();
        const acct = await env.STMT.get("u:" + u, "json");
        if (!acct) return notFound();
        const refs = acct.assoc === true ? (await refsBy(env, u)).map((r) => mineOut(url.origin, r)) : [];
        return json({ ok: true, orders: await ordersOf(env, u), refs, max: MAX_PER_ASSOC });
      }
      /* S9 9.3: AN ACCOUNT'S OWN SCREEN, read as it opens: how they got in, each way in with its moment and the kind
         of device, off the account's seen: record. Reading only. */
      const acm = /^\/all\/account\/([^/]+)$/.exec(p);
      if (acm) {
        if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
        const u = normUser(acm[1]);
        if (!u) return notFound();
        const seen = await env.STMT.get(SKEY(u), "json");
        const log = (seen && Array.isArray(seen.log) ? seen.log : [])
          .map((x) => ({ how: String(x.how || ""), at: x.at || null, where: x.where || null, kind: x.kind || null }));
        /* S9 9.4: and its phones and computers, newest use first, each by its pointer's id for his Sign out */
        const devices = devicesIn(await pointersOf(env, u)).map((d) => Object.assign({ id: d.id }, deviceOut(d)));
        return json({ ok: true, log, devices });
      }
      /* the associates' report card, written by the publish and read only here (v691) */
      if (p === "/all/assoc") {
        if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
        const a = await env.STMT.get("assoc", "json");
        return json({ ok: true, at: a ? a.at || null : null, products: a ? a.products || [] : [] });
      }
      /* the test account: made and unmade with one tap, and counted nowhere (v689) */
      /* S9 fix: A LINK THAT HAS LEFT HIS PAGE, shared or copied, marked on its pointer by the token's hash: Sign out
         everywhere counts it and never spares it. A link already opened has no pointer, and is left alone. */
      if (p === "/all/out") {
        if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
        const b = await readJson(request);
        const u = normUser(b && b.u), id = b && typeof b.id === "string" && /^[0-9a-f]{64}$/.test(b.id) ? b.id : "";
        if (!u || !id) return json({ ok: false, error: "send the username and the link's hash" }, 400);
        const pk = devPrefix(u) + (await idOf("ot:" + id)), ptr = await env.STMT.get(pk, "json");
        const left = ptr ? Math.floor((Date.parse(ptr.at || "") + SIGNIN_TTL * 1000 - Date.now()) / 1000) : 0;
        if (!ptr || ptr.key !== "ot:" + id || !(left > 60)) return json({ ok: true, out: false });
        await env.STMT.put(pk, JSON.stringify(Object.assign(ptr, { out: true })), { expirationTtl: left });
        return json({ ok: true, out: true });
      }
      /* S3 fix: Sign out everywhere, for one account */
      if (p === "/all/signout") {
        if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
        const b = await readJson(request);
        const u = normUser(b && b.u);
        if (!u) return json({ ok: false, error: "send the username" }, 400);
        /* S9 9.4: one of its devices, by the id his list carries, or everything */
        if (b.id != null) {
          const d = devicesIn(await pointersOf(env, u)).find((x) => x.id === String(b.id));
          const phones = d ? await endDevice(env, u, d) : 0;
          return json({ ok: true, devices: d ? 1 : 0, links: 0, phones, ended: (d ? 1 : 0) + phones });
        }
        const keep = typeof b.keep === "string" && /^[0-9a-f]{64}$/.test(b.keep) ? b.keep : "";
        return json(Object.assign({ ok: true }, await signOutEverywhere(env, u, keep)));
      }
      if (p === "/all/test") {
        if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
        const b = await readJson(request);
        if (!b) return json({ ok: false, error: "send JSON" }, 400);
        if (b.make === false) return json({ ok: true, made: false, removed: await unmakeTest(env) });
        await makeTest(env);
        return json({ ok: true, made: true, username: TEST_USER, password: TEST_PASS });
      }
      /* the tick, so both his devices agree on what has gone out */
      const sm = /^\/all\/sent\/([^/]+)$/.exec(p);
      if (sm) {
        if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
        const u = normUser(sm[1]);
        const b = await readJson(request);
        if (!b) return json({ ok: false, error: "send JSON" }, 400);
        const known = (await roster(env)).some((a) => a.username === u);
        if (!u || !known) return notFound();
        const issue = await env.STMT.get("issue");
        if (!issue || String(b.issue || "") !== issue) return json({ ok: false, error: "that is not this issue; reload" }, 409);
        if (b.sent === false) { await env.STMT.delete(SENT_KEY(issue, u)); return json({ ok: true, sent: null }); }
        const at = new Date().toISOString();
        await env.STMT.put(SENT_KEY(issue, u), JSON.stringify({ at }));
        return json({ ok: true, sent: at });
      }
      return notFound();
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
    /* ---- SAVED AS AN APP (v693, his instruction of 18 Sep 2026) -------------------------------
       The site had no manifest and no icon, so adding it to a home screen gave a screenshot with
       no name. These two are the whole of it, served from the Worker because there are no assets:
       a neutral tile and a name that says what the page is and not whose it is. */
    /* THE BRAND FACES (22 Sep 2026): the two font files the page's @font-face names, as bytes from
       stmt/fonts.js, because this Worker serves no files. A year of cache: a font file is immutable,
       and a new face would be a new name. */
    if (p.startsWith("/fonts/")) {
      if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
      const b64 = FONTS[p.slice(7)];
      if (!b64) return notFound();
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: Object.assign({}, HEADERS, {
        "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable" }) });
    }
    /* S9 9.7: Salt Admin's own icon, the ring with a keyhole (his D13). Outside /all on purpose: a home screen
       fetches an icon without the Access cookie, and a ring names nothing. */
    if (p === "/icon.png" || p === "/icon-key.png") {
      if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
      const bytes = Uint8Array.from(atob(p === "/icon.png" ? ICON_PNG_B64 : ADMIN_ICON_PNG_B64), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: Object.assign({}, HEADERS, {
        "content-type": "image/png", "cache-control": "public, max-age=86400" }) });
    }
    if (p === "/manifest.webmanifest") {
      if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
      const mf = {
        /* v704, HIS INSTRUCTION OF 18 SEP 2026: the user-facing name is SALT COUNTER. It went
           Order Salt, then The Counter on his word that it be app-worthy, and now his own name for
           it, which keeps the counter and puts the trade back in front of it. Twelve characters
           exactly, which is what iOS gives a home screen.
           THE PRODUCT WORD IS HIS TO SPEND HERE AND NOWHERE ELSE. Inside the page a product is
           still a mark and never a word (v695); this is the app's name, the one place on the site
           where something has to be called something. What never appears is the DESK's name, Salt
           Command, which is a different rule and still holds. */
        /* S3 3.11 (his D2): the saved app starts at /app, the Counter's own page in app mode. S3 fix: `id` holds the
           identity the old start_url gave every copy installed before (the site's root), or a browser would take the
           moved start_url for a new app and stop updating those */
        id: "/", name: "Salt Counter", short_name: "Salt Counter", start_url: "/app", scope: "./",
        display: "standalone", orientation: "portrait", background_color: "#05080a", theme_color: "#05080a",
        icons: [{ src: "icon.png", sizes: ICON_SIZE + "x" + ICON_SIZE, type: "image/png", purpose: "any maskable" }]
      };
      return new Response(JSON.stringify(mf), { headers: Object.assign({}, HEADERS, {
        "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=86400" }) });
    }
    if (p === "/push/key") return json({ ok: true, key: env.STMT_VAPID_PUBLIC_KEY || null, configured: !!(env.STMT_VAPID_PUBLIC_KEY && env.STMT_VAPID_PRIVATE_JWK) });
    if (p === "/remember/open") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      return handleRemember(request, env);
    }
    /* v710: the one-time link, opened */
    if (p === "/open-link") {
      if (m !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
      return handleSignin(request, env);
    }
    /* S3 3.9: the hand-over, minted on a session and opened by its key or its code */
    if (p === "/handover" || p === "/handover/open") return handleHandover(request, env, p, m);
    if (p === "/orders" || p.startsWith("/orders/") || p === "/push/subscribe" || p === "/remember" || p === "/logout" || p === "/account"
      || p === "/devices" || p === "/devices/signout" || p === "/push/unsubscribe") return handleCustomer(request, env, p, m);
    /* v709: an associate's own links, on a session like the orders, and never under /all */
    if (p === "/my/refs" || p.startsWith("/my/refs/")) return handleMyRefs(request, env, p, m, url.origin);
    if (p === "/desk/orders" || p.startsWith("/desk/orders/") || p === "/desk/bulletin" || p === "/desk/waiting") return handleDesk(request, env, p, m);
    /* the notice, in the clear, for the page's poll; anything past it is still the site's 404 */
    if (p === "/bulletin") {
      if (m !== "GET") return json({ ok: false, error: "method not allowed" }, 405);
      return json(Object.assign({ ok: true }, await readBulletin(env)));
    }
    /* v710: THE LINK SERVES THE ORDINARY DOOR, whatever the token is. The page reads the token off
       its own address and posts it; an expired or invented one lands the reader on the door rather
       than a 404, so nobody is stranded and the page is not a probe for which tokens exist. The
       difference is kept to the JSON route's one refusal.
       IT IS THE SHAPE THAT OPENS THE ROUTE, NOT THE TOKEN: `SIGNIN_RE` and nothing else, so the
       site's rule that an unknown path is a 404 still holds for every path that could never have
       been a link. The shape is no secret, being minted by the page this route serves. */
    const sLink = p.startsWith("/s/") && SIGNIN_RE.test(p.slice(3));
    if (sLink) {
      if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
      return pageResponse("", null);
    }
    /* S3 3.11: THE SAVED APP'S START, the Counter's own page; it knows it is the app by its own address */
    if (p === "/app") {
      if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);
      return pageResponse("", null);
    }
    if (p !== "/") return notFound();
    if (m !== "GET" && m !== "HEAD") return json({ ok: false, error: "method not allowed" }, 405);

    /* The QR carries ?u=<username>; anything else in the query is ignored, and a username that
       does not parse is simply not filled in. */
    return pageResponse(normUser(url.searchParams.get("u")), null);
  },

  /* ---- THE CHASE (v700; S12 12.3, his decision D5 of 24 Sep 2026) ------------------------------
   * The first clock this Worker ever had. An advance is the book's own word for goods out ahead of
   * the money (isAdvance, as the engine reads it). TWICE A DAY, at 10:00 and 18:00 in Kuala Lumpur
   * (chaseSlot: the cron stays hourly and this decides), from the day after the handover, paused
   * while a claim waits and stopped when what was received is paid: toChase in stmt/orders.js. One
   * wake a slot per CUSTOMER, not per order: two unpaid advances are one person's problem and one
   * banner, in its own words, "A payment is due", and a tap opens the oldest order it is about.
   *
   * THE MARK IS THE SLOT'S HOUR ITSELF, not a timestamp to subtract from: `chased:<username>` holds
   * the hour bucket it was last woken in, so a tick that fires twice inside one hour cannot wake the
   * same person twice. It lapses after two hours, so a customer who settles up leaves nothing behind.
   * S10: it lives where the orders live, in the order book on the object road and in KV on the KV
   * road, read and written in one step by markChased.
   *
   * IT IS SILENT ON FAILURE BY DESIGN, like every other push path here, so the counts are LOGGED:
   * a wake that reaches nobody and a wake that was not needed look identical from outside.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        if (!env.STMT) return;
        /* S10 10.3: THE WEEK OF READING BOTH, hourly, before the chase and apart from it (checkStores) */
        if (readsBoth(env)) {
          try { console.log("orderbook check: " + JSON.stringify(await checkStores(env))); }
          catch (e) { console.log("orderbook check FAILED: " + String((e && e.stack) || e)); }
        }
        const now = new Date(event && event.scheduledTime ? event.scheduledTime : Date.now());
        const slot = chaseSlot(now);
        if (slot === null) return;
        let woke = 0, held = 0, quiet = 0;
        for (const { u, orders } of await toChase(env, now)) {
          /* his own test account is counted nowhere, and that includes being chased */
          if (u === TEST_USER) continue;
          /* S10: the mark is read and written in one step, where the orders live (markChased); S12: it is the slot's */
          if (!(await markChased(env, u, slot))) { held++; continue; }
          const r = await wakeCustomer(env, u, { k: "due", o: orders[orders.length - 1].id });
          if (r.sent) woke++; else quiet++;
        }
        if (woke || held || quiet) console.log("chase: " + JSON.stringify({ slot, woke, held, quiet }));
      } catch (e) {
        console.log("chase FAILED: " + String((e && e.stack) || e));
      }
    })());
  }
};
