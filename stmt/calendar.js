/* stmt/calendar.js: HIS CALENDAR OF MARKS (salt price band version 3, 13 Nov 2026). A mark is a name and the days it runs, { id, name, from, to }, such as
 * Hari Raya or a school holiday; the engine's `calendarLift` measures each against the 28 days before it. Counter KV `calendar`, { v: 1, list }, sixty at
 * most, written by Salt Admin alone (stmt/maker.js, the verified owner) and read by the Desk (GET /desk/calendar). It prices nothing, so a mark stands the
 * moment it is added or removed: there is no Approve. */

export const CAL_KEY = "calendar";
export const CAL_MAX = 60;
export const CAL_DAYS = 365;
const DAY = 864e5;
const dayNo = (s) => Math.round(Date.parse(s + "T00:00:00Z") / DAY);
const real = (s) => typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

/** One mark checked against today (a Kuala Lumpur day): { mark } or { error }. */
export function validateMark(m, today) {
  if (!m || typeof m !== "object" || Array.isArray(m) || Object.keys(m).some((k) => !["name", "from", "to"].includes(k)))
    return { error: "A mark is a name and the days it runs, nothing else." };
  const name = typeof m.name === "string" ? m.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 30 || /[<>]/.test(name)) return { error: "A mark's name is 2 to 30 characters, with no < or >." };
  if (!real(m.from) || !real(m.to)) return { error: "A mark's days are real dates, YYYY-MM-DD." };
  if (m.to < m.from) return { error: "A mark ends on or after the day it starts." };
  if (dayNo(m.to) > dayNo(today) + CAL_DAYS || dayNo(m.from) < dayNo(today) - CAL_DAYS) return { error: "A mark runs within a year of today." };
  return { mark: { name, from: m.from, to: m.to } };
}

/** A stored list read back, checked; anything that does not hold reads as none. */
export function calendarOf(value) {
  const list = value && typeof value === "object" && Array.isArray(value.list) ? value.list : [];
  return { v: 1, list: list.filter((x) => x && typeof x.id === "string" && /^[0-9a-f]{12}$/.test(x.id) && typeof x.name === "string" && real(x.from) && real(x.to)).slice(0, CAL_MAX)
    .map((x) => ({ id: x.id, name: x.name, from: x.from, to: x.to })) };
}

export async function readCalendar(env) {
  let value = null;
  try { value = env && env.STMT ? await env.STMT.get(CAL_KEY, "json") : null; } catch (e) { value = null; }
  return calendarOf(value);
}

/** An add or a remove applied to a list: { cal } or { error }. */
export function applyCalendar(cal, body, today, mint) {
  if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !["add", "remove"].includes(Object.keys(body)[0]))
    return { error: "Send one thing: add a mark or remove one." };
  if (body.remove !== undefined) {
    if (typeof body.remove !== "string" || !cal.list.some((x) => x.id === body.remove)) return { error: "That mark is not on the calendar." };
    return { cal: { v: 1, list: cal.list.filter((x) => x.id !== body.remove) } };
  }
  if (cal.list.length >= CAL_MAX) return { error: "Sixty marks at most." };
  const r = validateMark(body.add, today);
  if (r.error) return r;
  return { cal: { v: 1, list: cal.list.concat([{ id: mint(), ...r.mark }]) } };
}
