/* stmt/paynum.js: THE ACCOUNT NUMBERS THE PAY SHEET SHOWS (Phase 7b, his yes of 11 Oct 2026).
 *
 * The sheet shows the account number of the bank a customer chose, in groups of four with Copy, above the reference. The number is
 * NEVER in git: the repo is public (rule 3) and stmt/pay.js ships names and rails only. It lives in this Worker's KV, key `paynum`,
 * written from the laptop by `node tools/paysync.mjs --numbers` under his own login: {v: 1, at, accounts: {<key>: {number}}}.
 * GET /pay/accounts, on a customer's session alone (stmt/worker.js), answers it through `numbersOf`, which is the whitelist:
 *   - a key only if stmt/pay.js names it with the transfer rail and it is not suspended, so a number for an account the page would
 *     not offer is never served;
 *   - a number only if it is 10 to 15 digits, the writer's own rule;
 *   - `number` and nothing else, so a field added to the record by mistake (a holder, an owner, a payee, a payload) never leaves.
 * Nothing here imports anything but the generated rails.
 */
import { PAY_ACCOUNTS } from "./pay.js";

export const PAYNUM_KEY = "paynum";
export const NUM_RE = /^[0-9]{10,15}$/;

/** {key: {number}} from a `paynum` record: only the accounts the page offers for a transfer, only a well-formed number, only `number`. */
export function numbersOf(rec, list = PAY_ACCOUNTS) {
  const out = {}, a = rec && typeof rec === "object" && rec.v === 1 ? rec.accounts : null;
  if (!a || typeof a !== "object" || Array.isArray(a)) return out;
  for (const acct of list) {
    if (!acct.transfer || acct.maintenance || !Object.prototype.hasOwnProperty.call(a, acct.key)) continue;
    const x = a[acct.key];
    if (x && typeof x === "object" && typeof x.number === "string" && NUM_RE.test(x.number)) out[acct.key] = { number: x.number };
  }
  return out;
}

/** The numbers as KV holds them, or {} while none are filed or when the read fails. */
export async function payNumbers(env) {
  let r = null;
  try { r = await env.STMT.get(PAYNUM_KEY, "json"); } catch (e) { r = null; }
  return numbersOf(r);
}
