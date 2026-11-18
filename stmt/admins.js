/* stmt/admins.js: WHO MAY OPEN SALT ADMIN, AND HOW (his word of 17 Nov 2026).
 *
 * "The entry to Salt Admin now comes from Salt Counter first. Just like all my customers, I will need an account." An admin is an
 * ordinary Counter account, signed in at the Counter's own door with its username and password, whose code is an admin code
 * (A, then the initial and the length of the name, then the place: AA10-KUL is his) and whose tier is filed in the committed
 * statements/_admins.json, codes only, never a name. Tier 1 is the owner, one account and no more; tier 2 is staff, whose access
 * is his to decide later, so a tier 2 account is recognised and let into nothing yet.
 *
 * AN ADMIN IS NOT A PARTY OF THE BOOK. The code is in no roster and on no row, so no price, count or reading moves for it, and its
 * account places no order, sends no claim and joins no group order (the Worker refuses each).
 *
 * THE DOOR TO /all (his word of 18 Nov 2026: ONE SIGN-IN KEEPS SALT ADMIN OPEN ON THAT BROWSER FOR 12 HOURS). A tier 1 account's live
 * PASSWORD session, at POST /admin/enter, mints a key for this browser, filed only as its hash at adm:<sha256> for twelve hours
 * (ADMIN_TTL) and set as an HttpOnly cookie on /all alone. That record holds the door: the fifteen-minute password session is
 * needed only to mint it, never to keep it. With ADMIN_DOOR on, /all opens only for a request holding that key AND the owner's
 * verified Access token (checked on every request), and only while the account's published record is still tier 1.
 * WHAT CLOSES IT: the twelve hours running out; the Counter's Log out (every key of the account, through its pointers); Leave
 * (POST /all/leave, this browser's key); Sign out everywhere (POST /all/signout); the account losing tier 1 at a publish.
 * A device signed out from Account (POST /devices/signout) does not end it: a key is tied to a browser's cookie, not to a device row.
 * With it off (the value it ships with), /all is as before and the Counter's road is tried beside it.
 * ADMIN_DOOR MAY BE TURNED ON once he has signed in once: his maintenance switch is now the notice at the door and a stop on customers
 * signing in (stmt/maintenance.js), and an admin account signs in, reaches /admin and /all as normal under it. MAINTENANCE_UNTIL, the
 * deploy's complete block, still holds /admin and the sign-in roads with everything else.
 *
 * NO IMPORT. Only a sibling would do and this file needs none.
 */

export const ADMIN_TIERS = Object.freeze({ owner: 1, staff: 2 });
export const ADMIN_CODE_RE = /^A[A-Z]{1,4}[0-9]{1,2}-[A-Z]{2,4}$/;
export const ADMIN_COOKIE = "salt_adm";
export const ADMIN_TTL = 12 * 3600;
export const ADMIN_KEY_RE = /^[A-Za-z0-9_-]{32}$/;

/** The tier a published record carries in the clear (1 or 2), or 0 for every other account. */
export const adminTier = (rec) => (rec && (rec.admin === 1 || rec.admin === 2) ? rec.admin : 0);

/** The committed map {code: tier}, checked: an admin code's shape, a tier of 1 or 2, and one owner at most. Throws on anything else. */
export function adminMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error("statements/_admins.json is an object of code to tier");
  const out = {};
  for (const [code, tier] of Object.entries(map)) {
    if (!ADMIN_CODE_RE.test(code)) throw new Error("statements/_admins.json: " + code + " is not an admin code (A, initial, length, dash, place)");
    if (tier !== 1 && tier !== 2) throw new Error("statements/_admins.json: " + code + " has tier " + JSON.stringify(tier) + "; a tier is 1 (owner) or 2 (staff)");
    out[code] = tier;
  }
  const owners = Object.keys(out).filter((c) => out[c] === 1);
  if (owners.length > 1) throw new Error("statements/_admins.json names more than one tier 1 account: " + owners.join(", "));
  return out;
}

/** Whether ADMIN_DOOR is on: "1" alone. */
export const doorOn = (env) => String((env && env.ADMIN_DOOR) || "").trim() === "1";

export function cookieOf(request, name) {
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

export const enterCookie = (key) => ADMIN_COOKIE + "=" + key + "; Path=/all; Max-Age=" + ADMIN_TTL + "; HttpOnly; Secure; SameSite=Lax";
export const leaveCookie = () => ADMIN_COOKIE + "=; Path=/all; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
