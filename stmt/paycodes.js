/* stmt/paycodes.js: WHAT THE PAY SHEET NEEDS TO SHOW A CUSTOMER, FETCHED FROM SALT QR OUT OF THEIR SIGHT (his rule of 06 Nov 2026:
 * customers stay on Salt Counter and never learn Salt QR exists; plan draft 5, P1).
 *
 * Salt QR's public /data.js holds, per account, the DuitNow payload, the account number, the bank and the JomPAY biller code and
 * Ref-1. The Counter's Worker reads that file through the service binding QRCMD (a Worker cannot fetch another on workers.dev by its
 * address, and the customer's browser never contacts Salt QR), keeps SIX fields of each account the sheet needs and no more, and
 * answers them on a customer's session at GET /pay/accounts (stmt/worker.js), per rail.
 *
 *   - The file is read the way Salt QR's own build writes it (`self.QR_CODES = [...];` then `self.QR_BUILD`), the array taken with that
 *     anchor and JSON.parse: never eval, never a script run.
 *   - Only the keys stmt/pay.js names, and only {key, payload, acct, bank, biller, ref1}: owner, group, member number and payee name
 *     are in the file or its source and stay out of every answer and every KV copy.
 *   - A payload whose checksum fails is refused, copied never repaired (stmt/paycrc.js is Salt QR's own rule, generated).
 *   - The last good read is filed in Counter KV `paycodes` ({v: 1, at, accounts}) and answered when the binding fails or answers badly,
 *     only while it is under three days old. SUSPENSIONS ARE NEVER CACHED HERE: they come from a fresh /state.json (stmt/paystate.js) or
 *     the flags baked into stmt/pay.js, as before.
 * Nothing here imports anything but siblings.
 */
import { PAY_ACCOUNTS } from "./pay.js";
import { payloadError } from "./paycrc.js";
import { STATE_WAIT_MS } from "./paystate.js";

export const PAYCODES_KEY = "paycodes";
export const KEEP_MS = 3 * 864e5;   /* a copy older than this is never answered */
const REFILE_MS = 6 * 36e5;         /* a good read re-files the copy when it differs or is this old */
const ANCHOR = /self\.QR_CODES = ([\s\S]*?);\nself\.QR_BUILD/;
export const NUM_RE = /^[0-9]{10,15}$/;
const BILLER_RE = /^[0-9A-Za-z]{1,12}$/, REF1_RE = /^[0-9A-Za-z-]{1,30}$/;

/** One account's six fields, each only if well formed: the key, then what the rails need. null for a key the rails lack. */
export function cleanOne(x, list = PAY_ACCOUNTS) {
  if (!x || typeof x !== "object" || typeof x.key !== "string" || !list.some((a) => a.key === x.key)) return null;
  const out = { key: x.key };
  if (typeof x.payload === "string" && x.payload && payloadError(x.payload) === null) out.payload = x.payload;
  if (typeof x.acct === "string" && NUM_RE.test(x.acct.replace(/\s+/g, ""))) out.acct = x.acct.replace(/\s+/g, "");
  if (typeof x.bank === "string" && x.bank && x.bank.length <= 80) out.bank = x.bank;
  if (typeof x.biller === "string" && BILLER_RE.test(x.biller)) out.biller = x.biller;
  if (typeof x.ref1 === "string" && REF1_RE.test(x.ref1)) out.ref1 = x.ref1;
  return out;
}

/** The list of accounts the page may be told about, whitelisted; each key once (the first). */
export function cleanList(arr, list = PAY_ACCOUNTS) {
  const out = [], seen = new Set();
  if (!Array.isArray(arr)) return out;
  for (const x of arr) {
    const c = cleanOne(x, list);
    if (c && !seen.has(c.key)) { seen.add(c.key); out.push(c); }
  }
  return out;
}

/** The accounts out of Salt QR's /data.js text; null when the anchor is missing or the array is not JSON. */
export function codesOf(text, list = PAY_ACCOUNTS) {
  if (typeof text !== "string") return null;
  const m = ANCHOR.exec(text);
  if (!m) return null;
  let arr; try { arr = JSON.parse(m[1]); } catch (e) { return null; }
  return Array.isArray(arr) ? cleanList(arr, list) : null;
}

/** The accounts as the Counter may answer them: through the same whitelist whatever the source (Salt QR, the KV copy, a fixture). null when unreadable. */
export async function payCodes(env, list = PAY_ACCOUNTS, now = Date.now()) {
  let fresh = null;
  if (env && env.QRCMD && typeof env.QRCMD.fetch === "function") {
    try {
      const r = await env.QRCMD.fetch("https://qr-command/data.js", { headers: { "cache-control": "no-store" }, signal: AbortSignal.timeout(STATE_WAIT_MS) });
      if (r.ok) fresh = codesOf(await r.text(), list);
    } catch (e) { fresh = null; }
  }
  if (fresh && fresh.length) {
    try {
      const prev = await env.STMT.get(PAYCODES_KEY, "json");
      const same = prev && prev.v === 1 && JSON.stringify(prev.accounts) === JSON.stringify(fresh) && typeof prev.at === "number" && now - prev.at < REFILE_MS;
      if (!same) await env.STMT.put(PAYCODES_KEY, JSON.stringify({ v: 1, at: now, accounts: fresh }));
    } catch (e) { /* a copy that cannot be filed is no reason to refuse the read */ }
    return fresh;
  }
  try {
    const rec = await env.STMT.get(PAYCODES_KEY, "json");
    if (rec && rec.v === 1 && typeof rec.at === "number" && now - rec.at < KEEP_MS && rec.at - now < 6e4) return cleanList(rec.accounts, list);
  } catch (e) { /* no copy */ }
  return null;
}

/** What GET /pay/accounts answers: per account not suspended, only what its rails need.
 *  qr the payload (rail qr); number and bank (rail transfer); biller and ref1 (rail jompay, both or neither). `list` carries the live flags. */
export function shapeAccounts(codes, list = PAY_ACCOUNTS) {
  const out = {};
  if (!Array.isArray(codes)) return out;
  for (const a of list) {
    if (a.maintenance) continue;
    const c = codes.find((x) => x.key === a.key);
    if (!c) continue;
    const o = {};
    if (a.qr && c.payload) o.qr = c.payload;
    if (a.transfer && c.acct) { o.number = c.acct; o.bank = c.bank || a.bank; }
    if (a.jompay && c.biller && c.ref1) { o.biller = c.biller; o.ref1 = c.ref1; }
    if (Object.keys(o).length) out[a.key] = o;
  }
  return out;
}
