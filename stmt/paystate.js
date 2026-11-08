/* stmt/paystate.js: WHICH OF HIS ACCOUNTS QR COMMAND HAS UNDER MAINTENANCE NOW (his instruction of 17 Oct 2026).
 *
 * stmt/pay.js carries each account's `maintenance` flag as it stood at the last `paysync --sync`. QR Command also suspends an
 * account live, from its /admin, written to its KV and served at its public, no-store /state.json as {maintenance: {<key>: bool}},
 * with no deploy behind it; its own phone consults that FIRST and the baked flag only for a key it says nothing about. The Counter
 * reads the same file, through the service binding QRCMD (a Worker cannot fetch another on workers.dev by its address), and applies
 * the same precedence, so an account QR Command will not draw a code for is never offered on the pay sheet.
 *
 * Only a real boolean against a key stmt/pay.js names is taken; anything else in the file is ignored. An unbound service, a miss,
 * a slow or malformed answer gives null, and the baked flags stand: QR Command's own page still refuses a suspended code.
 * Nothing here imports anything but the generated rails.
 */
import { PAY_ACCOUNTS } from "./pay.js";

export const STATE_WAIT_MS = 1500;
export const MAX_BYTES = 1048576;   /* an answer over a megabyte is refused: the binding is not trusted with more than the file ever holds */
export const PAYDOWN_KEY = "paydown";
const DOWN_KEEP_MS = 3 * 864e5, DOWN_REFILE_MS = 6 * 36e5;

/** {key: bool} for every account stmt/pay.js names, the live word winning over the baked flag; null when the live state is unreadable. */
export function downOf(state, list = PAY_ACCOUNTS) {
  const m = state && typeof state === "object" ? state.maintenance : null;
  if (!m || typeof m !== "object" || Array.isArray(m)) return null;
  const out = {};
  for (const a of list) {
    const live = Object.prototype.hasOwnProperty.call(m, a.key) && typeof m[a.key] === "boolean" ? m[a.key] : null;
    out[a.key] = live === null ? a.maintenance === true : live;
  }
  return out;
}

/** The rails with today's flags: PAY_ACCOUNTS as it is when `down` is null. */
export function liveAccounts(down, list = PAY_ACCOUNTS) {
  return down ? list.map((a) => Object.assign({}, a, { maintenance: down[a.key] === true })) : list;
}

/** QR Command's live state through the QRCMD binding, as downOf reads it; null on any failure. */
export async function payDown(env) {
  if (!env || !env.QRCMD || typeof env.QRCMD.fetch !== "function") return null;
  try {
    const r = await env.QRCMD.fetch("https://qr-command/state.json", { headers: { "cache-control": "no-store" }, signal: AbortSignal.timeout(STATE_WAIT_MS) });
    if (!r.ok || tooBig(r)) return null;
    const t = await r.text();
    return t.length > MAX_BYTES ? null : downOf(JSON.parse(t));
  } catch (e) { return null; }
}

/** true when a response says, by content-length, that its body is over the cap. */
export function tooBig(r) {
  const n = Number(r && r.headers && typeof r.headers.get === "function" ? r.headers.get("content-length") : NaN);
  return Number.isFinite(n) && n > MAX_BYTES;
}

/** THE LAST FRESH WORD IS KEPT (06 Nov 2026, Fable): a suspension he made live must hold while /state.json cannot be read, so each fresh read is filed in KV
 *  `paydown` ({v, at, down}), and when the read fails the effective flags are the baked ones OR what the last fresh read said was down, for three days at most.
 *  A stored word may add a suspension and never lift one; with none stored the baked flags stand. {fresh, effective}: fresh is what a customer is told as `down`
 *  (null when the read failed), effective the flags to draw by (null: the baked flags as they are). */
export async function payDownKept(env, now = Date.now(), list = PAY_ACCOUNTS) {
  const fresh = await payDown(env);
  if (fresh) {
    try {
      const prev = await env.STMT.get(PAYDOWN_KEY, "json");
      const same = prev && prev.v === 1 && JSON.stringify(prev.down) === JSON.stringify(fresh) && typeof prev.at === "number" && now - prev.at < DOWN_REFILE_MS;
      if (!same) await env.STMT.put(PAYDOWN_KEY, JSON.stringify({ v: 1, at: now, down: fresh }));
    } catch (e) { /* a word that cannot be filed is no reason to refuse the read */ }
    return { fresh, effective: fresh };
  }
  try {
    const rec = await env.STMT.get(PAYDOWN_KEY, "json");
    if (rec && rec.v === 1 && typeof rec.at === "number" && now - rec.at < DOWN_KEEP_MS && rec.at - now < 6e4 && rec.down && typeof rec.down === "object") {
      const eff = {};
      for (const a of list) eff[a.key] = a.maintenance === true || rec.down[a.key] === true;
      return { fresh: null, effective: eff };
    }
  } catch (e) { /* none stored */ }
  return { fresh: null, effective: null };
}
