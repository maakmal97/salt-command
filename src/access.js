const ADMIN_EMAIL = "maakmal97@icloud.com";
const KEY_TTL_MS = 60 * 60 * 1000;
const KEYS = new Map();

function b64url(value) {
  value = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (value.length % 4) value += "=";
  const bytes = atob(value), out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return out;
}

function cookie(request, name) {
  const all = request.headers.get("cookie") || "";
  for (const part of all.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

async function teamKey(issuer, kid) {
  const now = Date.now(), cacheKey = issuer + "|" + kid, kept = KEYS.get(cacheKey);
  if (kept && now - kept.at < KEY_TTL_MS) return kept.key;
  const response = await fetch(issuer + "/cdn-cgi/access/certs");
  if (!response.ok) return null;
  const certs = await response.json();
  for (const [key, entry] of KEYS) if (now - entry.at >= KEY_TTL_MS) KEYS.delete(key);
  let found = null;
  for (const jwk of (certs && certs.keys) || []) {
    if (!jwk || jwk.kty !== "RSA" || typeof jwk.kid !== "string" || !jwk.kid) continue;
    try {
      const key = await crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
      KEYS.set(issuer + "|" + jwk.kid, { key, at: now });
      if (jwk.kid === kid) found = key;
    } catch (e) {
      continue;
    }
  }
  return found;
}

async function verifiedClaims(request, env) {
  const team = String((env && env.ACCESS_TEAM) || "").trim();
  const aud = String((env && env.ACCESS_AUD) || "").trim();
  if (!team || !aud) return null;
  const token = request.headers.get("cf-access-jwt-assertion") || cookie(request, "CF_Authorization");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(b64url(parts[0])));
    const claims = JSON.parse(decoder.decode(b64url(parts[1])));
    const issuer = "https://" + team + ".cloudflareaccess.com";
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== "RS256" || claims.iss !== issuer || !audiences.includes(aud)) return null;
    if (typeof claims.exp !== "number" || claims.exp <= Date.now() / 1000) return null;
    if (typeof header.kid !== "string" || !header.kid) return null;
    const key = await teamKey(issuer, header.kid);
    if (!key) return null;
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1]));
    return valid ? claims : null;
  } catch (e) {
    return null;
  }
}

export async function ownerAccess(request, env) {
  const claims = await verifiedClaims(request, env);
  return !!claims && typeof claims.email === "string" && claims.email.trim().toLowerCase() === ADMIN_EMAIL;
}

/* CI's Access service token. Access puts its client id in `common_name` and leaves `email` out
   and `sub` empty; the client id is configured, never read from a request header. */
export async function ciAccess(request, env) {
  const id = String((env && env.ACCESS_CI_CLIENT_ID) || "").trim();
  if (!id) return false;
  const claims = await verifiedClaims(request, env);
  return !!claims && claims.common_name === id && claims.sub === "" && claims.email === undefined;
}
