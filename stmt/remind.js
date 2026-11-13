/* PRICE BAND VERSION 3: THE REMINDER TO A LATE REGULAR (his answers of 13 Nov 2026). One automatic wake a cycle to a regular who is late or
 * lapsed and owes nothing, in his plain words "Time for more?" and "Your usual is one tap away." (news.remind and its body): no product word, no figure, no name.
 * The publish writes KV `remind` = {username: last order day} (tools/stmt-publish.mjs remindMap); the hourly cron sends here once a day at
 * 10:00 Kuala Lumpur. A CYCLE IS THE LAST ORDER DAY: `reminded:<username>` holds the day it was reminded for, written BEFORE the send (a tick
 * firing twice sends once), and a new order moves the day, so the next cycle is reminded again. Never a practice account, never one the chase
 * is waking this hour (goods unpaid). The wake opens Order at their usual (#again). */
import { isTest } from "./testusers.js";
import { wakeCustomer } from "./push.js";
import { ordersOf, OPEN_STATES } from "./orders.js";

export const REMIND_HOUR = 10;
export const REMIND_TTL = 120 * 86400;
const DAY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const klHour = (now) => new Date(now.getTime() + 8 * 3600000).getUTCHours();

/** Send the day's reminders. `skip` is the set of usernames the chase is waking this slot. Returns the counts; never throws on one customer. */
export async function sendReminders(env, now, skip, wake = wakeCustomer) {
  const out = { sent: 0, quiet: 0, held: 0 };
  if (klHour(now) !== REMIND_HOUR || !env.STMT) return out;
  let map = null;
  try { map = await env.STMT.get("remind", "json"); } catch { map = null; }
  if (!map || typeof map !== "object") return out;
  for (const [u, day] of Object.entries(map)) {
    if (!DAY_RE.test(String(day)) || isTest(u) || (skip && skip.has(u))) continue;
    /* an order of theirs open (placed, agreed or ready) is their next order already on its way: nothing sent, nothing marked */
    let mine = [];
    try { mine = await ordersOf(env, u); } catch { mine = []; }
    if (mine.some((o) => OPEN_STATES.includes(o.status))) { out.open = (out.open || 0) + 1; continue; }
    const key = "reminded:" + u;
    let was = null;
    try { was = await env.STMT.get(key); } catch { was = null; }
    if (was === day) { out.held++; continue; }
    await env.STMT.put(key, day, { expirationTtl: REMIND_TTL });
    const r = await wake(env, u, { k: "remind", o: "" });
    if (r && r.sent) out.sent++; else out.quiet++;
  }
  return out;
}
