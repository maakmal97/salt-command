const DAY_MS = 86400000;
const CLOCK_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

const toMinutes = (value) => {
  const match = CLOCK_RE.exec(String(value || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};


/** 20 Oct 2026 (his word, canvas V63): THE ONE RULE OF THE WEEKLY HOURS. A day's span runs from its open to its close, and a close
 *  earlier than the open is the next day's (Fri 09:00 to 02:00 is open until Sat 02:00). The open stretches between lo and hi, in
 *  ms, as [from, to] pairs in order, touching or overlapping spans merged into one, so nothing counts a minute twice. `days` is
 *  seven of {open, close} as "HH:MM" strings or null, Sunday first, Kuala Lumpur time. openAt, the next open and the next change,
 *  openMinutes and the delivery windows (stmt/window.js slotSpan) all read it. ES5 and calls nothing outside itself: the Counter's
 *  page carries its source beside slotSpan, so no backslash, backtick, arrow function, let or const. */
export function openParts(days, lo, hi) {
  var H = 3600000, D = 24 * H, parts = [], out = [];
  if (!days || days.length !== 7 || !(hi > lo)) return out;
  function partMin(t) { var x = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(String(t || "")); return x ? (+x[1]) * 60 + (+x[2]) : null; }
  var l = new Date(lo + 8 * H), s = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - 8 * H - D;
  for (var n = 0; s < hi && n < 400; s += D, n++) {
    var d = days[new Date(s + 8 * H).getUTCDay()], o = d ? partMin(d.open) : null, c = d ? partMin(d.close) : null;
    if (o === null || c === null || c === o) continue;
    var a = s + o * 60000, b = s + (c < o ? c + 1440 : c) * 60000;
    if (a < lo) a = lo;
    if (b > hi) b = hi;
    if (b > a) parts.push([a, b]);
  }
  parts.sort(function (p, q) { return p[0] - q[0]; });
  for (var i = 0; i < parts.length; i++) {
    var last = out.length ? out[out.length - 1] : null;
    if (last && parts[i][0] <= last[1]) { if (parts[i][1] > last[1]) last[1] = parts[i][1]; }
    else out.push([parts[i][0], parts[i][1]]);
  }
  return out;
}

function openAt(schedule, at) {
  if (!schedule) return true;
  return openParts(schedule.days, at, at + 1).length > 0;
}

function nextScheduleOpen(schedule, at) {
  if (!schedule) return null;
  const part = openParts(schedule.days, at, at + 15 * DAY_MS).find((p) => p[0] > at);
  return part ? new Date(part[0]).toISOString() : null;
}

function nextScheduleChange(schedule, at) {
  if (!schedule) return null;
  const times = [];
  for (const [open, close] of openParts(schedule.days, at, at + 8 * DAY_MS)) {
    if (open > at) times.push(open);
    if (close > at) times.push(close);
  }
  times.sort((a, b) => a - b);
  const change = times.find((time) => openAt(schedule, time) !== openAt(schedule, time - 1));
  return change == null ? null : new Date(change).toISOString();
}

export function validateWeeklyHours(value) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => key !== "days")
    || !Array.isArray(value.days) || value.days.length !== 7)
    return { error: "Set hours or mark closed for each day of the week." };
  const days = [];
  for (const day of value.days) {
    if (day === null) { days.push(null); continue; }
    if (!day || typeof day !== "object" || Array.isArray(day) || Object.keys(day).some((key) => !["open", "close"].includes(key)))
      return { error: "Each day must be closed or have opening and closing times." };
    const start = toMinutes(day.open), end = toMinutes(day.close);
    if (start === null || end === null) return { error: "Use valid 24-hour times." };
    /* 20 Oct 2026 (his word): a close earlier than the open is the next day's; the same time is refused, never read as all day */
    if (start === end) return { error: "A day cannot open and close at the same time." };
    days.push({ open: String(day.open), close: String(day.close), start, end });
  }
  /* a span past midnight ends before the next day opens (Saturday's into Sunday too); touching is one open stretch */
  for (let i = 0; i < 7; i++) {
    const d = days[i], next = days[(i + 1) % 7];
    if (d && next && d.end < d.start && next.start < d.end)
      return { error: "A day cannot open before the day before it closes." };
  }
  return { days };
}

export function validateManualHours(value, now = Date.now()) {
  if (!value || typeof value !== "object" || Object.keys(value).some((key) => !["open", "until"].includes(key))
    || typeof value.open !== "boolean" || typeof value.until !== "string")
    return { error: "Choose whether the Counter is open or closed." };
  const until = Date.parse(value.until);
  if (!Number.isFinite(until) || until <= now || until > now + 14 * DAY_MS)
    return { error: "Set an end time within the next 14 days." };
  return { open: value.open, until: new Date(until).toISOString() };
}

export const HOURS_KEY = "maker:hours";

/** The hours as a delivery window reads them (stmt/window.js), from Salt Admin's store: {schedule, manual}, each null
 *  when unset. A store that cannot be read, or holds what no longer validates, reads as none set, every window open, so a
 *  fault in the hours never stops an order (as the page's own note says, "you can still place an order"). */
export async function hoursConfig(env) {
  let value = null;
  try { value = env && env.STMT ? await env.STMT.get(HOURS_KEY, "json") : null; } catch (e) { value = null; }
  return windowHours(value);
}
/** The two parts of the stored hours a window reads, checked: the weekly days and a manual override still well formed. */
export function windowHours(value) {
  if (!value || typeof value !== "object") return { schedule: null, manual: null };
  const days = value.schedule != null ? validateWeeklyHours(value.schedule) : null;
  const m = value.manual;
  const manual = m && typeof m === "object" && typeof m.open === "boolean" && typeof m.until === "string" && Number.isFinite(Date.parse(m.until))
    ? { open: m.open, until: new Date(Date.parse(m.until)).toISOString() } : null;
  return { schedule: days && !days.error ? { days: days.days.map((d) => d && { open: d.open, close: d.close }) } : null, manual };
}

/** 20 Oct 2026 (his answer): the minutes the Counter was open between two moments, on the weekly hours as they stand and with no manual
 *  override, as stmt/confirm.js measures "in Counter hours"; with no weekly hours filed it is open at every moment. Salt Admin's waited
 *  meter reads it off the review answer, so an order placed while closed counts from opening. */
export function openMinutes(config, from, to) {
  if (!(Number.isFinite(from) && Number.isFinite(to) && to > from)) return 0;
  const parsed = !config || config.schedule == null ? { days: null } : validateWeeklyHours(config.schedule);
  if (parsed.error) throw new TypeError(parsed.error);
  if (!parsed.days) return (to - from) / 60000;
  return openParts(parsed.days, from, to).reduce((sum, [a, b]) => sum + b - a, 0) / 60000;
}

export function hoursStatus(config, at = Date.now()) {
  const parsed = !config || config.schedule == null ? { days: null } : validateWeeklyHours(config.schedule);
  if (parsed.error) throw new TypeError(parsed.error);
  const schedule = parsed.days ? { days: parsed.days } : null;
  const manual = config && config.manual;
  const manualUntil = manual && Date.parse(manual.until);
  const manualActive = !!manual && typeof manual.open === "boolean" && Number.isFinite(manualUntil) && manualUntil > at;
  const open = manualActive ? manual.open : openAt(schedule, at);
  const nextChange = manualActive ? new Date(manualUntil).toISOString() : nextScheduleChange(schedule, at);
  let nextOpen = null;
  if (!open) {
    if (manualActive && manual.open === false && openAt(schedule, manualUntil)) nextOpen = new Date(manualUntil).toISOString();
    else nextOpen = nextScheduleOpen(schedule, manualActive ? manualUntil : at);
  }
  return { open, source: manualActive ? "manual" : schedule ? "schedule" : "default", nextChange, nextOpen };
}
