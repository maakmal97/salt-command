/* push.js — Web Push out of the Worker, VAPID-signed and DELIBERATELY PAYLOAD-FREE.
 *
 * WHY NO PAYLOAD. A Web Push payload has to be encrypted per RFC 8291 (ECDH to the
 * subscription's own p256dh key, HKDF, aes128gcm), which is a lot of fiddly crypto to get
 * exactly right in a Worker, and the text it carries goes stale between being sent and being
 * read. A payload-free push still WAKES the service worker, which then reads the live state
 * and writes the notification itself. Less code, and the banner always says what is true now
 * rather than what was true when the push was queued.
 *
 * THE VAPID HALF IS STILL REQUIRED. A push service will not accept an anonymous POST: it wants
 * a JWT signed by the key whose public half the subscription was created with. That is what
 * this file does, and it is the whole of the crypto here.
 *
 * SUBSCRIPTIONS ARE PRUNED ON 404 AND 410. A push endpoint dies when the app is uninstalled or
 * the browser rotates it, and it answers "gone" for ever after. Keeping a dead endpoint means
 * every later send does pointless work and the failure count never returns to zero, which
 * teaches you to ignore it. So a gone endpoint is deleted on the spot.
 */

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/* The private half is stored as a JWK because importKey takes it directly; a raw PKCS8 blob
   would need base64 wrangling in the secret and buys nothing. */
async function signingKey(env) {
  const raw = env.VAPID_PRIVATE_JWK;
  if (!raw) return null;
  let jwk;
  try { jwk = JSON.parse(raw); } catch { return null; }
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/* One JWT per push ORIGIN, not per subscription: `aud` is the origin of the endpoint, so every
   subscription on the same push service shares a token. Cached for the length of one send. */
async function vapidToken(env, key, origin) {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(new TextEncoder().encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,   // 12h; the spec caps it at 24
    sub: env.VAPID_SUBJECT || "mailto:salt@salt-command.invalid",
  })));
  const data = new TextEncoder().encode(`${header}.${body}`);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data);
  return `${header}.${body}.${b64url(sig)}`;
}

export async function listSubs(env) {
  if (!env.SALT_QUEUE) return [];
  const out = [];
  let cursor;
  do {
    const page = await env.SALT_QUEUE.list({ prefix: "push:", cursor });
    for (const k of page.keys) {
      const v = await env.SALT_QUEUE.get(k.name);
      if (!v) continue;
      try { out.push({ key: k.name, ...JSON.parse(v) }); } catch { /* a corrupt record is skipped, not fatal */ }
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out;
}

/* `tag` collapses a banner rather than stacking one per send: a second "row waiting" replaces
   the first instead of queueing behind it. The service worker reads it back off the wake. */
export async function sendPush(env, { tag = "salt", urgency = "normal" } = {}) {
  const key = await signingKey(env);
  if (!key) return { ok: false, error: "no VAPID_PRIVATE_JWK", sent: 0 };
  const pub = env.VAPID_PUBLIC_KEY;
  if (!pub) return { ok: false, error: "no VAPID_PUBLIC_KEY", sent: 0 };

  const subs = await listSubs(env);
  if (!subs.length) return { ok: true, sent: 0, note: "nobody is subscribed" };

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
          Urgency: urgency,
          Topic: tag.slice(0, 32),
          Authorization: `vapid t=${tokens.get(origin)}, k=${pub}`,
          "Content-Length": "0",
        },
      });
    } catch { failed++; continue; }
    if (r.status === 404 || r.status === 410) {
      await env.SALT_QUEUE.delete(s.key);   // dead for ever; do not keep asking
      gone++;
    } else if (r.ok || r.status === 201) sent++;
    else failed++;
  }
  return { ok: true, sent, gone, failed, subscribers: subs.length };
}
