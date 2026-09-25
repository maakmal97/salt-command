/* stmt/access.js: WHO PASSED CLOUDFLARE ACCESS, verified rather than assumed.
 *
 * His instruction of 10 Sep 2026: the owner opens any statement from a list, and Zero Trust is
 * what proves he is the owner. Everything under /all is covered by an Access application on this
 * hostname; this module is the second lock behind it.
 *
 * THE GATE IS THE TOKEN, NOT THE HEADER. Access injects Cf-Access-Jwt-Assertion on every request
 * that passed the application, and the page's own fetches carry the CF_Authorization cookie. Both
 * are read and neither is believed: the JWT is verified here, RS256 against the team's published
 * keys, with the issuer, the audience and the expiry checked. The presence of a header would not
 * do, because a misconfigured or deleted Access application is exactly the case in which a
 * stranger reaches the route carrying a header of his own. The same argument, and the same
 * function, as the QR Command admin route.
 *
 * FAIL CLOSED. With ACCESS_TEAM or ACCESS_AUD unset, every gated route answers 401 and hands over
 * nothing, so this deploys safely before the Access application exists. That matters more here
 * than it did on QR Command: what stands behind this gate is STMT_MASTER, the one passphrase that
 * opens every account.
 *
 * NO IMPORT. Only a sibling will do, and this file needs none: the suite holds every file under
 * stmt/ to that rule, and a Worker has no filesystem to reach for anyway.
 */

function b64url(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* THE TEAM'S KEYS ARE KEPT FOR AN HOUR, per issuer and key id, in this isolate (the plan's 2.6,
 * 26 Sep 2026). Only the public key is remembered: every request still verifies its own signature
 * and checks the issuer, the audience and the expiry, so a kept key admits nothing a fresh fetch
 * would refuse. Access rotates its signing key every six weeks and honours the previous one for
 * seven days after, so an hour opens no window the platform does not already leave. A key id not
 * kept, or kept past the hour, fetches the certs once and keeps every RSA key in them, so the
 * previous key is warm too; a key id still missing after that fetch is nobody. */
const KEY_TTL_MS = 60 * 60 * 1000;
const KEYS = new Map();   /* issuer + "|" + kid -> { key: CryptoKey, at: ms } */

async function teamKey(iss, kid) {
  const now = Date.now();
  const kept = KEYS.get(iss + "|" + kid);
  if (kept && now - kept.at < KEY_TTL_MS) return kept.key;
  const certs = await (await fetch(iss + "/cdn-cgi/access/certs")).json();
  for (const [id, e] of KEYS) if (now - e.at >= KEY_TTL_MS) KEYS.delete(id);
  let found = null;
  for (const jwk of (certs && certs.keys) || []) {
    if (!jwk || jwk.kty !== "RSA" || !jwk.kid) continue;
    let key;
    try {
      key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    } catch (e) {
      continue;   /* one malformed key in the list spoils none of the others */
    }
    KEYS.set(iss + "|" + jwk.kid, { key, at: now });
    if (jwk.kid === kid) found = key;
  }
  return found;
}

function cookie(request, name) {
  const all = request.headers.get("cookie") || "";
  for (const part of all.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return "";
}

/** Who passed Access, as {email}, or null. Never throws: a malformed token, an unreachable key
 *  server and an unset variable all read as "nobody", which is the answer that opens nothing. */
export async function identity(request, env) {
  const team = String((env && env.ACCESS_TEAM) || "").trim();
  const aud = String((env && env.ACCESS_AUD) || "").trim();
  if (!team || !aud) return null;
  const token = request.headers.get("cf-access-jwt-assertion") || cookie(request, "CF_Authorization");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(b64url(parts[0])));
    const claims = JSON.parse(dec.decode(b64url(parts[1])));
    const iss = "https://" + team + ".cloudflareaccess.com";
    const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== "RS256" || claims.iss !== iss || !auds.includes(aud)) return null;
    if (typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) return null;
    if (typeof header.kid !== "string" || !header.kid) return null;
    const key = await teamKey(iss, header.kid);
    if (!key) return null;
    const good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]));
    return good ? { email: String(claims.email || "") } : null;
  } catch (e) {
    return null;
  }
}
