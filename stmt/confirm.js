/* stmt/confirm.js: USUALLY CONFIRMED WITHIN (Counter Batch C, item 19; his answers of 18 and 20 Oct 2026).
 *
 * One site-wide figure: the median time from Place to his Accept over his last 30 confirmations made in Counter hours, rounded
 * up to the next quarter hour, never under 15 minutes, and none under 10 confirmations. The hourly cron measures it from the
 * order book and files it at KV confirm:within as {mins, n, at}; GET /hours carries {mins, n} while it is under three hours
 * old (stmt/maker.js publicHours), so a stuck cron shows nothing rather than an old figure. It names nobody and prices nothing.
 *
 * In Counter hours: both moments inside the weekly hours as they stand now (hoursStatus with no manual override, which would
 * recolour past moments), each moment passed as a number. Left out: any order with a price (an ask haggled before Accept, or an
 * Accept sent to them as an offer), a group order, the test accounts, and an order never accepted. A replacement is measured
 * from the root of its chain, walked back over every order and falling back to its own placing on a missing link or a loop. */
import { hoursStatus } from "./hours.js";
import { isTest } from "./testusers.js";

export const CONFIRM_KEY = "confirm:within";
export const CONFIRM_LAST = 30;
export const CONFIRM_MIN = 10;
export const CONFIRM_STEP = 15;
export const CONFIRM_FRESH_MS = 3 * 3600e3;

const ms = (s) => { const t = Date.parse(String(s || "")); return Number.isFinite(t) ? t : null; };
/** The first acknowledgement on an order's history, as a number, or null. */
export const acceptedAt = (o) => {
  const h = ((o && o.history) || []).find((x) => x && x.status === "acknowledged");
  return h ? ms(h.at) : null;
};
/** When the chain an order ends was first placed: its root's placing, or its own on a missing link or a loop. */
export function placedAt(o, byId) {
  const seen = new Set([o.id]);
  let cur = o;
  while (cur.replaces) {
    const prev = byId.get(cur.replaces);
    if (!prev || seen.has(prev.id)) return ms(o.at);
    seen.add(prev.id); cur = prev;
  }
  return ms(cur.at);
}
/** The median of a list of numbers, the mean of the middle two for an even count. */
export const median = (xs) => {
  const s = xs.slice().sort((a, b) => a - b), k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
};
/** Minutes up to the next quarter hour, never under one. */
export const quarterUp = (m) => Math.max(CONFIRM_STEP, Math.ceil(m / CONFIRM_STEP - 1e-9) * CONFIRM_STEP);

/** {mins, n} measured over `orders` (every order, cancelled ones included) on the weekly hours `cfg.schedule`, or null. */
export function confirmWithin(orders, cfg) {
  const list = (orders || []).filter((o) => o && typeof o.id === "string" && o.kind !== "pool");
  const byId = new Map(list.map((o) => [o.id, o]));
  const sched = { schedule: cfg && cfg.schedule != null ? cfg.schedule : null, manual: null };
  const inHours = (t) => hoursStatus(sched, t).open;
  const taken = [];
  for (const o of list) {
    if (o.price || o.pool || isTest(o.u)) continue;
    const acc = acceptedAt(o), placed = placedAt(o, byId);
    if (acc === null || placed === null || acc < placed) continue;
    if (!inHours(placed) || !inHours(acc)) continue;
    taken.push({ acc, mins: (acc - placed) / 60000 });
  }
  if (taken.length < CONFIRM_MIN) return null;
  const last = taken.sort((a, b) => b.acc - a.acc).slice(0, CONFIRM_LAST);
  return { mins: quarterUp(median(last.map((x) => x.mins))), n: last.length };
}

/** What GET /hours carries of a filed figure: {mins, n} while fresh and whole, else nothing. */
export function confirmView(v, now = Date.now()) {
  if (!v || typeof v !== "object") return null;
  const at = ms(v.at);
  if (at === null || now - at > CONFIRM_FRESH_MS || now < at - 60000) return null;
  if (!Number.isInteger(v.mins) || v.mins < CONFIRM_STEP || !Number.isInteger(v.n) || v.n < CONFIRM_MIN || v.n > CONFIRM_LAST) return null;
  return { mins: v.mins, n: v.n };
}
