/* stmt/push.js: WEB PUSH TO A CUSTOMER'S PHONE, VAPID-signed and payload-free.
 *
 * A COPY OF THE DESK'S SENDER (src/push.js), NOT AN IMPORT OF IT. The statements site may import
 * only a sibling file: nothing under stmt/ reaches into src/ or tools/, and the suite proves it.
 * The signing is fifty lines of standard crypto that has not changed since it was written, so
 * a second copy costs less than the first crack in that wall would. Keep the two the same.
 *
 * WHY NO PAYLOAD, in one line: a payload has to be encrypted per RFC 8291, and the text goes
 * stale between being sent and being read. The push is a WAKE. The service worker this site
 * serves at /sw.js shows a fixed banner, "your order has an update, open your statement page",
 * and says nothing else: it holds no session and reads nothing, so it cannot leak an amount, a
 * status or a username onto a lock screen.
 *
 * THE KEYS ARE THE SITE'S OWN. STMT_VAPID_PRIVATE_JWK (a secret) and STMT_VAPID_PUBLIC_KEY (a var)
 * on THIS Worker, minted by tools/stmt-setup.mjs; the desk's pair is never reused here, because a
 * subscription is bound to the key it was created with and the two sites must not be able to
 * wake each other's phones.
 *
 * A subscription is push:<username>:<hash of the endpoint>, so one customer's phones are listed
 * with one prefix and the endpoint, a capability URL, is not in the key name. Gone endpoints
 * (404, 410) are deleted on the spot.
 */

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function signingKey(env) {
  const raw = env.STMT_VAPID_PRIVATE_JWK;
  if (!raw) return null;
  let jwk;
  try { jwk = JSON.parse(raw); } catch { return null; }
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function vapidToken(env, key, origin) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.STMT_VAPID_SUBJECT || "mailto:salt@salt-command.invalid",
  })));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${header}.${body}.${b64url(sig)}`;
}

const unb64url = (s) => {
  const t = s.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));
};

/* S12 12.1 (24 Sep 2026): A SUBSCRIPTION KEEPS ITS ENCRYPTION KEYS. The phone hands them over with the
   endpoint (RFC 8291): `p256dh`, its P-256 public key, and `auth`, sixteen secret bytes. Only with both can a
   wake carry words the phone alone can read. Anything else is dropped, never refused: a record with no keys
   still wakes the phone, as every record did before. */
export function pushKeys(k) {
  if (!k || typeof k.p256dh !== "string" || typeof k.auth !== "string") return null;
  if (!/^[A-Za-z0-9_-]{16,120}=*$/.test(k.p256dh) || !/^[A-Za-z0-9_-]{16,40}=*$/.test(k.auth)) return null;
  try {
    const p = unb64url(k.p256dh), a = unb64url(k.auth);
    return p.length === 65 && p[0] === 4 && a.length === 16 ? { p256dh: k.p256dh, auth: k.auth } : null;
  } catch { return null; }
}

/** The hash that names a subscription: the first twelve bytes of SHA-256 over the endpoint, as hex. */
export async function endpointId(endpoint) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(endpoint)));
  return [...new Uint8Array(h)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* v761: `u` is optional. With one, this customer's phones; without, EVERY phone on the site, which
   is what a notice to everybody needs. The prefix is the whole of the difference. */
export async function listSubs(env, u) {
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: u ? "push:" + u + ":" : "push:", cursor });
    for (const k of page.keys) {
      const v = await env.STMT.get(k.name);
      if (!v) continue;
      try { out.push({ key: k.name, ...JSON.parse(v) }); } catch { /* a corrupt record is skipped */ }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

/** Wake every phone one customer has subscribed. Never throws: a banner is not worth an error path. */
export async function wakeCustomer(env, u) { return wake(env, u, "salt-order"); }
/* v761: AND EVERY PHONE ON THE SITE, for a notice that is for everybody. Same send, same clearing
   of a subscription the service has given up on, a different collapsing topic so a notice does not
   replace an order's banner on the lock screen and neither replaces the other. */
export async function wakeEveryone(env) { return wake(env, null, "salt-notice"); }
async function wake(env, u, topic) {
  try {
    const key = await signingKey(env);
    const pub = env.STMT_VAPID_PUBLIC_KEY;
    if (!key || !pub) return { ok: false, error: "push is not configured", sent: 0 };
    const subs = await listSubs(env, u);
    if (!subs.length) return { ok: true, sent: 0 };
    const tokens = new Map();
    let sent = 0, gone = 0, failed = 0;
    for (const s of subs) {
      let origin;
      try { origin = new URL(s.endpoint).origin; } catch { failed++; continue; }
      if (!tokens.has(origin)) tokens.set(origin, await vapidToken(env, key, origin));
      let r;
      try {
        r = await fetch(s.endpoint, {
          method: "POST",
          headers: {
            TTL: "3600",
            Urgency: "high",
            Topic: topic,
            Authorization: `vapid t=${tokens.get(origin)}, k=${pub}`,
            "Content-Length": "0",
          },
        });
      } catch { failed++; continue; }
      if (r.status === 404 || r.status === 410) { await env.STMT.delete(s.key); gone++; }
      else if (r.ok || r.status === 201) sent++;
      else failed++;
    }
    return { ok: true, sent, gone, failed };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), sent: 0 };
  }
}
