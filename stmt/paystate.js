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
    if (!r.ok) return null;
    return downOf(await r.json());
  } catch (e) { return null; }
}
